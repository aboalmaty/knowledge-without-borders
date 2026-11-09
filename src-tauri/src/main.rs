#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod db;

use db::{AppState, SaveBenefitInput, SaveCategoryInput, SaveTranslationInput};
use std::path::PathBuf;
use tauri::{Manager, State};
use chrono::Local;
use uuid::Uuid;

#[tauri::command]
fn get_dashboard(state: State<'_, AppState>) -> Result<db::Dashboard, String> {
    db::get_dashboard(&state.db_path)
}

#[tauri::command]
fn list_categories(state: State<'_, AppState>) -> Result<Vec<db::Category>, String> {
    db::list_categories(&state.db_path)
}

#[tauri::command]
fn save_category(state: State<'_, AppState>, input: SaveCategoryInput) -> Result<db::Category, String> {
    db::save_category(&state.db_path, input)
}

#[tauri::command]
fn delete_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    db::delete_category(&state.db_path, id)
}

#[tauri::command]
fn list_benefits(state: State<'_, AppState>, search: String, category_id: Option<String>) -> Result<Vec<db::BenefitSummary>, String> {
    db::list_benefits(&state.db_path, search, category_id)
}

#[tauri::command]
fn get_benefit(state: State<'_, AppState>, id: String) -> Result<db::Benefit, String> {
    db::get_benefit(&state.db_path, id)
}

#[tauri::command]
fn save_benefit(state: State<'_, AppState>, input: SaveBenefitInput) -> Result<db::BenefitSummary, String> {
    db::save_benefit(&state.db_path, input)
}

#[tauri::command]
fn delete_benefit(state: State<'_, AppState>, id: String) -> Result<(), String> {
    db::delete_benefit(&state.db_path, id)
}

#[tauri::command]
fn save_translation(state: State<'_, AppState>, input: SaveTranslationInput) -> Result<db::Translation, String> {
    db::save_translation(&state.db_path, input)
}

#[tauri::command]
fn export_bundle(state: State<'_, AppState>, benefit_ids: Vec<String>) -> Result<serde_json::Value, String> {
    db::export_bundle(&state.db_path, benefit_ids)
}

#[tauri::command]
fn export_bundle_file(app: tauri::AppHandle, state: State<'_, AppState>, benefit_ids: Vec<String>) -> Result<String, String> {
    let bundle = db::export_bundle(&state.db_path, benefit_ids)?;
    let dir = match app.path().download_dir() {
        Ok(path) => path,
        Err(_) => app.path().app_data_dir().map_err(|e| e.to_string())?,
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let filename = format!("KWB-Library-{}-{}.kwb", Local::now().format("%Y%m%d-%H%M%S"), &Uuid::new_v4().to_string()[..8]);
    let output = dir.join(filename);
    let json = serde_json::to_vec_pretty(&bundle).map_err(|e| e.to_string())?;
    std::fs::write(&output, json).map_err(|e| e.to_string())?;
    Ok(output.to_string_lossy().to_string())
}

#[tauri::command]
fn import_bundle(state: State<'_, AppState>, bundle_text: String, sender_name: String) -> Result<db::ImportResult, String> {
    db::import_bundle(&state.db_path, bundle_text, sender_name)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only HTTP and HTTPS links can be opened".into());
    }
    open::that(url).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir: PathBuf = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("knowledge-without-borders.sqlite3");
            db::initialize(&db_path).map_err(std::io::Error::other)?;
            app.manage(AppState { db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            list_categories,
            save_category,
            delete_category,
            list_benefits,
            get_benefit,
            save_benefit,
            delete_benefit,
            save_translation,
            export_bundle,
            export_bundle_file,
            import_bundle,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("error while running Knowledge Without Borders");
}
