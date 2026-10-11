/* Gemeinsame Funktionen für Website und Verwaltung */
(function () {
  var cfg = window.HONIG_CONFIG;
  var sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'honig-auth' }
  });

  var WEEKDAYS = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  var STATUS = {
    neu: 'Neu – wartet auf Bestätigung', bestaetigt: 'Bestätigt', abgeholt: 'Abgeholt', storniert: 'Storniert'
  };
  var STATUS_SHORT = { neu: 'Neu', bestaetigt: 'Bestätigt', abgeholt: 'Abgeholt', storniert: 'Storniert' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function euro(c) {
    return '€ ' + ((c || 0) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function parseEuro(s) {
    s = String(s || '').replace(/[€\s]/g, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isNaN(v) ? 0 : Math.round(v * 100);
  }
  function isoWeekday(ymd) { var d = new Date(ymd + 'T12:00:00').getDay(); return d === 0 ? 7 : d; }
  function dateDe(ymd, withDay) {
    if (!ymd) return '–';
    var p = String(ymd).slice(0, 10).split('-');
    var s = p[2] + '.' + p[1] + '.' + p[0];
    return withDay === false ? s : WEEKDAYS[isoWeekday(String(ymd).slice(0, 10))] + ', ' + s;
  }
  function dtDe(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
      d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  }
  function todayVienna(addDays) {
    var d = new Date(Date.now() + (addDays || 0) * 86400000);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }); // YYYY-MM-DD
  }
  function phoneIntl(p) {
    var d = String(p || '').replace(/[^0-9+]/g, '');
    if (d.indexOf('00') === 0) d = '+' + d.slice(2);
    if (d.indexOf('0') === 0) d = '+43' + d.slice(1);
    return d;
  }
  function pickupDays(st) {
    return String(st.abholtage || '').split(',').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x >= 1 && x <= 7; });
  }
  function slots(st) {
    return String(st.zeitfenster || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function mapsUrl(st) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((st.strasse || '') + ', ' + (st.plz_ort || ''));
  }
  function statusUrl(code, token) {
    var base = location.href.replace(/[#?].*$/, '').replace(/admin\.html$/, '').replace(/[^/]*$/, '');
    return base + 'status.html?c=' + encodeURIComponent(code) + '&t=' + encodeURIComponent(token);
  }
  function imgSrc(u, prefix) {
    if (!u) return 'glas.svg';
    return u;
  }

  async function loadSettings() {
    var res = await sb.from('settings').select('key,value');
    var st = {};
    (res.data || []).forEach(function (r) { st[r.key] = r.value; });
    return st;
  }

  function header(st) {
    var banner = (st.banner || '').trim() ? '<div class="banner">' + esc(st.banner) + '</div>' : '';
    return banner + '<header class="topbar"><div class="wrap topbar-in">' +
      '<a class="brand" href="./"><img src="favicon.svg" alt="" width="34" height="34"><span>' + esc(st.hof_name) + '</span></a>' +
      '<nav class="nav"><a href="./#produkte">Produkte</a><a href="./#abholung">Abholung</a><a href="./#ueber-uns">Über uns</a>' +
      '<a href="status.html">Meine Reservierung</a><a class="btn btn-small" href="./#reservieren">Vorreservieren</a></nav></div></header>';
  }
  function footer(st) {
    var wa = st.whatsapp ? '<a href="https://wa.me/' + esc(phoneIntl(st.whatsapp).replace('+', '')) + '" target="_blank" rel="noopener">WhatsApp schreiben</a>' : '';
    return '<footer class="footer"><div class="wrap footer-grid">' +
      '<div><strong>' + esc(st.hof_name) + '</strong><br>' + esc(st.strasse) + '<br>' + esc(st.plz_ort) +
      '<br><a href="' + esc(mapsUrl(st)) + '" target="_blank" rel="noopener">Route planen ↗</a></div>' +
      '<div>' + (st.telefon ? 'Tel.: <a href="tel:' + esc(phoneIntl(st.telefon)) + '">' + esc(st.telefon) + '</a><br>' : '') +
      (st.email ? 'E-Mail: <a href="mailto:' + esc(st.email) + '">' + esc(st.email) + '</a><br>' : '') + wa + '</div>' +
      '<div><a href="impressum.html">Impressum</a><br><a href="datenschutz.html">Datenschutz</a><br><a href="admin.html">Verwaltung</a></div>' +
      '</div><div class="wrap small muted">Alle Produkte nur zur Selbstabholung ab Hof – kein Versand. © ' + new Date().getFullYear() + ' ' + esc(st.hof_name) + '</div></footer>';
  }
  function applyChrome(st, title) {
    document.title = (title ? title + ' · ' : '') + (st.hof_name || 'Honig ab Hof') + (title ? '' : ' – Honig ab Hof');
    var h = document.getElementById('site-header'); if (h) h.innerHTML = header(st);
    var f = document.getElementById('site-footer'); if (f) f.innerHTML = footer(st);
  }

  window.Honig = {
    sb: sb, esc: esc, nl: nl, euro: euro, parseEuro: parseEuro, dateDe: dateDe, dtDe: dtDe, todayVienna: todayVienna,
    isoWeekday: isoWeekday, phoneIntl: phoneIntl, pickupDays: pickupDays, slots: slots, mapsUrl: mapsUrl,
    statusUrl: statusUrl, imgSrc: imgSrc, loadSettings: loadSettings, applyChrome: applyChrome,
    WEEKDAYS: WEEKDAYS, STATUS: STATUS, STATUS_SHORT: STATUS_SHORT
  };
})();
