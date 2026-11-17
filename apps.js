/* Раздел «Заявки амбассадоров» в CRM: заявки с формы на сайте (таблица Supabase amb_applications).
   Видят и правят владелец и менеджер; удалять может только владелец. */
(function () {
  'use strict';
  var API = window.CRM_APPS;
  if (!API || !window.CRM_READY) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m) { var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.hidden = true; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3500); };
  var nf = function (n) { return (+n || 0).toLocaleString('ru-RU').replace(/ | /g, ' '); };
  var ST = [['new', 'Новая'], ['work', 'В работе'], ['approved', 'Одобрена'], ['later', 'Позже'], ['rejected', 'Отклонена']];
  var STN = {}; ST.forEach(function (s) { STN[s[0]] = s[1]; });
  var NETS = [['vk', 'ВКонтакте'], ['tg', 'Telegram'], ['max', 'MAX'], ['yt', 'YouTube'], ['dzen', 'Дзен'], ['rt', 'Rutube'], ['other', 'Другая']];
  var PREF = { tg: 'Telegram', vk: 'ВКонтакте', max: 'MAX', call: 'Звонок', mail: 'Почта' };
  var ROWS = [], F = { q: '', st: '', net: '', sort: 'date' }, OPEN = null, ROLE = '', timer = null;

  var CSS = '#ap{position:fixed;inset:0;z-index:35;background:var(--bg);color:var(--ink);display:none;flex-direction:column;font:14px/1.45 var(--font-body)}#ap.on{display:flex}' +
    '.ap-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--panel)}.ap-bar h2{font-family:var(--font-head);font-size:18px;text-transform:uppercase;letter-spacing:.03em;margin:0 8px 0 0;font-weight:600}.ap-sp{flex:1}' +
    '.ap-body{flex:1;min-height:0;overflow:auto;padding:14px}.ap-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}.ap-tile{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 14px}.ap-tile .l{color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em}.ap-tile .v{font-family:var(--font-head);font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}' +
    '.ap-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.ap-filters input[type=text],.ap-filters select{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;padding:7px 10px}.ap-filters input[type=text]{flex:1 1 240px;min-width:180px}' +
    '.ap-chip.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}' +
    '.ap-t{min-width:1000px}.ap-t th,.ap-t td{vertical-align:top}.ap-t tr.item{cursor:pointer}.ap-t tr.new td:first-child{box-shadow:inset 3px 0 0 var(--accent)}.ap-n{font-size:12.5px;color:var(--muted)}' +
    '.ap-soc{display:flex;flex-direction:column;gap:2px;font-size:13px}.ap-soc b{font-variant-numeric:tabular-nums}.ap-tot{font-family:var(--font-head);font-size:20px;font-variant-numeric:tabular-nums}' +
    '.ap-st{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;padding:4px 6px}.ap-st.new{border-color:var(--accent);color:var(--accent)}.ap-st.approved{border-color:var(--good);color:var(--good)}.ap-st.rejected{color:var(--bad)}' +
    '.ap-drawer{position:fixed;top:0;right:0;bottom:0;width:min(520px,100vw);background:var(--panel);border-left:1px solid var(--line);z-index:36;overflow:auto;padding:18px 20px 28px;box-shadow:-8px 0 30px rgba(0,0,0,.18)}.ap-drawer h3{font-family:var(--font-head);font-weight:500;font-size:22px;text-transform:uppercase;margin:0 0 6px}' +
    '.ap-kv{display:grid;grid-template-columns:130px 1fr;gap:6px 14px;margin:12px 0}.ap-kv dt{color:var(--muted);font-size:12.5px}.ap-kv dd{margin:0;overflow-wrap:anywhere}.ap-drawer textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:6px;padding:8px 10px}.ap-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}';

  function stats() {
    var a = { all: ROWS.length, nw: 0, work: 0, ok: 0, aud: 0 };
    ROWS.forEach(function (r) { if (r.status === 'new') a.nw++; else if (r.status === 'work') a.work++; else if (r.status === 'approved') a.ok++; a.aud += +r.total_followers || 0; });
    return a;
  }
  function filtered() {
    var q = F.q.toLowerCase().trim();
    var L = ROWS.filter(function (r) {
      if (F.st && r.status !== F.st) return false;
      if (F.net && !(r.socials || []).some(function (s) { return s.net === F.net; })) return false;
      if (q && [r.name, r.city, r.phone, r.email, r.telegram, r.sport, r.about, r.note].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return L.sort(function (a, b) { return F.sort === 'fol' ? (b.total_followers || 0) - (a.total_followers || 0) : String(b.created_at).localeCompare(String(a.created_at)); });
  }
  function dt(s) { var d = new Date(s); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  function stSel(r) { return '<select class="ap-st ' + esc(r.status) + '" data-st="' + esc(r.id) + '">' + ST.map(function (s) { return '<option value="' + s[0] + '"' + (r.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>'; }
  function socCell(r) { var L = r.socials || []; return L.length ? '<div class="ap-soc">' + L.map(function (s) { return '<span>' + esc(s.name || s.net) + ': <b>' + nf(s.followers) + '</b></span>'; }).join('') + '</div>' : '<span class="ap-n">нет страниц</span>'; }
  function rowsHtml(L) {
    return L.map(function (r) {
      return '<tr class="item ' + esc(r.status) + '" data-id="' + esc(r.id) + '"><td style="white-space:nowrap">' + esc(dt(r.created_at)) + '</td><td><b>' + esc(r.name) + '</b><div class="ap-n">' + esc(r.city) + '</div></td><td><div>' + esc(r.phone || '') + '</div><div class="ap-n">' + esc([r.telegram, r.email].filter(Boolean).join(' · ')) + '</div>' + (r.contact_pref ? '<div class="ap-n">ответить: ' + esc(PREF[r.contact_pref] || r.contact_pref) + '</div>' : '') + '</td><td>' + socCell(r) + '</td><td class="r ap-tot">' + nf(r.total_followers) + '</td><td>' + esc((r.directions || []).join(', ')) + (r.sport ? '<div class="ap-n">' + esc(r.sport) + '</div>' : '') + '</td><td>' + stSel(r) + '</td><td class="ap-n">' + esc(r.note || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="muted" style="padding:24px;text-align:center">' + (ROWS.length ? 'Ничего не найдено.' : 'Заявок пока нет. Они появятся здесь сразу после отправки формы на сайте.') + '</td></tr>';
  }
  function render() {
    var box = $('#ap-body'); if (!box) return;
    var a = stats(), L = filtered();
    box.innerHTML = '<div class="ap-tiles"><div class="ap-tile"><div class="l">Всего заявок</div><div class="v">' + a.all + '</div></div><div class="ap-tile"><div class="l">Новые</div><div class="v">' + a.nw + '</div></div><div class="ap-tile"><div class="l">В работе</div><div class="v">' + a.work + '</div></div><div class="ap-tile"><div class="l">Одобрены</div><div class="v">' + a.ok + '</div></div><div class="ap-tile"><div class="l">Суммарная аудитория</div><div class="v">' + nf(a.aud) + '</div></div></div>' +
      '<div class="ap-filters"><input type="text" id="ap-q" placeholder="Поиск: имя, город, телефон, спорт…" value="' + esc(F.q) + '">' +
      [['', 'Все']].concat(ST).map(function (s) { return '<button class="small ap-chip' + (F.st === s[0] ? ' on' : '') + '" data-f="' + s[0] + '">' + s[1] + '</button>'; }).join('') +
      '<select id="ap-net"><option value="">Любая соцсеть</option>' + NETS.map(function (n) { return '<option value="' + n[0] + '"' + (F.net === n[0] ? ' selected' : '') + '>' + n[1] + '</option>'; }).join('') + '</select>' +
      '<select id="ap-sort"><option value="date"' + (F.sort === 'date' ? ' selected' : '') + '>Сначала новые</option><option value="fol"' + (F.sort === 'fol' ? ' selected' : '') + '>По числу подписчиков</option></select></div>' +
      '<div class="panel"><div class="scroll" style="max-height:none"><table class="ap-t"><thead><tr><th>Когда</th><th>Кто</th><th>Контакты</th><th>Соцсети, подписчики</th><th class="r">Всего</th><th>Направление</th><th>Статус</th><th>Заметка</th></tr></thead><tbody id="ap-rows">' + rowsHtml(L) + '</tbody></table></div></div><p class="ap-n" style="margin-top:8px">Показано ' + L.length + ' из ' + ROWS.length + '. Строка открывается кликом; статус меняется прямо в таблице.</p>';
    var q = $('#ap-q'); q.oninput = function () { F.q = q.value; var pos = q.selectionStart; render(); var n = $('#ap-q'); n.focus(); n.setSelectionRange(pos, pos); };
    [].forEach.call(box.querySelectorAll('[data-f]'), function (b) { b.onclick = function () { F.st = b.dataset.f; render(); }; });
    $('#ap-net').onchange = function (e) { F.net = e.target.value; render(); };
    $('#ap-sort').onchange = function (e) { F.sort = e.target.value; render(); };
    bindRows();
    badge();
  }
  function bindRows() {
    [].forEach.call(document.querySelectorAll('#ap-rows tr.item'), function (tr) { tr.onclick = function (e) { if (e.target.closest('select')) return; openCard(tr.dataset.id); }; });
    [].forEach.call(document.querySelectorAll('#ap-rows [data-st]'), function (s) { s.onchange = function () { setStatus(s.dataset.st, s.value); }; });
  }
  function find(id) { return ROWS.filter(function (r) { return r.id === id; })[0]; }
  function setStatus(id, st) {
    var r = find(id); if (!r) return;
    API.update(id, { status: st }).then(function (u) { Object.assign(r, u || { status: st }); render(); if (OPEN === id) openCard(id); toast('Статус: ' + STN[st]); }, function (e) { toast('Не удалось сохранить: ' + e.message); render(); });
  }
  function closeCard() { var d = $('#ap-drawer'); if (d) d.remove(); OPEN = null; }
  function openCard(id) {
    var r = find(id); if (!r) return; closeCard(); OPEN = id;
    var d = document.createElement('div'); d.id = 'ap-drawer'; d.className = 'ap-drawer';
    var soc = (r.socials || []).map(function (s) { var l = s.link || ''; return '<div>' + esc(s.name || s.net) + ': <b>' + nf(s.followers) + '</b> ' + (/^https?:\/\//.test(l) ? '<a href="' + esc(l) + '" target="_blank" rel="noopener">' + esc(l) + '</a>' : esc(l)) + '</div>'; }).join('') || '<span class="ap-n">нет страниц</span>';
    d.innerHTML = '<div class="ap-row" style="justify-content:space-between;margin:0"><h3>' + esc(r.name) + '</h3><button id="ap-x">Закрыть</button></div><div class="ap-n">' + esc(dt(r.created_at)) + ' · ' + esc(r.city) + '</div>' +
      '<div class="ap-row">' + stSel(r) + (r.handled_by ? '<span class="ap-n">обработал: ' + esc(r.handled_by) + '</span>' : '') + '</div>' +
      '<dl class="ap-kv"><dt>Телефон</dt><dd>' + esc(r.phone || '—') + '</dd><dt>Telegram</dt><dd>' + esc(r.telegram || '—') + '</dd><dt>E-mail</dt><dd>' + esc(r.email || '—') + '</dd><dt>Ответить в</dt><dd>' + esc(PREF[r.contact_pref] || '—') + '</dd>' +
      '<dt>Соцсети</dt><dd>' + soc + '<div style="margin-top:6px">Всего подписчиков: <b>' + nf(r.total_followers) + '</b></div></dd>' +
      '<dt>Направление</dt><dd>' + esc((r.directions || []).join(', ') || '—') + '</dd><dt>Вид спорта, тема</dt><dd>' + esc(r.sport || '—') + '</dd><dt>О себе</dt><dd>' + esc(r.about || '—').replace(/\n/g, '<br>') + '</dd>' +
      '<dt>Чем поможет</dt><dd>' + esc((r.plans || []).join(', ') || '—') + '</dd><dt>Откуда узнал(а)</dt><dd>' + esc(r.source || '—') + '</dd></dl>' +
      '<label>Заметка<textarea id="ap-note" rows="4" placeholder="Что решили, когда написать, что обещали">' + esc(r.note || '') + '</textarea></label>' +
      '<div class="ap-row"><button class="primary" id="ap-save">Сохранить заметку</button>' + (ROLE === 'owner' ? '<button class="danger" id="ap-del">Удалить заявку</button>' : '') + '</div>';
    document.body.appendChild(d);
    $('#ap-x').onclick = closeCard;
    $('#ap-save').onclick = function () { API.update(id, { note: $('#ap-note').value.trim() || null }).then(function (u) { Object.assign(r, u || {}); render(); toast('Заметка сохранена'); }, function (e) { toast('Не удалось сохранить: ' + e.message); }); };
    var dl = $('#ap-del'); if (dl) dl.onclick = function () { if (!confirm('Удалить заявку «' + r.name + '» без возможности восстановления?')) return; API.del(id).then(function () { ROWS = ROWS.filter(function (x) { return x.id !== id; }); closeCard(); render(); toast('Заявка удалена'); }, function (e) { toast('Не удалось удалить: ' + e.message); }); };
    var sel = d.querySelector('[data-st]'); if (sel) sel.onchange = function () { setStatus(id, sel.value); };
  }
  function exportXlsx() {
    var L = filtered(), head = ['Дата', 'Имя', 'Город', 'Телефон', 'Telegram', 'E-mail', 'Ответить в'].concat(NETS.map(function (n) { return n[1] + ': подписчики'; }), NETS.map(function (n) { return n[1] + ': ссылка'; }), ['Всего подписчиков', 'Направление', 'Вид спорта, тема', 'О себе', 'Чем поможет', 'Откуда узнал', 'Статус', 'Заметка']);
    var data = [head].concat(L.map(function (r) {
      var by = {}; (r.socials || []).forEach(function (s) { by[s.net] = s; });
      return [dt(r.created_at), r.name, r.city, r.phone || '', r.telegram || '', r.email || '', PREF[r.contact_pref] || ''].concat(NETS.map(function (n) { return by[n[0]] ? +by[n[0]].followers : ''; }), NETS.map(function (n) { return by[n[0]] ? by[n[0]].link || '' : ''; }), [+r.total_followers || 0, (r.directions || []).join(', '), r.sport || '', r.about || '', (r.plans || []).join(', '), r.source || '', STN[r.status] || r.status, r.note || '']);
    }));
    var name = 'zayavki-ambassadorov-' + new Date().toISOString().slice(0, 10);
    if (window.XLSX) { var ws = window.XLSX.utils.aoa_to_sheet(data), wb = window.XLSX.utils.book_new(); ws['!cols'] = head.map(function (h, i) { return { wch: i < 7 ? 18 : i < 21 ? 16 : 28 }; }); window.XLSX.utils.book_append_sheet(wb, ws, 'Заявки'); window.XLSX.writeFile(wb, name + '.xlsx'); return; }
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + data.map(function (r) { return r.map(q).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function load(quiet) {
    return API.list().then(function (r) { ROWS = r; if ($('#ap.on')) render(); else badge(); }, function (e) { if (!quiet) toast('Не удалось прочитать заявки: ' + e.message); });
  }
  function badge() {
    var a = document.querySelector('.tabs a[data-t="zayavki"]'); if (!a) return;
    var n = ROWS.filter(function (r) { return r.status === 'new'; }).length;
    a.innerHTML = 'Заявки амбассадоров' + (n ? ' <span class="tag warn" style="margin-left:4px">' + n + '</span>' : '');
  }
  function route() {
    var on = location.hash === '#zayavki', root = $('#ap'); if (!root) return;
    root.classList.toggle('on', on); document.documentElement.style.overflow = on ? 'hidden' : '';
    var a = document.querySelector('.tabs a[data-t="zayavki"]'); if (a) a.classList.toggle('on', on);
    if (on) { render(); load(); clearInterval(timer); timer = setInterval(function () { if (location.hash === '#zayavki') load(true); }, 60000); } else { clearInterval(timer); closeCard(); }
  }
  function init(role) {
    ROLE = role;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var d = document.createElement('div'); d.id = 'ap';
    d.innerHTML = '<div class="ap-bar"><button id="ap-back">← К CRM</button><h2>Заявки амбассадоров</h2><span class="ap-sp"></span><button id="ap-ref">Обновить</button><button id="ap-xl" class="primary">Скачать Excel</button></div><div class="ap-body" id="ap-body"></div>';
    document.body.appendChild(d);
    $('#ap-back').onclick = function () { location.hash = '#ostatki'; };
    $('#ap-ref').onclick = function () { load(); };
    $('#ap-xl').onclick = exportXlsx;
    var nav = document.querySelector('.tabs');
    if (nav && !nav.querySelector('[data-t="zayavki"]')) { var a = document.createElement('a'); a.href = '#zayavki'; a.dataset.t = 'zayavki'; a.textContent = 'Заявки амбассадоров'; nav.appendChild(a); }
    window.addEventListener('hashchange', route);
    load(true).then(route);
    setInterval(function () { if (location.hash !== '#zayavki') load(true); }, 180000);
  }
  window.CRM_READY.then(function () { var r = window.CRM_ROLE && window.CRM_ROLE(); if (r === 'owner' || r === 'manager') init(r); });
})();
