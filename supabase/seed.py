#!/usr/bin/env python3
"""Seed Repos — insère les 12 établissements de démo dans Supabase.

Usage (après avoir exécuté schema.sql + storage.sql et téléversé les photos) :
    python3 supabase/seed.py

Affiche à la fin le bloc STAY_UUIDS à coller dans js/db.js.
"""
import json
import re
import sys
import urllib.request
import uuid

SUPABASE_URL = "https://aoviicnkinbakrshxule.supabase.co"
ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdmlpY25raW5iYWtyc2h4dWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMTg3MjIsImV4cCI6MjEwNjU5NDcyMn0.NpE9kIu2rxFVGipgvn81q0TGYWzis6Fgxj-XiqzrdtY"

TYPE_MAP = {
    "Hôtel": "hotel",
    "Motel": "motel",
    "Maison meublée": "maison",
    "Auberge": "auberge",
}


def api(method, path, body=None, query=""):
    url = SUPABASE_URL + "/rest/v1/" + path + query
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "apikey": ANON,
            "Authorization": "Bearer " + ANON,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def parse_stays():
    src = open("js/app.src.js", encoding="utf-8").read()
    m = re.search(r"var STAYS = \[(.*?)\];", src, re.S)
    if not m:
        sys.exit("STAYS introuvable dans js/app.src.js")
    stays = []
    # chaque établissement est un objet { ... } sur sa propre ligne
    for om in re.finditer(r"\{id:(\d+),(.*?)\},?\s*$", m.group(1), re.M):
        sid = int(om.group(1))
        body = om.group(2)
        get = lambda k: (re.search(k + r':"((?:[^"\\]|\\.)*)"', body) or [None, ""])[1]
        getn = lambda k: (re.search(k + r":(-?[\d.]+)", body) or [None, "0"])[1]
        tags = re.search(r"tags:\[(.*?)\]", body)
        tags = re.findall(r'"([^"]+)"', tags.group(1)) if tags else []
        stays.append(
            {
                "sid": sid,
                "name": get("name"),
                "type": get("type"),
                "stars": int(getn("stars") or 0),
                "city": get("city"),
                "quarter": get("quarter"),
                "lat": float(getn("lat") or 0),
                "lng": float(getn("lng") or 0),
                "day": int(getn("day") or 0),
                "night": int(getn("night") or 0),
                "img": get("img"),
                "alt": get("alt"),
                "tags": tags,
            }
        )
    return stays


def main():
    stays = parse_stays()
    print(f"{len(stays)} établissements à insérer")
    mapping = {}
    for s in stays:
        uid = str(uuid.uuid4())
        mapping[s["sid"]] = uid
        photo = s["img"].split("/")[-1]
        photo_url = f"{SUPABASE_URL}/storage/v1/object/public/assets/{photo}"
        est = {
            "id": uid,
            "name": s["name"],
            "type": TYPE_MAP.get(s["type"], "hotel"),
            "city": s["city"],
            "address": s["quarter"],
            "lat": s["lat"],
            "lng": s["lng"],
            "description": s["alt"],
            "stars": s["stars"],
            "amenities": s["tags"],
            "photos": [photo_url],
            "is_active": True,
        }
        api("POST", "establishments", est)
        r3 = round(s["day"] * 0.45 / 100) * 100
        r6 = round(s["day"] * 0.70 / 100) * 100
        for slot, price in [
            ("3h", r3),
            ("6h", r6),
            ("journee", s["day"]),
            ("nuit", s["night"]),
        ]:
            api(
                "POST",
                "slot_prices",
                {
                    "establishment_id": uid,
                    "slot_type": slot,
                    "price_fcfa": price,
                },
            )
        print(f"  ✓ {s['sid']:>2} {s['name'][:45]}")
    print("\n-- À coller dans js/db.js (STAY_UUIDS) :")
    print("  var STAY_UUIDS = {")
    for sid in sorted(mapping):
        print(f'    {sid}: "{mapping[sid]}",')
    print("  };")


if __name__ == "__main__":
    main()
