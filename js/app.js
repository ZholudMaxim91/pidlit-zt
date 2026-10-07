/* Підліт до Житомира — основна логіка застосунку. */
(function () {
  "use strict";

  // ---------- Налаштування ----------
  var SPEED_MIN = 300;           // км/год — повільніший сценарій
  var SPEED_MAX = 400;           // км/год — найшвидший сценарій
  var ZONES = [                  // межі зон підльоту (хв) за SPEED_MAX
    { to: 5,  cls: "z0" },
    { to: 10, cls: "z1" },
    { to: 15, cls: "z2" },
    { to: 20, cls: "z3" },
    { to: 30, cls: "z4" }
  ];
  var ZONE_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#7cb342", "#26a69a"];
  // Підписи пунктів біля Житомира ховаються на дрібному масштабі (видно при наведенні/виборі).
  var NEAR_KM = 25, NEAR_LABEL_ZOOM = 10;
  var MID_KM = 45, MID_LABEL_ZOOM = 8;
  var LS = { theme: "zt-theme", zones: "zt-zones", favs: "zt-favorites", custom: "zt-custom-places" };
  var MAX_CUSTOM = 300;          // скільки доданих користувачем пунктів зберігаємо

  var TARGET = window.ZT_TARGET;
  var GEO = window.ZTGeocode;
  var nextId = 0;
  var byId = {};

  // Додає розрахункові поля до пункту (відстань, азимут, час підльоту, ключі пошуку).
  function makePlace(p) {
    var km = distanceKm(p.lat, p.lon, TARGET.lat, TARGET.lon);
    var place = Object.assign({}, p, {
      id: nextId++,
      key: p.custom ? "c:" + p.lat.toFixed(4) + "," + p.lon.toFixed(4) : p.name,   // ключ для «Обраного»
      km: km,
      bearing: bearingDeg(TARGET.lat, TARGET.lon, p.lat, p.lon),
      secFast: km / SPEED_MAX * 3600,
      secSlow: km / SPEED_MIN * 3600,
      keys: [p.name].concat(p.aliases || []).map(norm)
    });
    byId[place.id] = place;
    return place;
  }

  var PLACES = window.ZT_PLACES.map(makePlace);

  // ---------- Безпечний localStorage ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватний режим */ } }

  // Користувацькі пункти (зберігаються в цьому браузері/на цьому телефоні).
  function loadCustom() {
    var raw;
    try { raw = JSON.parse(lsGet(LS.custom)) || []; } catch (e) { raw = []; }
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, MAX_CUSTOM).filter(function (c) {
      return c && typeof c.name === "string" && c.name.length > 0 && c.name.length <= 80 &&
        isFinite(c.lat) && isFinite(c.lon) && GEO.inOblastBox(+c.lat, +c.lon);
    }).map(function (c) {
      return { name: c.name, sub: typeof c.sub === "string" ? c.sub.slice(0, 120) : "",
               lat: +c.lat, lon: +c.lon, src: "osm", custom: true };
    });
  }
  function saveCustom() {
    var list = PLACES.filter(function (p) { return p.custom; }).map(function (p) {
      return { name: p.name, sub: p.sub, lat: p.lat, lon: p.lon };
    });
    lsSet(LS.custom, JSON.stringify(list));
  }

  // ---------- Геометрія ----------
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  // Відстань по великому колу (Haversine), км.
  function distanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371.0088;
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Азимут з точки 1 на точку 2, градуси 0..360.
  function bearingDeg(lat1, lon1, lat2, lon2) {
    var y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  // Точка на відстані km за азимутом brg від (lat, lon).
  function destination(lat, lon, brg, km) {
    var R = 6371.0088, d = km / R, b = toRad(brg);
    var p1 = toRad(lat), l1 = toRad(lon);
    var p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    var l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [toDeg(p2), toDeg(l2)];
  }

  function circlePoints(km) {
    var pts = [];
    for (var a = 0; a < 360; a += 3) pts.push(destination(TARGET.lat, TARGET.lon, a, km));
    return pts;
  }

  // ---------- Форматування ----------
  var nf1 = new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function fmtKm(km) { return nf1.format(km) + " км"; }

  function fmtDur(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + " хв " + (s < 10 ? "0" : "") + s + " с";
  }

  function fmtRangeShort(p) {
    var a = Math.floor(p.secFast / 60), b = Math.ceil(p.secSlow / 60);
    return a === b ? "≈" + a + " хв" : a + "–" + b + " хв";
  }

  var DIRS = ["з півночі", "з північного сходу", "зі сходу", "з південного сходу",
              "з півдня", "з південного заходу", "із заходу", "з північного заходу"];
  var DIRS_SHORT = ["Пн", "ПнСх", "Сх", "ПдСх", "Пд", "ПдЗх", "Зх", "ПнЗх"];
  function dirIndex(b) { return Math.round(b / 45) % 8; }

  function zoneIndex(sec) {
    var min = sec / 60;
    for (var i = 0; i < ZONES.length; i++) if (min <= ZONES[i].to) return i;
    return ZONES.length - 1;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Нормалізація для пошуку: регістр, апострофи, укр/рос відповідники літер.
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/['’ʼ`"«»\-\s.]/g, "")
      .replace(/ё/g, "е").replace(/[єэ]/g, "е")
      .replace(/[іїыйi]/g, "и").replace(/ґ/g, "г");
  }

  // ---------- Обране ----------
  var favs = new Set();
  try { (JSON.parse(lsGet(LS.favs)) || []).forEach(function (n) { favs.add(n); }); } catch (e) {}
  function saveFavs() { lsSet(LS.favs, JSON.stringify(Array.from(favs))); }
  function isFav(p) { return favs.has(p.key); }

  // ---------- Карта ----------
  var map = L.map("map", { zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 16 });
  L.control.zoom({ position: "bottomright", zoomInTitle: "Наблизити", zoomOutTitle: "Віддалити" }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    crossOrigin: "anonymous",   // CORS-відповіді можна економно кешувати в service worker
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · координати: <a href="https://www.geonames.org" target="_blank" rel="noopener">GeoNames</a>'
  }).addTo(map);

  // Початковий вигляд охоплює вбудовані пункти (доданий користувачем далекий пункт не «віддаляє» карту).
  var allBounds = L.latLngBounds(PLACES.map(function (p) { return [p.lat, p.lon]; }).concat([[TARGET.lat, TARGET.lon]]));
  function applyZoomClass() {
    var c = map.getContainer().classList, z = map.getZoom();
    c.toggle("zoom-lo", z < NEAR_LABEL_ZOOM);
    c.toggle("zoom-xlo", z < MID_LABEL_ZOOM);
  }
  map.on("zoomend", applyZoomClass);

  function fitAll() { map.fitBounds(allBounds, { padding: [30, 30] }); }
  fitAll();
  applyZoomClass();

  // ---------- Шар зон підльоту ----------
  var zonesLayer = L.layerGroup();
  (function buildZones() {
    var inner = 0;
    ZONES.forEach(function (z, i) {
      var outerKm = SPEED_MAX * z.to / 60;
      var rings = [circlePoints(outerKm)];
      if (inner > 0) rings.push(circlePoints(inner));
      L.polygon(rings, {
        stroke: true, color: ZONE_COLORS[i], weight: 1.5, opacity: 0.55, dashArray: "6 6",
        fillColor: ZONE_COLORS[i], fillOpacity: 0.13, interactive: false, className: "zone"
      }).addTo(zonesLayer);
      L.tooltip({ permanent: true, direction: "center", className: "zone-label", interactive: false })
        .setLatLng(destination(TARGET.lat, TARGET.lon, 205, outerKm))
        .setContent(z.to + " хв")
        .addTo(zonesLayer);
      inner = outerKm;
    });
  })();

  var zonesToggle = document.getElementById("zones-toggle");
  zonesToggle.checked = lsGet(LS.zones) !== "off";
  function applyZones() {
    if (zonesToggle.checked) zonesLayer.addTo(map); else zonesLayer.remove();
    lsSet(LS.zones, zonesToggle.checked ? "on" : "off");
  }
  zonesToggle.addEventListener("change", applyZones);
  applyZones();

  // Легенда
  document.getElementById("legend-speed").textContent = SPEED_MAX;
  document.getElementById("legend").innerHTML = ZONES.map(function (z, i) {
    var from = i === 0 ? 0 : ZONES[i - 1].to;
    var kmFrom = Math.round(SPEED_MAX * from / 60), kmTo = Math.round(SPEED_MAX * z.to / 60);
    return '<li><span class="sw ' + z.cls + '"></span>' + from + "–" + z.to + " хв <span class=\"muted\">(" + kmFrom + "–" + kmTo + " км)</span></li>";
  }).join("");

  // Легенда: на телефоні згорнута за замовчуванням.
  var legendBtn = document.getElementById("legend-btn");
  var legendBox = document.getElementById("legend-box");
  function setLegend(open) {
    legendBox.hidden = !open;
    legendBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  legendBtn.addEventListener("click", function () { setLegend(legendBox.hidden); });
  setLegend(!window.matchMedia("(max-width: 640px)").matches);

  // ---------- Ціль (центр Житомира) ----------
  L.marker([TARGET.lat, TARGET.lon], {
    icon: L.divIcon({ className: "target-icon", html: '<span class="target-dot"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
    keyboard: false, zIndexOffset: 1000
  }).bindTooltip("<b>🎯 " + esc(TARGET.name) + "</b><br><span class=\"muted\">" + esc(TARGET.note) + "</span>",
    { direction: "top", offset: [0, -12], className: "ztip" }).addTo(map);

  // ---------- Населені пункти ----------
  var lineLayer = L.layerGroup().addTo(map);
  var markers = {};
  var selected = null;
  var hovered = null;

  function tooltipHtml(p) {
    return '<div class="tt-title">' + (isFav(p) ? "★ " : "") + esc(p.name) + "</div>" +
      '<div class="tt-row">📏 <b>' + fmtKm(p.km) + "</b> по прямій</div>" +
      '<div class="tt-row">⏱ <b>' + fmtDur(p.secFast) + " – " + fmtDur(p.secSlow) + "</b></div>" +
      '<div class="tt-row muted">🧭 ' + DIRS[dirIndex(p.bearing)] + " · " + Math.round(p.bearing) + "°</div>";
  }

  function iconFor(p) {
    var z = ZONES[zoneIndex(p.secFast)].cls;
    var cls = "pm " + z + (p.km < NEAR_KM ? " near" : p.km < MID_KM ? " mid" : "") + (isFav(p) ? " fav" : "") + (selected === p ? " sel" : "");
    return L.divIcon({
      className: "pm-wrap",
      html: '<div class="' + cls + '"><span class="dot"></span><span class="lbl">' + esc(p.name) + "</span></div>",
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function drawLine(p) {
    lineLayer.clearLayers();
    if (!p) return;
    L.polyline([[p.lat, p.lon], [TARGET.lat, TARGET.lon]], {
      color: "#d32f2f", weight: 4, opacity: 0.5, dashArray: "10 8", interactive: false, className: "track"
    }).addTo(lineLayer);
  }

  function refreshMarker(p) {
    var m = markers[p.id];
    m.setIcon(iconFor(p));
    m.setTooltipContent(tooltipHtml(p));
  }

  function addMarker(p) {
    var m = L.marker([p.lat, p.lon], { icon: iconFor(p), title: p.name, riseOnHover: true, keyboard: true })
      .bindTooltip(tooltipHtml(p), { direction: "top", offset: [0, -12], className: "ztip", opacity: 1 })
      .addTo(map);

    m.on("mouseover", function () {
      hovered = p;
      drawLine(p);
    });
    m.on("mouseout", function () {
      hovered = null;
      drawLine(selected);
      if (selected) markers[selected.id].openTooltip();   // вибраний пункт тримає підказку
    });
    m.on("click", function (e) {
      L.DomEvent.stopPropagation(e);
      select(p, false);
    });
    m.on("keypress", function (e) {
      if (e.originalEvent && e.originalEvent.key === "Enter") select(p, false);
    });
    markers[p.id] = m;
  }

  PLACES.forEach(addMarker);

  map.on("click", function () { select(null); });

  // ---------- Вибір пункту та картка ----------
  var card = document.getElementById("card");
  var cardTitle = document.getElementById("card-title");
  var cardBody = document.getElementById("card-body");
  var cardFav = document.getElementById("card-fav");
  var cardSub = document.getElementById("card-sub");

  function renderCard() {
    if (!selected) { card.hidden = true; return; }
    var p = selected;
    cardTitle.textContent = p.name;
    cardSub.textContent = p.sub || "";
    cardSub.hidden = !p.sub;
    cardFav.textContent = isFav(p) ? "★" : "☆";
    cardFav.setAttribute("aria-pressed", isFav(p) ? "true" : "false");
    cardFav.title = isFav(p) ? "Прибрати з обраного" : "Додати в обране";
    cardFav.classList.toggle("on", isFav(p));
    var z = zoneIndex(p.secFast);
    cardBody.innerHTML =
      '<div class="big"><span class="sw ' + ZONES[z].cls + '"></span>' + fmtRangeShort(p) + "</div>" +
      '<dl class="facts">' +
        "<dt>📏 Відстань по прямій</dt><dd>" + fmtKm(p.km) + "</dd>" +
        "<dt>⏱ За " + SPEED_MAX + " км/год</dt><dd>" + fmtDur(p.secFast) + "</dd>" +
        "<dt>⏱ За " + SPEED_MIN + " км/год</dt><dd>" + fmtDur(p.secSlow) + "</dd>" +
        "<dt>🧭 Напрямок загрози</dt><dd>" + DIRS[dirIndex(p.bearing)] + " (" + DIRS_SHORT[dirIndex(p.bearing)] + ", " + Math.round(p.bearing) + "°)</dd>" +
      "</dl>" +
      (p.src === "map" ? '<p class="muted tiny">Координати визначено за картою, точність ≈ ±0,5 км.</p>' : "") +
      (p.custom ? '<p class="muted tiny">➕ Додано вами · координати OpenStreetMap. ' +
        '<button type="button" class="link-btn" data-act="del">Видалити з карти</button></p>' : "");
    card.hidden = false;
  }

  function select(p, fly) {
    var prev = selected;
    selected = p || null;
    if (prev && prev !== selected) {
      refreshMarker(prev);
      markers[prev.id].closeTooltip();
    }
    if (selected) {
      refreshMarker(selected);
      if (fly) {
        var z = Math.max(map.getZoom(), 10);
        map.flyTo([selected.lat, selected.lon], z, { duration: 0.8 });
        map.once("moveend", function () { if (selected === p) markers[p.id].openTooltip(); });
      }
      markers[selected.id].openTooltip();
    }
    drawLine(selected || hovered);
    renderCard();
  }

  document.getElementById("card-close").addEventListener("click", function () { select(null); });

  cardFav.addEventListener("click", function () {
    if (!selected) return;
    toggleFav(selected);
  });

  function toggleFav(p) {
    if (isFav(p)) favs.delete(p.key); else favs.add(p.key);
    saveFavs();
    refreshMarker(p);
    if (selected === p) { markers[p.id].openTooltip(); renderCard(); }
    renderFavs();
    toast(isFav(p) ? "★ " + p.name + " — додано в обране" : p.name + " — прибрано з обраного");
  }

  // ---------- Панель «Обране» ----------
  var favBtn = document.getElementById("btn-fav");
  var favPanel = document.getElementById("fav-panel");
  var favList = document.getElementById("fav-list");
  var favEmpty = document.getElementById("fav-empty");
  var favCount = document.getElementById("fav-count");

  function renderFavs() {
    var list = PLACES.filter(isFav).sort(function (a, b) { return a.km - b.km; });
    favCount.hidden = list.length === 0;
    favCount.textContent = list.length;
    favEmpty.hidden = list.length > 0;
    favList.innerHTML = list.map(function (p) {
      return '<li><button type="button" class="fav-go" data-id="' + p.id + '">' +
        '<span class="sw ' + ZONES[zoneIndex(p.secFast)].cls + '"></span>' +
        '<span class="fav-name">' + esc(p.name) + "</span>" +
        '<span class="fav-meta">' + fmtKm(p.km) + " · " + fmtRangeShort(p) + "</span></button>" +
        '<button type="button" class="icon-btn small fav-del" data-id="' + p.id + '" aria-label="Прибрати ' + esc(p.name) + '">✕</button></li>';
    }).join("");
  }

  function setFavPanel(open) {
    favPanel.hidden = !open;
    favBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  favBtn.addEventListener("click", function () { setFavPanel(favPanel.hidden); });
  document.getElementById("fav-close").addEventListener("click", function () { setFavPanel(false); });
  favList.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var p = byId[+btn.getAttribute("data-id")];
    if (!p) return;
    if (btn.classList.contains("fav-del")) toggleFav(p);
    else {
      select(p, true);
      if (window.matchMedia("(max-width: 640px)").matches) setFavPanel(false);
    }
  });
  renderFavs();

  // ---------- Пошук ----------
  var form = document.getElementById("search");
  var q = document.getElementById("q");
  function renderDatalist() {
    document.getElementById("places-list").innerHTML = PLACES.slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name, "uk"); })
      .map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join("");
  }
  renderDatalist();

  function findPlace(text) {
    var k = norm(text);
    if (!k) return null;
    var exact = PLACES.filter(function (p) { return p.keys.indexOf(k) !== -1; });
    if (exact.length) return exact[0];
    var starts = PLACES.filter(function (p) { return p.keys.some(function (x) { return x.indexOf(k) === 0; }); });
    if (starts.length) return starts.sort(function (a, b) { return a.km - b.km; })[0];
    var part = PLACES.filter(function (p) { return p.keys.some(function (x) { return x.indexOf(k) !== -1; }); });
    return part.length ? part[0] : null;
  }

  function doSearch() {
    var p = findPlace(q.value);
    if (!p) {
      if (q.value.trim()) toast("Не знайдено: «" + q.value.trim() + "»");
      return;
    }
    q.value = p.name;
    q.blur();
    select(p, true);
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); doSearch(); });
  // Вибір підказки зі списку (datalist) — одразу показуємо пункт.
  q.addEventListener("input", function (e) {
    if (e.inputType === "insertReplacementText" || e.inputType === undefined) {
      var v = norm(q.value);
      if (PLACES.some(function (p) { return norm(p.name) === v; })) doSearch();
    }
  });

  // ---------- Додавання населеного пункту (кнопка «＋») ----------
  var addModal = document.getElementById("add-modal");
  var addBtn = document.getElementById("btn-add");
  var addForm = document.getElementById("add-form");
  var addQ = document.getElementById("add-q");
  var addList = document.getElementById("add-list");
  var addStatus = document.getElementById("add-status");
  var addSubmit = document.getElementById("add-submit");
  var addItems = [], addActive = -1, addChosen = null;
  var addTimer = null, addAbort = null, addSeq = 0, addFallbackReady = false;

  // Чи є вже такий пункт на карті (близько за координатами або однакова назва поруч).
  function findDuplicate(item) {
    var k = norm(item.name);
    for (var i = 0; i < PLACES.length; i++) {
      var d = distanceKm(PLACES[i].lat, PLACES[i].lon, item.lat, item.lon);
      if (d < 1.5 || (d < 6 && PLACES[i].keys[0] === k)) return PLACES[i];
    }
    return null;
  }

  function addCustomPlace(item) {
    var dup = findDuplicate(item);
    if (dup) {
      select(dup, true);
      toast("«" + dup.name + "» уже є на карті");
      return dup;
    }
    var customCount = PLACES.filter(function (p) { return p.custom; }).length;
    if (customCount >= MAX_CUSTOM) { toast("Досягнуто ліміту доданих пунктів (" + MAX_CUSTOM + ")"); return null; }
    var p = makePlace({ name: item.name, sub: item.sub, lat: item.lat, lon: item.lon, src: "osm", custom: true });
    PLACES.push(p);
    addMarker(p);
    saveCustom();
    renderDatalist();
    select(p, true);
    toast("✅ " + p.name + " — додано на карту");
    return p;
  }

  function removeCustomPlace(p) {
    if (!p || !p.custom) return;
    if (!window.confirm("Видалити «" + p.name + "» з карти?")) return;
    if (selected === p) select(null);
    markers[p.id].remove();
    delete markers[p.id];
    delete byId[p.id];
    PLACES.splice(PLACES.indexOf(p), 1);
    favs.delete(p.key);
    saveFavs();
    saveCustom();
    renderFavs();
    renderDatalist();
    toast(p.name + " — видалено з карти");
  }

  cardBody.addEventListener("click", function (e) {
    if (e.target.closest('[data-act="del"]')) removeCustomPlace(selected);
  });

  function setAddStatus(msg) { addStatus.textContent = msg || ""; }

  function renderAddItems() {
    addList.innerHTML = addItems.map(function (it, i) {
      return '<li id="add-opt-' + i + '" role="option" data-i="' + i + '" class="combo-item' +
        (i === addActive ? " active" : "") + '" aria-selected="' + (i === addActive ? "true" : "false") + '">' +
        '<span class="ci-main"><b>' + esc(it.name) + '</b> <span class="ci-kind">' + esc(it.kind) + "</span>" +
        (it.dup ? ' <span class="ci-dup">✓ вже на карті</span>' : "") + "</span>" +
        '<span class="ci-sub">' + esc(it.sub) + "</span></li>";
    }).join("");
    addList.hidden = addItems.length === 0;
    addQ.setAttribute("aria-expanded", addItems.length ? "true" : "false");
    if (addActive >= 0) addQ.setAttribute("aria-activedescendant", "add-opt-" + addActive);
    else addQ.removeAttribute("aria-activedescendant");
  }

  function setActive(i) {
    addActive = i;
    renderAddItems();
    var el = document.getElementById("add-opt-" + i);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }

  function chooseItem(i) {
    var it = addItems[i];
    if (!it) return;
    addChosen = it;
    addActive = i;
    addQ.value = it.name;
    addSubmit.disabled = false;
    addSubmit.textContent = it.dup ? "Показати на карті" : "Додати";
    renderAddItems();
    setAddStatus("Обрано: " + it.name + " (" + it.sub + "). Натисніть «" + addSubmit.textContent + "».");
  }

  function runAddSearch(fallback) {
    var text = addQ.value.trim();
    clearTimeout(addTimer);
    if (addAbort) addAbort.abort();
    addItems = []; addActive = -1; addFallbackReady = false;
    renderAddItems();
    if (text.length < 2) { setAddStatus("Введіть щонайменше 2 літери назви."); return; }
    var seq = ++addSeq;
    addAbort = new AbortController();
    setAddStatus("Пошук…");
    GEO.search(text, { signal: addAbort.signal, fallback: !!fallback }).then(function (items) {
      if (seq !== addSeq) return;
      items.forEach(function (it) { it.dup = !!findDuplicate(it); });
      addItems = items;
      addActive = -1;
      renderAddItems();
      setAddStatus(items.length
        ? "Знайдено: " + items.length + ". Оберіть пункт зі списку."
        : "Нічого не знайдено в Житомирській області. Перевірте написання.");
    }).catch(function (err) {
      if (seq !== addSeq || (err && err.name === "AbortError")) return;
      if (fallback) {
        setAddStatus("Сервіс пошуку недоступний. Перевірте інтернет і спробуйте ще раз.");
      } else {
        addFallbackReady = true;
        setAddStatus("Основний сервіс пошуку недоступний. Натисніть Enter, щоб спробувати запасний.");
      }
    });
  }

  function openAdd() {
    addQ.value = "";
    addItems = []; addActive = -1; addChosen = null; addFallbackReady = false;
    addSubmit.disabled = true;
    addSubmit.textContent = "Додати";
    renderAddItems();
    setAddStatus("Почніть вводити назву й оберіть пункт зі списку.");
    addModal.hidden = false;
    setTimeout(function () { addQ.focus(); }, 0);
  }

  function closeAdd() {
    clearTimeout(addTimer);
    if (addAbort) addAbort.abort();
    addSeq++;
    addModal.hidden = true;
    addBtn.focus();
  }

  addBtn.addEventListener("click", openAdd);
  document.getElementById("add-close").addEventListener("click", closeAdd);
  document.getElementById("add-cancel").addEventListener("click", closeAdd);
  addModal.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) closeAdd(); });

  addQ.addEventListener("input", function () {
    addChosen = null;
    addSubmit.disabled = true;
    addSubmit.textContent = "Додати";
    clearTimeout(addTimer);
    addTimer = setTimeout(function () { runAddSearch(false); }, 300);
  });

  addQ.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && addItems.length) { e.preventDefault(); setActive((addActive + 1) % addItems.length); }
    else if (e.key === "ArrowUp" && addItems.length) { e.preventDefault(); setActive((addActive - 1 + addItems.length) % addItems.length); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (addChosen) addSubmit.click();
      else if (addItems.length) chooseItem(addActive >= 0 ? addActive : 0);
      else if (addFallbackReady) runAddSearch(true);
      else if (addQ.value.trim().length >= 2) runAddSearch(false);
    }
  });

  addList.addEventListener("click", function (e) {
    var li = e.target.closest("li[data-i]");
    if (li) { chooseItem(+li.getAttribute("data-i")); addSubmit.focus(); }
  });

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!addChosen) return;
    var item = addChosen;
    closeAdd();
    addCustomPlace(item);
  });

  // ---------- Тема ----------
  var themeBtn = document.getElementById("btn-theme");
  function currentTheme() { return document.documentElement.getAttribute("data-theme"); }
  function applyThemeIcon() {
    var dark = currentTheme() === "dark";
    themeBtn.textContent = dark ? "☀️" : "🌙";
    themeBtn.title = dark ? "Світла тема" : "Темна тема";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0b1220" : "#0f172a");
  }
  themeBtn.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    lsSet(LS.theme, next);
    applyThemeIcon();
  });
  applyThemeIcon();

  document.getElementById("btn-fit").addEventListener("click", function () { select(null); fitAll(); });

  // ---------- Повідомлення ----------
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 2600);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!addModal.hidden) { closeAdd(); return; }
      select(null); setFavPanel(false);
    }
    var tag = document.activeElement && document.activeElement.tagName;
    if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); q.focus(); }
  });

  // Збережені раніше доданим користувачем пункти.
  loadCustom().forEach(function (c) {
    if (findDuplicate(c)) return;
    var p = makePlace(c);
    PLACES.push(p);
    addMarker(p);
  });
  renderFavs();
  renderDatalist();

  // ---------- Встановлення як застосунок (PWA) ----------
  var installBtn = document.getElementById("btn-install");
  var deferredPrompt = null;
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    installBtn.hidden = true;
    toast("✅ Застосунок встановлено — шукайте іконку на екрані телефона");
  });
  if (isIOS && !isStandalone) installBtn.hidden = false;
  installBtn.addEventListener("click", function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; installBtn.hidden = true; });
    } else if (isIOS) {
      toast("iPhone: натисніть «Поділитися» ⎋ → «На початковий екран»", 6000);
    }
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* без офлайн-режиму */ });
    });
  }

  // Для перевірки з консолі / тестів.
  window.ZT = { places: PLACES, select: select, findPlace: findPlace, addCustom: addCustomPlace };
})();
