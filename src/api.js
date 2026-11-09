import { invoke } from '@tauri-apps/api/core';

export const isDesktop = Boolean(window.__TAURI_INTERNALS__);
const KEY = 'kwb-browser-preview-v1';

function seedState() {
  return { categories: [], benefits: [], translations: [] };
}
function loadMock() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seedState(); }
  catch { return seedState(); }
}
function saveMock(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
function makeId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function plain(html = '') { const el = document.createElement('div'); el.innerHTML = html; return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
function childrenOf(categories, parentId) { return categories.filter(c => (c.parent_id || null) === (parentId || null)); }
function descendants(categories, id) { const ids = [id]; for (const c of categories.filter(x => x.parent_id === id)) ids.push(...descendants(categories, c.id)); return ids; }
function mockStats(s) {
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today); week.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const month = new Date(now.getFullYear(), now.getMonth(), 1); const year = new Date(now.getFullYear(), 0, 1);
  const countSince = d => s.benefits.filter(b => new Date(b.added_at || b.created_at) >= d).length;
  return {
    total: s.benefits.length, today: countSince(today), week: countSince(week), month: countSince(month), year: countSince(year),
    received: s.benefits.filter(b => b.imported_at).length,
    category_counts: s.categories.filter(c => !c.parent_id).map(c => ({ id: c.id, name: c.name, count: s.benefits.filter(b => descendants(s.categories, c.id).includes(b.category_id)).length }))
  };
}

export async function getDashboard() {
  if (isDesktop) return invoke('get_dashboard');
  const s = loadMock();
  return { stats: mockStats(s), recent: [...s.benefits].sort((a,b) => (b.added_at || '').localeCompare(a.added_at || '')).slice(0, 7) };
}
export async function listCategories() {
  if (isDesktop) return invoke('list_categories');
  const s = loadMock();
  return s.categories.map(c => ({ ...c, benefit_count: s.benefits.filter(b => b.category_id === c.id).length }));
}
function normalizeSearch(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').toLowerCase();
}
function categoryPath(categories, id) {
  const parts=[]; let current=categories.find(c=>c.id===id); let guard=0;
  while(current && guard++<100){parts.unshift(current.name);current=categories.find(c=>c.id===current.parent_id);}
  return parts.join(' ');
}
export async function listBenefits(search = '', categoryId = null) {
  if (isDesktop) return invoke('list_benefits', { search, categoryId });
  const s = loadMock(); const catIds = categoryId ? descendants(s.categories, categoryId) : null; const q = normalizeSearch(search.trim());
  return s.benefits.filter(b => {
    if (catIds && !catIds.includes(b.category_id)) return false;
    if (!q) return true;
    const translations=s.translations.filter(t=>t.benefit_id===b.id).map(t=>`${t.title||''} ${t.content_text||plain(t.content_html)||''}`).join(' ');
    const haystack=normalizeSearch([b.title,b.content_text,b.author,b.book,b.volume,b.page,b.owner_name,categoryPath(s.categories,b.category_id),translations].join(' '));
    return haystack.includes(q);
  }).sort((a,b) => (b.added_at || '').localeCompare(a.added_at || ''));
}
export async function getBenefit(id) {
  if (isDesktop) return invoke('get_benefit', { id });
  const s = loadMock(); const b = s.benefits.find(x => x.id === id); if (!b) return null;
  return { ...b, translations: s.translations.filter(t => t.benefit_id === id) };
}
export async function saveBenefit(input) {
  if (isDesktop) return invoke('save_benefit', { input });
  const s = loadMock(); const now = new Date().toISOString(); const id = input.id || makeId(); const old = s.benefits.find(b => b.id === id);
  const row = { ...input, id, content_text: plain(input.content_html), created_at: old?.created_at || now, added_at: old?.added_at || now, updated_at: now, imported_at: old?.imported_at || null, sender_name: old?.sender_name || null };
  s.benefits = old ? s.benefits.map(b => b.id === id ? row : b) : [row, ...s.benefits]; saveMock(s); return row;
}
export async function deleteBenefit(id) {
  if (isDesktop) return invoke('delete_benefit', { id });
  const s = loadMock(); s.benefits = s.benefits.filter(b => b.id !== id); s.translations = s.translations.filter(t => t.benefit_id !== id); saveMock(s);
}
export async function saveCategory(input) {
  if (isDesktop) return invoke('save_category', { input });
  const s = loadMock(); const id = input.id || makeId(); const row = { ...input, id, created_at: input.created_at || new Date().toISOString() };
  s.categories = input.id ? s.categories.map(c => c.id === id ? row : c) : [...s.categories, row]; saveMock(s); return row;
}
export async function deleteCategory(id) {
  if (isDesktop) return invoke('delete_category', { id });
  const s = loadMock(); if (s.categories.some(c => c.parent_id === id) || s.benefits.some(b => b.category_id === id)) throw new Error('category_has_children');
  s.categories = s.categories.filter(c => c.id !== id); saveMock(s);
}
export async function saveTranslation(input) {
  if (isDesktop) return invoke('save_translation', { input });
  const s = loadMock(); const now = new Date().toISOString();
  const old = s.translations.find(t => t.benefit_id === input.benefit_id && t.language_code === input.language_code);
  const row = { ...input, id: old?.id || makeId(), content_text: plain(input.content_html), translated_at: now };
  s.translations = old ? s.translations.map(t => t === old ? row : t) : [...s.translations, row]; saveMock(s); return row;
}
export async function exportBundle(ids) {
  if (isDesktop) return { filePath: await invoke('export_bundle_file', { benefitIds: ids }) };
  const s = loadMock(); const chosen = ids?.length ? s.benefits.filter(b => ids.includes(b.id)) : s.benefits;
  const catIds = new Set(); for (const b of chosen) { let c = s.categories.find(x => x.id === b.category_id); while (c) { catIds.add(c.id); c = s.categories.find(x => x.id === c.parent_id); } }
  return { format: 'KWB', version: 1, exported_at: new Date().toISOString(), categories: ids?.length ? s.categories.filter(c => catIds.has(c.id)) : s.categories, benefits: chosen.map(b => ({ ...b, translations: s.translations.filter(t => t.benefit_id === b.id) })) };
}
export async function importBundle(bundleText, senderName = '') {
  if (isDesktop) return invoke('import_bundle', { bundleText, senderName });
  const bundle = JSON.parse(bundleText); if (bundle.format !== 'KWB' || bundle.version !== 1) throw new Error('invalid_bundle');
  const s = loadMock(); let cats = 0, added = 0, skipped = 0; const idMap = new Map();
  for (const c of [...(bundle.categories || [])].sort((a,b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))) {
    const mappedParent = c.parent_id ? (idMap.get(c.parent_id) || c.parent_id) : null;
    let match = s.categories.find(x => x.id === c.id) || s.categories.find(x => x.name === c.name && (x.parent_id || null) === mappedParent);
    if (!match) { match = { ...c, parent_id: mappedParent }; s.categories.push(match); cats++; }
    idMap.set(c.id, match.id);
  }
  for (const b of bundle.benefits || []) {
    if (s.benefits.some(x => x.id === b.id)) { skipped++; continue; }
    const row = { ...b, category_id: b.category_id ? (idMap.get(b.category_id) || b.category_id) : null, added_at: new Date().toISOString(), imported_at: new Date().toISOString(), sender_name: senderName || null };
    s.benefits.push(row); added++;
    for (const tr of b.translations || []) s.translations.push({ ...tr, benefit_id: b.id });
  }
  saveMock(s); return { imported_benefits: added, skipped_benefits: skipped, imported_categories: cats };
}
export async function openExternal(url) {
  if (isDesktop) return invoke('open_external', { url });
  window.open(url, '_blank', 'noopener,noreferrer');
}
