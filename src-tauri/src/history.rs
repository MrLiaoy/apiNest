//! 伴生历史文件：<集合名>.apix.history.json
//! 结构由前端定义（docs/开发计划.md §3.2），Rust 只负责读写与条数淘汰。

use std::fs;
use std::path::Path;

const MAX_ENTRIES: usize = 500;

fn history_path(collection_path: &str) -> String {
    match collection_path.strip_suffix(".json") {
        Some(stem) => format!("{stem}.apix.history.json"),
        None => format!("{collection_path}.history.json"),
    }
}

fn empty_history() -> String {
    "{\"version\":1,\"entries\":[]}".to_string()
}

#[tauri::command]
pub fn read_history(collection_path: String) -> Result<String, String> {
    Ok(fs::read_to_string(history_path(&collection_path)).unwrap_or_else(|_| empty_history()))
}

#[tauri::command]
pub fn append_history(collection_path: String, entry: String) -> Result<(), String> {
    let hp = history_path(&collection_path);
    let mut root: serde_json::Value = match fs::read_to_string(&hp) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_else(|_| {
            serde_json::from_str(&empty_history()).expect("static json")
        }),
        Err(_) => serde_json::from_str(&empty_history()).expect("static json"),
    };
    let entry_val: serde_json::Value =
        serde_json::from_str(&entry).map_err(|e| e.to_string())?;
    if let Some(entries) = root.get_mut("entries").and_then(|v| v.as_array_mut()) {
        entries.push(entry_val);
        let len = entries.len();
        if len > MAX_ENTRIES {
            entries.drain(..len - MAX_ENTRIES);
        }
    }
    if let Some(parent) = Path::new(&hp).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(
        &hp,
        serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(collection_path: String) -> Result<(), String> {
    fs::write(history_path(&collection_path), empty_history()).map_err(|e| e.to_string())
}
