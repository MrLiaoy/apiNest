use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

const MAX_BODY: usize = 5 * 1024 * 1024; // 5MB 截断保护
const TIMEOUT_SECS: u64 = 30;

#[derive(Deserialize, Serialize)]
pub struct HeaderPair {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
pub struct FileField {
    pub name: String,
    pub path: String,
}

/// 请求体载荷（type 标签枚举，与前端 SendOptions 对齐）
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum BodyPayload {
    None,
    Json { content: String },
    Form { rows: Vec<HeaderPair>, files: Vec<FileField> },
    Urlencoded { content: String },
    Raw { content: String },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOptions {
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderPair>,
    pub body: BodyPayload,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<HeaderPair>,
    pub duration_ms: u64,
    pub size_bytes: u64,
    pub body_text: String,
    pub truncated: bool,
}

#[derive(Serialize)]
pub struct SendError {
    /// 前端按错误码查 i18n 文案：error.timeout / error.connect / ...
    pub code: String,
    pub detail: String,
}

impl SendError {
    pub fn new(code: &str, detail: String) -> Self {
        Self { code: code.into(), detail }
    }
}

pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .expect("failed to build http client")
    })
}

fn map_reqwest_err(e: reqwest::Error) -> SendError {
    let code = if e.is_timeout() {
        "timeout"
    } else if e.is_connect() {
        "connect"
    } else if e.is_decode() {
        "decode"
    } else if e.is_builder() {
        "builder"
    } else {
        "unknown"
    };
    SendError::new(code, e.to_string())
}

#[tauri::command]
pub async fn send_request(opts: SendOptions) -> Result<SendResponse, SendError> {
    let method = reqwest::Method::from_bytes(opts.method.as_bytes())
        .map_err(|_| SendError::new("method", opts.method.clone()))?;
    let url = reqwest::Url::parse(&opts.url)
        .map_err(|e| SendError::new("url", e.to_string()))?;

    let user_ct = opts
        .headers
        .iter()
        .any(|h| h.key.eq_ignore_ascii_case("content-type") && !h.value.trim().is_empty());

    let mut req = client().request(method, url);
    for h in &opts.headers {
        if h.key.trim().is_empty() {
            continue;
        }
        req = req.header(h.key.as_str(), h.value.as_str());
    }

    match &opts.body {
        BodyPayload::None => {}
        BodyPayload::Json { content } => {
            if !user_ct {
                req = req.header(reqwest::header::CONTENT_TYPE, "application/json");
            }
            req = req.body(content.clone());
        }
        BodyPayload::Urlencoded { content } => {
            if !user_ct {
                req = req.header(
                    reqwest::header::CONTENT_TYPE,
                    "application/x-www-form-urlencoded",
                );
            }
            req = req.body(content.clone());
        }
        BodyPayload::Raw { content } => {
            req = req.body(content.clone());
        }
        BodyPayload::Form { rows, files } => {
            let mut form = reqwest::multipart::Form::new();
            for r in rows {
                if !r.key.trim().is_empty() {
                    form = form.text(r.key.clone(), r.value.clone());
                }
            }
            for f in files {
                let bytes = tokio::fs::read(&f.path)
                    .await
                    .map_err(|e| SendError::new("file", format!("{}: {e}", f.path)))?;
                let filename = Path::new(&f.path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| f.name.clone());
                let part = reqwest::multipart::Part::bytes(bytes)
                    .file_name(filename)
                    .mime_str("application/octet-stream")
                    .map_err(|e| SendError::new("file", e.to_string()))?;
                form = form.part(f.name.clone(), part);
            }
            req = req.multipart(form);
        }
    }

    let start = Instant::now();
    let resp = req.send().await.map_err(map_reqwest_err)?;
    let status = resp.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers: Vec<HeaderPair> = resp
        .headers()
        .iter()
        .map(|(k, v)| HeaderPair {
            key: k.as_str().to_string(),
            value: v.to_str().unwrap_or("").to_string(),
        })
        .collect();
    let bytes = resp.bytes().await.map_err(map_reqwest_err)?;
    let duration_ms = start.elapsed().as_millis() as u64;
    let size_bytes = bytes.len() as u64;

    let truncated = bytes.len() > MAX_BODY;
    let body_text = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_BODY)]).to_string();

    Ok(SendResponse {
        status: status.as_u16(),
        status_text,
        headers,
        duration_ms,
        size_bytes,
        body_text,
        truncated,
    })
}
