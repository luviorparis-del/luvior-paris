/* ============================================================
   LUVIOR PARIS — Admin › Website Management
   Editor is generated from the data-cms-* tags in each public page, so the
   page HTML stays the single source of default content.
   Storage: site_content rows  cms-draft:<page> (draft)  and  cms:<page> (live).
   ============================================================ */

const WS_PAGES = [
  { id: 'home', label: 'Homepage', file: 'index.html', subtitle: 'Every section below the hero. Save a draft, preview it, then publish.',
    links: [['Hero & slideshow', 'home:hero'], ['Offer & promo banner', 'offers']] },
  { id: 'collections', label: 'Shop page', file: 'collections.html', subtitle: 'Text and images on the Collections / shop page.',
    links: [['Products', 'shop:products'], ['Collections', 'collections']] },
  { id: 'product', label: 'Product page', file: 'product.html', subtitle: 'Shipping & returns text and FAQ shown on every product page. Per-product details are edited in Shop → Products.' },
  { id: 'story', label: 'Our Story', file: 'our-story.html', subtitle: 'Story sections, images and their order.' },
  { id: 'journal', label: 'Journal', file: 'journal.html', subtitle: 'Banner, articles (cover, content, gallery, date, featured, published) and quote.' },
  { id: 'contact', label: 'Contact', file: 'contact.html', subtitle: 'Contact details, form wording, FAQ and social profiles.' },
  { id: 'footer', label: 'Footer', file: 'index.html', subtitle: 'Footer text, links, social profiles and copyright — shown on every page.' },
  { id: 'nav', label: 'Header menu', file: 'index.html', subtitle: 'Menu links in the header and mobile menu — shown on every page. The current page is highlighted automatically.' }
];
const WS_BUCKET = 'hero-images';
const WS_IMG_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
const WS_IMG_MAX = 10 * 1024 * 1024;

let ws = null;
let wsProducts = null;

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  children.flat().forEach(c => c !== null && c !== undefined && el.append(c instanceof Node ? c : document.createTextNode(c)));
  return el;
}

window.addEventListener('beforeunload', e => { if (ws && ws.dirty) { e.preventDefault(); e.returnValue = ''; } });

// Renders one page editor into the main content area (or a given host element).
async function renderWsPage(pageId, opts = {}) {
  const page = WS_PAGES.find(p => p.id === pageId);
  const host = opts.host || document.getElementById('page-content');
  if (!opts.host) {
    host.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">${esc(opts.title || page.label)}</h1><p class="page-subtitle">${esc(opts.subtitle || page.subtitle || '')}</p></div>
      </div>`;
  }
  const body = h('div', { id: 'ws-body' });
  body.innerHTML = loading();
  host.appendChild(body);
  await wsLoad(pageId, opts.only || null);
}

// Legacy entry point (#website) → Homepage sections.
function renderWebsite() { navigate('home:sections'); }

async function wsLoad(pageId, only = null) {
  const page = WS_PAGES.find(p => p.id === pageId);
  const body = document.getElementById('ws-body');
  body.innerHTML = loading();
  try {
    const [html, rows] = await Promise.all([
      fetch(`../${page.file}?v=${Date.now()}`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`Could not load ${page.file}`); return r.text(); }),
      sb.from('site_content').select('key,value,updated_at').in('key', ['cms-draft:' + pageId, 'cms:' + pageId])
    ]);
    if (rows.error) throw new Error(rows.error.message);
    if (!wsProducts) {
      const { data } = await sb.from('products').select('id,name,status,price,compare_price').order('name');
      wsProducts = data || [];
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const schema = CMS.extract(doc, pageId);
    const byKey = Object.fromEntries((rows.data || []).map(r => [r.key, r]));
    const draft = byKey['cms-draft:' + pageId], live = byKey['cms:' + pageId];
    ws = {
      page, schema, only,
      working: clone(draft?.value || live?.value) || { v: 1, sections: {}, order: [] },
      liveJson: JSON.stringify(live?.value || null),
      draftJson: JSON.stringify(draft?.value || null),
      dirty: false
    };
    wsRender();
  } catch (err) {
    console.error('Website editor load failed:', err);
    body.innerHTML = `<div class="empty-state"><h3>Could not load this page</h3><p>${esc(err.message)}</p></div>`;
  }
}

/* ---------- state helpers ---------- */
function wsSec(id) {
  if (!ws.working.sections[id]) ws.working.sections[id] = { hidden: false, f: {} };
  if (!ws.working.sections[id].f) ws.working.sections[id].f = {};
  return ws.working.sections[id];
}
function wsGet(secId, field) {
  const f = ws.working.sections[secId]?.f;
  return f && field.key in f ? clone(f[field.key]) : clone(field.def);
}
function wsSet(secId, key, value) {
  if (value === undefined) delete wsSec(secId).f[key];
  else wsSec(secId).f[key] = value;
  wsDirty();
}
function wsDirty() {
  ws.dirty = true;
  wsStatus();
}
function wsOrder() {
  const ids = ws.schema.map(s => s.id);
  const saved = (ws.working.order || []).filter(id => ids.includes(id));
  return [...saved, ...ids.filter(id => !saved.includes(id))];
}

/* ---------- page render ---------- */
function wsRender() {
  const body = document.getElementById('ws-body');
  body.replaceChildren();
  const bar = h('div', { class: 'ws-toolbar card' },
    h('div', { class: 'ws-toolbar__status', id: 'ws-status' }),
    h('div', { class: 'btn-group' },
      h('button', { class: 'btn btn-outline', id: 'ws-discard', text: 'Discard draft', onclick: wsDiscard }),
      h('button', { class: 'btn btn-outline', id: 'ws-save', text: 'Save draft', onclick: () => wsSave(false) }),
      h('button', { class: 'btn btn-outline', text: 'Preview', onclick: wsPreview }),
      h('button', { class: 'btn btn-primary', text: 'Publish', onclick: () => wsSave(true) })));
  body.appendChild(bar);

  if (!ws.only && ws.page.links) {
    const info = h('div', { class: 'ws-info' });
    (ws.only ? [] : ws.page.links || []).forEach(([label, target]) => info.appendChild(h('button', { class: 'btn btn-sm btn-outline', text: label + ' →', onclick: () => navigate(target) })));
    body.appendChild(info);
  }

  const order = wsOrder();
  const visible = ws.only ? ws.schema.filter(sec => ws.only.includes(sec.id)) : ws.schema;
  const sorted = [...visible].sort((a, b) => (a.pinned === b.pinned ? order.indexOf(a.id) - order.indexOf(b.id) : a.pinned ? -1 : 1));
  const list = h('div', { class: 'ws-sections', id: 'ws-sections' });
  sorted.forEach(sec => list.appendChild(wsSectionCard(sec)));
  body.appendChild(list);
  wsStatus();
}

function wsStatus() {
  const el = document.getElementById('ws-status');
  if (!el) return;
  const cur = JSON.stringify(ws.working);
  let text, cls;
  if (ws.dirty) { text = 'Unsaved changes'; cls = 'badge-pending'; }
  else if (ws.draftJson !== 'null' && ws.draftJson !== ws.liveJson) { text = 'Draft saved — not published yet'; cls = 'badge-processing'; }
  else if (ws.liveJson !== 'null' && cur === ws.liveJson) { text = 'Published — live on the website'; cls = 'badge-active'; }
  else { text = 'Showing original page content'; cls = 'badge-draft'; }
  el.innerHTML = `<span class="badge ${cls}">${text}</span>`;
  const discard = document.getElementById('ws-discard');
  if (discard) discard.disabled = !(ws.dirty || (ws.draftJson !== 'null' && ws.draftJson !== ws.liveJson));
}

function wsSectionCard(sec) {
  const state = ws.working.sections[sec.id];
  const hidden = !!state?.hidden;
  const card = h('div', { class: 'ws-section card' + (hidden ? ' is-hidden' : ''), 'data-sec': sec.id });
  const bodyEl = h('div', { class: 'ws-section__body', hidden: true });
  const toggle = h('button', { class: 'ws-section__toggle', 'aria-expanded': 'false', onclick: () => {
    const open = bodyEl.hidden;
    bodyEl.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !bodyEl.childElementCount) wsFillSection(bodyEl, sec);
  } }, h('span', { class: 'ws-caret', 'aria-hidden': 'true', text: '▸' }), sec.label);

  const actions = h('div', { class: 'ws-section__actions' });
  if (!sec.pinned && !ws.only) {
    actions.append(
      h('button', { class: 'btn btn-sm btn-outline', title: 'Move up', 'aria-label': `Move ${sec.label} up`, text: '↑', onclick: () => wsMove(sec.id, -1) }),
      h('button', { class: 'btn btn-sm btn-outline', title: 'Move down', 'aria-label': `Move ${sec.label} down`, text: '↓', onclick: () => wsMove(sec.id, 1) }));
  }
  if (sec.hideable) {
    const cb = h('input', { type: 'checkbox', checked: !hidden, onchange: e => {
      wsSec(sec.id).hidden = !e.target.checked;
      card.classList.toggle('is-hidden', !e.target.checked);
      wsDirty();
    } });
    actions.appendChild(h('label', { class: 'form-check ws-visible' }, cb, 'Visible'));
  }
  card.append(h('div', { class: 'ws-section__head' }, toggle, actions), bodyEl);
  return card;
}

function wsMove(id, dir) {
  const movable = wsOrder().filter(x => !ws.schema.find(s => s.id === x).pinned);
  const i = movable.indexOf(id), j = i + dir;
  if (j < 0 || j >= movable.length) return;
  [movable[i], movable[j]] = [movable[j], movable[i]];
  ws.working.order = movable;
  wsDirty();
  const list = document.getElementById('ws-sections');
  const card = list.querySelector(`[data-sec="${id}"]`);
  const other = list.querySelector(`[data-sec="${movable[i]}"]`);
  if (dir < 0) other.before(card); else other.after(card);
}

function wsFillSection(bodyEl, sec) {
  if (sec.hint) bodyEl.appendChild(h('p', { class: 'ws-hint ws-hint--section', text: sec.hint }));
  if (sec.fields.length === 0) bodyEl.appendChild(h('p', { class: 'ws-hint', text: 'Nothing to edit here directly. Use the Visible switch to show or hide this section.' }));
  sec.fields.forEach(field => bodyEl.appendChild(wsField(field, wsGet(sec.id, field), v => wsSet(sec.id, field.key, v), sec.id)));
}

/* ---------- field editors ---------- */
function wsField(field, value, onChange, scope) {
  const wrap = h('div', { class: 'form-group ws-field' }, h('label', { text: field.label }));
  if (field.hint) wrap.appendChild(h('p', { class: 'ws-hint', text: field.hint }));
  switch (field.kind) {
    case 'textarea':
      wrap.appendChild(h('textarea', { rows: 3, maxlength: 4000, oninput: e => onChange(e.target.value) }, value ?? ''));
      break;
    case 'link': {
      const v = value || { label: '', href: '' };
      const row = h('div', { class: 'form-row' },
        h('input', { placeholder: 'Text', value: v.label || '', maxlength: 200, oninput: e => { v.label = e.target.value; onChange({ ...v }); } }),
        h('input', { placeholder: 'Link (page.html, https://…, mailto:, tel:)', value: v.href || '', maxlength: 500, oninput: e => { v.href = e.target.value; onChange({ ...v }); } }));
      wrap.appendChild(row);
      break;
    }
    case 'bool':
      wrap.classList.add('ws-field--inline');
      wrap.prepend(h('input', { type: 'checkbox', checked: !!value, onchange: e => onChange(e.target.checked) }));
      break;
    case 'datetime': {
      const local = value ? wsToLocalInput(value) : '';
      const input = h('input', { type: 'datetime-local', value: local, onchange: e => onChange(e.target.value ? new Date(e.target.value).toISOString() : '') });
      wrap.appendChild(h('div', { class: 'ws-inline' }, input, h('button', { class: 'btn btn-sm btn-outline', type: 'button', text: 'Clear', onclick: () => { input.value = ''; onChange(''); } })));
      wrap.appendChild(h('p', { class: 'ws-hint', text: 'Leave empty for no countdown. When the time passes the offer hides automatically.' }));
      break;
    }
    case 'product': {
      const sel = h('select', { onchange: e => onChange(e.target.value) }, h('option', { value: '', text: 'Automatic — biggest active discount' }));
      wsProducts.forEach(p => sel.appendChild(h('option', { value: String(p.id), selected: String(value) === String(p.id), text: `${p.name}${p.status !== 'active' ? ' (draft — not shown)' : ''}` })));
      wrap.appendChild(sel);
      break;
    }
    case 'image':
      wrap.appendChild(wsImageEditor(value, onChange, scope));
      break;
    case 'gallery':
      wrap.appendChild(wsGalleryEditor(value || [], onChange, scope));
      break;
    case 'list':
      wrap.appendChild(wsListEditor(field, value || [], onChange, scope));
      break;
    default:
      wrap.appendChild(h('input', { value: value ?? '', maxlength: 1000, oninput: e => onChange(e.target.value) }));
  }
  return wrap;
}

function wsToLocalInput(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function wsListEditor(field, items, onChange, scope) {
  const box = h('div', { class: 'ws-list' });
  const emit = () => { onChange(clone(items)); draw(); };
  function draw() {
    box.replaceChildren();
    items.forEach((item, i) => {
      const head = h('div', { class: 'ws-list__head' },
        h('strong', { text: wsItemTitle(item, i) }),
        h('div', { class: 'ws-list__actions' },
          h('button', { class: 'btn btn-sm btn-outline', type: 'button', title: 'Move up', text: '↑', disabled: i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; emit(); } }),
          h('button', { class: 'btn btn-sm btn-outline', type: 'button', title: 'Move down', text: '↓', disabled: i === items.length - 1, onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; emit(); } }),
          h('button', { class: 'btn btn-sm btn-outline ws-danger', type: 'button', title: 'Remove', text: 'Remove', onclick: async () => {
            if (!(await showConfirm('Remove this item?', 'Remove item', 'Remove'))) return;
            items.splice(i, 1); emit();
          } })));
      const fieldsEl = h('div', { class: 'ws-list__fields', hidden: items.length > 3 });
      head.querySelector('strong').addEventListener('click', () => { fieldsEl.hidden = !fieldsEl.hidden; });
      field.item.forEach(sf => fieldsEl.appendChild(wsField(sf, clone(item[sf.key]), v => { item[sf.key] = v; onChange(clone(items)); }, scope)));
      box.appendChild(h('div', { class: 'ws-list__item' }, head, fieldsEl));
    });
    box.appendChild(h('button', { class: 'btn btn-sm btn-outline', type: 'button', text: '+ Add item', onclick: () => {
      const base = items.length ? clone(items[items.length - 1]) : {};
      field.item.forEach(sf => {
        if (sf.kind === 'text' || sf.kind === 'textarea') base[sf.key] = '';
        if (sf.kind === 'link') base[sf.key] = { label: '', href: '' };
        if (sf.kind === 'image') base[sf.key] = { src: '', d: { ...CMS.IMG_POS }, m: { ...CMS.IMG_POS } };
        if (sf.kind === 'gallery') base[sf.key] = [];
        if (sf.kind === 'bool') base[sf.key] = sf.key === 'published';
      });
      items.push(base); emit();
    } }));
  }
  draw();
  return box;
}

function wsItemTitle(item, i) {
  const first = Object.values(item).find(v => typeof v === 'string' && v.trim()) || Object.values(item).find(v => v && typeof v === 'object' && v.label);
  const text = typeof first === 'string' ? first : first?.label;
  return `${i + 1}. ${text ? text.slice(0, 60) : 'Item'}`;
}

/* ---------- image editor ---------- */
async function wsUpload(file, scope) {
  if (!WS_IMG_TYPES.includes(file.type)) throw new Error('Use a PNG, WebP or JPEG image (PNG/WebP keep transparency).');
  if (file.size > WS_IMG_MAX) throw new Error('Image is larger than 10MB.');
  await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => { URL.revokeObjectURL(url); resolve(); };
    probe.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a readable image.')); };
    probe.src = url;
  });
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `site/${ws?.page.id || 'shared'}/${scope || 'misc'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(WS_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return sb.storage.from(WS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function wsImageEditor(value, onChange, scope) {
  let v = value && (value.src || value.cleared) ? value : null;
  let device = 'd';
  const root = h('div', { class: 'ws-img' });
  const stage = h('div', { class: 'ws-img__stage' });
  const status = h('p', { class: 'ws-hint' });
  const fileInput = h('input', { type: 'file', accept: WS_IMG_TYPES.join(','), hidden: true, onchange: async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    status.textContent = 'Uploading…';
    try {
      const src = await wsUpload(file, scope);
      v = { src, d: { ...(v?.d || CMS.IMG_POS) }, m: { ...(v?.m || CMS.IMG_POS) } };
      onChange(clone(v));
      status.textContent = 'Uploaded. Save or publish to keep it.';
      draw();
    } catch (err) {
      console.error('Image upload failed:', err);
      status.textContent = '';
      showToast(err.message, 'error');
    }
  } });

  const sliders = h('div', { class: 'ws-img__sliders' });
  const SL = [['w', 'Size', 10, 200, 1, '%'], ['x', 'Horizontal', -60, 60, 1, '%'], ['y', 'Vertical', -60, 60, 1, '%'], ['s', 'Scale', 0.5, 2, 0.05, '×']];

  function draw() {
    stage.replaceChildren();
    const pos = v?.src ? { ...CMS.IMG_POS, ...(v.d || {}), ...(device === 'm' ? v.m || {} : {}) } : null;
    if (v?.src) {
      const img = h('img', { src: v.src, alt: '' });
      img.style.width = pos.w + '%';
      img.style.transform = `translate(${pos.x}%, ${pos.y}%) scale(${pos.s})`;
      stage.appendChild(img);
    } else {
      stage.appendChild(h('span', { text: v?.cleared ? 'Image removed — this spot stays empty' : 'Using the page default image' }));
    }
    sliders.replaceChildren();
    if (v?.src) {
      sliders.appendChild(h('div', { class: 'ws-img__devices' },
        h('button', { type: 'button', class: 'filter-btn' + (device === 'd' ? ' active' : ''), text: 'Desktop', onclick: () => { device = 'd'; draw(); } }),
        h('button', { type: 'button', class: 'filter-btn' + (device === 'm' ? ' active' : ''), text: 'Mobile', onclick: () => { device = 'm'; draw(); } })));
      SL.forEach(([k, label, min, max, step, unit]) => {
        const out = h('span', { class: 'ws-img__val', text: pos[k] + unit });
        const input = h('input', { type: 'range', min, max, step, value: pos[k], 'aria-label': `${label} (${device === 'd' ? 'desktop' : 'mobile'})`, oninput: e => {
          const n = Number(e.target.value);
          if (device === 'd') v.d = { ...CMS.IMG_POS, ...(v.d || {}), [k]: n };
          else v.m = { ...(v.m || {}), [k]: n };
          out.textContent = n + unit;
          const img = stage.querySelector('img');
          const p = { ...CMS.IMG_POS, ...(v.d || {}), ...(device === 'm' ? v.m || {} : {}) };
          img.style.width = p.w + '%';
          img.style.transform = `translate(${p.x}%, ${p.y}%) scale(${p.s})`;
          onChange(clone(v));
        } });
        sliders.appendChild(h('label', { class: 'ws-img__slider' }, h('span', { text: label }), input, out));
      });
      sliders.appendChild(h('button', { type: 'button', class: 'btn btn-sm btn-outline', text: `Reset ${device === 'd' ? 'desktop' : 'mobile'} position`, onclick: () => {
        if (device === 'd') v.d = { ...CMS.IMG_POS }; else v.m = {};
        onChange(clone(v)); draw();
      } }));
    }
    buttons.querySelector('[data-act="upload"]').textContent = v?.src ? 'Replace image' : 'Upload image';
    buttons.querySelector('[data-act="remove"]').disabled = !v?.src;
    buttons.querySelector('[data-act="default"]').disabled = !v;
  }

  const buttons = h('div', { class: 'btn-group' },
    h('button', { type: 'button', class: 'btn btn-sm btn-primary', 'data-act': 'upload', onclick: () => fileInput.click() }),
    h('button', { type: 'button', class: 'btn btn-sm btn-outline', 'data-act': 'remove', text: 'Remove', onclick: () => { v = { src: '', cleared: true }; onChange(clone(v)); draw(); } }),
    h('button', { type: 'button', class: 'btn btn-sm btn-outline', 'data-act': 'default', text: 'Use page default', onclick: () => { v = null; onChange(undefined); draw(); } }));

  root.append(stage, buttons, fileInput, status, sliders);
  draw();
  return root;
}

function wsGalleryEditor(srcs, onChange, scope) {
  const box = h('div', { class: 'ws-gallery' });
  const input = h('input', { type: 'file', accept: WS_IMG_TYPES.join(','), multiple: true, hidden: true, onchange: async e => {
    const files = [...e.target.files];
    e.target.value = '';
    for (const file of files) {
      try { srcs.push(await wsUpload(file, scope + '-gallery')); }
      catch (err) { showToast(`${file.name}: ${err.message}`, 'error'); }
    }
    onChange([...srcs]); draw();
  } });
  function draw() {
    box.replaceChildren();
    srcs.forEach((src, i) => box.appendChild(h('div', { class: 'ws-gallery__item' },
      h('img', { src, alt: '' }),
      h('button', { type: 'button', title: 'Remove', 'aria-label': 'Remove image', text: '×', onclick: () => { srcs.splice(i, 1); onChange([...srcs]); draw(); } }))));
    box.appendChild(h('button', { type: 'button', class: 'btn btn-sm btn-outline', text: '+ Add images', onclick: () => input.click() }));
    box.appendChild(input);
  }
  draw();
  return box;
}

/* ---------- validation / save / publish / preview ---------- */
function wsValidate() {
  const bad = [];
  const okHref = href => !href || /^(https?:\/\/|mailto:|tel:|#|\/|[a-z0-9-]+\.html)/i.test(href.trim());
  const walk = (val, where) => {
    if (Array.isArray(val)) val.forEach((x, i) => walk(x, `${where} #${i + 1}`));
    else if (val && typeof val === 'object') {
      if ('href' in val && !okHref(val.href)) bad.push(`${where}: link "${val.href}" is not valid`);
      Object.entries(val).forEach(([k, x]) => k !== 'href' && walk(x, where));
    }
  };
  Object.entries(ws.working.sections).forEach(([id, sec]) => {
    const label = ws.schema.find(s => s.id === id)?.label || id;
    walk(sec.f, label);
  });
  return bad;
}

async function wsWrite(key) {
  const { error } = await sb.from('site_content').upsert({ key, value: ws.working, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

async function wsSave(publish) {
  const problems = wsValidate();
  if (problems.length) { showToast(problems[0], 'error', 6000); return false; }
  if (publish && !(await showConfirm(`Publish "${ws.page.label}" to the live website?`, 'Publish changes', 'Publish', 'btn-primary'))) return false;
  try {
    await wsWrite('cms-draft:' + ws.page.id);
    ws.draftJson = JSON.stringify(ws.working);
    if (publish) {
      await wsWrite('cms:' + ws.page.id);
      ws.liveJson = ws.draftJson;
    }
    ws.dirty = false;
    wsStatus();
    showToast(publish ? `${ws.page.label} published` : 'Draft saved', 'success');
    return true;
  } catch (err) {
    console.error('Website save failed:', err);
    showToast('Save failed: ' + err.message, 'error', 6000);
    return false;
  }
}

async function wsPreview() {
  if (ws.dirty && !(await wsSave(false))) return;
  window.open(`../${ws.page.file}?cms_preview=1${ws.only ? '#special-offer' : ''}`, '_blank', 'noopener');
}

async function wsDiscard() {
  if (!(await showConfirm('Discard the draft and go back to the live version of this page?', 'Discard draft', 'Discard'))) return;
  try {
    const { error } = await sb.from('site_content').delete().eq('key', 'cms-draft:' + ws.page.id);
    if (error) throw new Error(error.message);
    showToast('Draft discarded', 'success');
    ws.dirty = false;
    await wsLoad(ws.page.id, ws.only);
  } catch (err) {
    showToast('Could not discard: ' + err.message, 'error');
  }
}


/* ============================================================
   OFFERS & PROMOTIONS — offer + promo banner editor, discount overview
   ============================================================ */
async function renderOffers() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header"><div><h1 class="page-title">Offers & Promotions</h1>
      <p class="page-subtitle">The homepage special offer (product, countdown), the promotional banner, and every discounted product.</p></div></div>
    <div id="offer-editor"></div>
    <section class="settings-block">
      <h3>Discounted products</h3>
      <p class="ws-hint">A product is discounted when its Compare-at price is higher than its price. Edit prices in Shop → Products.</p>
      <div id="offer-products">${loading()}</div>
    </section>`;
  renderWsPage('home', { host: el.querySelector('#offer-editor'), only: ['offer', 'ticker'] });
  const box = el.querySelector('#offer-products');
  const { data, error } = await sb.from('products').select('id,name,status,price,compare_price').order('name');
  if (error) { box.innerHTML = `<p class="ws-hint">Could not load products: ${esc(error.message)}</p>`; return; }
  const rows = (data || []).filter(p => p.compare_price);
  if (!rows.length) { box.innerHTML = '<p class="ws-hint">No product has a Compare-at price yet.</p>'; return; }
  box.innerHTML = `<div class="table-wrap"><table class="mobile-cards">
    <thead><tr><th>Product</th><th>Price</th><th>Compare-at</th><th>Discount</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map(p => {
      const valid = p.compare_price > p.price;
      return `<tr>
        <td data-label="Product"><strong>${esc(p.name)}</strong></td>
        <td data-label="Price">${formatPriceRaw(p.price)}</td>
        <td data-label="Compare-at">${formatPriceRaw(p.compare_price)}</td>
        <td data-label="Discount">${valid ? `<span class="badge badge-active">${Math.round((1 - p.price / p.compare_price) * 100)}% off</span>` : '<span class="badge badge-failed">Compare-at is below price</span>'}</td>
        <td data-label="Status">${badge(p.status)}</td>
        <td data-label=""><button class="btn btn-sm btn-outline" onclick="openProductForm(${p.id})">Edit</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

/* ============================================================
   MEDIA LIBRARY — every uploaded image across storage buckets
   ============================================================ */
const MEDIA_BUCKETS = [['product-images', 'Products'], ['hero-images', 'Website & hero']];

async function mediaList(bucket, prefix = '', depth = 0, out = []) {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error(error.message);
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) { if (depth < 4) await mediaList(bucket, path, depth + 1, out); }
    else if (!item.name.startsWith('.')) out.push({ bucket, path, name: item.name, size: item.metadata?.size || 0, created: item.created_at, url: sb.storage.from(bucket).getPublicUrl(path).data.publicUrl });
  }
  return out;
}

async function mediaUsage() {
  const [content, images, cols] = await Promise.all([
    sb.from('site_content').select('value'),
    sb.from('product_images').select('image_url'),
    sb.from('collections').select('image_url')
  ]);
  return [JSON.stringify((content.data || []).map(r => r.value)), ...(images.data || []).map(r => r.image_url), ...(cols.data || []).map(r => r.image_url)].join('\n');
}

let mediaState = { filter: 'all', items: [], used: '' };

async function renderMedia() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Media Library</h1><p class="page-subtitle">All uploaded images. Copy a link, upload new files, or delete unused ones.</p></div>
      <div class="btn-group">
        <button class="btn btn-primary" id="media-upload-btn">Upload images</button>
        <input type="file" id="media-upload" accept="${WS_IMG_TYPES.join(',')}" multiple hidden>
      </div>
    </div>
    <div class="filter-bar" id="media-filters"></div>
    <div id="media-grid">${loading()}</div>`;
  el.querySelector('#media-upload-btn').addEventListener('click', () => el.querySelector('#media-upload').click());
  el.querySelector('#media-upload').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    let ok = 0;
    for (const f of files) {
      try { await wsUpload(f, 'library'); ok++; } catch (err) { showToast(`${f.name}: ${err.message}`, 'error'); }
    }
    if (ok) { showToast(`${ok} image${ok > 1 ? 's' : ''} uploaded`, 'success'); renderMedia(); }
  });
  try {
    const [lists, used] = await Promise.all([Promise.all(MEDIA_BUCKETS.map(([b]) => mediaList(b))), mediaUsage()]);
    mediaState.items = lists.flat().sort((a, b) => String(b.created).localeCompare(String(a.created)));
    mediaState.used = used;
    mediaDraw();
  } catch (err) {
    console.error('Media load failed:', err);
    el.querySelector('#media-grid').innerHTML = `<div class="empty-state"><h3>Could not load media</h3><p>${esc(err.message)}</p></div>`;
  }
}

function mediaDraw() {
  const filters = document.getElementById('media-filters');
  const grid = document.getElementById('media-grid');
  if (!filters || !grid) return;
  const opts = [['all', 'All'], ...MEDIA_BUCKETS, ['unused', 'Not in use']];
  filters.replaceChildren(...opts.map(([id, label]) => h('button', { class: 'filter-btn' + (mediaState.filter === id ? ' active' : ''), text: label, onclick: () => { mediaState.filter = id; mediaDraw(); } })));
  const inUse = it => mediaState.used.includes(it.path);
  const items = mediaState.items.filter(it => mediaState.filter === 'all' || (mediaState.filter === 'unused' ? !inUse(it) : it.bucket === mediaState.filter));
  if (!items.length) { grid.innerHTML = '<div class="empty-state"><h3>No images here</h3></div>'; return; }
  grid.replaceChildren(h('div', { class: 'media-grid' }, items.map(it => h('figure', { class: 'media-item' },
    h('div', { class: 'media-item__thumb' }, h('img', { src: it.url, alt: '', loading: 'lazy' })),
    h('figcaption', {},
      h('span', { class: 'media-item__name', title: it.path, text: it.name }),
      h('span', { class: 'media-item__meta', text: `${(it.size / 1024).toFixed(0)} KB · ${inUse(it) ? 'In use' : 'Not in use'}` }),
      h('div', { class: 'media-item__actions' },
        h('button', { class: 'btn btn-sm btn-outline', text: 'Copy link', onclick: async () => { await navigator.clipboard.writeText(it.url); showToast('Link copied', 'success'); } }),
        h('button', { class: 'btn btn-sm btn-outline ws-danger', text: 'Delete', onclick: () => mediaDelete(it, inUse(it)) })))))));
}

async function mediaDelete(it, used) {
  const msg = used ? 'This image is used on the website or by a product. Deleting it will leave an empty space there. Delete anyway?' : 'Delete this image permanently?';
  if (!(await showConfirm(msg, 'Delete image'))) return;
  const { error } = await sb.storage.from(it.bucket).remove([it.path]);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  mediaState.items = mediaState.items.filter(x => x !== it);
  showToast('Image deleted', 'success');
  mediaDraw();
}
