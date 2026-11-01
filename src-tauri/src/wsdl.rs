//! WSDL 解析（简化策略，见 docs/tasks/07）：
//! 支持常见 document/literal 场景 —— 解析 endpoint、操作列表、第一个操作的简单类型入参；
//! 复杂嵌套 Schema / include / import 不支持，退化为整段 XML 手填。

use quick_xml::events::attributes::Attributes;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

use crate::http::SendError;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsdlParam {
    pub name: String,
    pub type_name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WsdlOperation {
    pub name: String,
    pub soap_action: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WsdlInfo {
    pub endpoint: String,
    pub target_namespace: String,
    pub operation: String,
    pub soap_action: String,
    pub operations: Vec<WsdlOperation>,
    pub params: Vec<WsdlParam>,
}

/// 剥离命名空间前缀（quick-xml 0.42 的 QName as_ref() 返回 &str）
fn local(name: &str) -> &str {
    match name.rfind(':') {
        Some(i) => &name[i + 1..],
        None => name,
    }
}

#[derive(Default)]
struct State {
    target_ns: String,
    endpoint: String,
    // schema: 顶层 element -> 参数列表
    cur_schema_element: Option<String>,
    in_sequence: usize,
    elements: HashMap<String, Vec<(String, String)>>,
    // message -> part 的 element 引用
    cur_message: Option<String>,
    messages: HashMap<String, String>,
    // portType: 操作 -> input message
    cur_port_op: Option<String>,
    port_inputs: HashMap<String, String>,
    // binding
    in_binding: bool,
    cur_bind_op: Option<String>,
    bind_ops: Vec<(String, String)>,
    seen_ops: HashSet<String>,
}

/// 处理 Start / Empty（自闭合）事件的公共逻辑
fn handle_start(st: &mut State, ln: &str, mut attrs: Attributes) -> Result<(), String> {
    let mut attr_name: Option<String> = None;
    let mut attr_type: Option<String> = None;
    let mut attr_message: Option<String> = None;
    let mut attr_element: Option<String> = None;
    let mut attr_location: Option<String> = None;
    let mut attr_soap_action: Option<String> = None;

    for a in attrs.with_checks(false) {
        let a = a.map_err(|e| e.to_string())?;
        let v = {
            #[allow(deprecated)]
            a.unescape_value().map_err(|e| e.to_string())?.to_string()
        };
        match local(a.key.as_ref()) {
            "name" => attr_name = Some(v),
            "type" => attr_type = Some(v),
            "message" => attr_message = Some(v),
            "element" => attr_element = Some(v),
            "location" => attr_location = Some(v),
            "soapAction" => attr_soap_action = Some(v),
            "targetNamespace" => st.target_ns = v,
            _ => {}
        }
    }

    match ln {
        "address" => {
            if st.endpoint.is_empty() {
                if let Some(l) = attr_location {
                    st.endpoint = l;
                }
            }
        }
        "element" => {
            if let Some(n) = attr_name {
                if st.in_sequence > 0 {
                    if let Some(cur) = &st.cur_schema_element {
                        st.elements
                            .entry(cur.clone())
                            .or_default()
                            .push((n, attr_type.unwrap_or_default()));
                    }
                } else {
                    st.cur_schema_element = Some(n.clone());
                    st.elements.entry(n).or_default();
                }
            }
        }
        "message" => {
            st.cur_message = attr_name.clone();
        }
        "part" => {
            if let Some(msg) = &st.cur_message {
                if let Some(el) = attr_element.or(attr_type) {
                    st.messages.entry(msg.clone()).or_insert(el);
                }
            }
        }
        "input" => {
            if let Some(op) = &st.cur_port_op {
                if let Some(msg) = &attr_message {
                    st.port_inputs
                        .entry(op.clone())
                        .or_insert_with(|| msg.clone());
                }
            }
        }
        "operation" => {
            if let Some(action) = attr_soap_action {
                // <soap:operation soapAction="..."/>（绑定段）
                if st.in_binding {
                    if let Some(op) = &st.cur_bind_op {
                        if st.seen_ops.insert(op.clone()) {
                            st.bind_ops.push((op.clone(), action));
                        }
                    }
                }
            } else if let Some(n) = attr_name {
                if st.in_binding {
                    st.cur_bind_op = Some(n);
                } else {
                    st.cur_port_op = Some(n);
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn handle_end(st: &mut State, ln: &str) {
    match ln {
        "sequence" => st.in_sequence = st.in_sequence.saturating_sub(1),
        "element" => {
            if st.in_sequence == 0 {
                st.cur_schema_element = None;
            }
        }
        "message" => st.cur_message = None,
        "operation" => {
            st.cur_bind_op = None;
            st.cur_port_op = None;
        }
        "binding" => st.in_binding = false,
        _ => {}
    }
}

fn parse_wsdl_text(xml: &str) -> Result<WsdlInfo, String> {
    use quick_xml::events::Event;
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut st = State::default();
    loop {
        match reader.read_event().map_err(|e| e.to_string())? {
            Event::Start(e) => {
                let ln = local(e.name().as_ref()).to_string();
                match ln.as_str() {
                    "sequence" => st.in_sequence += 1,
                    "binding" => st.in_binding = true,
                    _ => {}
                }
                handle_start(&mut st, &ln, e.attributes())?;
            }
            Event::Empty(e) => {
                let ln = local(e.name().as_ref()).to_string();
                handle_start(&mut st, &ln, e.attributes())?;
            }
            Event::End(e) => {
                let ln = local(e.name().as_ref()).to_string();
                handle_end(&mut st, &ln);
            }
            Event::Eof => break,
            _ => {}
        }
    }

    // 操作列表：优先 binding（带 soapAction），退化用 portType + targetNamespace 拼接
    let mut operations: Vec<WsdlOperation> = st
        .bind_ops
        .iter()
        .map(|(n, a)| WsdlOperation {
            name: n.clone(),
            soap_action: a.clone(),
        })
        .collect();
    if operations.is_empty() {
        for (op, _msg) in st.port_inputs.iter() {
            operations.push(WsdlOperation {
                name: op.clone(),
                soap_action: format!("{}/{}", st.target_ns, op),
            });
        }
    }
    if operations.is_empty() {
        return Err("no operation found in WSDL".into());
    }

    // P0：取第一个操作，解析入参
    let first = &operations[0];
    let params: Vec<WsdlParam> = st
        .port_inputs
        .get(&first.name)
        .and_then(|msg| st.messages.get(msg))
        .map(|el| {
            let el_local = el.rsplit(':').next().unwrap_or(el).to_string();
            st.elements.get(&el_local).cloned().unwrap_or_default()
        })
        .unwrap_or_default()
        .into_iter()
        .map(|(name, type_name)| WsdlParam { name, type_name })
        .collect();

    Ok(WsdlInfo {
        endpoint: st.endpoint,
        target_namespace: st.target_ns,
        operation: first.name.clone(),
        soap_action: first.soap_action.clone(),
        operations,
        params,
    })
}

#[tauri::command]
pub async fn parse_wsdl(url: String) -> Result<WsdlInfo, SendError> {
    let resp = crate::http::client().get(&url).send().await.map_err(|e| {
        let code = if e.is_timeout() {
            "timeout"
        } else if e.is_connect() {
            "connect"
        } else {
            "unknown"
        };
        SendError::new(code, e.to_string())
    })?;
    if !resp.status().is_success() {
        return Err(SendError::new("wsdl", format!("HTTP {}", resp.status())));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| SendError::new("wsdl", e.to_string()))?;
    parse_wsdl_text(&text).map_err(|e| SendError::new("wsdl", e))
}
