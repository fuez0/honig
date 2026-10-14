/* Gemeinsame Funktionen für Website und Verwaltung */
// Alte GitHub-Adresse → eigene Domain
if (location.hostname === 'fuez0.github.io') {
  location.replace('https://honig.x10.mx' + location.pathname.replace(/^\/honig/, '') + location.search + location.hash);
}
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
  // Zeitfenster: "Fr 15:00 – 18:00, Sa 09:00 – 12:00" (mit Wochentag) oder "09:00 – 12:00" (für alle Tage)
  var DAYKEYS = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7 };
  function parseSlots(st) {
    return String(st.zeitfenster || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var m = x.match(/^(mo|di|mi|do|fr|sa|so)[a-zäöü]*\.?\s*:?\s+(.+)$/i);
      return m ? { day: DAYKEYS[m[1].toLowerCase()], label: m[2].trim() } : { day: 0, label: x };
    });
  }
  function slots(st, ymd) {
    var wd = ymd ? isoWeekday(ymd) : 0;
    return parseSlots(st).filter(function (s) { return !ymd || !s.day || s.day === wd; }).map(function (s) { return s.label; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
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
      '<div class="nav-wrap"><nav class="nav" id="mainnav" aria-label="Hauptmenü"><a href="./#produkte">Produkte</a><a href="./#abholung">Abholung</a><a href="./#ueber-uns">Über uns</a>' +
      '<a href="status.html">Meine Reservierung</a></nav>' +
      '<a class="btn btn-small nav-cta" href="./#produkte">Reservieren</a>' +
      '<button type="button" class="menu-btn" aria-expanded="false" aria-controls="mainnav" aria-label="Menü öffnen"><span></span><span></span><span></span></button></div>' +
      '</div></header>';
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
    var h = document.getElementById('site-header');
    if (h) {
      h.innerHTML = header(st);
      var mb = h.querySelector('.menu-btn'), nv = h.querySelector('.nav');
      var setOpen = function (o) {
        nv.classList.toggle('open', o); mb.setAttribute('aria-expanded', o ? 'true' : 'false');
        mb.setAttribute('aria-label', o ? 'Menü schließen' : 'Menü öffnen');
      };
      mb.addEventListener('click', function () { setOpen(!nv.classList.contains('open')); });
      nv.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nv.classList.contains('open')) { setOpen(false); mb.focus(); } });
      document.addEventListener('click', function (e) { if (!h.contains(e.target)) setOpen(false); });
    }
    var f = document.getElementById('site-footer'); if (f) f.innerHTML = footer(st);
    setHeaderVar();
  }
  // Höhe der fixen Kopfzeile merken, damit Sprungmarken nicht darunter verschwinden
  function setHeaderVar() {
    var t = document.getElementById('site-header') || document.querySelector('.topbar');
    if (t) document.documentElement.style.setProperty('--hdr', Math.round(t.getBoundingClientRect().height) + 'px');
  }
  window.addEventListener('resize', setHeaderVar);
  // Nach dem Laden der Inhalte zur Sprungmarke springen (z. B. von einer Unterseite kommend)
  function scrollToHash() {
    if (!location.hash || location.hash.length < 2) return;
    var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) el.scrollIntoView({ block: 'start' });
  }

  window.Honig = {
    sb: sb, esc: esc, nl: nl, euro: euro, parseEuro: parseEuro, dateDe: dateDe, dtDe: dtDe, todayVienna: todayVienna,
    isoWeekday: isoWeekday, phoneIntl: phoneIntl, pickupDays: pickupDays, slots: slots, parseSlots: parseSlots, mapsUrl: mapsUrl,
    statusUrl: statusUrl, scrollToHash: scrollToHash, imgSrc: imgSrc, loadSettings: loadSettings, applyChrome: applyChrome,
    WEEKDAYS: WEEKDAYS, STATUS: STATUS, STATUS_SHORT: STATUS_SHORT
  };
})();
