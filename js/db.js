/* ============================================================
   ReposDB — couche de persistance Supabase (PostgreSQL + Storage)
   - Les réservations créées sont enregistrées dans la table `bookings`
   - Au démarrage, les réservations de cet appareil sont rechargées
   - Sans réseau / en cas d'erreur : l'appli continue en local
   ============================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://aoviicnkinbakrshxule.supabase.co";
  // Clé "anon" publique : faite pour être exposée côté client.
  var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdmlpY25raW5iYWtyc2h4dWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMTg3MjIsImV4cCI6MjEwNjU5NDcyMn0.NpE9kIu2rxFVGipgvn81q0TGYWzis6Fgxj-XiqzrdtY";

  // Correspondance id entier (appli) -> id UUID (base). Rempli au seed.
  var STAY_UUIDS = {
    1: "ae97a950-f4e3-4ced-8163-38eaf4b9e4a7",
    2: "e74b69af-c4bd-4e18-b79e-55e57ff95b74",
    3: "85f9d611-4668-45e6-8e87-1042e99d1a5f",
    4: "7527ea41-be73-42e2-8fcb-389c42f0adc3",
    5: "eabc9f87-4e1b-4597-8faa-8aec215878d3",
    6: "9f9b0693-74b2-4796-875a-55b3e17775e0",
    7: "6c343693-6021-4533-a47a-f1c2bb398ad7",
    8: "cca85848-780b-416b-8e76-80bd83a7aab9",
    9: "e3369503-1253-4e37-9405-f2c5d03faf2d",
    10: "bf60f1b8-b63e-4cd9-97ee-81d9cc449d85",
    11: "f496f0a8-8d8f-445c-8c22-351807b21f30",
    12: "97c96ca4-197c-4365-b24e-bd11daf3384f"
  };

  var SLOT_TO_DB = { "3h": "3h", "6h": "6h", "jour": "journee", "nuit": "nuit" };
  var SLOT_FROM_DB = { "3h": "3h", "6h": "6h", "journee": "jour", "nuit": "nuit" };
  var PAY_TO_DB = { airtel: "airtel", moov: "moov", card: "carte", place: "sur_place" };
  var PAY_FROM_DB = { airtel: "airtel", moov: "moov", carte: "card", sur_place: "place" };

  function headers(json) {
    var h = { apikey: SUPABASE_ANON, Authorization: "Bearer " + SUPABASE_ANON };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  function lsGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) {}
  }

  function myCodes() {
    try { return JSON.parse(lsGet("repos_my_codes") || "[]"); }
    catch (e) { return []; }
  }
  function rememberCode(code) {
    var codes = myCodes();
    if (codes.indexOf(code) < 0) {
      codes.push(code);
      lsSet("repos_my_codes", JSON.stringify(codes));
    }
  }
  // Cache local complet (pour un réaffichage immédiat après rechargement)
  function cacheBooking(b) {
    lsSet("repos_booking_" + b.code, JSON.stringify(b));
  }
  function cachedBooking(code) {
    try { return JSON.parse(lsGet("repos_booking_" + code) || "null"); }
    catch (e) { return null; }
  }

  function photoUrl(file) {
    return SUPABASE_URL + "/storage/v1/object/public/assets/" + file;
  }

  // Enregistre une réservation dans Postgres. Ne lève jamais (fire-and-forget).
  function createBooking(b) {
    try {
      rememberCode(b.code);
      cacheBooking(b);
      var uuid = STAY_UUIDS[b.stayId];
      if (!uuid) return;
      var body = {
        code: b.code,
        establishment_id: uuid,
        day: b.date,
        slot_type: SLOT_TO_DB[b.slotKey] || "journee",
        extras: (b.extras || []).map(function (x) {
          return { name: x.name, price_fcfa: x.price };
        }),
        total_fcfa: b.price,
        payment_method: PAY_TO_DB[b.paymentMethod] || "sur_place",
        payment_status: b.paymentMethod === "place" ? "on_site" : "paid",
        status: "confirmed"
      };
      fetch(SUPABASE_URL + "/rest/v1/bookings", {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify(body)
      }).catch(function () { /* mode local */ });
    } catch (e) { /* mode local */ }
  }

  // Recharge les réservations de cet appareil (cache local + statuts distants).
  function restoreBookings(intoArray) {
    var codes = myCodes();
    if (!codes.length || !intoArray) return;
    var seen = {};
    intoArray.forEach(function (b) { seen[b.code] = true; });
    // 1) Cache local immédiat
    codes.forEach(function (code) {
      if (seen[code]) return;
      var b = cachedBooking(code);
      if (b) { intoArray.unshift(b); seen[code] = true; }
    });
    // 2) Statuts à jour depuis Postgres (silencieux)
    try {
      var q = codes.map(function (c) { return '"' + c.replace(/"/g, "") + '"'; }).join(",");
      fetch(SUPABASE_URL + "/rest/v1/bookings?code=in.(" + encodeURIComponent(q) + ")&select=code,status", {
        headers: headers(false)
      }).then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          (rows || []).forEach(function (row) {
            for (var i = 0; i < intoArray.length; i++) {
              if (intoArray[i].code === row.code) {
                intoArray[i].cancelled = (row.status === "cancelled");
                if (row.status === "cancelled") intoArray[i].cat = "past";
              }
            }
          });
        }).catch(function () {});
    } catch (e) {}
  }

  window.ReposDB = {
    createBooking: createBooking,
    restoreBookings: restoreBookings,
    photoUrl: photoUrl,
    STAY_UUIDS: STAY_UUIDS
  };
})();
