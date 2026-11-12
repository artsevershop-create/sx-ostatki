/* Слой для страницы «Остатки СХ» вне claude.ai: вход по почте и паролю (Supabase Auth), роли, база collection/doc, файлы. */
(function () {
  'use strict';
  var CFG = { url: 'https://nvywtrzrxpolyqvrntjl.supabase.co', key: 'sb_publishable_4q3Ty9pTKaQwvxRm0V2CEA_PPoOj7M8' };
  var HIDDEN_FOR_MANAGER = [];
  var sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ostatki-crm-auth' } });
  var ROLE = null, EMAIL = '', resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });
  window.CRM_ROLE = function () { return ROLE; };
  window.CRM_FILE_URL = function (path) { return sb.storage.from('crm-docs').createSignedUrl(path, 3600).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data.signedUrl; }); };
  window.CRM_LOG = function (n) { return sb.from('crm_log').select('*').order('id', { ascending: false }).limit(n || 300).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); };
  window.CRM_READY = ready;
  // Бланки, подпись и печать, история договоров и КП: таблица crm_blanks, читает и пишет только владелец (RLS в Supabase).
  window.CRM_BLANKS = {
    get: function (kind, id) { return sb.from('crm_blanks').select('data').eq('kind', kind).eq('id', id).maybeSingle().then(function (r) { if (r.error) throw fail(r.error); return r.data ? r.data.data : null; }); },
    list: function (kind, limit) { return sb.from('crm_blanks').select('id,data,updated_at').eq('kind', kind).order('updated_at', { ascending: false }).limit(limit || 100).then(function (r) { if (r.error) throw fail(r.error); return r.data; }); },
    put: function (kind, id, data) { return sb.from('crm_blanks').upsert({ kind: kind, id: id, data: data, updated_at: new Date().toISOString(), updated_by: EMAIL }).then(function (r) { if (r.error) throw fail(r.error); }); },
    fileUp: function (file) { var path = Date.now().toString(36) + '_' + String(file.name || 'file').replace(/[^w.-]+/g, '_'); return sb.storage.from('crm-contracts').upload(path, file, { contentType: file.type || 'application/octet-stream' }).then(function (r) { if (r.error) throw fail(r.error); return path; }); },
    fileUrl: function (path) { return sb.storage.from('crm-contracts').createSignedUrl(path, 3600).then(function (r) { if (r.error) throw fail(r.error); return r.data.signedUrl; }); },
    fileDel: function (path) { return sb.storage.from('crm-contracts').remove([path]).then(function (r) { if (r.error) throw fail(r.error); }); },
    del: function (kind, id) { return sb.from('crm_blanks').delete().eq('kind', kind).eq('id', id).then(function (r) { if (r.error) throw fail(r.error); }); }
  };
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = document.createElement('style');
  css.textContent = '#crm-login{position:fixed;inset:0;z-index:9999;background:#f2f4f6;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Roboto,system-ui,sans-serif}' +
    '#crm-login .box{background:#fff;border:1px solid #dbe1e7;border-radius:10px;padding:26px 24px;width:100%;max-width:360px;box-shadow:0 8px 30px rgba(23,33,43,.08)}' +
    '#crm-login h1{font:600 24px Oswald,sans-serif;margin:0 0 4px;color:#17212b}#crm-login p{margin:0 0 16px;color:#5b6a79;font-size:14px}' +
    '#crm-login label{display:block;font-size:13px;color:#5b6a79;margin:10px 0 4px}#crm-login input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #c5ced7;border-radius:6px;font-size:16px}' +
    '#crm-login button{width:100%;margin-top:16px;padding:11px;border:0;border-radius:6px;background:#17212b;color:#fff;font-size:16px;cursor:pointer}#crm-login button:disabled{opacity:.6}' +
    '#crm-login .err{color:#b3261e;font-size:14px;margin-top:10px;min-height:18px}' +
    '.crm-user{font-size:13px;color:#5b6a79;display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:0 0 6px}.crm-user button{padding:4px 10px}';
  document.head.appendChild(css);

  function showLogin(msg) {
    var old = document.getElementById('crm-login'); if (old) old.remove();
    document.body.appendChild(el('<div id="crm-login"><form class="box" id="crm-form"><h1>Остатки СХ</h1><p>Вход для сотрудников «Северного характера»</p>' +
      '<label for="crm-em">Почта</label><input id="crm-em" type="email" autocomplete="username" autocapitalize="off" required>' +
      '<label for="crm-pw">Пароль</label><input id="crm-pw" type="password" autocomplete="current-password" required>' +
      '<button type="submit" id="crm-go">Войти</button><div class="err" id="crm-err">' + esc(msg || '') + '</div></form></div>'));
    document.getElementById('crm-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = document.getElementById('crm-go'); b.disabled = true; document.getElementById('crm-err').textContent = '';
      sb.auth.signInWithPassword({ email: document.getElementById('crm-em').value.trim(), password: document.getElementById('crm-pw').value }).then(function (r) {
        if (r.error) { b.disabled = false; document.getElementById('crm-err').textContent = 'Неверная почта или пароль'; return; }
        afterLogin();
      });
    });
    setTimeout(function () { var i = document.getElementById('crm-em'); if (i) i.focus(); }, 50);
  }
  function showNoAccess(email) {
    var old = document.getElementById('crm-login'); if (old) old.remove();
    document.body.appendChild(el('<div id="crm-login"><div class="box"><h1>Нет доступа</h1><p>Почта ' + esc(email) + ' не добавлена в список сотрудников CRM. Попросите владельца выдать доступ.</p><button id="crm-out2">Выйти</button></div></div>'));
    document.getElementById('crm-out2').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
  }
  function afterLogin() {
    sb.auth.getUser().then(function (u) {
      var email = u && u.data && u.data.user && u.data.user.email;
      if (!email) { showLogin(); return; }
      EMAIL = email;
      sb.from('crm_users').select('role').maybeSingle().then(function (r) {
        if (r.error || !r.data) { showNoAccess(email); return; }
        ROLE = r.data.role;
        var o = document.getElementById('crm-login'); if (o) o.remove();
        decorate(); resolveReady(true);
      });
    });
  }
  function changePassword() {
    var old = document.getElementById('crm-login'); if (old) old.remove();
    document.body.appendChild(el('<div id="crm-login"><div class="box"><h1>Смена пароля</h1><p>' + esc(EMAIL) + '</p>' +
      '<label>Новый пароль (не короче 8 символов)<input type="password" id="crm-pw1" autocomplete="new-password"></label>' +
      '<label>Повторите пароль<input type="password" id="crm-pw2" autocomplete="new-password"></label>' +
      '<div class="err" id="crm-pwerr"></div><button id="crm-pwok">Сохранить пароль</button><button id="crm-pwno" style="margin-top:8px;background:transparent;color:inherit;border:1px solid currentColor">Отмена</button></div></div>'));
    var e = document.getElementById('crm-pwerr');
    document.getElementById('crm-pwno').onclick = function () { document.getElementById('crm-login').remove(); };
    document.getElementById('crm-pwok').onclick = function () {
      var a = document.getElementById('crm-pw1').value, b = document.getElementById('crm-pw2').value;
      if (a.length < 8) { e.textContent = 'Пароль короче 8 символов'; return; }
      if (a !== b) { e.textContent = 'Пароли не совпадают'; return; }
      sb.auth.updateUser({ password: a }).then(function (r) {
        if (r.error) { e.textContent = 'Не удалось сменить: ' + r.error.message; return; }
        document.getElementById('crm-login').remove(); alert('Пароль изменён. Входите с новым паролем.');
      });
    };
    setTimeout(function () { var i = document.getElementById('crm-pw1'); if (i) i.focus(); }, 50);
  }
  function decorate() {
    if (ROLE === 'manager') {
      var s = document.createElement('style');
      s.textContent = HIDDEN_FOR_MANAGER.map(function (t) { return '.tabs a[data-t="' + t + '"]{display:none!important}'; }).join('');
      document.head.appendChild(s);
    }
    var tp = document.getElementById('tab-pravki'); if (tp && ROLE === 'owner') tp.style.display = '';
    var wrap = document.querySelector('.wrap');
    if (wrap && !document.querySelector('.crm-user')) {
      var u = el('<div class="crm-user"><span>' + esc(EMAIL) + ' · ' + (ROLE === 'owner' ? 'владелец' : 'менеджер') + '</span>' +
        (ROLE === 'owner' ? '<button id="crm-imp" title="Загрузить базу из файла">Импорт базы</button>' : '') + '<button id="crm-pwbtn" title="Сменить свой пароль">Пароль</button><button id="crm-out">Выйти</button></div>');
      wrap.insertBefore(u, wrap.firstChild);
      document.getElementById('crm-out').onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
      var imp = document.getElementById('crm-imp'); if (imp) imp.onclick = importSeed;
      document.getElementById('crm-pwbtn').onclick = changePassword;
    }
  }

  function fail(e) { var err = new Error((e && e.message) || String(e)); err.code = e && e.code; return err; }
  function parsePath(p) { var i = p.indexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; }
  var caches = {};
  function snapDoc(id, data) { return { id: id, exists: true, data: function () { return data; } }; }
  function notify(coll) { var c = caches[coll]; if (!c || !c.loaded) return; c.subs.forEach(function (s) { s.fire(); }); }
  function ensure(coll) {
    var c = caches[coll]; if (c) return c;
    c = caches[coll] = { map: {}, subs: [], loaded: false };
    (async function () {
      var from = 0, size = 1000, all = [];
      for (;;) {
        var r = await sb.from('crm_docs').select('id,data').eq('coll', coll).order('id').range(from, from + size - 1);
        if (r.error) { c.subs.forEach(function (s) { if (s.err) s.err(fail(r.error)); }); return; }
        all = all.concat(r.data); if (r.data.length < size) break; from += size;
      }
      all.forEach(function (x) { c.map[x.id] = x.data; });
      c.loaded = true; notify(coll);
    })();
    c.chan = sb.channel('crm-' + coll).on('postgres_changes', { event: '*', schema: 'public', table: 'crm_docs', filter: 'coll=eq.' + coll }, function (p) {
      if (p.eventType === 'DELETE') delete c.map[p.old.id]; else c.map[p.new.id] = p.new.data;
      notify(coll);
    }).subscribe();
    return c;
  }
  function Query(coll, opts) { this.coll = coll; this.o = opts || {}; }
  Query.prototype.orderBy = function (f, d) { return new Query(this.coll, Object.assign({}, this.o, { ob: f, dir: d || 'asc' })); };
  Query.prototype.limit = function (n) { return new Query(this.coll, Object.assign({}, this.o, { lim: n })); };
  Query.prototype.doc = function (id) { return new DocRef(this.coll, id); };
  Query.prototype._docs = function () {
    var c = caches[this.coll], o = this.o;
    var arr = Object.keys(c.map).map(function (id) { return { id: id, d: c.map[id] }; });
    if (o.ob) arr.sort(function (a, b) { var x = a.d[o.ob], y = b.d[o.ob]; if (x === y) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : 1) * (o.dir === 'desc' ? -1 : 1); });
    else arr.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (o.lim) arr = arr.slice(0, o.lim);
    return arr.map(function (x) { return snapDoc(x.id, x.d); });
  };
  Query.prototype.onSnapshot = function (cb, errcb) {
    var self = this, c = ensure(this.coll);
    var sub = { err: errcb, fire: function () { var ds = self._docs(); cb({ docs: ds, size: ds.length, empty: !ds.length }); } };
    c.subs.push(sub); if (c.loaded) setTimeout(function () { sub.fire(); }, 0);
    return function () { c.subs = c.subs.filter(function (s) { return s !== sub; }); };
  };
  function DocRef(coll, id) { this.coll = coll; this.id = id; }
  DocRef.prototype.set = function (data) {
    var self = this, copy = JSON.parse(JSON.stringify(data));
    return sb.from('crm_docs').upsert({ coll: this.coll, id: this.id, data: copy, updated_at: new Date().toISOString() }).then(function (r) {
      if (r.error) throw fail(r.error);
      var c = caches[self.coll]; if (c) { c.map[self.id] = copy; notify(self.coll); }
    });
  };
  DocRef.prototype.update = function (patch) {
    var self = this;
    return sb.rpc('crm_patch', { p_coll: this.coll, p_id: this.id, p_patch: JSON.parse(JSON.stringify(patch)) }).then(function (r) {
      if (r.error) throw fail(r.error);
      return sb.from('crm_docs').select('data').eq('coll', self.coll).eq('id', self.id).maybeSingle().then(function (g) {
        var c = caches[self.coll]; if (c && g.data) { c.map[self.id] = g.data.data; notify(self.coll); }
      });
    });
  };
  DocRef.prototype.delete = function () {
    var self = this;
    return sb.from('crm_docs').delete().eq('coll', this.coll).eq('id', this.id).then(function (r) {
      if (r.error) throw fail(r.error);
      var c = caches[self.coll]; if (c) { delete c.map[self.id]; notify(self.coll); }
    });
  };
  DocRef.prototype.onSnapshot = function (cb, errcb) {
    var self = this, c = ensure(this.coll);
    var sub = { err: errcb, fire: function () { var d = c.map[self.id]; cb(d === undefined ? { id: self.id, exists: false, data: function () { return undefined; } } : snapDoc(self.id, d)); } };
    c.subs.push(sub); if (c.loaded) setTimeout(function () { sub.fire(); }, 0);
    return function () { c.subs = c.subs.filter(function (s) { return s !== sub; }); };
  };
  var dbApi = { collection: function (n) { return new Query(n); }, doc: function (p) { var a = parsePath(p); return new DocRef(a[0], a[1]); } };

  var assetApi = {
    upload: async function (file) {
      var path = Date.now() + '_' + String(file.name || 'file').replace(/[^\w.\-]+/g, '_');
      var r = await sb.storage.from('crm-docs').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (r.error) throw fail(r.error);
      var s = await sb.storage.from('crm-docs').createSignedUrl(path, 60 * 60 * 24 * 365);
      return { id: path, url: s.data && s.data.signedUrl, sizeBytes: file.size, contentType: file.type };
    },
    delete: async function (id) { var r = await sb.storage.from('crm-docs').remove([id]); if (r.error) throw fail(r.error); },
    list: async function () { return { assets: [], usage: {} }; }
  };
  var dlApi = { save: function (o) { return new Promise(function (res) {
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename || 'file';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); res(); }, 500);
  }); } };
  window.claude = { use: function (name) {
    if (name === 'db') return ready.then(function () { return dbApi; });
    if (name === 'assets') return ready.then(function () { return ROLE === 'owner' ? assetApi : null; });
    if (name === 'downloads') return Promise.resolve(dlApi);
    return Promise.resolve(null);
  } };

  function importSeed() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async function () {
      var f = inp.files[0]; if (!f) return;
      var j; try { j = JSON.parse(await f.text()); } catch (e) { alert('Файл не прочитан как JSON'); return; }
      var rows = []; Object.keys(j).forEach(function (c) { Object.keys(j[c]).forEach(function (id) { rows.push({ coll: c, id: id, data: j[c][id] }); }); });
      if (!confirm('Загрузить в базу ' + rows.length + ' записей? Записи с теми же номерами будут заменены.')) return;
      for (var i = 0; i < rows.length; i += 100) {
        var r = await sb.from('crm_docs').upsert(rows.slice(i, i + 100));
        if (r.error) { alert('Ошибка загрузки: ' + r.error.message); return; }
      }
      alert('Загружено записей: ' + rows.length + '. Страница обновится.'); location.reload();
    };
    inp.click();
  }
  function start() { sb.auth.getSession().then(function (r) { if (r.data && r.data.session) afterLogin(); else showLogin(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
