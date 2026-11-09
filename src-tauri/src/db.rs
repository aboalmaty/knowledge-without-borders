use chrono::{Datelike, Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use uuid::Uuid;

pub struct AppState { pub db_path: std::path::PathBuf }

fn connect(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}
fn now_string() -> String { Local::now().format("%Y-%m-%dT%H:%M:%S").to_string() }

pub fn initialize(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let conn = connect(path)?;
    let current_version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if current_version > 1 { return Err(format!("Database schema version {} is newer than this application", current_version)); }
    conn.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY NOT NULL,
            parent_id TEXT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
        CREATE TABLE IF NOT EXISTS benefits (
            id TEXT PRIMARY KEY NOT NULL,
            category_id TEXT NULL REFERENCES categories(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            content_html TEXT NOT NULL DEFAULT '',
            content_text TEXT NOT NULL DEFAULT '',
            search_text TEXT NOT NULL DEFAULT '',
            author TEXT NOT NULL DEFAULT '',
            book TEXT NOT NULL DEFAULT '',
            volume TEXT NOT NULL DEFAULT '',
            page TEXT NOT NULL DEFAULT '',
            source_language TEXT NOT NULL DEFAULT 'ar',
            owner_name TEXT NOT NULL DEFAULT '',
            sender_name TEXT NULL,
            imported_at TEXT NULL,
            created_at TEXT NOT NULL,
            added_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_benefits_category ON benefits(category_id);
        CREATE INDEX IF NOT EXISTS idx_benefits_added ON benefits(added_at);
        CREATE INDEX IF NOT EXISTS idx_benefits_imported ON benefits(imported_at);
        CREATE TABLE IF NOT EXISTS translations (
            id TEXT PRIMARY KEY NOT NULL,
            benefit_id TEXT NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
            language_code TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            content_html TEXT NOT NULL DEFAULT '',
            content_text TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            translator TEXT NOT NULL DEFAULT '',
            translated_at TEXT NOT NULL,
            UNIQUE(benefit_id, language_code)
        );
        CREATE INDEX IF NOT EXISTS idx_translations_benefit ON translations(benefit_id);
    "#).map_err(|e| e.to_string())?;
    if current_version == 0 { conn.pragma_update(None, "user_version", 1).map_err(|e| e.to_string())?; }
    Ok(())
}

fn strip_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len()); let mut in_tag = false; let mut last_space = false;
    for ch in html.chars() {
        match ch {
            '<' => { in_tag = true; if !last_space && !out.is_empty() { out.push(' '); last_space = true; } },
            '>' => { in_tag = false; },
            _ if !in_tag => { if ch.is_whitespace() { if !last_space { out.push(' '); last_space = true; } } else { out.push(ch); last_space = false; } },
            _ => {}
        }
    }
    out.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
        .replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
        .trim().to_string()
}
fn normalize_text(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        let mapped = match ch {
            'أ' | 'إ' | 'آ' | 'ٱ' => 'ا', 'ى' => 'ي', 'ؤ' => 'و', 'ئ' => 'ي', 'ـ' => continue,
            '\u{064B}'..='\u{065F}' | '\u{0670}' => continue, _ => ch,
        };
        out.extend(mapped.to_lowercase());
    }
    out
}
fn build_search_text(title: &str, content: &str, author: &str, book: &str, volume: &str, page: &str, owner: &str, categories: &str) -> String {
    normalize_text(&format!("{} {} {} {} {} {} {} {}", title, content, author, book, volume, page, owner, categories))
}

fn category_path_text(conn: &Connection, category_id: &Option<String>) -> Result<String, String> {
    let mut names = Vec::new();
    let mut current = category_id.clone();
    while let Some(id) = current {
        let row: Option<(String, Option<String>)> = conn.query_row(
            "SELECT name,parent_id FROM categories WHERE id=?1", [&id], |r| Ok((r.get(0)?,r.get(1)?))
        ).optional().map_err(|e|e.to_string())?;
        if let Some((name,parent)) = row { names.push(name); current = parent; } else { break; }
    }
    names.reverse();
    Ok(names.join(" "))
}

fn refresh_benefit_search(conn: &Connection, benefit_id: &str) -> Result<(), String> {
    let base: Option<(Option<String>,String,String,String,String,String,String,String,String)> = conn.query_row(
        "SELECT category_id,title,content_text,author,book,volume,page,owner_name,source_language FROM benefits WHERE id=?1",
        [benefit_id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?))
    ).optional().map_err(|e|e.to_string())?;
    let Some((category_id,title,content,author,book,volume,page,owner,_source_language)) = base else { return Ok(()); };
    let category_terms = category_path_text(conn, &category_id)?;
    let mut stmt = conn.prepare("SELECT title,content_text FROM translations WHERE benefit_id=?1").map_err(|e|e.to_string())?;
    let translations = stmt.query_map([benefit_id], |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(|e|e.to_string())?;
    let mut translation_terms = String::new();
    for item in translations { let (t,c)=item.map_err(|e|e.to_string())?; translation_terms.push(' '); translation_terms.push_str(&t); translation_terms.push(' '); translation_terms.push_str(&c); }
    let full_content = format!("{} {}", content, translation_terms);
    let search = build_search_text(&title,&full_content,&author,&book,&volume,&page,&owner,&category_terms);
    conn.execute("UPDATE benefits SET search_text=?1 WHERE id=?2",params![search,benefit_id]).map_err(|e|e.to_string())?;
    Ok(())
}

fn refresh_category_search(conn: &Connection, category_id: &str) -> Result<(), String> {
    let mut stmt = conn.prepare("WITH RECURSIVE subtree(id) AS (SELECT id FROM categories WHERE id=?1 UNION ALL SELECT c.id FROM categories c JOIN subtree s ON c.parent_id=s.id) SELECT id FROM benefits WHERE category_id IN (SELECT id FROM subtree)").map_err(|e|e.to_string())?;
    let rows = stmt.query_map([category_id], |r| r.get::<_,String>(0)).map_err(|e|e.to_string())?;
    let ids = rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    for id in ids { refresh_benefit_search(conn,&id)?; }
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct Category { pub id:String, pub parent_id:Option<String>, pub name:String, pub description:String, pub created_at:String, pub benefit_count:i64 }
#[derive(Serialize, Clone)]
pub struct BenefitSummary {
    pub id:String, pub category_id:Option<String>, pub title:String, pub content_text:String, pub author:String, pub book:String,
    pub volume:String, pub page:String, pub source_language:String, pub owner_name:String, pub sender_name:Option<String>,
    pub imported_at:Option<String>, pub created_at:String, pub added_at:String, pub updated_at:String,
}
#[derive(Serialize, Clone)]
pub struct Translation { pub id:String, pub benefit_id:String, pub language_code:String, pub title:String, pub content_html:String, pub content_text:String, pub status:String, pub translator:String, pub translated_at:String }
#[derive(Serialize)]
pub struct Benefit { #[serde(flatten)] pub summary:BenefitSummary, pub content_html:String, pub translations:Vec<Translation> }
#[derive(Serialize)]
pub struct CategoryCount { pub id:String, pub name:String, pub count:i64 }
#[derive(Serialize)]
pub struct Stats { pub total:i64, pub today:i64, pub week:i64, pub month:i64, pub year:i64, pub received:i64, pub category_counts:Vec<CategoryCount> }
#[derive(Serialize)]
pub struct Dashboard { pub stats:Stats, pub recent:Vec<BenefitSummary> }

#[derive(Deserialize)]
pub struct SaveCategoryInput { pub id:Option<String>, pub parent_id:Option<String>, pub name:String, pub description:Option<String> }
#[derive(Deserialize)]
pub struct SaveBenefitInput {
    pub id:Option<String>, pub category_id:Option<String>, pub title:String, pub content_html:String,
    pub author:Option<String>, pub book:Option<String>, pub volume:Option<String>, pub page:Option<String>,
    pub source_language:Option<String>, pub owner_name:Option<String>,
}
#[derive(Deserialize)]
pub struct SaveTranslationInput { pub benefit_id:String, pub language_code:String, pub title:Option<String>, pub content_html:String, pub status:Option<String>, pub translator:Option<String> }

fn read_summary(row:&rusqlite::Row<'_>)->rusqlite::Result<BenefitSummary>{
    Ok(BenefitSummary {
        id:row.get("id")?,category_id:row.get("category_id")?,title:row.get("title")?,content_text:row.get("content_text")?,
        author:row.get("author")?,book:row.get("book")?,volume:row.get("volume")?,page:row.get("page")?,
        source_language:row.get("source_language")?,owner_name:row.get("owner_name")?,sender_name:row.get("sender_name")?,
        imported_at:row.get("imported_at")?,created_at:row.get("created_at")?,added_at:row.get("added_at")?,updated_at:row.get("updated_at")?,
    })
}
const SUMMARY_SELECT:&str="SELECT id,category_id,title,content_text,author,book,volume,page,source_language,owner_name,sender_name,imported_at,created_at,added_at,updated_at FROM benefits";

pub fn list_categories(path:&Path)->Result<Vec<Category>,String>{
    let conn=connect(path)?;
    let mut categories={
        let mut stmt=conn.prepare("SELECT id,parent_id,name,description,created_at FROM categories ORDER BY COALESCE(parent_id,''),name COLLATE NOCASE").map_err(|e|e.to_string())?;
        let rows=stmt.query_map([],|r|Ok(Category{id:r.get(0)?,parent_id:r.get(1)?,name:r.get(2)?,description:r.get(3)?,created_at:r.get(4)?,benefit_count:0})).map_err(|e|e.to_string())?;
        rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?
    };
    for category in &mut categories {
        category.benefit_count=conn.query_row(
            "WITH RECURSIVE subtree(id) AS (SELECT id FROM categories WHERE id=?1 UNION ALL SELECT c.id FROM categories c JOIN subtree s ON c.parent_id=s.id) SELECT COUNT(*) FROM benefits WHERE category_id IN (SELECT id FROM subtree)",
            [&category.id],|r|r.get(0)
        ).map_err(|e|e.to_string())?;
    }
    Ok(categories)
}

pub fn save_category(path:&Path,input:SaveCategoryInput)->Result<Category,String>{
    let name=input.name.trim();if name.is_empty(){return Err("Category name is required".into())}
    let conn=connect(path)?;let id=input.id.filter(|s|!s.is_empty()).unwrap_or_else(||Uuid::new_v4().to_string());
    if let Some(parent)=&input.parent_id{
        if parent==&id{return Err("A category cannot be its own parent".into())}
        let exists:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",[parent],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !exists{return Err("Parent category was not found".into())}
        let cycle:bool=conn.query_row("WITH RECURSIVE descendants(id) AS (SELECT id FROM categories WHERE parent_id=?1 UNION ALL SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id) SELECT EXISTS(SELECT 1 FROM descendants WHERE id=?2)",params![id,parent],|r|r.get(0)).map_err(|e|e.to_string())?;
        if cycle{return Err("Moving a category below one of its descendants is not allowed".into())}
    }
    let created:Option<String>=conn.query_row("SELECT created_at FROM categories WHERE id=?1",[&id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    let created_at=created.unwrap_or_else(now_string);let description=input.description.unwrap_or_default();
    conn.execute("INSERT INTO categories(id,parent_id,name,description,created_at) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,name=excluded.name,description=excluded.description",params![id,input.parent_id,name,description,created_at]).map_err(|e|e.to_string())?;
    refresh_category_search(&conn,&id)?;
    Ok(Category{id,parent_id:input.parent_id,name:name.to_string(),description,created_at,benefit_count:0})
}
pub fn delete_category(path:&Path,id:String)->Result<(),String>{
    let conn=connect(path)?;let used:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE parent_id=?1) OR EXISTS(SELECT 1 FROM benefits WHERE category_id=?1)",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if used{return Err("category_has_children".into())}let changed=conn.execute("DELETE FROM categories WHERE id=?1",[id]).map_err(|e|e.to_string())?;if changed==0{return Err("Category not found".into())}Ok(())
}

pub fn list_benefits(path:&Path,search:String,category_id:Option<String>)->Result<Vec<BenefitSummary>,String>{
    let conn=connect(path)?;let q=normalize_text(search.trim());
    let mut stmt=conn.prepare("WITH RECURSIVE subtree(id) AS (SELECT id FROM categories WHERE id=?1 UNION ALL SELECT c.id FROM categories c JOIN subtree s ON c.parent_id=s.id) SELECT id,category_id,title,content_text,author,book,volume,page,source_language,owner_name,sender_name,imported_at,created_at,added_at,updated_at FROM benefits b WHERE (?1 IS NULL OR b.category_id IN (SELECT id FROM subtree)) AND (?2='' OR b.search_text LIKE '%' || ?2 || '%') ORDER BY b.added_at DESC").map_err(|e|e.to_string())?;
    let rows=stmt.query_map(params![category_id,q],read_summary).map_err(|e|e.to_string())?;rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
fn list_translations(conn:&Connection,benefit_id:&str)->Result<Vec<Translation>,String>{
    let mut stmt=conn.prepare("SELECT id,benefit_id,language_code,title,content_html,content_text,status,translator,translated_at FROM translations WHERE benefit_id=?1 ORDER BY language_code").map_err(|e|e.to_string())?;
    let rows=stmt.query_map([benefit_id],|r|Ok(Translation{id:r.get(0)?,benefit_id:r.get(1)?,language_code:r.get(2)?,title:r.get(3)?,content_html:r.get(4)?,content_text:r.get(5)?,status:r.get(6)?,translator:r.get(7)?,translated_at:r.get(8)?})).map_err(|e|e.to_string())?;
    rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())
}
pub fn get_benefit(path:&Path,id:String)->Result<Benefit,String>{
    let conn=connect(path)?;let mut stmt=conn.prepare(&format!("{} WHERE id=?1",SUMMARY_SELECT)).map_err(|e|e.to_string())?;
    let summary=stmt.query_row([&id],read_summary).map_err(|e|e.to_string())?;let content_html=conn.query_row("SELECT content_html FROM benefits WHERE id=?1",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;
    let translations=list_translations(&conn,&id)?;Ok(Benefit{summary,content_html,translations})
}
pub fn save_benefit(path:&Path,input:SaveBenefitInput)->Result<BenefitSummary,String>{
    let title=input.title.trim();if title.is_empty(){return Err("Benefit title is required".into())}
    let conn=connect(path)?;if let Some(cat)=&input.category_id{let exists:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",[cat],|r|r.get(0)).map_err(|e|e.to_string())?;if !exists{return Err("Selected category does not exist".into())}}
    let id=input.id.filter(|s|!s.is_empty()).unwrap_or_else(||Uuid::new_v4().to_string());let old:Option<(String,String)>=conn.query_row("SELECT created_at,added_at FROM benefits WHERE id=?1",[&id],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(|e|e.to_string())?;
    let now=now_string();let created_at=old.as_ref().map(|x|x.0.clone()).unwrap_or_else(||now.clone());let added_at=old.as_ref().map(|x|x.1.clone()).unwrap_or_else(||now.clone());
    let author=input.author.unwrap_or_default();let book=input.book.unwrap_or_default();let volume=input.volume.unwrap_or_default();let page=input.page.unwrap_or_default();let source_language=input.source_language.unwrap_or_else(||"ar".into());let owner_name=input.owner_name.unwrap_or_default();
    let content_text=strip_html(&input.content_html);let category_terms=category_path_text(&conn,&input.category_id)?;
    let search=build_search_text(title,&content_text,&author,&book,&volume,&page,&owner_name,&category_terms);
    conn.execute("INSERT INTO benefits(id,category_id,title,content_html,content_text,search_text,author,book,volume,page,source_language,owner_name,created_at,added_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,title=excluded.title,content_html=excluded.content_html,content_text=excluded.content_text,search_text=excluded.search_text,author=excluded.author,book=excluded.book,volume=excluded.volume,page=excluded.page,source_language=excluded.source_language,owner_name=excluded.owner_name,updated_at=excluded.updated_at",params![id,input.category_id,title,input.content_html,content_text,search,author,book,volume,page,source_language,owner_name,created_at,added_at,now]).map_err(|e|e.to_string())?;
    refresh_benefit_search(&conn,&id)?;
    let mut stmt=conn.prepare(&format!("{} WHERE id=?1",SUMMARY_SELECT)).map_err(|e|e.to_string())?;stmt.query_row([id],read_summary).map_err(|e|e.to_string())
}
pub fn delete_benefit(path:&Path,id:String)->Result<(),String>{let conn=connect(path)?;let changed=conn.execute("DELETE FROM benefits WHERE id=?1",[id]).map_err(|e|e.to_string())?;if changed==0{return Err("Benefit not found".into())}Ok(())}
pub fn save_translation(path:&Path,input:SaveTranslationInput)->Result<Translation,String>{
    let conn=connect(path)?;let exists:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM benefits WHERE id=?1)",[&input.benefit_id],|r|r.get(0)).map_err(|e|e.to_string())?;if !exists{return Err("Benefit not found".into())}
    let lang=input.language_code.trim();if lang.is_empty(){return Err("Translation language is required".into())}
    let old:Option<String>=conn.query_row("SELECT id FROM translations WHERE benefit_id=?1 AND language_code=?2",params![input.benefit_id,lang],|r|r.get(0)).optional().map_err(|e|e.to_string())?;let id=old.unwrap_or_else(||Uuid::new_v4().to_string());
    let title=input.title.unwrap_or_default();let content_text=strip_html(&input.content_html);let status=input.status.unwrap_or_else(||"draft".into());let translator=input.translator.unwrap_or_default();let translated_at=now_string();
    conn.execute("INSERT INTO translations(id,benefit_id,language_code,title,content_html,content_text,status,translator,translated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(benefit_id,language_code) DO UPDATE SET title=excluded.title,content_html=excluded.content_html,content_text=excluded.content_text,status=excluded.status,translator=excluded.translator,translated_at=excluded.translated_at",params![id,input.benefit_id,lang,title,input.content_html,content_text,status,translator,translated_at]).map_err(|e|e.to_string())?;
    refresh_benefit_search(&conn,&input.benefit_id)?;
    Ok(Translation{id,benefit_id:input.benefit_id,language_code:lang.into(),title,content_html:input.content_html,content_text,status,translator,translated_at})
}

fn date_boundaries()->(String,String,String,String){let today=Local::now().date_naive();let week=today-chrono::Duration::days(today.weekday().num_days_from_monday() as i64);let month=NaiveDate::from_ymd_opt(today.year(),today.month(),1).unwrap();let year=NaiveDate::from_ymd_opt(today.year(),1,1).unwrap();(today.to_string(),week.to_string(),month.to_string(),year.to_string())}
pub fn get_dashboard(path:&Path)->Result<Dashboard,String>{
    let conn=connect(path)?;let(today,week,month,year)=date_boundaries();
    let total:i64=conn.query_row("SELECT COUNT(*) FROM benefits",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    let today_n:i64=conn.query_row("SELECT COUNT(*) FROM benefits WHERE substr(added_at,1,10)=?1",[&today],|r|r.get(0)).map_err(|e|e.to_string())?;
    let week_n:i64=conn.query_row("SELECT COUNT(*) FROM benefits WHERE substr(added_at,1,10)>=?1",[&week],|r|r.get(0)).map_err(|e|e.to_string())?;
    let month_n:i64=conn.query_row("SELECT COUNT(*) FROM benefits WHERE substr(added_at,1,10)>=?1",[&month],|r|r.get(0)).map_err(|e|e.to_string())?;
    let year_n:i64=conn.query_row("SELECT COUNT(*) FROM benefits WHERE substr(added_at,1,10)>=?1",[&year],|r|r.get(0)).map_err(|e|e.to_string())?;
    let received:i64=conn.query_row("SELECT COUNT(*) FROM benefits WHERE imported_at IS NOT NULL",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    let mut cs=conn.prepare("SELECT id,name FROM categories WHERE parent_id IS NULL ORDER BY name COLLATE NOCASE").map_err(|e|e.to_string())?;let cat_rows=cs.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(|e|e.to_string())?;let mut category_counts=Vec::new();
    for row in cat_rows{let(id,name)=row.map_err(|e|e.to_string())?;let count:i64=conn.query_row("WITH RECURSIVE subtree(id) AS (SELECT id FROM categories WHERE id=?1 UNION ALL SELECT c.id FROM categories c JOIN subtree s ON c.parent_id=s.id) SELECT COUNT(*) FROM benefits WHERE category_id IN (SELECT id FROM subtree)",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;category_counts.push(CategoryCount{id,name,count});}
    let stats=Stats{total,today:today_n,week:week_n,month:month_n,year:year_n,received,category_counts};let mut rs=conn.prepare(&format!("{} ORDER BY added_at DESC LIMIT 7",SUMMARY_SELECT)).map_err(|e|e.to_string())?;let recent=rs.query_map([],read_summary).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;Ok(Dashboard{stats,recent})
}

fn summary_to_value(b:&BenefitSummary,content_html:String,translations:Vec<Translation>)->Value{json!({"id":b.id,"category_id":b.category_id,"title":b.title,"content_html":content_html,"content_text":b.content_text,"author":b.author,"book":b.book,"volume":b.volume,"page":b.page,"source_language":b.source_language,"owner_name":b.owner_name,"sender_name":b.sender_name,"imported_at":b.imported_at,"created_at":b.created_at,"added_at":b.added_at,"updated_at":b.updated_at,"translations":translations})}
pub fn export_bundle(path:&Path,benefit_ids:Vec<String>)->Result<Value,String>{
    let conn=connect(path)?;let full_export=benefit_ids.is_empty();let mut benefits=Vec::new();
    if benefit_ids.is_empty(){for b in list_benefits(path,String::new(),None)?{let html:String=conn.query_row("SELECT content_html FROM benefits WHERE id=?1",[&b.id],|r|r.get(0)).map_err(|e|e.to_string())?;benefits.push(summary_to_value(&b,html,list_translations(&conn,&b.id)?));}}
    else{for id in benefit_ids{let mut stmt=conn.prepare(&format!("{} WHERE id=?1",SUMMARY_SELECT)).map_err(|e|e.to_string())?;let summary=match stmt.query_row([&id],read_summary).optional().map_err(|e|e.to_string())?{Some(x)=>x,None=>continue};let html:String=conn.query_row("SELECT content_html FROM benefits WHERE id=?1",[&id],|r|r.get(0)).map_err(|e|e.to_string())?;benefits.push(summary_to_value(&summary,html,list_translations(&conn,&id)?));}}
    let mut needed=BTreeMap::<String,Value>::new();for b in &benefits{let mut current=b.get("category_id").and_then(Value::as_str).map(str::to_owned);while let Some(id)=current{if needed.contains_key(&id){break}let row:Option<(String,Option<String>,String,String,String)>=conn.query_row("SELECT id,parent_id,name,description,created_at FROM categories WHERE id=?1",[&id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional().map_err(|e|e.to_string())?;if let Some((cid,parent,name,description,created_at))=row{current=parent.clone();needed.insert(cid.clone(),json!({"id":cid,"parent_id":parent,"name":name,"description":description,"created_at":created_at}));}else{break}}}
    if full_export {
        let mut stmt=conn.prepare("SELECT id,parent_id,name,description,created_at FROM categories").map_err(|e|e.to_string())?;
        let rows=stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,Option<String>>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?))).map_err(|e|e.to_string())?;
        for row in rows { let(id,parent,name,description,created_at)=row.map_err(|e|e.to_string())?;needed.insert(id.clone(),json!({"id":id,"parent_id":parent,"name":name,"description":description,"created_at":created_at})); }
    }
    let mut cats:Vec<Value>=needed.into_values().collect();cats.sort_by_key(|c|if c.get("parent_id").unwrap_or(&Value::Null).is_null(){0}else{1});Ok(json!({"format":"KWB","version":1,"application":"Knowledge Without Borders","exported_at":now_string(),"categories":cats,"benefits":benefits}))
}
fn get_str<'a>(v:&'a Value,key:&str,default:&'a str)->&'a str{v.get(key).and_then(Value::as_str).unwrap_or(default)}
fn get_opt_string(v:&Value,key:&str)->Option<String>{v.get(key).and_then(Value::as_str).filter(|s|!s.is_empty()).map(str::to_owned)}
#[derive(Serialize)]pub struct ImportResult{pub imported_benefits:u64,pub skipped_benefits:u64,pub imported_categories:u64}
pub fn import_bundle(path:&Path,bundle_text:String,sender_name:String)->Result<ImportResult,String>{
    let bundle:Value=serde_json::from_str(&bundle_text).map_err(|_|"invalid_bundle".to_string())?;if get_str(&bundle,"format","")!="KWB"||bundle.get("version").and_then(Value::as_u64)!=Some(1){return Err("invalid_bundle".into())}
    let categories=bundle.get("categories").and_then(Value::as_array).cloned().unwrap_or_default();let benefits=bundle.get("benefits").and_then(Value::as_array).cloned().unwrap_or_default();let mut conn=connect(path)?;let tx=conn.transaction().map_err(|e|e.to_string())?;
    let mut id_map:HashMap<String,String>=HashMap::new();let mut pending=categories;let mut imported_categories=0u64;
    while !pending.is_empty(){let mut next=Vec::new();let before=pending.len();for c in pending{let old_id=get_str(&c,"id","").to_string();if old_id.is_empty(){continue}let old_parent=get_opt_string(&c,"parent_id");let parent=match old_parent.as_ref(){Some(p)=>Some(id_map.get(p).cloned().unwrap_or_else(||p.clone())),None=>None};
        if let Some(p)=&parent{let parent_exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",[p],|r|r.get(0)).map_err(|e|e.to_string())?;if !parent_exists{next.push(c);continue}}
        let existing:Option<String>=tx.query_row("SELECT id FROM categories WHERE id=?1",[&old_id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
        let chosen=if let Some(found)=existing{found}else{let name=get_str(&c,"name","").trim();if name.is_empty(){continue}let same:Option<String>=tx.query_row("SELECT id FROM categories WHERE name=?1 AND parent_id IS ?2 LIMIT 1",params![name,parent],|r|r.get(0)).optional().map_err(|e|e.to_string())?;if let Some(found)=same{found}else{let created=get_str(&c,"created_at","").to_string();let created=if created.is_empty(){now_string()}else{created};tx.execute("INSERT INTO categories(id,parent_id,name,description,created_at) VALUES(?1,?2,?3,?4,?5)",params![old_id,parent,name,get_str(&c,"description",""),created]).map_err(|e|e.to_string())?;imported_categories+=1;old_id.clone()}};
        id_map.insert(old_id,chosen);
    }if next.len()==before{return Err("The bundle contains a category with an unresolved parent".into())}pending=next;}
    let mut imported_benefits=0u64;let mut skipped_benefits=0u64;let imported_at=now_string();
    for b in benefits{let id=get_str(&b,"id","");if id.is_empty(){continue}let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM benefits WHERE id=?1)",[id],|r|r.get(0)).map_err(|e|e.to_string())?;if exists{skipped_benefits+=1;continue}
        let original_cat=get_opt_string(&b,"category_id");let category=original_cat.as_ref().map(|x|id_map.get(x).cloned().unwrap_or_else(||x.clone()));let title=get_str(&b,"title","").trim();if title.is_empty(){continue}let html=get_str(&b,"content_html","");let text=strip_html(html);let author=get_str(&b,"author","");let book=get_str(&b,"book","");let owner=get_str(&b,"owner_name","");let category_terms=category_path_text(&tx,&category)?;let volume=get_str(&b,"volume","");let page=get_str(&b,"page","");let search=build_search_text(title,&text,author,book,volume,page,owner,&category_terms);let sender=if sender_name.trim().is_empty(){None}else{Some(sender_name.trim())};let now=now_string();let created=get_str(&b,"created_at","");let created=if created.is_empty(){now.clone()}else{created.to_string()};
        tx.execute("INSERT INTO benefits(id,category_id,title,content_html,content_text,search_text,author,book,volume,page,source_language,owner_name,sender_name,imported_at,created_at,added_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",params![id,category,title,html,text,search,author,book,get_str(&b,"volume",""),get_str(&b,"page",""),get_str(&b,"source_language","ar"),owner,sender,imported_at,created,now,now]).map_err(|e|e.to_string())?;
        if let Some(translations)=b.get("translations").and_then(Value::as_array){for tr in translations{let lang=get_str(tr,"language_code","");if lang.is_empty(){continue}let raw_id=get_str(tr,"id","");let tr_id=if raw_id.is_empty(){Uuid::new_v4().to_string()}else{raw_id.to_string()};let th=get_str(tr,"content_html","");let tt=strip_html(th);let tr_date=get_str(tr,"translated_at","");let tr_date=if tr_date.is_empty(){now.clone()}else{tr_date.to_string()};tx.execute("INSERT OR IGNORE INTO translations(id,benefit_id,language_code,title,content_html,content_text,status,translator,translated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",params![tr_id,id,lang,get_str(tr,"title",""),th,tt,get_str(tr,"status","draft"),get_str(tr,"translator",""),tr_date]).map_err(|e|e.to_string())?;}}
        refresh_benefit_search(&tx,id)?;
        imported_benefits+=1;
    }
    tx.commit().map_err(|e|e.to_string())?;Ok(ImportResult{imported_benefits,skipped_benefits,imported_categories})
}
