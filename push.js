/* Push-Benachrichtigungen für die Honig-Verwaltung */
(function () {
  var H = window.Honig, sb = H.sb, esc = H.esc;
  var FN = window.HONIG_CONFIG.url + '/functions/v1/push-neue-reservierung';
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var regP = null;

  function reg() {
    if (!supported) return Promise.reject(new Error('nicht unterstützt'));
    if (!regP) regP = navigator.serviceWorker.register('sw.js', { scope: './' }).then(function () { return navigator.serviceWorker.ready; });
    return regP;
  }
  function b64ToU8(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4);
    var raw = atob(s), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }
  function deviceName() {
    var u = navigator.userAgent;
    return (/iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Gerät') +
      ' · ' + new Date().toLocaleDateString('de-DE');
  }
  async function current() {
    if (!supported) return null;
    var r = await reg();
    return r.pushManager.getSubscription();
  }
  async function save(sub) {
    var j = sub.toJSON();
    var x = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceName() }, { onConflict: 'endpoint' });
    if (x.error) throw x.error;
  }
  async function enable() {
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt. Bitte in den Einstellungen des Handys für „Honig“ erlauben.');
    var k = await sb.rpc('push_public_key');
    if (k.error || !k.data) throw new Error('Schlüssel konnte nicht geladen werden.');
    var r = await reg();
    var sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(k.data) });
    await save(sub);
  }
  async function disable() {
    var sub = await current();
    if (!sub) return;
    await sb.rpc('push_abmelden', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  async function test() {
    var s = await sb.auth.getSession();
    var res = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.data.session.access_token, apikey: window.HONIG_CONFIG.key }, body: '{"test":true}' });
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(j.error || 'Test fehlgeschlagen');
    return j.sent || 0;
  }

  // Panel unter „Benutzer“
  async function box(el) {
    if (!el) return;
    var head = '<h3>🔔 Benachrichtigungen auf diesem Gerät</h3>';
    if (isIOS && !standalone) {
      el.innerHTML = head + '<p>Auf dem iPhone geht das nur, wenn die Verwaltung als App auf dem Home-Bildschirm liegt:</p><ol>' +
        '<li>Diese Seite in <strong>Safari</strong> öffnen</li><li>Teilen-Symbol <strong>□↑</strong> → „Zum Home-Bildschirm“</li>' +
        '<li>Die neue <strong>Honig</strong>-App öffnen, anmelden und hier auf „Aktivieren“ tippen</li></ol>';
      return;
    }
    if (!supported) { el.innerHTML = head + '<p class="muted">Dieser Browser unterstützt keine Push-Benachrichtigungen.</p>'; return; }
    var sub = null;
    try { sub = await current(); } catch (e) {}
    var on = !!sub && Notification.permission === 'granted';
    el.innerHTML = head + (on
      ? '<p>✅ Aktiv. Bei jeder neuen Online-Reservierung kommt eine Mitteilung – antippen öffnet direkt die Reservierung.</p>' +
        '<p><button class="btn btn-small btn-green" id="pt">Test senden</button> <button class="btn btn-small btn-grey" id="poff">Ausschalten</button></p>'
      : (Notification.permission === 'denied'
        ? '<p>⛔ Benachrichtigungen sind für diese Seite blockiert. Bitte in den Geräte- bzw. Browser-Einstellungen erlauben und dann neu laden.</p>'
        : '<p>Bei jeder neuen Online-Reservierung eine Mitteilung aufs Handy bekommen.</p><p><button class="btn btn-small btn-green" id="pon">Aktivieren</button></p>')) +
      '<p class="small muted" id="pmsg"></p>';
    var msg = function (t) { var m = el.querySelector('#pmsg'); if (m) m.textContent = t; };
    var bOn = el.querySelector('#pon'), bOff = el.querySelector('#poff'), bT = el.querySelector('#pt');
    if (bOn) bOn.onclick = async function () { bOn.disabled = true; try { await enable(); await box(el); msg('Aktiviert. Tipp: „Test senden“ ausprobieren.'); } catch (e) { bOn.disabled = false; msg(e.message || e); } };
    if (bOff) bOff.onclick = async function () { bOff.disabled = true; try { await disable(); await box(el); } catch (e) { bOff.disabled = false; msg(e.message || e); } };
    if (bT) bT.onclick = async function () { bT.disabled = true; try { var n = await test(); msg(n ? 'Test gesendet – die Mitteilung sollte gleich erscheinen.' : 'Kein aktives Gerät gefunden – bitte aus- und wieder einschalten.'); } catch (e) { msg(e.message || e); } bT.disabled = false; };
  }

  // Hinweis oben in der Reservierungsliste, solange Push hier noch nicht aktiv ist
  async function banner(app) {
    var hide = false; try { hide = localStorage.getItem('honig-push-hinweis') === 'aus'; } catch (e) {}
    if (hide) return;
    if (supported) {
      if (Notification.permission === 'denied') return;
      var on = false;
      try { on = !!(await current()) && Notification.permission === 'granted'; } catch (e) {}
      if (on) return;
    } else if (!(isIOS && !standalone)) return;
    if (document.getElementById('pushhint')) return;
    var d = document.createElement('div');
    d.id = 'pushhint'; d.className = 'flash flash-warn';
    d.innerHTML = '🔔 Neue Reservierungen als Mitteilung aufs Handy? <a href="#/benutzer">Jetzt einrichten</a> · <a href="#" id="pushno">nicht mehr anzeigen</a>';
    app.insertBefore(d, app.firstChild);
    d.querySelector('#pushno').onclick = function (e) { e.preventDefault(); try { localStorage.setItem('honig-push-hinweis', 'aus'); } catch (x) {} d.remove(); };
  }

  // beim Start: Service Worker registrieren, Abo aktuell halten, Klicks auf Mitteilungen verarbeiten
  async function init(onRefresh) {
    if (!supported) return;
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (!e.data) return;
      if (e.data.type === 'push-open' && e.data.url) {
        var h = e.data.url.indexOf('#') > -1 ? e.data.url.slice(e.data.url.indexOf('#')) : '#/';
        if (location.hash === h) onRefresh && onRefresh(true); else location.hash = h;
      }
      if (e.data.type === 'push-refresh') onRefresh && onRefresh(false);
    });
    try {
      var sub = await current();
      if (sub && Notification.permission === 'granted') await save(sub);
    } catch (e) {}
  }

  window.HonigPush = { init: init, box: box, banner: banner };
})();
