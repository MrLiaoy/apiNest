use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::Manager;

/// 读取集合文件并校验 JSON 合法性（结构细节由前端按模型归一化）
#[tauri::command]
pub fn read_collection(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("invalid collection json: {e}"))?;
    Ok(content)
}

/// 写集合文件；覆盖已有文件前自动备份 .bak
#[tauri::command]
pub fn write_collection(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if p.exists() {
        let bak = p.with_extension("bak");
        let _ = fs::copy(p, bak);
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

/// 确保目录存在
#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// 通用写文本文件（导出用，不做 .bak 备份）
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 读取导入源：.json 直接返回文本；.zip 解压后寻找 Postman/Apifox 集合 JSON
#[tauri::command]
pub fn read_import_source(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    if path.to_lowercase().ends_with(".zip") {
        let reader = std::io::Cursor::new(data);
        let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
        let mut best: Option<(usize, String)> = None;
        for i in 0..archive.len() {
            let mut f = archive.by_index(i).map_err(|e| e.to_string())?;
            if !f.name().to_lowercase().ends_with(".json") {
                continue;
            }
            let mut content = String::new();
            f.read_to_string(&mut content).map_err(|e| e.to_string())?;
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                let is_collection = v.get("info").is_some() && v.get("item").is_some();
                if !is_collection {
                    continue;
                }
                let score = v
                    .get("item")
                    .and_then(|x| x.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0);
                if best.as_ref().map(|(s, _)| score > *s).unwrap_or(true) {
                    best = Some((score, content));
                }
            }
        }
        best.map(|(_, c)| c)
            .ok_or_else(|| "压缩包中未找到 Postman / Apifox 集合 JSON 文件".to_string())
    } else {
        String::from_utf8(data).map_err(|_| "不是有效的文本文件".to_string())
    }
}

// ===== 目录式集合存储（一个集合 = 一个目录） =====

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// 打开集合目录：返回骨架 apix.collection.json 文本
#[tauri::command]
pub fn open_collection_dir(dir: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&dir).join("apix.collection.json")).map_err(|e| e.to_string())
}

/// 读取单个请求定义
#[tauri::command]
pub fn read_request(dir: String, id: String) -> Result<String, String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    fs::read_to_string(Path::new(&dir).join("requests").join(format!("{id}.json")))
        .map_err(|e| e.to_string())
}

/// 写单个请求定义
#[tauri::command]
pub fn write_request(dir: String, id: String, content: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    let d = Path::new(&dir).join("requests");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    fs::write(d.join(format!("{id}.json")), content).map_err(|e| e.to_string())
}

/// 删除请求的定义与历史文件（移入回收站语义由 OS 决定，这里直接删）
#[tauri::command]
pub fn delete_request_files(dir: String, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    let base = Path::new(&dir);
    let _ = fs::remove_file(base.join("requests").join(format!("{id}.json")));
    let _ = fs::remove_file(base.join("history").join(format!("{id}.json")));
    Ok(())
}

/// 读取单请求历史
#[tauri::command]
pub fn read_request_history(dir: String, id: String) -> Result<String, String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    let file = Path::new(&dir).join("history").join(format!("{id}.json"));
    Ok(fs::read_to_string(&file).unwrap_or_else(|_| "{\"version\":1,\"entries\":[]}".into()))
}

/// 追加单请求历史（滚动上限 max 由设置传入）
#[tauri::command]
pub fn append_request_history(
    dir: String,
    id: String,
    entry: String,
    max: usize,
) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    let hp = Path::new(&dir).join("history");
    fs::create_dir_all(&hp).map_err(|e| e.to_string())?;
    let file = hp.join(format!("{id}.json"));
    let mut root: serde_json::Value = match fs::read_to_string(&file) {
        Ok(t) => serde_json::from_str(&t).unwrap_or_else(|_| {
            serde_json::json!({"version":1,"entries":[]})
        }),
        Err(_) => serde_json::json!({"version":1,"entries":[]}),
    };
    if let Some(entries) = root.get_mut("entries").and_then(|v| v.as_array_mut()) {
        if let Ok(ev) = serde_json::from_str::<serde_json::Value>(&entry) {
            entries.push(ev);
        }
        let len = entries.len();
        if len > max {
            entries.drain(..len - max);
        }
    }
    fs::write(
        &file,
        serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

/// 清空单请求历史
#[tauri::command]
pub fn clear_request_history(dir: String, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("invalid request id".into());
    }
    let hp = Path::new(&dir).join("history");
    fs::create_dir_all(&hp).map_err(|e| e.to_string())?;
    fs::write(
        hp.join(format!("{id}.json")),
        "{\"version\":1,\"entries\":[]}",
    )
    .map_err(|e| e.to_string())
}

/// 在工作区里为新集合分配一个不存在的目录名
#[tauri::command]
pub fn unique_collection_dir(workspace: String, name: String) -> String {    let safe: String = name
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let base = if safe.is_empty() { "collection".to_string() } else { safe };
    for i in 0..1000u32 {
        let dir_name = if i == 0 {
            base.clone()
        } else {
            format!("{base}-{i}")
        };
        let dir = Path::new(&workspace).join(&dir_name);
        if !dir.exists() {
            return dir.to_string_lossy().to_string();
        }
    }
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Path::new(&workspace)
        .join(format!("{base}-{secs}"))
        .to_string_lossy()
        .to_string()
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallLangResult {
    pub code: String,
    pub content: String,
}

/// 安装用户上传的语言包：校验格式 → 拷入 appData/locales/<code>.json
#[tauri::command]
pub fn install_language(app: tauri::AppHandle, src: String) -> Result<InstallLangResult, String> {
    let text = fs::read_to_string(&src).map_err(|e| e.to_string())?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("JSON 格式无效: {e}"))?;
    // 最小合法性：必须是对象且含 app.name（与内置 zh/en 同构）
    let ok = v
        .get("app")
        .and_then(|a| a.get("name"))
        .and_then(|n| n.as_str())
        .is_some();
    if !ok {
        return Err("缺少 \"app\": { \"name\": ... } 字段，不是有效的语言配置".into());
    }
    let stem = Path::new(&src)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("lang")
        .to_string();
    let code: String = stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if code.is_empty() {
        return Err("无法从文件名确定语言代码（如 fr.json → fr）".into());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("locales");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(
        dir.join(format!("{code}.json")),
        serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(InstallLangResult { code, content: text })
}

/// 在工作区目录里为新集合分配一个不重复的文件路径（集合名.json / 集合名-2.json / …）
#[tauri::command]
pub fn unique_collection_path(dir: String, name: String) -> String {
    let safe: String = name
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let base = if safe.is_empty() { "collection".to_string() } else { safe };
    for i in 0..1000u32 {
        let file = if i == 0 {
            format!("{base}.json")
        } else {
            format!("{base}-{i}.json")
        };
        let p = Path::new(&dir).join(&file);
        if !p.exists() {
            return p.to_string_lossy().to_string();
        }
    }
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Path::new(&dir)
        .join(format!("{base}-{secs}.json"))
        .to_string_lossy()
        .to_string()
}
