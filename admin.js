/* Honig-Verwaltung – Single-Page-App */
(function () {
  var H = window.Honig, sb = H.sb, esc = H.esc, euro = H.euro;
  var app = document.getElementById('app');
  var me = null, ST = {};

  // ---------- Hilfen ----------
  function flash(msg, type) {
    var f = document.getElementById('flash');
    f.innerHTML = msg ? '<div class="flash flash-' + (type || 'ok') + '">' + esc(msg) + '</div>' : '';
    if (msg) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function nav(key) {
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === key); });
  }
  function route() { return (location.hash || '#/').slice(1); }
  function qs(str) { var o = {}; new URLSearchParams(str || '').forEach(function (v, k) { o[k] = v; }); return o; }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function err(e) { flash('Fehler: ' + (e && e.message ? e.message : e), 'err'); }
  function statusBadge(s) { return '<span class="status status-' + esc(s) + '">' + esc(H.STATUS_SHORT[s] || s) + '</span>'; }
  function formData(f) { var o = {}; new FormData(f).forEach(function (v, k) { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; }

  async function refreshBadge() {
    if (!me || !me.approved) return;
    var r = await sb.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'neu');
    var d = document.getElementById('newdot');
    d.hidden = !r.count; d.textContent = r.count || '';
  }

  // ---------- Passwort-Regeln ----------
  var PW_HINT = 'Mindestens 8 Zeichen, davon mindestens ein Großbuchstabe, ein Kleinbuchstabe, eine Zahl und ein Sonderzeichen.';
  function pwFehler(pw, pw2) {
    if (pw.length < 8) return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    if (!/[A-ZÄÖÜ]/.test(pw)) return 'Das Passwort braucht mindestens einen Großbuchstaben.';
    if (!/[a-zäöüß]/.test(pw)) return 'Das Passwort braucht mindestens einen Kleinbuchstaben.';
    if (!/[0-9]/.test(pw)) return 'Das Passwort braucht mindestens eine Zahl.';
    if (!/[^A-Za-zÄÖÜäöüß0-9\s]/.test(pw)) return 'Das Passwort braucht mindestens ein Sonderzeichen (z. B. ! ? # $ % & * -).';
    if (pw !== pw2) return 'Die beiden Passwörter stimmen nicht überein.';
    return '';
  }

  // ---------- Anmeldung ----------
  function loginView(msg) {
    document.getElementById('abar').hidden = true;
    app.innerHTML = '<div class="login panel"><h1>Anmelden</h1>' + (msg ? '<div class="flash flash-warn">' + esc(msg) + '</div>' : '') +
      '<form id="lf" class="fields"><label>E-Mail<input type="email" name="email" required autocomplete="username"></label>' +
      '<label>Passwort<input type="password" name="pw" required autocomplete="current-password"></label>' +
      '<button class="btn">Anmelden</button></form>' +
      '<details style="margin-top:16px"><summary>Noch kein Konto? Registrieren</summary>' +
      '<form id="rf" class="fields" style="margin-top:10px"><p class="small muted">Das erste Konto wird automatisch freigeschaltet. Weitere Konten (z. B. Papa) müssen danach unter „Benutzer“ freigegeben werden.</p>' +
      '<label>Name<input name="name" required></label><label>E-Mail<input type="email" name="email" required></label>' +
      '<label>Passwort<input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>' +
      '<label>Passwort wiederholen<input type="password" name="pw2" minlength="8" required autocomplete="new-password"></label>' +
      '<p class="small muted">' + PW_HINT + '</p><div class="flash flash-err" id="rferr" hidden></div>' +
      '<button class="btn btn-green">Konto anlegen</button></form></details>' +
      '<details style="margin-top:10px"><summary>Passwort vergessen?</summary><form id="ff" class="fields" style="margin-top:10px">' +
      '<label>E-Mail<input type="email" name="email" required></label><button class="btn btn-grey btn-small">Link zum Zurücksetzen senden</button></form></details>' +
      '<p class="small muted"><a href="./">← zur Website</a></p></div>';
    document.getElementById('lf').onsubmit = async function (e) {
      e.preventDefault();
      var r = await sb.auth.signInWithPassword({ email: this.email.value.trim(), password: this.pw.value });
      if (r.error) return loginView(r.error.message.indexOf('confirm') > -1 ? 'Bitte zuerst den Bestätigungslink in deiner E-Mail anklicken.' : 'E-Mail oder Passwort falsch.');
      start();
    };
    document.getElementById('rf').onsubmit = async function (e) {
      e.preventDefault();
      var fe = document.getElementById('rferr');
      var pe = pwFehler(this.pw.value, this.pw2.value);
      if (pe) { fe.textContent = pe; fe.hidden = false; return; }
      fe.hidden = true;
      var r = await sb.auth.signUp({ email: this.email.value.trim(), password: this.pw.value,
        options: { data: { name: this.name.value.trim() }, emailRedirectTo: location.href.replace(/#.*$/, '') } });
      if (r.error) return loginView('Registrierung fehlgeschlagen: ' + r.error.message);
      if (r.data.session) return start();
      loginView('Fast fertig: Bitte den Bestätigungslink in deiner E-Mail anklicken und dich dann hier anmelden.');
    };
    document.getElementById('ff').onsubmit = async function (e) {
      e.preventDefault();
      await sb.auth.resetPasswordForEmail(this.email.value.trim(), { redirectTo: location.href.replace(/#.*$/, '') + '#/passwort' });
      loginView('Falls die Adresse registriert ist, kommt gleich eine E-Mail mit einem Link.');
    };
  }

  async function start() {
    var s = await sb.auth.getSession();
    if (!s.data.session) return loginView();
    var u = s.data.session.user;
    var r = await sb.from('admins').select('*').eq('user_id', u.id).maybeSingle();
    me = r.data || { name: u.email, approved: false };
    if (!me.approved) {
      document.getElementById('abar').hidden = true;
      app.innerHTML = '<div class="login panel"><h1>Fast geschafft</h1><p>Dein Konto <strong>' + esc(u.email) + '</strong> wartet noch auf Freischaltung. Bitte Markus oder Josef, dich unter „Benutzer“ freizugeben.</p>' +
        '<button class="btn btn-grey" id="lo">Abmelden</button></div>';
      document.getElementById('lo').onclick = async function () { await sb.auth.signOut(); loginView(); };
      return;
    }
    document.getElementById('abar').hidden = false;
    document.getElementById('logout').textContent = 'Abmelden (' + me.name + ')';
    ST = await H.loadSettings();
    refreshBadge();
    render();
    if (window.HonigPush) HonigPush.init(function (rerender) { refreshBadge(); if (rerender || route() === '/' || route().indexOf('/?') === 0) render(); });
  }

  // ---------- Router ----------
  async function render() {
    if (!me || !me.approved) return;
    var r = route(), parts = r.split('?'), path = parts[0], q = qs(parts[1]);
    try {
      if (path === '/abmelden') { await sb.auth.signOut(); me = null; location.hash = ''; return loginView(); }
      if (path === '/' || path === '') return listView(q);
      if (path.indexOf('/r/') === 0) return detailView(parseInt(path.slice(3), 10));
      if (path === '/neu') return newResView();
      if (path === '/abholliste') return pickupView(q);
      if (path === '/produkte') return productsView();
      if (path.indexOf('/p/') === 0) return productView(path.slice(3));
      if (path === '/einstellungen') return settingsView();
      if (path === '/benutzer') return usersView();
      if (path === '/passwort') return usersView();
      listView({});
    } catch (e) { err(e); }
  }
  window.addEventListener('hashchange', function () { flash(''); render(); });
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') location.hash = '#/benutzer'; });

  // ---------- Reservierungen ----------
  async function listView(q) {
    nav('res');
    var f = q.f || 'offen', search = (q.q || '').trim(), today = H.todayVienna(0);
    var all = await sb.from('reservations').select('id,status,pickup_date,wish_date');
    if (all.error) throw all.error;
    var c = { neu: 0, bestaetigt: 0, abgeholt: 0, storniert: 0, heute: 0 };
    all.data.forEach(function (r) { c[r.status]++; if (r.status === 'bestaetigt' && (r.pickup_date || r.wish_date) === today) c.heute++; });

    var qq = sb.from('reservations').select('*, reservation_items(*)').limit(300);
    if (f === 'offen') qq = qq.in('status', ['neu', 'bestaetigt']);
    else if (f === 'heute') qq = qq.eq('status', 'bestaetigt');
    else if (f !== 'alle') qq = qq.eq('status', f);
    if (search) {
      var s = search.replace(/[%,()]/g, ' ');
      qq = qq.or('name.ilike.%' + s + '%,code.ilike.%' + s + '%,phone.ilike.%' + s + '%,email.ilike.%' + s + '%');
    }
    qq = (f === 'abgeholt' || f === 'storniert' || f === 'alle') ? qq.order('id', { ascending: false }) : qq.order('id');
    var res = await qq;
    if (res.error) throw res.error;
    var rows = res.data;
    if (f === 'heute') rows = rows.filter(function (r) { return (r.pickup_date || r.wish_date) === today; });
    if (f === 'offen' || f === 'neu' || f === 'bestaetigt' || f === 'heute') rows.sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'neu' ? -1 : 1;
      return String(a.pickup_date || a.wish_date || '9').localeCompare(String(b.pickup_date || b.wish_date || '9'));
    });

    function kpi(key, label, n) { return '<a class="kpi' + (f === key ? ' on' : '') + '" href="#/?f=' + key + '"><b>' + n + '</b>' + label + '</a>'; }
    var html = '<div class="kpis">' + kpi('neu', 'Neu / unbestätigt', c.neu) + kpi('heute', 'Heute abholen', c.heute) +
      kpi('bestaetigt', 'Bestätigt', c.bestaetigt) + kpi('abgeholt', 'Abgeholt', c.abgeholt) + kpi('storniert', 'Storniert', c.storniert) + '</div>' +
      '<div class="toolbar"><div class="actions">' +
      '<a class="btn btn-small' + (f === 'offen' ? '' : ' btn-grey') + '" href="#/?f=offen">Offene</a>' +
      '<a class="btn btn-small' + (f === 'alle' ? '' : ' btn-grey') + '" href="#/?f=alle">Alle</a>' +
      '<a class="btn btn-small btn-green" href="#/neu">+ Telefonische Reservierung</a></div>' +
      '<form id="sf"><input name="q" placeholder="Suche Name, Nr., Telefon…" value="' + esc(search) + '"><button class="btn btn-small">Suchen</button></form></div>';
    if (!rows.length) html += '<div class="panel muted">Keine Reservierungen in dieser Ansicht.</div>';
    else html += '<table class="atbl m-res"><tr class="hd"><th>Nr.</th><th>Kunde</th><th class="hide-m">Produkte</th><th>Termin</th><th class="r">Summe</th><th>Status</th></tr>' +
      rows.map(function (r) {
        var conf = r.status === 'bestaetigt' || r.status === 'abgeholt';
        return '<tr class="click" data-id="' + r.id + '"><td><a href="#/r/' + r.id + '"><strong>' + esc(r.code) + '</strong></a><br><span class="small muted">' + esc(H.dtDe(r.created_at)) + '</span></td>' +
          '<td>' + esc(r.name) + '<br><span class="small muted">' + esc(r.phone || r.email) + '</span></td>' +
          '<td class="hide-m small">' + r.reservation_items.map(function (i) { return i.qty + '× ' + esc(i.product_name) + ' <span class="muted">' + esc(i.unit) + '</span>'; }).join('<br>') + '</td>' +
          '<td>' + (conf ? '<strong>' + H.dateDe(r.pickup_date || r.wish_date) + '</strong><br><span class="small">' + esc(r.pickup_time || r.wish_time) + '</span>'
            : '<span class="small muted">Wunsch:</span> ' + H.dateDe(r.wish_date) + '<br><span class="small">' + esc(r.wish_time) + '</span>') + '</td>' +
          '<td class="r">' + euro(r.total_cents) + '</td><td>' + statusBadge(r.status) + '</td></tr>';
      }).join('') + '</table>';
    html += '<p class="small muted">Tipp: Diese Seite am Handy über „Teilen → Zum Home-Bildschirm“ hinzufügen – dann funktioniert sie wie eine App.</p>';
    app.innerHTML = html;
    if (window.HonigPush) HonigPush.banner(app);
    document.getElementById('sf').onsubmit = function (e) { e.preventDefault(); go('#/?f=' + f + '&q=' + encodeURIComponent(this.q.value)); };
    app.querySelectorAll('tr.click').forEach(function (tr) { tr.onclick = function () { go('#/r/' + tr.dataset.id); }; });
    refreshBadge();
  }

  function customerMessage(r, type) {
    var first = (r.name || '').trim().split(' ')[0];
    if (type === 'storniert') return 'Hallo ' + first + ',\n\nleider müssen wir deine Honig-Reservierung ' + r.code + ' stornieren.' +
      ((r.customer_msg || '').trim() ? '\n\n' + r.customer_msg.trim() : '') + '\n\nLiebe Grüße\n' + ST.hof_name;
    var when = H.dateDe(r.pickup_date || r.wish_date) + ((r.pickup_time || r.wish_time) ? ', ' + (r.pickup_time || r.wish_time) : '');
    return 'Hallo ' + first + ',\n\ndeine Honig-Reservierung ' + r.code + ' ist bestätigt.\nAbholung: ' + when +
      '\nAdresse: ' + ST.strasse + ', ' + ST.plz_ort + '\nBetrag: ' + euro(r.total_cents) + ' (' + ST.zahlung + ')\n' +
      ((r.customer_msg || '').trim() ? '\n' + r.customer_msg.trim() + '\n' : '') +
      '\nDetails: ' + H.statusUrl(r.code, r.token) + '\n\nLiebe Grüße\n' + ST.hof_name;
  }

  async function detailView(id) {
    nav('res');
    var res = await sb.from('reservations').select('*, reservation_items(*)').eq('id', id).maybeSingle();
    if (res.error) throw res.error;
    var r = res.data;
    if (!r) { flash('Reservierung nicht gefunden.', 'err'); return go('#/'); }
    var s = r.status, phone = r.phone ? H.phoneIntl(r.phone) : '';
    var msgC = customerMessage(r, 'bestaetigt'), msgS = customerMessage(r, 'storniert');
    var items = r.reservation_items.sort(function (a, b) { return a.id - b.id; });
    var open = s === 'neu' || s === 'bestaetigt';
    var html = '<p class="noprint"><a href="#/">← Alle Reservierungen</a></p>' +
      '<div class="res-head"><div><span class="muted small">Reservierung</span><div class="code">' + esc(r.code) + '</div></div>' +
      '<span class="status status-' + esc(s) + '">' + esc(H.STATUS[s]) + '</span></div><div class="agrid"><div>' +
      '<div class="panel"><h3>' + esc(r.name) + '</h3><p>' +
      (r.phone ? '📞 <a href="tel:' + esc(phone) + '">' + esc(r.phone) + '</a><br>' : '') +
      (r.email ? '✉️ <a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a><br>' : '') +
      '<span class="small muted">Eingegangen: ' + esc(H.dtDe(r.created_at)) + ' · ' + (r.source === 'telefon' ? 'telefonisch' : 'online') +
      (r.handled_by ? ' · zuletzt: ' + esc(r.handled_by) : '') + '</span></p>' +
      '<p><strong>Wunschtermin:</strong> ' + H.dateDe(r.wish_date) + (r.wish_time ? ', ' + esc(r.wish_time) : '') +
      (r.pickup_date ? '<br><strong>Bestätigter Termin:</strong> ' + H.dateDe(r.pickup_date) + (r.pickup_time ? ', ' + esc(r.pickup_time) : '') : '') + '</p>' +
      (r.note ? '<div class="callout"><strong>Anmerkung Kunde:</strong><br>' + H.nl(r.note) + '</div>' : '') +
      '<table class="tbl">' + items.map(function (i) {
        return '<tr><td style="white-space:nowrap">' + i.qty + '\u00a0×</td><td>' + esc(i.product_name) + ' <span class="muted">' + esc(i.unit) + '</span></td><td class="r">' + euro(i.price_cents * i.qty) + '</td></tr>';
      }).join('') + '<tr class="sum"><td></td><td>Summe</td><td class="r">' + euro(r.total_cents) + '</td></tr></table></div>' +
      '<form class="panel noprint" id="notef" style="margin-top:16px"><label>Interne Notiz (sieht nur ihr)<textarea name="admin_note" rows="2">' + esc(r.admin_note) + '</textarea></label>' +
      '<p><button class="btn btn-small btn-grey">Notiz speichern</button></p></form></div><div class="noprint">';
    if (open) html += '<form class="panel" id="cf"><h3>' + (s === 'neu' ? 'Termin bestätigen' : 'Termin ändern') + '</h3><div class="fields">' +
      '<label>Abholdatum<input type="date" name="d" required value="' + esc(r.pickup_date || r.wish_date || '') + '"></label>' +
      '<label>Uhrzeit<input name="t" value="' + esc(r.pickup_time || r.wish_time) + '" placeholder="z. B. 16:00 – 17:00"></label>' +
      '<label>Nachricht an Kunden (optional)<textarea name="m" rows="2" placeholder="z. B. Bitte beim Hoftor läuten.">' + esc(r.customer_msg) + '</textarea></label>' +
      '<button class="btn btn-green">' + (s === 'neu' ? '✓ Bestätigen' : 'Termin speichern') + '</button></div></form>';
    if (s === 'bestaetigt') html += '<div class="panel" style="margin-top:16px"><h3>Kunden benachrichtigen</h3><p class="small muted">Öffnet WhatsApp, SMS oder E-Mail mit fertigem Text.</p><div class="actions">' +
      (phone ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(phone.replace('+', '')) + '?text=' + encodeURIComponent(msgC) + '">WhatsApp</a>' +
        '<a class="btn btn-grey" href="sms:' + esc(phone) + '?&body=' + encodeURIComponent(msgC) + '">SMS</a><a class="btn btn-grey" href="tel:' + esc(phone) + '">Anrufen</a>' : '') +
      (r.email ? '<a class="btn btn-grey" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent('Abholtermin bestätigt – ' + r.code) + '&body=' + encodeURIComponent(msgC) + '">E-Mail</a>' : '') +
      '</div></div>';
    if (s === 'storniert' && (phone || r.email)) html += '<div class="panel" style="margin-top:16px"><h3>Kunden informieren</h3><div class="actions">' +
      (phone ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(phone.replace('+', '')) + '?text=' + encodeURIComponent(msgS) + '">WhatsApp</a>' : '') +
      (r.email ? '<a class="btn btn-grey" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent('Reservierung ' + r.code) + '&body=' + encodeURIComponent(msgS) + '">E-Mail</a>' : '') + '</div></div>';
    html += '<div class="panel" style="margin-top:16px"><h3>Status</h3><div class="actions">' +
      (open ? '<button class="btn" data-st="abgeholt">✓ Abgeholt &amp; bezahlt</button>' : '<button class="btn btn-grey" data-st="neu">Wieder öffnen</button>') +
      '<button class="btn btn-grey" onclick="window.print()">Drucken</button></div>' +
      (open ? '<details style="margin-top:12px"><summary>Stornieren…</summary><form id="xf" class="fields" style="margin-top:10px">' +
        '<label>Grund / Nachricht an Kunden<textarea name="m" rows="2" placeholder="z. B. Waldhonig ist leider ausverkauft."></textarea></label>' +
        '<button class="btn btn-red">Reservierung stornieren</button></form></details>' : '') +
      '<details style="margin-top:12px"><summary>Endgültig löschen…</summary><button class="btn btn-red btn-small" id="delbtn" style="margin-top:10px">Löschen</button></details>' +
      '<p class="small muted" style="margin-top:12px">Kunden-Link: <a href="' + esc(H.statusUrl(r.code, r.token)) + '" target="_blank">Statusseite ↗</a></p></div></div></div>';
    app.innerHTML = html;

    async function setStatus(st, d, t, m, okMsg) {
      var x = await sb.rpc('admin_set_status', { p_id: r.id, p_status: st, p_pickup_date: d || null, p_pickup_time: t == null ? null : t, p_msg: m == null ? null : m });
      if (x.error) return err(x.error);
      await detailView(r.id); flash(okMsg); refreshBadge();
    }
    var cf = document.getElementById('cf');
    if (cf) cf.onsubmit = function (e) { e.preventDefault(); setStatus('bestaetigt', this.d.value, this.t.value.trim(), this.m.value.trim(), 'Termin bestätigt. Jetzt Kunden per WhatsApp, SMS oder E-Mail benachrichtigen.'); };
    var xf = document.getElementById('xf');
    if (xf) xf.onsubmit = function (e) { e.preventDefault(); setStatus('storniert', null, null, this.m.value.trim(), 'Reservierung storniert, Bestand zurückgebucht.'); };
    app.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = function () { setStatus(b.dataset.st, null, null, null, b.dataset.st === 'abgeholt' ? 'Als abgeholt markiert.' : 'Reservierung wieder geöffnet.'); };
    });
    document.getElementById('notef').onsubmit = async function (e) {
      e.preventDefault();
      var x = await sb.from('reservations').update({ admin_note: this.admin_note.value.trim(), updated_at: new Date().toISOString() }).eq('id', r.id);
      x.error ? err(x.error) : flash('Notiz gespeichert.');
    };
    document.getElementById('delbtn').onclick = async function () {
      if (!confirm('Reservierung wirklich endgültig löschen?')) return;
      var x = await sb.rpc('admin_delete_reservation', { p_id: r.id });
      if (x.error) return err(x.error);
      go('#/'); setTimeout(function () { flash('Reservierung gelöscht.'); }, 50);
    };
  }

  async function newResView() {
    nav('res');
    var p = await sb.from('products').select('*').eq('active', true).order('sort').order('id');
    app.innerHTML = '<p><a href="#/">← Zurück</a></p><h1>Telefonische Reservierung</h1><form class="panel" id="nf"><div class="formgrid">' +
      '<label>Name *<input name="name" required></label><label>Telefon<input name="phone"></label><label>E-Mail<input type="email" name="email"></label>' +
      '<label>Wunschtermin<input type="date" name="wish_date"></label><label>Uhrzeit<input name="wish_time" placeholder="z. B. 16:00"></label>' +
      '<label class="full">Anmerkung<textarea name="note" rows="2"></textarea></label></div><h3 style="margin-top:20px">Produkte</h3><table class="atbl m-new">' +
      p.data.map(function (x) {
        return '<tr><td>' + esc(x.name) + ' <span class="muted">' + esc(x.unit) + '</span></td><td>' + euro(x.price_cents) + '</td><td class="small muted">' +
          (x.stock == null ? 'unbegrenzt' : x.stock + ' lagernd') + '</td><td style="width:110px"><input type="number" min="0" max="99" value="0" data-pid="' + x.id + '"></td></tr>';
      }).join('') + '</table><p><button class="btn">Reservierung speichern</button></p></form>';
    document.getElementById('nf').onsubmit = async function (e) {
      e.preventDefault();
      var d = formData(this);
      d.items = Array.prototype.map.call(this.querySelectorAll('[data-pid]'), function (i) { return { id: +i.dataset.pid, qty: +i.value || 0 }; });
      d.quelle = 'telefon';
      var x = await sb.rpc('create_reservation', { p: d });
      if (x.error) return err(x.error);
      if (!x.data.ok) return flash(x.data.errors.join(' '), 'err');
      go('#/r/' + x.data.id); setTimeout(function () { flash('Reservierung ' + x.data.code + ' angelegt.'); }, 300);
    };
  }

  async function pickupView(q) {
    nav('liste');
    var date = q.d || H.todayVienna(0), today = H.todayVienna(0);
    var res = await sb.from('reservations').select('*, reservation_items(*)').in('status', ['neu', 'bestaetigt']);
    if (res.error) throw res.error;
    var rows = res.data.filter(function (r) { return (r.pickup_date || r.wish_date) === date; })
      .sort(function (a, b) { return (a.status === b.status ? 0 : a.status === 'neu' ? 1 : -1) || String(a.pickup_time || a.wish_time).localeCompare(String(b.pickup_time || b.wish_time)); });
    var next = {};
    res.data.forEach(function (r) { var d = r.pickup_date || r.wish_date; if (r.status === 'bestaetigt' && d && d >= today) next[d] = (next[d] || 0) + 1; });
    var totals = {}, sum = 0;
    rows.forEach(function (r) {
      if (r.status !== 'bestaetigt') return; sum += r.total_cents;
      r.reservation_items.forEach(function (i) { var k = i.product_name + ' (' + i.unit + ')'; totals[k] = (totals[k] || 0) + i.qty; });
    });
    var html = '<div class="toolbar noprint"><form id="df"><input type="date" name="d" value="' + esc(date) + '"><button class="btn btn-small">Anzeigen</button></form><div class="actions">' +
      Object.keys(next).sort().slice(0, 8).map(function (d) { return '<a class="btn btn-small' + (d === date ? '' : ' btn-grey') + '" href="#/abholliste?d=' + d + '">' + d.slice(8, 10) + '.' + d.slice(5, 7) + '. (' + next[d] + ')</a>'; }).join('') +
      '<button class="btn btn-small" onclick="window.print()">🖨 Drucken</button></div></div><h1>Abholliste ' + H.dateDe(date) + '</h1>';
    if (Object.keys(totals).length) html += '<div class="panel" style="margin-bottom:16px"><h3>Herrichten (bestätigte Reservierungen)</h3><table class="tbl">' +
      Object.keys(totals).map(function (k) { return '<tr><td style="width:60px"><strong>' + totals[k] + ' ×</strong></td><td>' + esc(k) + '</td></tr>'; }).join('') +
      '<tr class="sum"><td></td><td>Erwartete Einnahmen: ' + euro(sum) + '</td></tr></table></div>';
    if (!rows.length) html += '<div class="panel muted">Für diesen Tag gibt es keine Abholungen.</div>';
    else html += '<table class="atbl m-pick"><tr class="hd"><th>☐</th><th>Zeit</th><th>Kunde</th><th>Produkte</th><th class="r">Summe</th></tr>' + rows.map(function (r) {
      return '<tr><td>☐</td><td>' + esc(r.pickup_time || r.wish_time || '–') + (r.status === 'neu' ? '<br><span class="status status-neu">unbestätigt</span>' : '') + '</td>' +
        '<td><a href="#/r/' + r.id + '"><strong>' + esc(r.name) + '</strong></a><br><span class="small">' + esc(r.code) + ' · ' + esc(r.phone) + '</span>' +
        (r.note ? '<br><span class="small muted">' + esc(r.note) + '</span>' : '') + '</td><td class="small">' +
        r.reservation_items.map(function (i) { return i.qty + '× ' + esc(i.product_name) + ' ' + esc(i.unit); }).join('<br>') + '</td><td class="r">' + euro(r.total_cents) + '</td></tr>';
    }).join('') + '</table>';
    app.innerHTML = html;
    document.getElementById('df').onsubmit = function (e) { e.preventDefault(); go('#/abholliste?d=' + this.d.value); };
  }

  // ---------- Produkte ----------
  async function productsView() {
    nav('prod');
    var p = await sb.from('products').select('*').order('sort').order('id');
    if (p.error) throw p.error;
    app.innerHTML = '<div class="toolbar"><h1 style="margin:0">Produkte</h1><a class="btn btn-green" href="#/p/neu">+ Neues Produkt</a></div>' +
      '<table class="atbl m-prod"><tr class="hd"><th></th><th>Produkt</th><th>Preis</th><th>Bestand</th><th class="hide-m">Sichtbar</th><th></th></tr>' +
      p.data.map(function (x) {
        return '<tr><td><img src="' + esc(H.imgSrc(x.image_url)) + '" alt=""></td><td><strong>' + esc(x.name) + '</strong><br><span class="small muted">' + esc(x.unit) + '</span></td>' +
          '<td>' + euro(x.price_cents) + '</td><td style="width:110px"><input type="number" min="0" data-stock="' + x.id + '" value="' + (x.stock == null ? '' : x.stock) + '" placeholder="∞"></td>' +
          '<td class="hide-m">' + (x.active ? '✅' : '🚫') + '</td><td class="r" style="white-space:nowrap"><a class="btn btn-small btn-grey" href="#/p/' + x.id + '">Bearbeiten</a> ' +
          '<button class="btn btn-small btn-grey" data-toggle="' + x.id + '" data-active="' + (x.active ? 1 : 0) + '">' + (x.active ? 'Ausblenden' : 'Einblenden') + '</button></td></tr>';
      }).join('') + '</table>' +
      (p.data.length ? '<p><button class="btn btn-small" id="savestock">Bestand speichern</button> <span class="small muted">Leer = unbegrenzt. Reservierungen ziehen den Bestand automatisch ab, Stornos buchen ihn zurück.</span></p>' : '');
    app.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.onclick = async function () {
        var x = await sb.from('products').update({ active: b.dataset.active !== '1' }).eq('id', b.dataset.toggle);
        x.error ? err(x.error) : (await productsView(), flash('Gespeichert.'));
      };
    });
    var ss = document.getElementById('savestock');
    if (ss) ss.onclick = async function () {
      var inputs = app.querySelectorAll('[data-stock]');
      for (var i = 0; i < inputs.length; i++) {
        var v = inputs[i].value.trim();
        var x = await sb.from('products').update({ stock: v === '' ? null : Math.max(0, parseInt(v, 10)) }).eq('id', inputs[i].dataset.stock);
        if (x.error) return err(x.error);
      }
      flash('Bestand aktualisiert.');
    };
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { reject(new Error('Bildformat wird nicht unterstützt – bitte JPG oder PNG.')); };
      img.src = url;
    });
  }
  async function uploadImage(file) {
    var blob = await resizeImage(file);
    var path = 'p/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    var up = await sb.storage.from('bilder').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (up.error) throw up.error;
    return sb.storage.from('bilder').getPublicUrl(path).data.publicUrl;
  }
  async function removeStored(url) {
    var m = String(url || '').match(/\/storage\/v1\/object\/public\/bilder\/(.+)$/);
    if (m) await sb.storage.from('bilder').remove([m[1]]);
  }

  async function productView(id) {
    nav('prod');
    var p = { name: '', description: '', unit: '500 g Glas', price_cents: 0, stock: null, max_per_order: null, image_url: '', active: true, sort: 100 };
    if (id !== 'neu') {
      var r = await sb.from('products').select('*').eq('id', id).maybeSingle();
      if (!r.data) return go('#/produkte');
      p = r.data;
    }
    app.innerHTML = '<p><a href="#/produkte">← Alle Produkte</a></p><h1>' + (p.id ? 'Produkt bearbeiten' : 'Neues Produkt') + '</h1>' +
      '<form class="panel" id="pf"><div class="formgrid">' +
      '<label>Name *<input name="name" required value="' + esc(p.name) + '" placeholder="z. B. Blütenhonig"></label>' +
      '<label>Einheit / Größe<input name="unit" value="' + esc(p.unit) + '" placeholder="z. B. 500 g Glas"></label>' +
      '<label>Preis (€) *<input name="price" required inputmode="decimal" value="' + (p.price_cents / 100).toFixed(2).replace('.', ',') + '"></label>' +
      '<label>Bestand (leer = unbegrenzt)<input type="number" min="0" name="stock" value="' + (p.stock == null ? '' : p.stock) + '"></label>' +
      '<label>Max. pro Reservierung (leer = egal)<input type="number" min="1" name="max_per_order" value="' + (p.max_per_order == null ? '' : p.max_per_order) + '"></label>' +
      '<label>Reihenfolge (kleiner = weiter vorne)<input type="number" name="sort" value="' + p.sort + '"></label>' +
      '<label class="full">Beschreibung<textarea name="description" rows="4">' + esc(p.description) + '</textarea></label>' +
      '<div class="full"><strong>Foto</strong><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<img id="prev" src="' + esc(H.imgSrc(p.image_url)) + '" alt="" style="width:160px;height:120px;object-fit:cover;border-radius:10px">' +
      '<div class="fields" style="flex:1;min-width:240px"><label>Eigenes Foto hochladen (z. B. direkt vom Handy)<input type="file" name="file" accept="image/*"></label>' +
      '<label>…oder Bild-Adresse (https://…)<input name="image_url" value="' + esc(p.image_url) + '"></label></div></div></div>' +
      '<label class="check full"><input type="checkbox" name="active" value="1"' + (p.active ? ' checked' : '') + '> Auf der Website anzeigen</label></div>' +
      '<p><button class="btn" id="psave">Speichern</button></p></form>' +
      (p.id ? '<button class="btn btn-red btn-small" id="pdel">Produkt löschen</button>' : '');
    var f = document.getElementById('pf');
    f.file.onchange = function () { if (f.file.files[0]) document.getElementById('prev').src = URL.createObjectURL(f.file.files[0]); };
    f.onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById('psave'); btn.disabled = true; btn.textContent = 'Speichert …';
      try {
        var img = f.image_url.value.trim();
        if (f.file.files[0]) { var newUrl = await uploadImage(f.file.files[0]); if (p.image_url && p.image_url !== newUrl) await removeStored(p.image_url); img = newUrl; }
        var row = {
          name: f.name.value.trim(), unit: f.unit.value.trim(), description: f.description.value.trim(),
          price_cents: Math.max(0, H.parseEuro(f.price.value)), stock: f.stock.value === '' ? null : Math.max(0, +f.stock.value),
          max_per_order: f.max_per_order.value === '' ? null : Math.max(1, +f.max_per_order.value),
          sort: +f.sort.value || 0, image_url: img, active: f.active.checked
        };
        var x = p.id ? await sb.from('products').update(row).eq('id', p.id) : await sb.from('products').insert(row);
        if (x.error) throw x.error;
        go('#/produkte'); setTimeout(function () { flash('Produkt gespeichert.'); }, 300);
      } catch (ex) { err(ex); btn.disabled = false; btn.textContent = 'Speichern'; }
    };
    var del = document.getElementById('pdel');
    if (del) del.onclick = async function () {
      if (!confirm('Produkt „' + p.name + '“ wirklich löschen? Bestehende Reservierungen bleiben erhalten.')) return;
      var x = await sb.from('products').delete().eq('id', p.id).select();
      if (x.error) return err(x.error);
      if (!x.data || !x.data.length) return flash('Löschen ist in der Datenbank noch nicht freigeschaltet. Tipp: stattdessen „Ausblenden“.', 'warn');
      await removeStored(p.image_url);
      go('#/produkte'); setTimeout(function () { flash('„' + p.name + '“ gelöscht.'); }, 300);
    };
  }

  // ---------- Einstellungen ----------
  var SETTINGS = [
    ['Hof & Kontakt', [['hof_name', 'Name des Hofs / der Imkerei'], ['inhaber', 'Inhaber (für Impressum)'], ['claim', 'Slogan', 'full'],
      ['strasse', 'Straße & Hausnummer'], ['plz_ort', 'PLZ & Ort'], ['telefon', 'Telefon'], ['email', 'E-Mail (öffentlich)'],
      ['whatsapp', 'WhatsApp-Nummer (optional, wird auf der Website angezeigt)']]],
    ['Reservierung & Abholung', [['reservierung_offen', 'Online-Reservierung ist geöffnet (ausschalten z. B. im Urlaub)', 'bool'],
      ['abholzeiten', 'Abholzeiten (Text auf der Website)', 'area'], ['abholtage', 'Wählbare Abholtage (keiner = alle)', 'days'],
      ['zeitfenster', 'Zeitfenster zur Auswahl – mit Komma getrennt, Wochentag davor (z. B. „Fr 15:00 – 18:00, Sa 09:00 – 12:00“); ohne Wochentag gilt es für jeden Tag, leer = keine Auswahl', 'full'],
      ['vorlauf_tage', 'Frühestens … Tage im Voraus', 'num'], ['max_tage_voraus', 'Höchstens … Tage im Voraus', 'num'],
      ['zahlung', 'Zahlungshinweis', 'full'], ['pfand', 'Hinweis Gläser-Rückgabe (leer = ausblenden)', 'full']]],
    ['Texte & Bilder', [['banner', 'Hinweis-Banner ganz oben (leer = aus), z. B. „Neue Ernte: Waldhonig ab sofort erhältlich!“', 'full'],
      ['ueber_uns', 'Über uns', 'area'], ['hero_image', 'Titelbild', 'img'], ['about_image', '„Über uns“-Bild', 'img'],
      ['impressum_extra', 'Zusatzangaben Impressum (z. B. UID-Nr., Kammer, Aufsichtsbehörde)', 'area']]]
  ];
  async function settingsView() {
    nav('set');
    ST = await H.loadSettings();
    var html = '<h1>Einstellungen</h1><form id="setf">';
    SETTINGS.forEach(function (g) {
      html += '<fieldset><legend>' + esc(g[0]) + '</legend><div class="formgrid">';
      g[1].forEach(function (f) {
        var k = f[0], label = f[1], t = f[2] || '', v = ST[k] || '';
        if (t === 'bool') html += '<label class="check full"><input type="checkbox" name="' + k + '" value="1"' + (v === '1' ? ' checked' : '') + '> ' + esc(label) + '</label>';
        else if (t === 'area') html += '<label class="full">' + esc(label) + '<textarea name="' + k + '" rows="4">' + esc(v) + '</textarea></label>';
        else if (t === 'days') html += '<div class="full"><strong>' + esc(label) + '</strong><div class="days" style="margin-top:6px">' +
          [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<label><input type="checkbox" name="day" value="' + d + '"' + (H.pickupDays(ST).indexOf(d) > -1 ? ' checked' : '') + '> ' + H.WEEKDAYS[d] + '</label>'; }).join('') + '</div></div>';
        else if (t === 'img') html += '<div><img src="' + esc(v) + '" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:10px;background:#eee">' +
          '<label>' + esc(label) + ' ersetzen<input type="file" data-img="' + k + '" accept="image/*"></label><label>…oder Bild-Adresse<input name="' + k + '" value="' + esc(v) + '"></label></div>';
        else html += '<label' + (t === 'full' ? ' class="full"' : '') + '>' + esc(label) + '<input name="' + k + '"' + (t === 'num' ? ' type="number" min="0"' : '') + ' value="' + esc(v) + '"></label>';
      });
      html += '</div></fieldset>';
    });
    html += '<p><button class="btn" id="setsave">Einstellungen speichern</button></p></form>';
    app.innerHTML = html;
    document.getElementById('setf').onsubmit = async function (e) {
      e.preventDefault();
      var f = this, btn = document.getElementById('setsave'); btn.disabled = true;
      try {
        var rows = [];
        SETTINGS.forEach(function (g) {
          g[1].forEach(function (x) {
            var k = x[0], t = x[2] || '';
            if (t === 'bool') rows.push({ key: k, value: f[k].checked ? '1' : '0' });
            else if (t === 'days') rows.push({ key: k, value: Array.prototype.filter.call(f.querySelectorAll('[name=day]'), function (c) { return c.checked; }).map(function (c) { return c.value; }).join(',') });
            else rows.push({ key: k, value: f[k].value.trim() });
          });
        });
        var files = f.querySelectorAll('[data-img]');
        for (var i = 0; i < files.length; i++) {
          if (files[i].files[0]) {
            var u = await uploadImage(files[i].files[0]);
            rows.forEach(function (r) { if (r.key === files[i].dataset.img) r.value = u; });
          }
        }
        var x = await sb.from('settings').upsert(rows);
        if (x.error) throw x.error;
        await settingsView(); flash('Einstellungen gespeichert.');
      } catch (ex) { err(ex); btn.disabled = false; }
    };
  }

  // ---------- Benutzer ----------
  async function usersView() {
    nav('user');
    var r = await sb.from('admins').select('*').order('created_at');
    if (r.error) throw r.error;
    var myId = (await sb.auth.getUser()).data.user.id;
    app.innerHTML = '<h1>Benutzer</h1><table class="atbl m-user"><tr class="hd"><th>Name</th><th>E-Mail</th><th>Status</th><th></th></tr>' +
      r.data.map(function (a) {
        var self = a.user_id === myId;
        return '<tr><td>' + esc(a.name) + (self ? ' <span class="small muted">(du)</span>' : '') + '</td><td class="small">' + esc(a.email) + '</td>' +
          '<td>' + (a.approved ? '✅ freigegeben' : '⏳ wartet') + '</td><td class="r" style="white-space:nowrap">' +
          (self ? '' : (a.approved ? '<button class="btn btn-small btn-grey" data-ap="' + a.user_id + '" data-v="0">Sperren</button>'
            : '<button class="btn btn-small btn-green" data-ap="' + a.user_id + '" data-v="1">Freigeben</button>') +
            ' <button class="btn btn-small btn-red" data-del="' + a.user_id + '">Entfernen</button>') + '</td></tr>';
      }).join('') + '</table>' +
      '<div class="agrid" style="margin-top:20px"><div class="panel"><h3>Neue Person hinzufügen</h3><p>So bekommt z. B. Papa Zugang:</p><ol>' +
      '<li>Er öffnet <strong>' + esc(location.href.replace(/#.*$/, '')) + '</strong></li><li>„Noch kein Konto? Registrieren“ → Name, E-Mail, Passwort</li>' +
      '<li>Bestätigungslink in seiner E-Mail anklicken</li><li>Du klickst hier bei ihm auf <strong>Freigeben</strong></li></ol></div>' +
      '<form class="panel fields" id="pwf"><h3>Eigenes Passwort ändern</h3><p class="small muted">' + PW_HINT + '</p><label>Neues Passwort<input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>' +
      '<label>Wiederholen<input type="password" name="pw2" minlength="8" required autocomplete="new-password"></label><button class="btn">Ändern</button></form>' +
      '<div class="panel" id="pushbox"></div></div>';
    if (window.HonigPush) HonigPush.box(document.getElementById('pushbox'));
    app.querySelectorAll('[data-ap]').forEach(function (b) {
      b.onclick = async function () {
        var x = await sb.from('admins').update({ approved: b.dataset.v === '1' }).eq('user_id', b.dataset.ap);
        x.error ? err(x.error) : (await usersView(), flash('Gespeichert.'));
      };
    });
    app.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('Zugang wirklich entfernen?')) return;
        var x = await sb.from('admins').delete().eq('user_id', b.dataset.del).select();
        if (x.error) return err(x.error);
        if (!x.data || !x.data.length) return flash('Entfernen ist noch nicht freigeschaltet – stattdessen „Sperren“ verwenden.', 'warn');
        await usersView(); flash('Zugang entfernt.');
      };
    });
    document.getElementById('pwf').onsubmit = async function (e) {
      e.preventDefault();
      var pe = pwFehler(this.pw.value, this.pw2.value);
      if (pe) return flash(pe, 'err');
      var x = await sb.auth.updateUser({ password: this.pw.value });
      x.error ? err(x.error) : (this.reset(), flash('Passwort geändert.'));
    };
  }

  setInterval(refreshBadge, 60000);
  start();
})();
