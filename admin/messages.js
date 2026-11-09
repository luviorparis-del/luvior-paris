/* ============================================================
   LUVIOR PARIS — Admin › Messages (contact form inbox)
   Reads contact_messages (admin-only RLS). "New" state is kept per browser.
   ============================================================ */

const MSG_REASONS = { order: 'Order', shipping: 'Shipping', return: 'Return', product: 'Product Question', wholesale: 'Wholesale', press: 'Press', collaboration: 'Collaboration', other: 'Other' };
const MSG_SEEN_KEY = 'luvior_admin_seen_messages';
let msgState = { items: [], filter: 'all', openId: null };

function msgSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(MSG_SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function msgMarkSeen(id) {
  const seen = msgSeen(); seen.add(id);
  try { localStorage.setItem(MSG_SEEN_KEY, JSON.stringify([...seen].slice(-1000))); } catch { /* storage unavailable */ }
}

async function renderMessages() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Messages</h1><p class="page-subtitle">Everything sent through the Contact page.</p></div>
      <button class="btn btn-outline" id="msg-refresh">Refresh</button>
    </div>
    <div class="filter-bar" id="msg-filters"></div>
    <div class="msg-layout"><div class="msg-list" id="msg-list">${loading()}</div><div class="msg-detail" id="msg-detail"></div></div>`;
  el.querySelector('#msg-refresh').addEventListener('click', renderMessages);
  const { data, error } = await sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) {
    el.querySelector('#msg-list').innerHTML = `<div class="empty-state"><h3>Could not load messages</h3><p>${esc(error.message)}</p></div>`;
    return;
  }
  msgState.items = data || [];
  if (!msgState.items.some(m => m.id === msgState.openId)) msgState.openId = null;
  msgDraw();
}

function msgDraw() {
  const seen = msgSeen();
  const reasons = [...new Set(msgState.items.map(m => m.reason))];
  const filters = document.getElementById('msg-filters');
  const unread = msgState.items.filter(m => !seen.has(m.id)).length;
  filters.replaceChildren(...[['all', `All (${msgState.items.length})`], ['new', `New (${unread})`], ...reasons.map(r => [r, MSG_REASONS[r] || r])]
    .map(([id, label]) => h('button', { class: 'filter-btn' + (msgState.filter === id ? ' active' : ''), text: label, onclick: () => { msgState.filter = id; msgDraw(); } })));

  const items = msgState.items.filter(m => msgState.filter === 'all' || (msgState.filter === 'new' ? !seen.has(m.id) : m.reason === msgState.filter));
  const list = document.getElementById('msg-list');
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><h3>${msgState.items.length ? 'Nothing here' : 'No messages yet'}</h3><p>${msgState.items.length ? 'Try another filter.' : 'Messages from the Contact page will appear here.'}</p></div>`;
  } else {
    list.replaceChildren(...items.map(m => h('button', {
      class: 'msg-row' + (m.id === msgState.openId ? ' active' : '') + (seen.has(m.id) ? '' : ' is-new'),
      onclick: () => { msgState.openId = m.id; msgMarkSeen(m.id); msgDraw(); }
    },
      h('span', { class: 'msg-row__top' }, h('strong', { text: `${m.first_name} ${m.last_name}` }), h('span', { class: 'msg-row__time', text: timeAgo(m.created_at) })),
      h('span', { class: 'msg-row__reason', text: MSG_REASONS[m.reason] || m.reason }),
      h('span', { class: 'msg-row__snippet', text: m.message.slice(0, 110) }))));
  }
  msgDetail();
}

function msgDetail() {
  const box = document.getElementById('msg-detail');
  const m = msgState.items.find(x => x.id === msgState.openId);
  if (!m) { box.innerHTML = '<div class="empty-state"><p>Select a message to read it.</p></div>'; return; }
  const subject = encodeURIComponent(`Re: your message to Luvior Paris${m.order_number ? ` (order ${m.order_number})` : ''}`);
  const quoted = encodeURIComponent(`\n\n— On ${formatDate(m.created_at)}, ${m.first_name} wrote:\n> ${m.message.replace(/\n/g, '\n> ')}`);
  box.replaceChildren(
    h('div', { class: 'msg-detail__head' },
      h('div', {}, h('h2', { text: `${m.first_name} ${m.last_name}` }), h('p', { class: 'page-subtitle', text: new Date(m.created_at).toLocaleString() })),
      h('span', { class: 'badge badge-processing', text: MSG_REASONS[m.reason] || m.reason })),
    h('div', { class: 'msg-detail__meta' },
      h('div', { class: 'detail-row' }, h('span', { class: 'label', text: 'Email' }), h('span', { class: 'value' }, h('a', { href: `mailto:${m.email}`, text: m.email }))),
      m.phone ? h('div', { class: 'detail-row' }, h('span', { class: 'label', text: 'Phone' }), h('span', { class: 'value' }, h('a', { href: `tel:${m.phone.replace(/[^\d+]/g, '')}`, text: m.phone }))) : null,
      m.order_number ? h('div', { class: 'detail-row' }, h('span', { class: 'label', text: 'Order number' }), h('span', { class: 'value', text: m.order_number })) : null),
    h('p', { class: 'msg-detail__body', text: m.message }),
    h('div', { class: 'btn-group' },
      h('a', { class: 'btn btn-primary', href: `mailto:${m.email}?subject=${subject}&body=${quoted}`, text: 'Reply by email' }),
      h('button', { class: 'btn btn-outline', text: 'Copy email', onclick: async () => { await navigator.clipboard.writeText(m.email); showToast('Email copied', 'success'); } }),
      h('button', { class: 'btn btn-outline ws-danger', text: 'Delete', onclick: () => msgDelete(m) })));
}

async function msgDelete(m) {
  if (!(await showConfirm(`Delete the message from ${esc(m.first_name)} ${esc(m.last_name)}? This cannot be undone.`, 'Delete message'))) return;
  const { error } = await sb.from('contact_messages').delete().eq('id', m.id);
  if (error) { showToast('Could not delete: ' + error.message, 'error'); return; }
  msgState.items = msgState.items.filter(x => x.id !== m.id);
  msgState.openId = null;
  showToast('Message deleted', 'success');
  msgDraw();
}
