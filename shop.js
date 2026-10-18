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
  var jumpAfterRender = function () { H.scrollToHash(); window.addEventListener('load', H.scrollToHash, { once: true }); };

  // ---------- Produkte (ein Honig = eine Karte, Größen per Auswahl) ----------
  var grid = document.getElementById('grid');
  function sizeLabel(u) { return String(u || '').replace(/\s*Glas$/i, '').trim() || u; }
  var kids = {};
  prods.forEach(function (p) { if (p.parent_id) (kids[p.parent_id] = kids[p.parent_id] || []).push(p); });
  var groups = prods.filter(function (p) { return !p.parent_id; }).map(function (p) {
    var vars = p.has_sizes ? (kids[p.id] || []) : [p];
    vars = vars.slice().sort(function (a, b) { return (a.sort - b.sort) || (a.id - b.id); });
    return { p: p, vars: vars, multi: !!p.has_sizes };
  }).filter(function (g) { return g.vars.length > 0; });
  var vinfo = {}, gsel = {};
  function vMax(v) {
    var max = 99;
    if (v.stock != null) max = Math.min(max, Math.max(0, v.stock));
    if (v.max_per_order) max = Math.min(max, v.max_per_order);
    return max;
  }
  if (!groups.length) grid.innerHTML = '<p class="empty">Derzeit ist kein Honig verfügbar – schau bald wieder vorbei!</p>';
  else grid.innerHTML = groups.map(function (g) {
    var p = g.p;
    g.vars.forEach(function (v) { vinfo[v.id] = { v: v, g: p.id, max: vMax(v), label: sizeLabel(v.unit) }; });
    var avail = g.vars.filter(function (v) { return vinfo[v.id].max > 0; });
    var sold = avail.length === 0;
    var first = (avail[0] || g.vars[0]);
    gsel[p.id] = first.id;
    var hidden = g.vars.map(function (v) {
      return '<div class="vq" hidden data-id="' + v.id + '" data-g="' + p.id + '" data-price="' + v.price_cents + '" data-name="' + esc(v.name + (v.unit ? ' (' + v.unit + ')' : '')) + '">' +
        '<input type="number" value="0" min="0" max="' + vinfo[v.id].max + '" tabindex="-1" aria-hidden="true"></div>';
    }).join('');
    var sizes = g.multi ? '<div class="sizes" role="radiogroup" aria-label="Größe ' + esc(p.name) + '">' + g.vars.map(function (v) {
      var out = vinfo[v.id].max <= 0;
      return '<button type="button" class="size' + (v.id === first.id ? ' sel' : '') + '" role="radio" aria-checked="' + (v.id === first.id) + '" data-v="' + v.id + '"' +
        (v.id === first.id ? '' : ' tabindex="-1"') + (out ? ' disabled title="ausverkauft"' : '') + '>' +
        '<span class="sz-l">' + esc(vinfo[v.id].label) + '</span><span class="sz-p">' + H.euro(v.price_cents) + '</span><span class="sz-n" hidden></span></button>';
    }).join('') + '</div>' : '';
    var full = p.name + (g.multi ? '' : (p.unit ? ' ' + p.unit : ''));
    var ctrl = sold ? '<span class="badge badge-out">Ausverkauft</span>' : (open ?
      '<div class="qty qsel" data-g="' + p.id + '">' +
      '<button type="button" class="qminus" aria-label="' + esc(p.name) + ' – Menge verringern">−</button>' +
      '<input type="number" value="0" min="0" max="' + vinfo[first.id].max + '" inputmode="numeric" aria-label="Menge ' + esc(full) + '">' +
      '<button type="button" class="qplus" aria-label="' + esc(p.name) + ' – Menge erhöhen">+</button></div>' : '');
    return '<article class="card' + (sold ? ' soldout' : '') + '" data-g="' + p.id + '">' +
      '<div class="card-img"><img src="' + esc(H.imgSrc(p.image_url)) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'glas.svg\'"></div>' +
      '<div class="card-body"><h3>' + esc(p.name) + (!g.multi && p.unit ? ' <span class="unit">' + esc(p.unit) + '</span>' : '') + '</h3><p class="desc">' + H.nl(p.description) + '</p>' +
      sizes +
      '<div class="card-foot"><span class="price" aria-live="polite">' + H.euro(first.price_cents) + '</span>' + ctrl + '</div>' +
      '<p class="low" hidden></p>' + hidden +
      '</div></article>';
  }).join('');

  if (!open) {
    jumpAfterRender();
    document.getElementById('resbox').innerHTML = '<div class="panel"><h2>Reservierung derzeit pausiert</h2><p>Gerade nehmen wir keine Online-Reservierungen an.' +
      (st.telefon ? ' Ruf uns gerne an: <a href="tel:' + esc(H.phoneIntl(st.telefon)) + '">' + esc(st.telefon) + '</a>' : '') + '</p></div>';
    return;
  }

  // ---------- Datum & Zeit ----------
  var days = H.pickupDays(st);
  var d = form.wish_date;
  d.min = H.todayVienna(parseInt(st.vorlauf_tage || '1', 10));
  d.max = H.todayVienna(parseInt(st.max_tage_voraus || '60', 10));
  (function () {
    var vor = Math.max(0, parseInt(st.vorlauf_tage || '1', 10) || 0), maxT = parseInt(st.max_tage_voraus || '60', 10) || 60;
    var ab = vor === 0 ? 'ab heute' : vor === 1 ? 'ab morgen' : 'ab ' + H.dateDe(d.min, false).slice(0, 6);
    var txt = 'Reservierungen ' + ab + ', bis zu ' + maxT + ' Tage im Voraus (spätestens ' + H.dateDe(d.max) + ').';
    if (days.length) txt += ' Abholung möglich: ' + days.map(function (x) { return H.WEEKDAYS[x]; }).join(', ') + '.';
    document.getElementById('dayhint').textContent = txt;
  })();

  // ---------- Eigener Kalender (große Felder statt winziger Browser-Datumsauswahl) ----------
  var cal = document.getElementById('cal'), dbtn = document.getElementById('date-btn'), dtxt = document.getElementById('date-btn-txt');
  function openCal() {
    if (d.value) { calY = +d.value.slice(0, 4); calM = +d.value.slice(5, 7) - 1; }
    focusV = null; renderCal(); cal.hidden = false; dbtn.setAttribute('aria-expanded', 'true');
    var b = cal.querySelector('.cal-day[tabindex="0"]'); if (b) b.focus();
  }
  function closeCal(back) { cal.hidden = true; dbtn.setAttribute('aria-expanded', 'false'); if (back) dbtn.focus(); }
  dbtn.addEventListener('click', function () { cal.hidden ? openCal() : closeCal(); });
  document.addEventListener('click', function (e) { if (!cal.hidden && !cal.contains(e.target) && !dbtn.contains(e.target)) closeCal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !cal.hidden) closeCal(true); });
  var MON = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(y, m, dd) { return y + '-' + pad(m + 1) + '-' + pad(dd); }
  function okDay(v) { return v >= d.min && v <= d.max && (!days.length || days.indexOf(H.isoWeekday(v)) !== -1); }
  var calY = +d.min.slice(0, 4), calM = +d.min.slice(5, 7) - 1, focusV = null;
  function firstOk() { for (var t = new Date(d.min + 'T12:00:00'); ; t.setDate(t.getDate() + 1)) { var v = ymdOf(t.getFullYear(), t.getMonth(), t.getDate()); if (v > d.max) return null; if (okDay(v)) return v; } }
  function renderCal() {
    var first = new Date(calY, calM, 1, 12), lead = (first.getDay() + 6) % 7, nDays = new Date(calY, calM + 1, 0, 12).getDate();
    var minM = d.min.slice(0, 7), maxM = d.max.slice(0, 7), curM = calY + '-' + pad(calM + 1);
    var tabV = focusV || (d.value && d.value.slice(0, 7) === curM ? d.value : null);
    if (!tabV || tabV.slice(0, 7) !== curM) { tabV = null; for (var i = 1; i <= nDays; i++) { if (okDay(ymdOf(calY, calM, i))) { tabV = ymdOf(calY, calM, i); break; } } }
    var h = '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Voriger Monat"' + (curM <= minM ? ' disabled' : '') + '>‹</button>' +
      '<strong aria-live="polite">' + MON[calM] + ' ' + calY + '</strong>' +
      '<button type="button" class="cal-nav" data-nav="1" aria-label="Nächster Monat"' + (curM >= maxM ? ' disabled' : '') + '>›</button></div>' +
      '<div class="cal-grid" role="grid">' + ['Mo','Di','Mi','Do','Fr','Sa','So'].map(function (w) { return '<span class="cal-wd" aria-hidden="true">' + w + '</span>'; }).join('');
    for (var k = 0; k < lead; k++) h += '<span></span>';
    for (var dd = 1; dd <= nDays; dd++) {
      var v = ymdOf(calY, calM, dd), ok = okDay(v), sel = v === d.value;
      h += '<button type="button" class="cal-day' + (sel ? ' sel' : '') + '" data-v="' + v + '"' + (ok ? '' : ' disabled') +
        ' tabindex="' + (v === tabV ? '0' : '-1') + '" aria-pressed="' + sel + '" aria-label="' + H.dateDe(v) + (ok ? '' : ' – nicht verfügbar') + '">' + dd + '</button>';
    }
    h += '</div>';
    cal.innerHTML = h;
  }
  function pick(v) {
    d.value = v; focusV = v;
    dtxt.textContent = H.dateDe(v); dtxt.classList.remove('ph');
    closeCal(true);
    d.dispatchEvent(new Event('change'));
  }
  cal.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.nav) { calM += +b.dataset.nav; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } focusV = null; renderCal(); return; }
    pick(b.dataset.v);
  });
  cal.addEventListener('keydown', function (e) {
    var b = e.target.closest('.cal-day'); if (!b) return;
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
    e.preventDefault();
    var t = new Date(b.dataset.v + 'T12:00:00');
    for (var n = 0; n < 62; n++) {
      t.setDate(t.getDate() + step);
      var v = ymdOf(t.getFullYear(), t.getMonth(), t.getDate());
      if (v < d.min || v > d.max) return;
      if (okDay(v)) { focusV = v; calY = t.getFullYear(); calM = t.getMonth(); renderCal(); cal.querySelector('[data-v="' + v + '"]').focus(); return; }
    }
  });
  (function () { var f = firstOk(); if (f) { calY = +f.slice(0, 4); calM = +f.slice(5, 7) - 1; } })();
  renderCal();
  var VB = 'nach Vereinbarung';
  var hasSlots = H.slots(st).length > 0;
  var timeHint = document.createElement('p'); timeHint.className = 'hint'; timeHint.id = 'timehint';
  document.getElementById('timewrap').insertAdjacentElement('afterend', timeHint);
  function fillTimes() {
    var sel = form.wish_time, prev = sel.value;
    if (!d.value) {
      sel.innerHTML = '<option value="">Bitte zuerst Wunschtermin wählen</option>'; sel.disabled = true;
      timeHint.textContent = ''; return;
    }
    sel.disabled = false;
    var sl = H.slots(st, d.value), wd = H.WEEKDAYS[H.isoWeekday(d.value)];
    if (sl.length) {
      sel.innerHTML = sl.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') +
        '<option value="' + VB + '">Andere Uhrzeit – ' + VB + '</option>';
      timeHint.textContent = 'Reguläre Abholzeit am ' + wd + ': ' + sl.join(' und ') + '.';
    } else {
      sel.innerHTML = '<option value="' + VB + '">' + VB.charAt(0).toUpperCase() + VB.slice(1) + '</option>';
      timeHint.textContent = 'Am ' + wd + ' gibt es keine reguläre Abholzeit – wir vereinbaren die Uhrzeit mit dir.';
    }
    if (Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) sel.value = prev;
  }
  d.addEventListener('change', function () {
    clearErr(d);
    fillTimes();
    if (!d.value) return d.setCustomValidity('');
    var bad = days.length && days.indexOf(H.isoWeekday(d.value)) === -1;
    d.setCustomValidity(bad ? 'Abholung nur am ' + days.map(function (x) { return H.WEEKDAYS[x]; }).join(', ') + ' möglich.' : '');
    if (bad) fieldErr(d, d.validationMessage);
  });
  if (hasSlots) fillTimes();
  else document.getElementById('timewrap').style.display = 'none';

  // ---------- Warenkorb ----------
  var qtys = Array.prototype.slice.call(document.querySelectorAll('.vq'));
  function clamp(inp) {
    var max = parseInt(inp.max || '99', 10), v = parseInt(inp.value || '0', 10);
    if (isNaN(v) || v < 0) v = 0; if (v > max) v = max; inp.value = v;
  }
  var sumlist = document.getElementById('sumlist'), cartbar = document.getElementById('cartbar'), resSec = document.getElementById('reservieren');
  var resVisible = false, cartCount = 0;
  function qtyById(id) { return qtys.filter(function (q) { return q.dataset.id === String(id); })[0]; }
  function setQty(id, n) {
    var q = qtyById(id); if (!q) return;
    q.querySelector('input').value = n; update();
  }
  function update(typing) {
    var total = 0, html = '', count = 0, allGlas = true;
    qtys.forEach(function (q) {
      var inp = q.querySelector('input'); clamp(inp);
      var n = parseInt(inp.value, 10), p = parseInt(q.dataset.price, 10), max = parseInt(inp.max || '99', 10);
      q.classList.toggle('active', n > 0);
      if (n > 0) {
        total += n * p; count += n;
        if (!/glas/i.test(q.dataset.name)) allGlas = false;
        html += '<li class="sl" data-id="' + esc(q.dataset.id) + '"><span class="sl-name">' + esc(q.dataset.name) + '</span><span class="sl-sum">' + H.euro(n * p) + '</span>' +
          '<span class="sl-ctrl"><span class="qty qty-s"><button type="button" data-act="minus" aria-label="' + esc(q.dataset.name) + ' – eins weniger">−</button>' +
          '<span aria-live="polite">' + n + '</span>' +
          '<button type="button" data-act="plus" aria-label="' + esc(q.dataset.name) + ' – eins mehr"' + (n >= max ? ' disabled' : '') + '>+</button></span>' +
          '<button type="button" class="linkbtn" data-act="del" aria-label="' + esc(q.dataset.name) + ' entfernen">Entfernen</button></span></li>';
      }
    });
    sumlist.innerHTML = html || '<li class="muted">Noch nichts ausgewählt – oben Menge wählen.</li>';
    document.getElementById('sumtotal').textContent = H.euro(total);
    cartCount = count;
    var unit = allGlas ? (count === 1 ? 'Glas' : 'Gläser') : 'Artikel';
    document.getElementById('cbinfo').textContent = count + ' ' + unit + ' · ' + H.euro(total);
    toggleBar();
    refreshCards(typing);
    if (total > 0 && grid.classList.contains('invalid')) clearErr(grid);
  }
  function refreshCards(typing) {
    Array.prototype.forEach.call(grid.querySelectorAll('.card[data-g]'), function (card) {
      var g = card.dataset.g, vid = gsel[g], info = vinfo[vid]; if (!info) return;
      var n = vVal(vid), box = card.querySelector('.qsel');
      card.querySelector('.price').textContent = H.euro(info.v.price_cents);
      if (box) {
        var inp = box.querySelector('input');
        if (!typing) inp.value = n;
        inp.max = info.max;
        inp.setAttribute('aria-label', 'Menge ' + info.v.name + ' ' + info.label);
        box.classList.toggle('active', n > 0);
        box.querySelector('.qplus').disabled = n >= info.max;
        box.querySelector('.qminus').disabled = n <= 0;
      }
      Array.prototype.forEach.call(card.querySelectorAll('.size'), function (b) {
        var c = vVal(+b.dataset.v), badge = b.querySelector('.sz-n');
        badge.hidden = c <= 0; badge.textContent = c > 0 ? c + '×' : '';
        b.classList.toggle('has', c > 0);
        b.setAttribute('aria-label', vinfo[b.dataset.v].label + ', ' + H.euro(vinfo[b.dataset.v].v.price_cents) + (c > 0 ? ', ' + c + ' ausgewählt' : '') + (b.disabled ? ', ausverkauft' : ''));
      });
      var low = card.querySelector('.low'), st0 = info.v.stock;
      if (low) {
        var show = st0 != null && st0 > 0 && st0 <= 5;
        low.hidden = !show; low.textContent = show ? 'Nur noch ' + st0 + (card.querySelector('.sizes') ? ' × ' + info.label : '') + ' verfügbar' : '';
      }
    });
  }
  function toggleBar() {
    var show = cartCount > 0 && !resVisible;
    cartbar.classList.toggle('show', show);
    cartbar.setAttribute('aria-hidden', show ? 'false' : 'true');
    document.getElementById('cbbtn').tabIndex = show ? 0 : -1;
    document.body.classList.toggle('has-cartbar', show);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { resVisible = en[0].isIntersecting; toggleBar(); }, { threshold: 0.15 }).observe(resSec);
  }
  document.getElementById('cbbtn').addEventListener('click', function (e) {
    e.preventDefault();
    resSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { try { form.name.focus({ preventScroll: true }); } catch (x) {} }, 500);
  });
  sumlist.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b) return;
    var li = b.closest('li'), q = qtyById(li.dataset.id); if (!q) return;
    var n = parseInt(q.querySelector('input').value, 10) || 0, act = b.dataset.act;
    setQty(li.dataset.id, act === 'plus' ? n + 1 : act === 'minus' ? Math.max(0, n - 1) : 0);
    var again = sumlist.querySelector('li[data-id="' + li.dataset.id + '"] button[data-act="' + act + '"]');
    if (again && !again.disabled) again.focus();
  });
  function vVal(id) { var q = qtyById(id); return q ? (parseInt(q.querySelector('input').value, 10) || 0) : 0; }
  // Sichtbarer Mengenregler gilt für die gewählte Größe
  Array.prototype.forEach.call(document.querySelectorAll('.qsel'), function (box) {
    var g = box.dataset.g, inp = box.querySelector('input');
    box.querySelector('.qminus').addEventListener('click', function () { setQty(gsel[g], Math.max(0, vVal(gsel[g]) - 1)); });
    box.querySelector('.qplus').addEventListener('click', function () { setQty(gsel[g], vVal(gsel[g]) + 1); });
    inp.addEventListener('input', function () { var q = qtyById(gsel[g]); if (q) { q.querySelector('input').value = inp.value; update(true); } });
    inp.addEventListener('change', function () { update(); });
  });
  // Größe wählen
  function selectSize(btn, focus) {
    var card = btn.closest('.card'), g = card.dataset.g;
    gsel[g] = +btn.dataset.v;
    Array.prototype.forEach.call(card.querySelectorAll('.size'), function (b) {
      var on = b === btn; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    if (focus) btn.focus();
    update();
  }
  grid.addEventListener('click', function (e) { var b = e.target.closest('.size'); if (b && !b.disabled) selectSize(b); });
  grid.addEventListener('keydown', function (e) {
    var b = e.target.closest('.size'); if (!b) return;
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(e.key) === -1) return;
    e.preventDefault();
    var list = Array.prototype.filter.call(b.parentNode.querySelectorAll('.size'), function (x) { return !x.disabled; });
    var i = list.indexOf(b) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    selectSize(list[(i + list.length) % list.length], true);
  });
  update();
  jumpAfterRender();

  // ---------- Fehler direkt am Feld ----------
  function errId(el) { return 'err-' + (el.name || el.id); }
  function anchorOf(el) {
    if (el === grid) return grid;
    if (el.type === 'checkbox') return el.closest('label');
    if (el.name === 'phone' || el.name === 'email') return form.querySelector('.hint');
    if (el === d) return dbtn;
    return el.closest('label') || el;
  }
  function clearErr(el) {
    var old = document.getElementById(errId(el)); if (old) old.remove();
    el.removeAttribute('aria-invalid');
    if (el === grid) grid.classList.remove('invalid');
    if (el === d) dbtn.classList.remove('invalid');
    if (el.type === 'checkbox') el.closest('label').classList.remove('invalid');
    if (el.name === 'phone' || el.name === 'email') { form.phone.removeAttribute('aria-invalid'); form.email.removeAttribute('aria-invalid'); }
  }
  function fieldErr(el, msg) {
    clearErr(el);
    var p = document.createElement('p');
    p.className = 'ferr'; p.id = errId(el); p.setAttribute('role', 'alert'); p.textContent = msg;
    if (el === grid) { grid.classList.add('invalid'); grid.insertAdjacentElement('beforebegin', p); }
    else if (el === d) { dbtn.classList.add('invalid'); cal.insertAdjacentElement('afterend', p); }
    else {
      anchorOf(el).insertAdjacentElement('afterend', p);
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', p.id);
      if (el.type === 'checkbox') el.closest('label').classList.add('invalid');
      if (el === form.phone && /oder E-Mail/.test(msg)) form.email.setAttribute('aria-invalid', 'true');
    }
  }
  function clearAll() {
    [grid, form.name, form.phone, form.email, form.wish_date, form.dsgvo].forEach(clearErr);
    document.getElementById('fehler').innerHTML = '';
    var g = document.getElementById('err-general'); if (g) g.remove();
  }
  function focusFirst(el) {
    var target = el === grid ? (grid.querySelector('.qsel input') || grid) : el === d ? dbtn : el;
    (el === grid ? grid : anchorOf(el)).scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (e) {} }, 350);
  }
  function generalErr(list) {
    var g = document.getElementById('err-general'); if (g) g.remove();
    g = document.createElement('div'); g.id = 'err-general'; g.className = 'flash flash-err'; g.setAttribute('role', 'alert');
    g.innerHTML = '<strong>Bitte prüfen:</strong><ul>' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    var btn = document.getElementById('submitbtn'); btn.insertAdjacentElement('beforebegin', g);
    g.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  // Server-Meldungen dem passenden Feld zuordnen
  function showErrors(list) {
    var first = null, rest = [];
    list.forEach(function (m) {
      var el = /Produkt|verfügbar|ausverkauft|maximal|Stück/i.test(m) ? grid
        : /Telefon|E-Mail|erreichen/i.test(m) ? (/E-Mail-Adresse scheint/.test(m) ? form.email : form.phone)
        : /Namen/i.test(m) ? form.name
        : /Wunschtermin|Datum|Tag ist/i.test(m) ? form.wish_date : null;
      if (el) { fieldErr(el, m); if (!first) first = el; } else rest.push(m);
    });
    if (rest.length) generalErr(rest);
    else if (first) focusFirst(first);
  }
  function validate() {
    var errs = [];
    var any = qtys.some(function (q) { return parseInt(q.querySelector('input').value, 10) > 0; });
    if (!any) errs.push([grid, 'Bitte wähle mindestens ein Produkt aus (Menge mit + erhöhen).']);
    if (form.name.value.trim().length < 2) errs.push([form.name, 'Bitte gib deinen Namen an.']);
    var ph = form.phone.value.trim(), em = form.email.value.trim();
    if (!ph && !em) errs.push([form.phone, 'Bitte gib eine Telefonnummer oder E-Mail-Adresse an, damit wir dich erreichen können.']);
    else {
      if (ph && !/^[0-9 +\/()-]{6,25}$/.test(ph)) errs.push([form.phone, 'Die Telefonnummer scheint nicht zu stimmen.']);
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) errs.push([form.email, 'Die E-Mail-Adresse scheint nicht zu stimmen.']);
    }
    if (!form.wish_date.value) errs.push([form.wish_date, 'Bitte wähle einen Wunschtermin für die Abholung.']);
    else if (!form.wish_date.checkValidity()) errs.push([form.wish_date, form.wish_date.validationMessage || 'Bitte einen anderen Termin wählen.']);
    if (!form.dsgvo.checked) errs.push([form.dsgvo, 'Bitte bestätige die Speicherung deiner Angaben.']);
    return errs;
  }
  [form.name, form.phone, form.email, form.dsgvo].forEach(function (el) {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () { if (el.getAttribute('aria-invalid')) clearErr(el); });
  });

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var items = qtys.map(function (q) { return { id: parseInt(q.dataset.id, 10), qty: parseInt(q.querySelector('input').value, 10) || 0 }; })
      .filter(function (x) { return x.qty > 0; });
    clearAll();
    var errs = validate();
    if (errs.length) {
      errs.forEach(function (e) { fieldErr(e[0], e[1]); });
      return focusFirst(errs[0][0]);
    }
    if (form.firma.value || Date.now() - loadedAt < 3000) return; // Spamschutz
    var btn = document.getElementById('submitbtn');
    btn.disabled = true; btn.textContent = 'Wird gesendet …';
    var res = await H.sb.rpc('create_reservation', { p: {
      name: form.name.value, phone: form.phone.value, email: form.email.value, note: form.note.value,
      wish_date: form.wish_date.value, wish_time: form.wish_time.value, items: items
    } });
    btn.disabled = false; btn.textContent = 'Jetzt unverbindlich reservieren';
    if (res.error) return generalErr(['Senden fehlgeschlagen – bitte erneut versuchen oder anrufen.']);
    if (!res.data || !res.data.ok) return showErrors((res.data && res.data.errors) || ['Unbekannter Fehler.']);
    location.href = 'status.html?c=' + encodeURIComponent(res.data.code) + '&t=' + encodeURIComponent(res.data.token) + '&neu=1';
  });
})();
