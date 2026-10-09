/* ============================================================
   LUVIOR PARIS — CMS runtime
   Static HTML is the default content. Elements tagged with data-cms-* are
   editable from Admin → Website; published values are applied on load.
   Shared by public pages (apply) and the admin editor (extract).
   ============================================================ */
(function () {
    const IMG_POS = { w: 100, x: 0, y: 0, s: 1 };
    const BR = ' ';

    /* ---------- text / link / image primitives ---------- */
    function readText(el) {
        const c = el.cloneNode(true);
        c.querySelectorAll('.arrow, svg').forEach(n => n.remove());
        c.querySelectorAll('br').forEach(b => b.replaceWith(BR));
        return c.textContent.replace(/\s+/g, ' ').split(BR).map(s => s.trim()).join('\n').trim();
    }

    function writeText(el, value) {
        const svgs = [...el.querySelectorAll(':scope > svg')];
        const arrows = [...el.querySelectorAll(':scope > .arrow')];
        el.textContent = '';
        svgs.forEach(s => el.appendChild(s));
        String(value ?? '').split('\n').forEach((line, i) => {
            if (i) el.appendChild(document.createElement('br'));
            el.appendChild(document.createTextNode(line));
        });
        arrows.forEach(a => { el.appendChild(document.createTextNode(' ')); el.appendChild(a); });
    }

    const readLink = el => ({ label: readText(el), href: el.getAttribute('href') || '' });
    function writeLink(el, v) {
        if (!v) return;
        writeText(el, v.label);
        el.setAttribute('href', safeHref(v.href));
    }

    function safeHref(h) {
        h = String(h || '').trim();
        return /^(https?:|mailto:|tel:|#|\/|[a-z0-9-]+\.html)/i.test(h) || h === '' ? h || '#' : '#';
    }

    function readImage(el) {
        const img = el.tagName === 'IMG' ? el : el.querySelector(':scope > img');
        return { src: img && !el.classList.contains('lx-cutout') ? img.getAttribute('src') : '', d: { ...IMG_POS }, m: { ...IMG_POS } };
    }

    // {src} sets an image, {src:'', cleared:true} removes it, anything else keeps the page default.
    function writeImage(el, v) {
        if (!v || (!v.src && !v.cleared)) return;
        el.dataset.cmsFilled = '1';
        el.classList.add('cms-has-img');
        if (!v.src) { el.replaceChildren(); el.classList.add('cms-img-empty'); return; }
        el.classList.remove('cms-img-empty');
        const d = { ...IMG_POS, ...(v.d || {}) }, m = { ...d, ...(v.m || {}) };
        const vars = { w: d.w, x: d.x, y: d.y, s: d.s, mw: m.w, mx: m.x, my: m.y, ms: m.s };
        Object.entries(vars).forEach(([k, val]) => el.style.setProperty('--cms-' + k, val));
        const img = document.createElement('img');
        img.className = 'cms-img';
        img.src = v.src;
        img.alt = v.alt || '';
        img.decoding = 'async';
        el.replaceChildren(img);
    }

    /* ---------- field discovery ---------- */
    const SECTION_FIELD_SEL = '[data-cms],[data-cms-link],[data-cms-img],[data-cms-setting],[data-cms-list]';
    const ITEM_FIELD_SEL = '[data-cms-field],[data-cms-field-link],[data-cms-field-img],[data-cms-field-bool],[data-cms-field-gallery]';

    const LABELS = { cta: 'Button', eyebrow: 'Small label above heading', link: 'Link', more: 'Link', label: 'Small label', read_time: 'Read time' };
    const humanize = k => LABELS[k] || k.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    function sectionPage(sec, doc) {
        const g = sec.closest('[data-cms-global]');
        return g ? g.dataset.cmsGlobal : doc.body.dataset.cmsPage;
    }

    function describe(el, attrPrefix) {
        const a = n => el.getAttribute(attrPrefix + n);
        if (a('-list') !== null && attrPrefix === 'data-cms') return { key: a('-list'), kind: 'list' };
        if (a('-setting') !== null && attrPrefix === 'data-cms') return { key: a('-setting'), kind: el.dataset.cmsType || 'text', setting: true };
        if (a('-img') !== null) return { key: a('-img'), kind: 'image' };
        if (a('-link') !== null) return { key: a('-link'), kind: 'link' };
        if (a('-bool') !== null) return { key: a('-bool'), kind: 'bool' };
        if (a('-gallery') !== null) return { key: a('-gallery'), kind: 'gallery' };
        const key = attrPrefix === 'data-cms' ? el.getAttribute('data-cms') : el.getAttribute('data-cms-field');
        return { key, kind: el.dataset.cmsType === 'textarea' ? 'textarea' : 'text' };
    }

    function readValue(el, kind) {
        switch (kind) {
            case 'link': return readLink(el);
            case 'image': return readImage(el);
            case 'bool': return (el.dataset.value ?? readText(el)) === 'true';
            case 'gallery': return [...el.querySelectorAll('img')].map(i => i.getAttribute('src'));
            case 'datetime': case 'product': return el.dataset.default || '';
            default: return readText(el);
        }
    }

    function writeValue(el, kind, v) {
        switch (kind) {
            case 'link': return writeLink(el, v);
            case 'image': return writeImage(el, v);
            case 'bool': el.dataset.value = v ? 'true' : 'false'; return;
            case 'gallery':
                el.replaceChildren(...(v || []).map(src => Object.assign(document.createElement('img'), { src, alt: '' })));
                return;
            case 'datetime': case 'product': el.dataset.value = v || ''; return;
            default: writeText(el, v);
        }
    }

    function ownFields(scope, sel, isItem) {
        const all = [...(scope.matches(sel) ? [scope] : []), ...scope.querySelectorAll(sel)];
        return all.filter(el => {
            if (isItem) return el === scope || el.closest('[data-cms-item]') === scope;
            if (el.closest('[data-cms-section]') !== scope) return false;
            const list = el.parentElement && el.parentElement.closest('[data-cms-list]');
            return !list || !scope.contains(list);
        });
    }

    function listItems(container) {
        return [...container.children].filter(c => c.hasAttribute('data-cms-item'));
    }

    function itemSchema(item) {
        return ownFields(item, ITEM_FIELD_SEL, true).map(el => {
            const d = describe(el, 'data-cms-field');
            return { ...d, label: el.dataset.cmsTitle || humanize(d.key) };
        });
    }

    function readItem(item, schema) {
        const out = {};
        schema.forEach(f => {
            const el = itemFieldEl(item, f);
            out[f.key] = el ? readValue(el, f.kind) : (f.kind === 'bool' ? false : '');
        });
        return out;
    }

    function itemFieldEl(item, f) {
        const attr = { link: 'data-cms-field-link', image: 'data-cms-field-img', bool: 'data-cms-field-bool', gallery: 'data-cms-field-gallery' }[f.kind] || 'data-cms-field';
        const sel = `[${attr}="${f.key}"]`;
        return item.matches(sel) ? item : item.querySelector(sel);
    }

    /* ---------- extract schema + defaults from a document ---------- */
    function extract(doc, page) {
        return [...doc.querySelectorAll('[data-cms-section]')]
            .filter(sec => sectionPage(sec, doc) === page)
            .map(sec => ({
                id: sec.dataset.cmsSection,
                label: sec.dataset.cmsLabel || humanize(sec.dataset.cmsSection),
                pinned: sec.hasAttribute('data-cms-pin'),
                hideable: !sec.hasAttribute('data-cms-nohide'),
                hint: sec.dataset.cmsHint || '',
                fields: ownFields(sec, SECTION_FIELD_SEL, false).map(el => {
                    const d = describe(el, 'data-cms');
                    const f = { ...d, label: el.dataset.cmsTitle || humanize(d.key), hint: el.dataset.cmsHint || '' };
                    if (d.kind === 'list') {
                        const items = listItems(el);
                        f.item = items.length ? itemSchema(items[0]) : [];
                        f.def = items.map(i => readItem(i, f.item));
                    } else {
                        f.def = readValue(el, d.kind);
                    }
                    return f;
                })
            }));
    }

    /* ---------- apply stored data to a document ---------- */
    function applyList(container, schema, values) {
        if (!container._cmsTpl) container._cmsTpl = listItems(container).map(i => i.cloneNode(true));
        const tpls = container._cmsTpl;
        if (!tpls.length) return;
        const old = listItems(container);
        const marker = document.createComment('cms-list');
        if (old[0]) old[0].before(marker); else container.appendChild(marker);
        old.forEach(o => o.remove());
        let anchor = marker;
        values.forEach((val, i) => {
            const node = tpls[Math.min(i, tpls.length - 1)].cloneNode(true);
            schema.forEach(f => {
                const el = itemFieldEl(node, f);
                if (!el) return;
                const v = val[f.key];
                writeValue(el, f.kind, v);
                if ((f.kind === 'text' || f.kind === 'textarea') && el !== node) el.hidden = !String(v ?? '').trim();
                if (f.kind === 'link' && el !== node) el.hidden = !(v && String(v.label || '').trim());
            });
            anchor.after(node);
            anchor = node;
        });
        marker.remove();
        const sec = container.closest('[data-cms-section]');
        sec?.querySelectorAll(`[data-cms-mirror="${container.dataset.cmsList}"]`).forEach(m => { m.innerHTML = container.innerHTML; });
    }

    function apply(doc, page, data) {
        if (!data || !data.sections) return;
        const schema = extract(doc, page);
        const secEls = {};
        [...doc.querySelectorAll('[data-cms-section]')].filter(s => sectionPage(s, doc) === page).forEach(s => { secEls[s.dataset.cmsSection] = s; });

        schema.forEach(sec => {
            const el = secEls[sec.id];
            const stored = data.sections[sec.id];
            if (!el || !stored) return;
            el.toggleAttribute('data-cms-hidden', !!stored.hidden);
            const f = stored.f || {};
            ownFields(el, SECTION_FIELD_SEL, false).forEach(fieldEl => {
                const d = describe(fieldEl, 'data-cms');
                if (!(d.key in f)) return;
                const fs = sec.fields.find(x => x.key === d.key);
                if (d.kind === 'list') applyList(fieldEl, fs.item, f[d.key] || []);
                else writeValue(fieldEl, d.kind, f[d.key]);
            });
        });

        if (Array.isArray(data.order) && data.order.length) reorder(Object.values(secEls), data.order);
    }

    function reorder(sections, order) {
        const groups = new Map();
        sections.filter(s => !s.hasAttribute('data-cms-pin')).forEach(s => {
            if (!groups.has(s.parentNode)) groups.set(s.parentNode, []);
            groups.get(s.parentNode).push(s);
        });
        groups.forEach(list => {
            const rank = id => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
            const sorted = [...list].sort((a, b) => rank(a.dataset.cmsSection) - rank(b.dataset.cmsSection));
            const marker = document.createComment('cms-order');
            list[0].before(marker);
            let anchor = marker;
            sorted.forEach(s => { anchor.after(s); anchor = s; });
            marker.remove();
        });
    }

    /* ---------- accessors for page scripts ---------- */
    function sectionEl(id, doc = document) { return doc.querySelector(`[data-cms-section="${id}"]`); }

    function setting(sectionId, key) {
        const el = sectionEl(sectionId)?.querySelector(`[data-cms-setting="${key}"]`);
        return el ? (el.dataset.value ?? el.dataset.default ?? '') : '';
    }

    function list(sectionId, key, doc = document) {
        const sec = sectionEl(sectionId, doc);
        const container = sec?.querySelector(`[data-cms-list="${key}"]`);
        if (!container) return [];
        const items = listItems(container);
        if (!items.length) return [];
        const schema = itemSchema(items[0]);
        return items.map(i => readItem(i, schema));
    }

    /* ---------- loader (public pages only) ---------- */
    async function fetchRows(keys) {
        const { data, error } = await sb.from('site_content').select('key,value').in('key', keys);
        if (error) throw new Error(error.message);
        return Object.fromEntries((data || []).map(r => [r.key, r.value]));
    }

    async function isPreview() {
        if (!new URLSearchParams(location.search).has('cms_preview')) return false;
        const { data } = await sb.auth.getSession();
        return !!data.session;
    }

    // Stored value for one page, honouring preview mode (draft first, then published).
    async function loadValue(page) {
        const preview = await isPreview();
        const rows = await fetchRows(preview ? ['cms-draft:' + page, 'cms:' + page] : ['cms:' + page]);
        return (preview && rows['cms-draft:' + page]) || rows['cms:' + page] || null;
    }

    async function load() {
        const page = document.body.dataset.cmsPage;
        if (!page || typeof sb === 'undefined') return;
        const pages = [page, ...(document.querySelector('[data-cms-global="footer"]') ? ['footer'] : [])];
        const preview = await isPreview();
        const keys = pages.flatMap(p => preview ? ['cms-draft:' + p, 'cms:' + p] : ['cms:' + p]);
        const rows = await fetchRows(keys);
        pages.forEach(p => {
            const value = (preview && rows['cms-draft:' + p]) || rows['cms:' + p];
            if (value) apply(document, p, value);
        });
        if (preview) showPreviewBar();
    }

    function showPreviewBar() {
        const bar = document.createElement('div');
        bar.className = 'cms-preview-bar';
        bar.textContent = 'Preview — showing unpublished draft';
        document.body.appendChild(bar);
    }

    window.CMS = { extract, apply, readText, list, setting, loadValue, IMG_POS };
    window.CMS.ready = load().catch(err => console.error('CMS load failed:', err));
})();
