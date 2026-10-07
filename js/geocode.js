/*
 * Пошук населених пунктів Житомирської області за назвою.
 *
 * Основний сервіс — Photon (photon.komoot.io, дані OpenStreetMap), створений саме
 * для автодоповнення. Запасний — Nominatim (nominatim.openstreetmap.org); його
 * політика забороняє автодоповнення, тому він викликається лише за явним
 * натисканням Enter, коли Photon недоступний.
 */
(function () {
  "use strict";

  // Прямокутник, що охоплює Житомирську область (з невеликим запасом).
  var BOX = { minLon: 26.9, maxLon: 30.1, minLat: 49.5, maxLat: 51.8 };
  var PHOTON = "https://photon.komoot.io/api/";
  var NOMINATIM = "https://nominatim.openstreetmap.org/search";
  var TIMEOUT_MS = 8000;
  var TYPES = { city: "місто", town: "місто", village: "село", hamlet: "хутір" };

  function inOblastBox(lat, lon) {
    return lat >= BOX.minLat && lat <= BOX.maxLat && lon >= BOX.minLon && lon <= BOX.maxLon;
  }

  function isZhytomyrState(s) {
    return typeof s === "string" && /житомир|zhytomyr|zhitomir/i.test(s);
  }

  function uniq(list) {
    var seen = {};
    return list.filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  function clean(s) { return String(s).replace(/\s+/g, " ").trim().slice(0, 80); }

  // fetch з тайм-аутом; зовнішнє скасування (signal) відрізняється від тайм-ауту.
  function getJson(url, signal) {
    var ctrl = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener("abort", function () { ctrl.abort(); });
    }
    return fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { code: "http" });
        return r.json();
      })
      .catch(function (e) {
        if (e && e.name === "AbortError" && !timedOut) throw e;          // скасовано користувачем
        throw Object.assign(new Error(timedOut ? "timeout" : (e && e.message) || "network"), { code: "unavailable" });
      })
      .finally(function () { clearTimeout(timer); });
  }

  function fromPhoton(json) {
    var out = [], seen = {};
    ((json && json.features) || []).forEach(function (f) {
      var pr = f.properties || {}, c = f.geometry && f.geometry.coordinates;
      if (!c || !pr.name || !TYPES[pr.osm_value]) return;
      var lon = +c[0], lat = +c[1];
      if (!isFinite(lat) || !isFinite(lon) || !inOblastBox(lat, lon)) return;
      if (pr.countrycode && pr.countrycode !== "UA") return;
      if (!isZhytomyrState(pr.state)) return;
      var id = pr.osm_type + pr.osm_id;
      if (seen[id]) return;
      seen[id] = true;
      out.push({
        name: clean(pr.name),
        kind: TYPES[pr.osm_value],
        sub: clean(uniq([pr.county, pr.district]).join(", ") || pr.state),
        lat: lat,
        lon: lon
      });
    });
    return out;
  }

  function fromNominatim(json) {
    var out = [], seen = {};
    (Array.isArray(json) ? json : []).forEach(function (r) {
      var a = r.address || {}, kindKey = r.addresstype || r.type;
      if (r.class !== "place" || !TYPES[kindKey]) return;
      var lat = +r.lat, lon = +r.lon;
      var name = r.name || a[kindKey] || a.village || a.town || a.city || a.hamlet;
      if (!name || !isFinite(lat) || !isFinite(lon) || !inOblastBox(lat, lon)) return;
      if (a.country_code && a.country_code !== "ua") return;
      if (!isZhytomyrState(a.state)) return;
      if (seen[r.osm_type + r.osm_id]) return;
      seen[r.osm_type + r.osm_id] = true;
      out.push({
        name: clean(name),
        kind: TYPES[kindKey],
        sub: clean(uniq([a.county, a.municipality]).join(", ") || a.state),
        lat: lat,
        lon: lon
      });
    });
    return out;
  }

  /**
   * @param {string} query
   * @param {{signal?: AbortSignal, fallback?: boolean}} [opts]
   * @returns {Promise<Array<{name,kind,sub,lat,lon}>>}
   */
  function search(query, opts) {
    opts = opts || {};
    var q = encodeURIComponent(String(query).trim());
    var bbox = [BOX.minLon, BOX.minLat, BOX.maxLon, BOX.maxLat].join(",");
    if (opts.fallback) {
      var url = NOMINATIM + "?format=jsonv2&addressdetails=1&limit=15&countrycodes=ua&accept-language=uk" +
        "&bounded=1&viewbox=" + [BOX.minLon, BOX.maxLat, BOX.maxLon, BOX.minLat].join(",") + "&q=" + q;
      return getJson(url, opts.signal).then(fromNominatim);
    }
    // lat/lon — зсув видачі до Житомира, osm_tag=place — лише населені пункти.
    // lang=default — назви як у OSM (в Україні це українські); без нього Photon підлаштовується
    // під мову браузера (Accept-Language) і для англомовного браузера віддає «Chudniv».
    var purl = PHOTON + "?q=" + q + "&lang=default&limit=20&osm_tag=place&bbox=" + bbox + "&lat=50.25&lon=28.66";
    return getJson(purl, opts.signal).then(fromPhoton);
  }

  function hasCyrillic(s) { return /[А-Яа-яІіЇїЄєҐґ]/.test(String(s)); }

  function roughKm(lat1, lon1, lat2, lon2) {
    var dy = (lat2 - lat1) * 111.2;
    var dx = (lon2 - lon1) * 111.2 * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Знаходить українську назву для пункту, збереженого раніше з латинською назвою.
   * Повертає найближчий (до 3 км) збіг із кириличною назвою або null.
   */
  function localize(item, signal) {
    return search(item.name, { signal: signal }).then(function (list) {
      var best = null, bestD = 3;
      list.forEach(function (c) {
        var d = roughKm(item.lat, item.lon, c.lat, c.lon);
        if (hasCyrillic(c.name) && d < bestD) { best = c; bestD = d; }
      });
      return best;
    });
  }

  window.ZTGeocode = { search: search, localize: localize, hasCyrillic: hasCyrillic, inOblastBox: inOblastBox };
})();
