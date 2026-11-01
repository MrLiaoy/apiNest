// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod collection;
mod history;
mod http;
mod wsdl;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 防多开：二次启动时聚焦已有窗口（必须最先注册）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            collection::read_collection,
            collection::write_collection,
            collection::ensure_dir,
            collection::unique_collection_path,
            collection::write_text_file,
            collection::read_import_source,
            collection::open_collection_dir,
            collection::read_request,
            collection::write_request,
            collection::delete_request_files,
            collection::read_request_history,
            collection::append_request_history,
            collection::clear_request_history,
            collection::unique_collection_dir,
            collection::install_language,
            http::send_request,
            wsdl::parse_wsdl,
            history::read_history,
            history::append_history,
            history::clear_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
