import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { LANGUAGES, t } from './i18n';
import {
  deleteBenefit, deleteCategory, exportBundle, getBenefit, getDashboard,
  importBundle, isDesktop, listBenefits, listCategories, openMessagingTarget, revealFileInFolder,
  saveBenefit, saveCategory, saveTranslation
} from './api';


const RTL_LANGUAGE_IDS = new Set(['ar','ur','he','fa','ps','sd','ug','yi','dv','ku','ckb','syr','nqo','bal','farsi','persian','hebrew','pashto','sindhi','uyghur','yiddish','kurdish']);
function directionForLanguage(code) {
  const value=String(code || '').trim().toLowerCase();
  const base=value.split(/[-_\s]/)[0];
  return RTL_LANGUAGE_IDS.has(value) || RTL_LANGUAGE_IDS.has(base) ? 'rtl' : 'ltr';
}

const emptyBenefit = () => ({
  id: null, title: '', content_html: '', category_id: '', author: '', book: '',
  volume: '', page: '', source_language: 'ar', owner_name: '',
});

function fmtDate(value, lang) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(value)); }
  catch { return value; }
}
function flattenCategories(categories, parentId = null, depth = 0) {
  return categories.filter(c => (c.parent_id || null) === (parentId || null))
    .sort((a,b) => a.name.localeCompare(b.name))
    .flatMap(c => [{ ...c, depth }, ...flattenCategories(categories, c.id, depth + 1)]);
}
function categoryPath(categories, id) {
  const names = []; let current = categories.find(c => c.id === id);
  while (current) { names.unshift(current.name); current = categories.find(c => c.id === current.parent_id); }
  return names.join(' / ');
}

function richTextToPlainText(html = '') {
  const container = document.createElement('div');
  container.innerHTML = DOMPurify.sanitize(html || '');
  return String(container.innerText || container.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildShareText(benefits, categories, translate) {
  return benefits.map((benefit, index) => {
    const title = String(benefit.title || '').trim();
    const body = richTextToPlainText(benefit.content_html || benefit.content_text || '');
    const category = categoryPath(categories, benefit.category_id);
    const source = [benefit.author, benefit.book, benefit.volume ? `${translate('shareVolume')} ${benefit.volume}` : '', benefit.page ? `${translate('sharePage')} ${benefit.page}` : '']
      .filter(value => String(value || '').trim()).join(' · ');
    return [
      `${index + 1}. ${title || 'Knowledge note'}`,
      body,
      category ? `${translate('shareCategory')}: ${category}` : '',
      source ? `${translate('shareSource')}: ${source}` : '',
    ].filter(Boolean).join('\n\n');
  }).join('\n\n────────────────────\n\n');
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('clipboard_unavailable');
  return true;
}
function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20M8 7h8M8 11h8"/></>,
    folder: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L20 7.5 16.5 4z"/><path d="m14.8 5.7 3.5 3.5"/></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    translate: <><path d="M4 5h12M10 3v2m4 0c0 5-4 9-8 11M7 9c1.5 2.5 3.5 4.5 6 6M14 20l4-9 4 9m-6.5-3h5"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.8.1l-.2.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.6-1.1h-.2l-2.9-1.7.1-.2a1.7 1.7 0 0 0-.1-1.8l-.1-.2v-3.4l.2-.1a1.7 1.7 0 0 0 1.1-1.6v-.2l1.7-2.9.2.1a1.7 1.7 0 0 0 1.8-.1l.2-.1h3.4l.1.2a1.7 1.7 0 0 0 1.6 1.1h.2l2.9 1.7-.1.2a1.7 1.7 0 0 0 .1 1.8l.1.2v3.4z"/></>
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}

function RichEditor({ value, onChange, lang, label, textDir = null }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = DOMPurify.sanitize(value || '');
    }
  }, [value]);
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && ref.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    ref.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  };
  const command = (cmd, val = null) => {
    restoreSelection();
    document.execCommand(cmd, false, val);
    rememberSelection();
    onChange(DOMPurify.sanitize(ref.current?.innerHTML || ''));
  };
  const applyColor = (cmd, value) => {
    restoreSelection();
    document.execCommand(cmd, false, value);
    rememberSelection();
    onChange(DOMPurify.sanitize(ref.current?.innerHTML || ''));
  };
  const onInput = e => {
    rememberSelection();
    onChange(DOMPurify.sanitize(e.currentTarget.innerHTML));
  };
  return <div className="rich-wrap">
    <div className="rich-toolbar" aria-label={t(lang, 'formatting')}>
      <button type="button" title={t(lang, 'bold')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')}><b>B</b></button>
      <button type="button" title={t(lang, 'italic')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')}><i>I</i></button>
      <button type="button" title={t(lang, 'underline')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('underline')}><u>U</u></button>
      <span className="toolbar-sep" />
      <select className="rich-select font-family-select" aria-label={t(lang,'fontFamily')} title={t(lang,'fontFamily')} defaultValue="Tahoma" onMouseDown={rememberSelection} onChange={e=>command('fontName',e.target.value)}>
        <option value="Tahoma">Tahoma</option><option value="Arial">Arial</option><option value="Segoe UI">Segoe UI</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option><option value="Microsoft YaHei">Microsoft YaHei</option>
      </select>
      <select className="rich-select font-size-select" aria-label={t(lang,'fontSize')} title={t(lang,'fontSize')} defaultValue="3" onMouseDown={rememberSelection} onChange={e=>command('fontSize',e.target.value)}>
        <option value="1">10</option><option value="2">12</option><option value="3">14</option><option value="4">18</option><option value="5">24</option><option value="6">32</option><option value="7">40</option>
      </select>
      <label className="color-tool" title={t(lang,'textColor')}><span>A</span><input type="color" defaultValue="#24384d" aria-label={t(lang,'textColor')} onMouseDown={rememberSelection} onChange={e=>applyColor('foreColor',e.target.value)}/></label>
      <label className="color-tool highlight-tool" title={t(lang,'highlightColor')}><span>▰</span><input type="color" defaultValue="#fff2a8" aria-label={t(lang,'highlightColor')} onMouseDown={rememberSelection} onChange={e=>applyColor('hiliteColor',e.target.value)}/></label>
      <span className="toolbar-sep" />
      <button type="button" title={t(lang, 'bulletList')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')}>• ≡</button>
      <button type="button" title={t(lang, 'numberedList')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertOrderedList')}>1. ≡</button>
      <button type="button" title={t(lang, 'quote')} onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','blockquote')}>❞</button>
    </div>
    <div ref={ref} dir={textDir || (['ar','ur'].includes(lang) ? 'rtl' : 'ltr')} className="rich-editor" contentEditable suppressContentEditableWarning onInput={onInput} onMouseUp={rememberSelection} onKeyUp={rememberSelection} data-placeholder={label} />
  </div>;
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handle = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{ if (e.target === e.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close"/></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

function CategoryTree({ categories, selected, onSelect, lang }) {
  const nodes = flattenCategories(categories);
  return <div className="category-tree">
    <button className={`tree-item tree-all ${!selected ? 'active' : ''}`} onClick={()=>onSelect(null)}>
      <span className="tree-dot all-dot">✦</span><span>{t(lang,'allCategories')}</span>
    </button>
    {nodes.map(c => <button key={c.id} className={`tree-item ${selected===c.id?'active':''}`} style={{paddingInlineStart: `${14 + c.depth * 18}px`}} onClick={()=>onSelect(c.id)}>
      <span className="tree-dot"><Icon name="folder"/></span><span className="tree-label">{c.name}</span><small>{c.benefit_count || 0}</small>
    </button>)}
    {!categories.length && <p className="muted small-pad">{t(lang,'emptyCategories')}</p>}
  </div>;
}

function BenefitForm({ initial, categories, lang, onCancel, onSave, busy }) {
  const [form, setForm] = useState(initial || emptyBenefit());
  const [sourceOption,setSourceOption] = useState('ar');
  const [customSource,setCustomSource] = useState('');
  useEffect(()=>{
    const next=initial || emptyBenefit();setForm(next);
    const known=LANGUAGES.some(x=>x.code===next.source_language);
    setSourceOption(known?(next.source_language || 'ar'):'other');
    setCustomSource(known?'':(next.source_language || ''));
  },[initial]);
  const set = (key, value) => setForm(f=>({...f,[key]:value}));
  const flat = flattenCategories(categories);
  const effectiveSource = sourceOption==='other' ? customSource.trim() : sourceOption;
  const sourceDir = directionForLanguage(effectiveSource);
  const submit = e => { e.preventDefault(); onSave({ ...form, category_id: form.category_id || null, source_language: effectiveSource || 'und' }); };
  return <form onSubmit={submit} className="form-grid">
    <label className="field span-2"><span>{t(lang,'title')} *</span><input autoFocus required dir={sourceDir} value={form.title} onChange={e=>set('title',e.target.value)} /></label>
    <label className="field span-2"><span>{t(lang,'content')} *</span><RichEditor value={form.content_html} onChange={v=>set('content_html',v)} lang={lang} textDir={sourceDir} label={t(lang,'content')}/></label>
    <label className="field span-2"><span>{t(lang,'mainCategory')}</span><select value={form.category_id || ''} onChange={e=>set('category_id',e.target.value)}><option value="">{t(lang,'noCategory')}</option>{flat.map(c=><option key={c.id} value={c.id}>{'　'.repeat(c.depth)}{c.name}</option>)}</select></label>
    <label className="field"><span>{t(lang,'author')}</span><input value={form.author || ''} onChange={e=>set('author',e.target.value)}/></label>
    <label className="field"><span>{t(lang,'book')}</span><input value={form.book || ''} onChange={e=>set('book',e.target.value)}/></label>
    <label className="field"><span>{t(lang,'volume')}</span><input value={form.volume || ''} onChange={e=>set('volume',e.target.value)}/></label>
    <label className="field"><span>{t(lang,'page')}</span><input value={form.page || ''} onChange={e=>set('page',e.target.value)}/></label>
    <label className="field"><span>{t(lang,'sourceLanguage')}</span><select value={sourceOption} onChange={e=>setSourceOption(e.target.value)}>{LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.native}</option>)}<option value="other">{t(lang,'otherLanguage')}</option></select></label>
    {sourceOption==='other' && <label className="field"><span>{t(lang,'otherLanguage')}</span><input required value={customSource} onChange={e=>setCustomSource(e.target.value)} placeholder="e.g. Japanese / ja"/></label>}
    <label className="field"><span>{t(lang,'owner')}</span><input value={form.owner_name || ''} onChange={e=>set('owner_name',e.target.value)}/></label>
    <div className="form-actions span-2"><button type="button" className="btn btn-ghost" onClick={onCancel}>{t(lang,'cancel')}</button><button className="btn btn-primary" disabled={busy}>{busy?'…':t(lang,'save')}</button></div>
  </form>;
}

function CategoryForm({ initial, categories, lang, onCancel, onSave, busy }) {
  const [name,setName] = useState(initial?.name || ''); const [parent,setParent] = useState(initial?.parent_id || ''); const [description,setDescription] = useState(initial?.description || '');
  const flat = flattenCategories(categories).filter(c=>c.id!==initial?.id);
  return <form className="form-grid" onSubmit={e=>{e.preventDefault();onSave({id:initial?.id || null,name,parent_id:parent || null,description});}}>
    <label className="field span-2"><span>{t(lang,'categoryName')} *</span><input autoFocus required value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field span-2"><span>{t(lang,'parentCategory')}</span><select value={parent} onChange={e=>setParent(e.target.value)}><option value="">{t(lang,'noParent')}</option>{flat.map(c=><option key={c.id} value={c.id}>{'　'.repeat(c.depth)}{c.name}</option>)}</select></label>
    <label className="field span-2"><span>{t(lang,'description')}</span><textarea rows="3" value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div className="form-actions span-2"><button type="button" className="btn btn-ghost" onClick={onCancel}>{t(lang,'cancel')}</button><button className="btn btn-primary" disabled={busy}>{t(lang,'save')}</button></div>
  </form>;
}

function TranslationForm({ benefit, initial, lang, onCancel, onSave, busy }) {
  const defaultLang=benefit.source_language==='en'?'es':'en';
  const [languageOption,setLanguageOption] = useState('en');
  const [customLanguage,setCustomLanguage] = useState('');
  const [title,setTitle] = useState(initial?.title || ''); const [content,setContent] = useState(initial?.content_html || '');
  const [status,setStatus] = useState(initial?.status || 'draft'); const [translator,setTranslator] = useState(initial?.translator || '');
  useEffect(()=>{
    const code=initial?.language_code || defaultLang;const known=LANGUAGES.some(x=>x.code===code);
    setLanguageOption(known?code:'other');setCustomLanguage(known?'':code);
    setTitle(initial?.title || '');setContent(initial?.content_html || '');setStatus(initial?.status || 'draft');setTranslator(initial?.translator || '');
  },[initial,benefit.id]);
  const effectiveLanguage=languageOption==='other'?customLanguage.trim():languageOption;
  const textDir=directionForLanguage(effectiveLanguage);
  return <form className="form-grid" onSubmit={e=>{e.preventDefault();onSave({benefit_id:benefit.id,language_code:effectiveLanguage,title,content_html:content,status,translator});}}>
    <label className="field"><span>{t(lang,'languageOfTranslation')}</span><select value={languageOption} disabled={Boolean(initial)} onChange={e=>setLanguageOption(e.target.value)}>{LANGUAGES.filter(l=>l.code!==benefit.source_language).map(l=><option key={l.code} value={l.code}>{l.native}</option>)}<option value="other">{t(lang,'otherLanguage')}</option></select></label>
    {languageOption==='other' && <label className="field"><span>{t(lang,'otherLanguage')}</span><input autoFocus required disabled={Boolean(initial)} value={customLanguage} onChange={e=>setCustomLanguage(e.target.value)} placeholder="e.g. Japanese / ja"/></label>}
    <label className="field"><span>{t(lang,'translationStatus')}</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">{t(lang,'draft')}</option><option value="reviewed">{t(lang,'reviewed')}</option><option value="verified">{t(lang,'verified')}</option></select></label>
    <label className="field span-2"><span>{t(lang,'title')}</span><input dir={textDir} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="field span-2"><span>{t(lang,'translatedText')}</span><RichEditor value={content} onChange={setContent} lang={lang} textDir={textDir} label={t(lang,'translatedText')}/></label>
    <label className="field span-2"><span>{t(lang,'translator')}</span><input value={translator} onChange={e=>setTranslator(e.target.value)}/></label>
    <div className="form-actions span-2"><button type="button" className="btn btn-ghost" onClick={onCancel}>{t(lang,'cancel')}</button><button className="btn btn-primary" disabled={busy || !effectiveLanguage}>{t(lang,'saveTranslation')}</button></div>
  </form>;
}

export default function App() {
  const [lang,setLang] = useState(localStorage.getItem('kwb-lang') || 'ar');
  const [theme,setTheme] = useState(localStorage.getItem('kwb-theme') || 'light');
  const [uiScale,setUiScale] = useState(Number(localStorage.getItem('kwb-ui-scale') || '1'));
  const rtl = ['ar','ur'].includes(lang);
  const tr = key => t(lang,key);
  const [view,setView] = useState('dashboard');
  const [dashboard,setDashboard] = useState({stats:{total:0,today:0,week:0,month:0,year:0,received:0,category_counts:[]},recent:[]});
  const [categories,setCategories] = useState([]); const [benefits,setBenefits] = useState([]); const [exchangeBenefits,setExchangeBenefits] = useState([]);
  const [selectedCategory,setSelectedCategory] = useState(null); const [search,setSearch] = useState(''); const [exchangeSearch,setExchangeSearch] = useState(''); const [exchangeCategory,setExchangeCategory] = useState('');
  const [selectedIds,setSelectedIds] = useState([]); const [activeBenefit,setActiveBenefit] = useState(null);
  const [modal,setModal] = useState(null); const [busy,setBusy] = useState(false); const [toast,setToast] = useState('');
  const [senderName,setSenderName] = useState(''); const [attributeSender,setAttributeSender] = useState(true);
  const [shareMode,setShareMode] = useState('file');
  const fileRef = useRef(null);

  useEffect(()=>{localStorage.setItem('kwb-lang',lang);document.documentElement.lang=lang;document.documentElement.dir=rtl?'rtl':'ltr';},[lang,rtl]);
  useEffect(()=>{localStorage.setItem('kwb-theme',theme);},[theme]);
  useEffect(()=>{localStorage.setItem('kwb-ui-scale',String(uiScale));document.documentElement.style.setProperty('--kwb-ui-scale',String(uiScale));},[uiScale]);
  const notify = useCallback(msg=>{setToast(msg);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(''),3200);},[]);
  const refresh = useCallback(async ()=>{
    try {
      const [d,c,b] = await Promise.all([getDashboard(),listCategories(),listBenefits(search,selectedCategory)]);
      setDashboard(d);setCategories(c);setBenefits(b);
    } catch(e) { notify(String(e)); }
  },[search,selectedCategory,notify]);
  useEffect(()=>{refresh();},[refresh]);
  useEffect(()=>{if(view==='exchange'){listBenefits(exchangeSearch,exchangeCategory || null).then(setExchangeBenefits).catch(e=>notify(String(e)));}},[view,exchangeSearch,exchangeCategory,notify]);

  const categoryMap = useMemo(()=>new Map(categories.map(c=>[c.id,c])),[categories]);
  const flatCategories = useMemo(()=>flattenCategories(categories),[categories]);
  const openNewBenefit = ()=>setModal({type:'benefit',initial:emptyBenefit()});
  const openEditBenefit = async b=>{const full=await getBenefit(b.id);setActiveBenefit(full);setModal({type:'benefit',initial:full});};
  const handleSaveBenefit = async input=>{setBusy(true);try{const saved=await saveBenefit(input);setModal(null);setActiveBenefit(await getBenefit(saved.id));setView('library');notify(tr('benefitSaved'));await refresh();}catch(e){notify(String(e));}finally{setBusy(false);}};
  const handleDeleteBenefit = async id=>{if(!window.confirm(tr('confirmDeleteBenefit')))return;try{await deleteBenefit(id);setActiveBenefit(null);setSelectedIds(ids=>ids.filter(x=>x!==id));await refresh();}catch(e){notify(String(e));}};
  const handleSaveCategory = async input=>{setBusy(true);try{await saveCategory(input);setModal(null);await refresh();notify(tr('categorySaved'));}catch(e){notify(String(e));}finally{setBusy(false);}};
  const handleDeleteCategory = async id=>{if(!window.confirm(tr('confirmDeleteCategory')))return;try{await deleteCategory(id);if(selectedCategory===id)setSelectedCategory(null);await refresh();}catch(e){notify(tr('categoryHasChildren'));}};
  const handleSaveTranslation = async input=>{setBusy(true);try{await saveTranslation(input);setModal(null);if(activeBenefit)setActiveBenefit(await getBenefit(activeBenefit.id));notify(tr('saveTranslation'));}catch(e){notify(String(e));}finally{setBusy(false);}};

  const toggleSelected = id => setSelectedIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  const toggleAllVisible = () => setSelectedIds(ids=>benefits.every(b=>ids.includes(b.id))?ids.filter(id=>!benefits.some(b=>b.id===id)):[...new Set([...ids,...benefits.map(b=>b.id)])]);
  const toggleAllExchange = () => setSelectedIds(ids=>exchangeBenefits.length && exchangeBenefits.every(b=>ids.includes(b.id))?ids.filter(id=>!exchangeBenefits.some(b=>b.id===id)):[...new Set([...ids,...exchangeBenefits.map(b=>b.id)])]);
  const toggleCategoryScope = async () => {
    try {
      const scoped = await listBenefits('', exchangeCategory || null);
      const ids = scoped.map(b=>b.id);
      if (!ids.length) { notify(tr('noBenefitsInScope')); return; }
      const idSet = new Set(ids);
      const allSelected = ids.every(id=>selectedIds.includes(id));
      setSelectedIds(current=>allSelected ? current.filter(id=>!idSet.has(id)) : [...new Set([...current,...ids])]);
      notify(`${allSelected ? tr('removedScope') : tr('addedScope')} · ${ids.length}`);
    } catch (e) { notify(String(e)); }
  };
  const saveDownload = (bundle) => {
    const blob = new Blob([JSON.stringify(bundle,null,2)],{type:'application/vnd.knowledge-without-borders+json;charset=utf-8'});
    const filename=`KWB-Library-${new Date().toISOString().slice(0,10)}.kwb`;
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    return filename;
  };
  const createShareFile = async ids => {
    const bundle=await exportBundle(ids);
    if(bundle.filePath) return {filePath:bundle.filePath,filename:bundle.filePath.split(/[\\/]/).pop()};
    return {filePath:null,filename:saveDownload(bundle)};
  };
  const deliverExport = async ids => {
    const output=await createShareFile(ids);
    if(output.filePath){notify(`${tr('exportDone')}: ${output.filePath}`);return output.filePath;}
    notify(tr('exportDone'));return null;
  };
  const handleExport = async () => { if (!selectedIds.length) { notify(tr('selectAtLeastOne')); return; } await deliverExport(selectedIds); };
  const handleExportAll = async () => { await deliverExport([]); };
  const handleImportFile = async e => {
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    setBusy(true);try{const text=await file.text();const result=await importBundle(text,attributeSender?senderName.trim():'');await refresh();setSelectedIds([]);setView('library');notify(`${tr('importDone')} — ${tr('importedCount')}: ${result.imported_benefits} · ${tr('skippedCount')}: ${result.skipped_benefits} · ${tr('importedCategories')}: ${result.imported_categories}`);}catch(err){notify(tr('fileInvalid'));}finally{setBusy(false);}
  };
  const openShareApp = async app => {
    if (!selectedIds.length) { notify(tr('selectAtLeastOne')); return; }
    const webHome={whatsapp:'https://web.whatsapp.com/',telegram:'https://web.telegram.org/',messenger:'https://www.messenger.com/'};
    const projectUrl='https://github.com/aboalmaty/knowledge-without-borders';
    setBusy(true);
    try {
      if (shareMode === 'text') {
        const records=(await Promise.all(selectedIds.map(id=>getBenefit(id)))).filter(Boolean);
        if (!records.length) throw new Error('no_selected_benefits');
        const message=buildShareText(records,categories,tr);
        let copied=false;
        try { copied=await copyTextToClipboard(message); } catch { /* Clipboard remains a convenient fallback. */ }

        if (app === 'messenger') {
          // Messenger has no confirmed, general-purpose Windows desktop URI for prefilled message text.
          await openMessagingTarget(app, null, webHome[app]);
          notify(copied ? tr('shareTextCopied') : tr('shareTextCopyFailed'));
          return;
        }

        if (message.length <= 3500) {
          // Prefer the installed Windows clients; use the web share URL only if no URI handler exists.
          const nativeUri = app === 'whatsapp'
            ? `whatsapp://send?text=${encodeURIComponent(message)}`
            : `tg://msg_url?url=${encodeURIComponent(projectUrl)}&text=${encodeURIComponent(message)}`;
          const webShareUrl = app === 'whatsapp'
            ? `https://wa.me/?text=${encodeURIComponent(message)}`
            : `https://t.me/share/url?url=${encodeURIComponent(projectUrl)}&text=${encodeURIComponent(message)}`;
          await openMessagingTarget(app, nativeUri, webShareUrl);
          notify(tr('shareTextReady'));
        } else {
          if (!copied) throw new Error('clipboard_unavailable');
          const nativeUri = app === 'whatsapp'
            ? 'whatsapp://app'
            : `tg://msg_url?url=${encodeURIComponent(projectUrl)}`;
          await openMessagingTarget(app, nativeUri, webHome[app]);
          notify(tr('shareTextCopied'));
        }
      } else {
        const output=await createShareFile(selectedIds);
        // Open the native client first, then reveal the exported file for manual attachment.
        // Telegram's share picker provides a convenient chat choice; the file itself is never sent automatically.
        const nativeUri = app === 'whatsapp'
          ? 'whatsapp://app'
          : app === 'telegram'
            ? `tg://msg_url?url=${encodeURIComponent(projectUrl)}`
            : null;
        await openMessagingTarget(app, nativeUri, webHome[app]);
        if (output.filePath && isDesktop) {
          try { await revealFileInFolder(output.filePath); }
          catch { /* The file is still saved; the user can open Downloads manually. */ }
        }
        notify(tr('shareReadyAttach'));
      }
    } catch(e) { notify(String(e)); }
    finally { setBusy(false); }
  };
  const currentTitle = activeBenefit?.title || '';

  const sidebarItems = [
    ['dashboard','grid','dashboard'],['library','book','library'],['categories','folder','categories'],['exchange','share','exchange'],['settings','settings','settings']
  ];
  const statCards = [
    ['totalBenefits','total','blue','book'],['today','today','mint','plus'],['week','week','violet','grid'],['month','month','amber','folder'],['year','year','indigo','globe'],['received','received','rose','download']
  ];

  return <div className="app-shell" data-theme={theme} dir={rtl?'rtl':'ltr'}>
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><span>✦</span><i/></div><div><div className="brand-name">{tr('brand')}</div><div className="brand-tagline">{tr('tagline')}</div></div></div>
      <div className="nav-label">{tr('overview')}</div>
      <nav className="side-nav">
        {sidebarItems.map(([id,icon,label])=><button key={id} className={`nav-item ${view===id?'selected':''}`} onClick={()=>setView(id)}><Icon name={icon}/><span>{tr(label)}</span>{view===id&&<span className="nav-active-dot"/>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-card"><span className="local-icon"><Icon name="globe"/></span><div><strong>{isDesktop?'Local-first':'Preview mode'}</strong><small>{isDesktop?tr('footer'):'Browser storage preview'}</small></div><span className="online-dot"/></div>
        <div className="sidebar-version">{tr('beta')}</div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumb"><span>{tr('brand')}</span><Icon name="arrow"/><strong>{tr(view)}</strong></div>
        <div className="top-actions">
          <label className="language-select"><Icon name="globe"/><select value={lang} onChange={e=>setLang(e.target.value)} aria-label="Language">{LANGUAGES.map(l=><option value={l.code} key={l.code}>{l.native}</option>)}</select><Icon name="chevron"/></label>
          <button className="top-add" onClick={openNewBenefit}><Icon name="plus"/><span>{tr('addBenefit')}</span></button>
        </div>
      </header>

      {view==='dashboard' && <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow">KNOWLEDGE WITHOUT BORDERS · 0.2.2</div><h1>{tr('dashboard')}</h1><p>{tr('tagline')}</p></div><div className="welcome-symbol">✧</div></div>
        <section className="stats-grid">
          {statCards.map(([label,key,tone,icon])=><article className={`stat-card ${tone}`} key={key}><div className="stat-top"><span>{tr(label)}</span><span className="stat-icon"><Icon name={icon}/></span></div><strong>{dashboard.stats?.[key] ?? 0}</strong><div className="stat-foot">{key==='received'?tr('importedCategories'):tr('overview')}</div></article>)}
        </section>
        <section className="dashboard-grid">
          <article className="panel distribution-panel"><div className="panel-heading"><div><h2>{tr('categoryDistribution')}</h2><p>{tr('totalBenefits')}: {dashboard.stats?.total || 0}</p></div><button className="text-link" onClick={()=>setView('categories')}>{tr('categories')} <Icon name="arrow"/></button></div>
            {(dashboard.stats?.category_counts || []).length ? <div className="distribution-list">{dashboard.stats.category_counts.map((c,i)=>{const max=Math.max(1,...dashboard.stats.category_counts.map(x=>x.count));return <button key={c.id} className="distribution-row" onClick={()=>{setSelectedCategory(c.id);setView('library');}}><span className="distribution-name"><i className={`bar-dot dot-${i%5}`}/>{c.name}</span><span className="bar-track"><i style={{width:`${Math.max(2,c.count/max*100)}%`}}/></span><strong>{c.count}</strong></button>;})}</div> : <div className="empty-inline"><span className="empty-art">✧</span><p>{tr('emptyCategories')}</p><button className="btn btn-outline" onClick={()=>setModal({type:'category',initial:null})}>{tr('addCategory')}</button></div>}
          </article>
          <article className="panel quick-panel"><div className="panel-heading"><div><h2>{tr('quickActions')}</h2><p>{tr('tagline')}</p></div></div>
            <button className="quick-action" onClick={openNewBenefit}><span className="quick-icon q-blue"><Icon name="plus"/></span><span><strong>{tr('addBenefit')}</strong><small>{tr('newBenefit')}</small></span><Icon name="arrow"/></button>
            <button className="quick-action" onClick={()=>setModal({type:'category',initial:null})}><span className="quick-icon q-violet"><Icon name="folder"/></span><span><strong>{tr('addCategory')}</strong><small>{tr('categories')}</small></span><Icon name="arrow"/></button>
            <button className="quick-action" onClick={()=>setView('exchange')}><span className="quick-icon q-mint"><Icon name="share"/></span><span><strong>{tr('export')}</strong><small>{tr('import')}</small></span><Icon name="arrow"/></button>
          </article>
        </section>
        <section className="panel recent-panel"><div className="panel-heading"><div><h2>{tr('recent')}</h2><p>{tr('overview')}</p></div><button className="text-link" onClick={()=>setView('library')}>{tr('library')} <Icon name="arrow"/></button></div>
          {dashboard.recent?.length ? <div className="recent-list">{dashboard.recent.map(b=><button className="recent-item" key={b.id} onClick={async()=>{setActiveBenefit(await getBenefit(b.id));setView('library');}}><span className="recent-file"><Icon name="file"/></span><span className="recent-text"><strong>{b.title}</strong><small>{b.book || b.author || categoryPath(categories,b.category_id) || tr('noCategory')}</small></span><time>{fmtDate(b.added_at || b.created_at,lang)}</time><Icon name="arrow"/></button>)}</div> : <div className="empty-recent"><span>✧</span><p>{tr('noBenefits')}</p><button className="btn btn-primary" onClick={openNewBenefit}>{tr('addBenefit')}</button></div>}
        </section>
      </div>}

      {view==='library' && <div className="page-content library-page">
        <div className="page-title-row"><div><div className="eyebrow">PERSONAL KNOWLEDGE BASE</div><h1>{tr('library')}</h1><p>{tr('totalBenefits')}: {dashboard.stats?.total || 0}</p></div><button className="btn btn-primary" onClick={openNewBenefit}><Icon name="plus"/>{tr('addBenefit')}</button></div>
        <div className="library-layout">
          <aside className="panel library-categories"><div className="panel-heading compact"><h2>{tr('categories')}</h2><button className="icon-btn soft" onClick={()=>setModal({type:'category',initial:null})}><Icon name="plus"/></button></div><CategoryTree categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} lang={lang}/></aside>
          <section className="library-results">
            <div className="search-line"><div className="search-box"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('searchPlaceholder')}/><kbd>⌘ K</kbd></div><button className={`btn btn-outline ${selectedIds.length?'has-selection':''}`} onClick={()=>setView('exchange')}><Icon name="share"/>{tr('export')} {selectedIds.length?`(${selectedIds.length})`:''}</button></div>
            <div className="results-meta"><span>{tr('searchResults')} · {benefits.length}</span><button className="subtle-link" onClick={toggleAllVisible}>{benefits.length && benefits.every(b=>selectedIds.includes(b.id))?tr('clearSelection'):tr('selectAll')}</button></div>
            <div className="benefit-list">{benefits.length ? benefits.map(b=><article key={b.id} className={`benefit-card ${activeBenefit?.id===b.id?'focused':''}`}>
              <input className="select-check" type="checkbox" checked={selectedIds.includes(b.id)} onChange={()=>toggleSelected(b.id)} aria-label={tr('selectItems')}/>
              <button className="benefit-card-main" onClick={async()=>setActiveBenefit(await getBenefit(b.id))}><span className="benefit-card-title">{b.title}</span><span className="benefit-card-preview">{(b.content_text || '').slice(0,180)}</span><span className="benefit-card-meta"><span><Icon name="folder"/>{categoryPath(categories,b.category_id)||tr('noCategory')}</span>{b.book&&<span><Icon name="book"/>{b.book}</span>}<time>{fmtDate(b.added_at || b.created_at,lang)}</time></span></button>
              <button className="icon-btn card-edit" onClick={()=>openEditBenefit(b)} title={tr('edit')}><Icon name="edit"/></button>
            </article>) : <div className="empty-state"><span className="empty-state-icon"><Icon name="book"/></span><h3>{tr('noBenefits')}</h3><button className="btn btn-primary" onClick={openNewBenefit}><Icon name="plus"/>{tr('addBenefit')}</button></div>}</div>
          </section>
          <aside className="panel detail-panel">
            {activeBenefit ? <>
              <div className="detail-head"><span className="detail-kicker">{tr('sourceLanguage')}: {LANGUAGES.find(l=>l.code===activeBenefit.source_language)?.native || activeBenefit.source_language}</span><div className="detail-actions"><button className="icon-btn" onClick={()=>openEditBenefit(activeBenefit)} title={tr('edit')}><Icon name="edit"/></button><button className="icon-btn danger" onClick={()=>handleDeleteBenefit(activeBenefit.id)} title={tr('delete')}><Icon name="trash"/></button></div></div>
              <h2 className="detail-title">{activeBenefit.title}</h2>
              <div className="detail-meta">{activeBenefit.book&&<span><Icon name="book"/>{activeBenefit.book}</span>}{activeBenefit.author&&<span>{activeBenefit.author}</span>}{(activeBenefit.volume||activeBenefit.page)&&<span>{activeBenefit.volume?`${tr('volume')} ${activeBenefit.volume}`:''} {activeBenefit.page?`${tr('page')} ${activeBenefit.page}`:''}</span>}</div>
              <div className="detail-content" dir={directionForLanguage(activeBenefit.source_language)} dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(activeBenefit.content_html || '')}}/>
              <div className="detail-credits">{activeBenefit.owner_name&&<span>{tr('owner')}: {activeBenefit.owner_name}</span>}{activeBenefit.sender_name&&<span>{tr('importedFrom')}: {activeBenefit.sender_name}</span>}</div>
              <div className="translations-section"><div className="translation-title"><h3>{tr('translations')} <span>{activeBenefit.translations?.length||0}</span></h3><button className="small-action" onClick={()=>setModal({type:'translation',benefit:activeBenefit,initial:null})}><Icon name="plus"/>{tr('addTranslation')}</button></div>
                {activeBenefit.translations?.length ? activeBenefit.translations.map(x=><button className="translation-row" key={x.id || x.language_code} onClick={()=>setModal({type:'translation',benefit:activeBenefit,initial:x})}><span className="translation-lang">{LANGUAGES.find(l=>l.code===x.language_code)?.native || x.language_code}</span><span>{x.title || (x.content_text || '').slice(0,50)}</span><em className={`status-${x.status}`}>{tr(x.status==='verified'?'verified':x.status==='reviewed'?'reviewed':'draft')}</em><Icon name="arrow"/></button>) : <p className="muted tiny">{tr('translationNotice')}</p>}
              </div>
            </> : <div className="detail-empty"><span className="detail-empty-icon"><Icon name="file"/></span><h3>{tr('view')}</h3><p>{tr('noBenefits')}</p></div>}
          </aside>
        </div>
      </div>}

      {view==='settings' && <div className="page-content settings-page">
        <div className="page-title-row"><div><div className="eyebrow">PERSONALIZATION</div><h1>{tr('settings')}</h1><p>{tr('settingsSubtitle')}</p></div><span className="exchange-mark"><Icon name="settings"/></span></div>
        <section className="panel settings-panel">
          <div className="settings-section-head"><div><h2>{tr('appearance')}</h2><p>{tr('appearanceHelp')}</p></div></div>
          <div className="theme-grid">
            {[['light','themeLight'],['dark','themeDark'],['sepia','themeSepia'],['mint','themeMint']].map(([key,label])=><button type="button" key={key} className={`theme-card ${theme===key?'active':''}`} onClick={()=>setTheme(key)}>
              <span className={`theme-preview preview-${key}`}><i/><i/><i/></span><strong>{tr(label)}</strong>{theme===key&&<span className="theme-active-mark"><Icon name="check"/></span>}
            </button>)}
          </div>
          <div className="settings-divider"/>
          <div className="settings-section-head"><div><h2>{tr('textSize')}</h2><p>{tr('textSizeHelp')}</p></div><strong className="scale-value">{Math.round(uiScale*100)}%</strong></div>
          <div className="scale-row"><button className="scale-button" type="button" onClick={()=>setUiScale(v=>Math.max(.8,Math.round((v-.05)*100)/100))} aria-label="Decrease size">−</button><input type="range" min="80" max="130" step="5" value={Math.round(uiScale*100)} onChange={e=>setUiScale(Number(e.target.value)/100)}/><button className="scale-button" type="button" onClick={()=>setUiScale(v=>Math.min(1.3,Math.round((v+.05)*100)/100))} aria-label="Increase size">+</button></div>
          <div className="settings-actions"><button className="btn btn-outline" onClick={()=>{setTheme('light');setUiScale(1);}}>{tr('resetSettings')}</button></div>
        </section>
      </div>}

      {view==='categories' && <div className="page-content">
        <div className="page-title-row"><div><div className="eyebrow">LIBRARY STRUCTURE</div><h1>{tr('categories')}</h1><p>{categories.length} {tr('categoriesCount')}</p></div><button className="btn btn-primary" onClick={()=>setModal({type:'category',initial:null})}><Icon name="plus"/>{tr('addCategory')}</button></div>
        <section className="panel categories-panel"><div className="category-table-head"><span>{tr('categoryName')}</span><span>{tr('parentCategory')}</span><span>{tr('benefits')}</span><span>{tr('actions')}</span></div>
          {flatCategories.length ? flatCategories.map(c=><div className="category-table-row" key={c.id}><div className="category-table-name" style={{paddingInlineStart:`${c.depth*24}px`}}><span className="category-folder"><Icon name="folder"/></span><strong>{c.name}</strong></div><span className="muted">{c.parent_id ? categoryMap.get(c.parent_id)?.name : '—'}</span><span><b className="count-pill">{c.benefit_count||0}</b></span><div className="row-actions"><button className="icon-btn" onClick={()=>setModal({type:'category',initial:c})} title={tr('edit')}><Icon name="edit"/></button><button className="icon-btn danger" onClick={()=>handleDeleteCategory(c.id)} title={tr('delete')}><Icon name="trash"/></button></div></div>) : <div className="empty-state"><span className="empty-state-icon"><Icon name="folder"/></span><h3>{tr('emptyCategories')}</h3><button className="btn btn-primary" onClick={()=>setModal({type:'category',initial:null})}>{tr('addCategory')}</button></div>}
        </section>
      </div>}

      {view==='exchange' && <div className="page-content">
        <div className="page-title-row"><div><div className="eyebrow">KNOWLEDGE EXCHANGE</div><h1>{tr('exchange')}</h1><p>{tr('selectItems')}</p></div><span className="exchange-mark"><Icon name="share"/></span></div>
        <div className="exchange-grid">
          <section className="panel exchange-panel"><div className="panel-heading"><div><h2>{tr('export')}</h2><p>{tr('selected')}: {selectedIds.length}</p></div><span className="exchange-step">01</span></div>
            <div className="exchange-filters"><div className="exchange-search"><Icon name="search"/><input value={exchangeSearch} onChange={e=>setExchangeSearch(e.target.value)} placeholder={tr('searchPlaceholder')}/></div><select value={exchangeCategory} onChange={e=>setExchangeCategory(e.target.value)}><option value="">{tr('allCategories')}</option>{flatCategories.map(c=><option key={c.id} value={c.id}>{'　'.repeat(c.depth)}{c.name} ({c.benefit_count||0})</option>)}</select></div>
            <div className="scope-select-row"><button className="btn btn-outline scope-select-button" onClick={toggleCategoryScope} disabled={busy}><Icon name="check"/>{exchangeCategory?tr('selectCategoryBenefits'):tr('selectAllLibraryBenefits')}</button><small>{tr('scopeSelectHelp')}</small></div>
            <div className="exchange-selection"><div className="selection-toolbar"><span>{tr('library')} · {exchangeBenefits.length}</span><button className="subtle-link" onClick={toggleAllExchange}>{exchangeBenefits.length && exchangeBenefits.every(b=>selectedIds.includes(b.id))?tr('clearSelection'):tr('selectAll')}</button></div>
              <div className="selection-list">{exchangeBenefits.length?exchangeBenefits.map(b=><label className="selection-item" key={b.id}><input type="checkbox" checked={selectedIds.includes(b.id)} onChange={()=>toggleSelected(b.id)}/><span><strong>{b.title}</strong><small>{categoryPath(categories,b.category_id)||tr('noCategory')}</small></span></label>):<p className="muted">{tr('noBenefits')}</p>}</div>
            </div>
            <div className="share-mode-picker" role="group" aria-label={tr('shareModeLabel')}>
              <label className={`share-mode-option ${shareMode==='text'?'selected':''}`}>
                <input type="radio" name="shareMode" value="text" checked={shareMode==='text'} onChange={()=>setShareMode('text')}/>
                <span><strong>{tr('shareAsText')}</strong></span>
              </label>
              <label className={`share-mode-option ${shareMode==='file'?'selected':''}`}>
                <input type="radio" name="shareMode" value="file" checked={shareMode==='file'} onChange={()=>setShareMode('file')}/>
                <span><strong>{tr('shareAsFile')}</strong></span>
              </label>
            </div>
            <div className="share-hint"><Icon name="file"/><p>{tr(shareMode==='text'?'shareTextHelp':'shareFileHelp')}</p></div>
            <button className="btn btn-primary full-width" onClick={handleExport} disabled={!selectedIds.length||busy}><Icon name="download"/>{tr('exportSelected')}</button>
            <button className="btn btn-outline full-width export-all-btn" onClick={handleExportAll} disabled={busy}><Icon name="book"/>{tr('exportAllLibrary')}</button>
            <div className="share-channels"><button disabled={!selectedIds.length||busy} onClick={()=>openShareApp('whatsapp')}>WhatsApp <span>↗</span></button><button disabled={!selectedIds.length||busy} onClick={()=>openShareApp('telegram')}>Telegram <span>↗</span></button><button disabled={!selectedIds.length||busy} onClick={()=>openShareApp('messenger')}>Messenger <span>↗</span></button></div>
          </section>
          <section className="panel exchange-panel import-panel"><div className="panel-heading"><div><h2>{tr('importTitle')}</h2><p>{tr('importHelp')}</p></div><span className="exchange-step">02</span></div>
            <div className="import-drop" onClick={()=>fileRef.current?.click()} role="button" tabIndex="0" onKeyDown={e=>e.key==='Enter'&&fileRef.current?.click()}><span className="import-art"><Icon name="upload"/></span><strong>{tr('chooseFile')}</strong><small>.kwb · Knowledge Without Borders</small><input ref={fileRef} type="file" accept=".kwb,application/json" hidden onChange={handleImportFile}/></div>
            <label className="field"><span>{tr('senderName')}</span><input value={senderName} onChange={e=>setSenderName(e.target.value)} placeholder={tr('senderName')}/></label>
            <label className="checkbox-line"><input type="checkbox" checked={attributeSender} onChange={e=>setAttributeSender(e.target.checked)}/><span>{tr('attributeSender')}</span></label>
            <div className="import-foot"><span><Icon name="check"/>{tr('footer')}</span><span>Version 1 bundle</span></div>
          </section>
        </div>
        <div className="translation-banner"><span className="translation-banner-icon"><Icon name="translate"/></span><div><strong>{tr('translations')}</strong><p>{tr('translationNotice')}</p></div><span className="soon-badge">ROADMAP</span></div>
      </div>}

      <footer className="app-footer"><span>© 2026 Knowledge Without Borders</span><span>{tr('footer')} · {tr('beta')}</span></footer>
    </main>

    {modal?.type==='benefit' && <Modal title={modal.initial?.id?tr('editBenefit'):tr('newBenefit')} onClose={()=>setModal(null)} wide><BenefitForm initial={modal.initial} categories={categories} lang={lang} busy={busy} onCancel={()=>setModal(null)} onSave={handleSaveBenefit}/></Modal>}
    {modal?.type==='category' && <Modal title={modal.initial?.id?tr('edit'):tr('newCategory')} onClose={()=>setModal(null)}><CategoryForm initial={modal.initial} categories={categories} lang={lang} busy={busy} onCancel={()=>setModal(null)} onSave={handleSaveCategory}/></Modal>}
    {modal?.type==='translation' && <Modal title={modal.initial?tr('edit'):tr('addTranslation')} onClose={()=>setModal(null)} wide><div className="translation-original"><strong>{tr('original')}: {modal.benefit.title}</strong><p dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(modal.benefit.content_html||'')}}/></div><TranslationForm benefit={modal.benefit} initial={modal.initial} lang={lang} busy={busy} onCancel={()=>setModal(null)} onSave={handleSaveTranslation}/></Modal>}
    {toast && <div className="toast"><span className="toast-check"><Icon name="check"/></span>{toast}</div>}
  </div>;
}
