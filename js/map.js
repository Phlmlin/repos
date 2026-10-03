/* ReposMap — carte interactive des établissements proches (Leaflet).
   Remplace MapHelpers.mountPlaceListMap : même contrat, même comportement.
   - places : [{label, venue, locality, lat, lng}]
   - rows   : éléments DOM .near-row (1 pour 1 avec places)
   - onUnavailable : appelé si la carte ne peut pas s'afficher */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function mountPlaceListMap(container, options, onUnavailable) {
    function fail() {
      try { if (onUnavailable) onUnavailable(); } catch (e) {}
      return null;
    }
    if (!window.L || !container) return fail();
    var places = options.places || [];
    var rows = options.rows || [];
    var selectedClass = options.selectedClass || "map-selected";
    if (!places.length) return fail();

    var map;
    try {
      map = L.map(container, { scrollWheelZoom: false, tap: true });
      map.on("focus", function () { map.scrollWheelZoom.enable(); });
      map.on("blur", function () { map.scrollWheelZoom.disable(); });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);
    } catch (e) { return fail(); }

    var markers = [];
    var bounds = [];

    function highlight(index, scroll) {
      rows.forEach(function (row, i) {
        row.classList.toggle(selectedClass, i === index);
      });
      if (scroll && index !== null && rows[index] && rows[index].scrollIntoView) {
        rows[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      markers.forEach(function (mk, i) {
        if (!mk) return;
        var el = mk.getElement && mk.getElement();
        var pin = el && el.querySelector(".pin");
        if (pin) pin.classList.toggle("pin--on", i === index);
      });
    }

    places.forEach(function (p, i) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") {
        markers.push(null);
        return;
      }
      var icon = L.divIcon({
        className: "repos-pin-wrap",
        html: '<div class="pin">' + (i + 1) + "</div>",
        iconSize: [30, 30],
        iconAnchor: [15, 28]
      });
      var mk = L.marker([p.lat, p.lng], { icon: icon, title: p.label || "" }).addTo(map);
      var popup = "<b>" + esc(p.label) + "</b>" +
        (p.venue ? "<br/>" + esc(p.venue) : "") +
        (p.locality ? "<br/>" + esc(p.locality) : "");
      mk.bindPopup(popup);
      mk.on("click", function () { highlight(i, true); });
      markers.push(mk);
      bounds.push([p.lat, p.lng]);
    });

    rows.forEach(function (row, i) {
      row.addEventListener("click", function () {
        if (markers[i]) {
          map.setView(markers[i].getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
          markers[i].openPopup();
        }
        highlight(i, false);
      });
    });

    if (bounds.length) {
      if (bounds.length === 1) map.setView(bounds[0], 14);
      else map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      // Libreville par défaut
      map.setView([0.4162, 9.4673], 12);
    }

    return {
      selectPlace: function (i) {
        if (markers[i]) {
          map.setView(markers[i].getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
          markers[i].openPopup();
        }
        highlight(i, false);
      }
    };
  }

  window.ReposMap = { mountPlaceListMap: mountPlaceListMap };
})();
