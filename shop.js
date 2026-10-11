(async function () {
  var H = window.Honig, esc = H.esc;
  var form = document.getElementById('resform');
  var loadedAt = Date.now();
  var st = {}, prods = [];

  try {
    var r = await Promise.all([H.loadSettings(), H.sb.from('products').select('*').eq('active', true).order('sort').order('id')]);
    st = r[0]; prods = r[1].data || [];
    if (r[1].error) throw r[1].error;
  } catch (e) {
    document.getElementById('grid').innerHTML = '<p class="flash flash-err">Die Produkte konnten gerade nicht geladen werden. Bitte Seite neu laden.</p>';
    return;
  }

  H.applyChrome(st);
  document.querySelectorAll('[data-s]').forEach(function (el) {
    var v = st[el.dataset.s]; if (v == null) return;
    el.innerHTML = el.dataset.nl ? H.nl(v) : esc(v);
  });
  if (st.hero_image) document.getElementById('hero').style.setProperty('--hero', 'url("' + st.hero_image.replace(/"/g, '') + '")');
  if (st.about_image) document.getElementById('aboutimg').src = st.about_image;
  document.getElementById('mapsbtn').href = H.mapsUrl(st);
  var ticks = [st.zahlung, 'Wir versenden nicht – alle Produkte werden ab Hof abgeholt.'];
  if ((st.pfand || '').trim()) ticks.push(st.pfand);
  document.getElementById('ticks').innerHTML = ticks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
    '<li>Deine Reservierung kannst du jederzeit unter <a href="status.html">„Meine Reservierung“</a> einsehen oder stornieren.</li>';
  if (st.telefon) document.getElementById('phoneq').innerHTML = 'Fragen? Ruf an: <a href="tel:' + esc(H.phoneIntl(st.telefon)) + '">' + esc(st.telefon) + '</a>';

  var open = st.reservierung_offen === '1';

  // ---------- Produkte ----------
  var grid = document.getElementById('grid');
  if (!prods.length) grid.innerHTML = '<p class="empty">Derzeit ist kein Honig verfügbar – schau bald wieder vorbei!</p>';
  else grid.innerHTML = prods.map(function (p) {
    var stock = p.stock == null ? null : p.stock;
    var sold = stock !== null && stock <= 0;
    var max = 99;
    if (stock !== null) max = Math.min(max, Math.max(0, stock));
    if (p.max_per_order) max = Math.min(max, p.max_per_order);
    var ctrl = sold ? '<span class="badge badge-out">Ausverkauft</span>' : (open ?
      '<div class="qty" data-id="' + p.id + '" data-price="' + p.price_cents + '" data-name="' + esc(p.name + (p.unit ? ' (' + p.unit + ')' : '')) + '">' +
      '<button type="button" class="qminus" aria-label="weniger">−</button>' +
      '<input type="number" value="0" min="0" max="' + max + '" inputmode="numeric" aria-label="Menge ' + esc(p.name) + '">' +
      '<button type="button" class="qplus" aria-label="mehr">+</button></div>' : '');
    return '<article class="card' + (sold ? ' soldout' : '') + '">' +
      '<div class="card-img"><img src="' + esc(H.imgSrc(p.image_url)) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'glas.svg\'"></div>' +
      '<div class="card-body"><h3>' + esc(p.name) + '</h3><p class="unit">' + esc(p.unit) + '</p><p class="desc">' + H.nl(p.description) + '</p>' +
      '<div class="card-foot"><span class="price">' + H.euro(p.price_cents) + '</span>' + ctrl + '</div>' +
      (!sold && stock !== null && stock <= 5 ? '<p class="low">Nur noch ' + stock + ' verfügbar</p>' : '') +
      '</div></article>';
  }).join('');

  if (!open) {
    document.getElementById('resbox').innerHTML = '<div class="panel"><h2>Vorreservierung derzeit pausiert</h2><p>Gerade nehmen wir keine Online-Reservierungen an.' +
      (st.telefon ? ' Ruf uns gerne an: <a href="tel:' + esc(H.phoneIntl(st.telefon)) + '">' + esc(st.telefon) + '</a>' : '') + '</p></div>';
    return;
  }

  // ---------- Datum & Zeit ----------
  var days = H.pickupDays(st);
  var d = form.wish_date;
  d.min = H.todayVienna(parseInt(st.vorlauf_tage || '1', 10));
  d.max = H.todayVienna(parseInt(st.max_tage_voraus || '60', 10));
  document.getElementById('dayhint').textContent = days.length ? 'Abholung möglich: ' + days.map(function (x) { return H.WEEKDAYS[x]; }).join(', ') : '';
  d.addEventListener('change', function () {
    if (!d.value) return d.setCustomValidity('');
    d.setCustomValidity(days.length && days.indexOf(H.isoWeekday(d.value)) === -1 ? 'Abholung nur am ' + days.map(function (x) { return H.WEEKDAYS[x]; }).join(', ') + ' möglich.' : '');
    d.reportValidity();
  });
  var sl = H.slots(st);
  if (sl.length) form.wish_time.innerHTML = '<option value="">egal</option>' + sl.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
  else document.getElementById('timewrap').style.display = 'none';

  // ---------- Warenkorb ----------
  var qtys = Array.prototype.slice.call(document.querySelectorAll('.qty'));
  function clamp(inp) {
    var max = parseInt(inp.max || '99', 10), v = parseInt(inp.value || '0', 10);
    if (isNaN(v) || v < 0) v = 0; if (v > max) v = max; inp.value = v;
  }
  function update() {
    var total = 0, html = '';
    qtys.forEach(function (q) {
      var inp = q.querySelector('input'); clamp(inp);
      var n = parseInt(inp.value, 10), p = parseInt(q.dataset.price, 10);
      q.classList.toggle('active', n > 0);
      if (n > 0) { total += n * p; html += '<li><span>' + n + ' × ' + esc(q.dataset.name) + '</span><span>' + H.euro(n * p) + '</span></li>'; }
    });
    document.getElementById('sumlist').innerHTML = html || '<li class="muted">Noch nichts ausgewählt – oben Menge wählen.</li>';
    document.getElementById('sumtotal').textContent = H.euro(total);
  }
  qtys.forEach(function (q) {
    var inp = q.querySelector('input');
    q.querySelector('.qminus').addEventListener('click', function () { inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) - 1); update(); });
    q.querySelector('.qplus').addEventListener('click', function () { inp.value = (parseInt(inp.value, 10) || 0) + 1; update(); });
    inp.addEventListener('input', update);
  });
  update();

  function showErrors(list) {
    var box = document.getElementById('fehler');
    box.innerHTML = '<div class="flash flash-err"><strong>Bitte prüfen:</strong><ul>' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var items = qtys.map(function (q) { return { id: parseInt(q.dataset.id, 10), qty: parseInt(q.querySelector('input').value, 10) || 0 }; })
      .filter(function (x) { return x.qty > 0; });
    if (!items.length) return showErrors(['Bitte wähle zuerst mindestens ein Produkt aus.']);
    if (!form.phone.value.trim() && !form.email.value.trim()) return showErrors(['Bitte gib Telefon oder E-Mail an.']);
    if (!form.checkValidity()) return form.reportValidity();
    if (form.firma.value || Date.now() - loadedAt < 3000) return; // Spamschutz
    var btn = document.getElementById('submitbtn');
    btn.disabled = true; btn.textContent = 'Wird gesendet …';
    var res = await H.sb.rpc('create_reservation', { p: {
      name: form.name.value, phone: form.phone.value, email: form.email.value, note: form.note.value,
      wish_date: form.wish_date.value, wish_time: form.wish_time.value, items: items
    } });
    btn.disabled = false; btn.textContent = 'Jetzt unverbindlich reservieren';
    if (res.error) return showErrors(['Senden fehlgeschlagen – bitte erneut versuchen oder anrufen.']);
    if (!res.data || !res.data.ok) return showErrors((res.data && res.data.errors) || ['Unbekannter Fehler.']);
    location.href = 'status.html?c=' + encodeURIComponent(res.data.code) + '&t=' + encodeURIComponent(res.data.token) + '&neu=1';
  });
})();
