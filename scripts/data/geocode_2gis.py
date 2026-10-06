"""Exact venue positions from the 2GIS Catalog API.

Usage: DGIS_KEY=... python3 scripts/data/geocode_2gis.py <cache-dir> korzinka|venues
  korzinka  every Korzinka branch in Uzbekistan: Tashkent in 3 km tiles, other towns by radius (the demo key returns
            at most 5 pages of 10). Writes scripts/data/korzinka_2gis.json.
  venues    each deck venue (Region deck cafés, HORECA deck restaurants) by name near its city or landmark.
            Writes scripts/data/venues_2gis.json.
Responses are cached in <cache-dir>/2gis/ so a rerun costs no requests. The key is read from the environment only.
"""
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

CACHE = os.path.join(sys.argv[1], '2gis')
MODE = sys.argv[2]
KEY = os.environ['DGIS_KEY']
os.makedirs(CACHE, exist_ok=True)
calls = 0


def api(params):
    global calls
    params = {**params, 'fields': 'items.point,items.full_address_name,items.address,items.schedule', 'page_size': 10, 'type': 'branch'}
    h = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()
    path = f'{CACHE}/{h}.json'
    if os.path.exists(path):
        return json.load(open(path))
    url = 'https://catalog.api.2gis.com/3.0/items?' + urllib.parse.urlencode({**params, 'key': KEY})
    for att in range(3):
        try:
            d = json.load(urllib.request.urlopen(url, timeout=30))
            break
        except Exception as e:  # noqa: BLE001
            body = getattr(e, 'read', lambda: b'')()[:200]
            print('  retry', att, e, body)
            time.sleep(3)
    else:
        return {}
    calls += 1
    time.sleep(0.25)
    json.dump(d, open(path, 'w'), ensure_ascii=False)
    return d


def search(q, lon, lat, radius, locale='uz_UZ'):
    items = []
    for page in range(1, 6):
        d = api({'q': q, 'point': f'{lon:.5f},{lat:.5f}', 'radius': int(radius), 'page': page, 'locale': locale})
        res = d.get('result', {})
        items += res.get('items', [])
        if len(items) >= res.get('total', 0) or not res.get('items'):
            break
    return items, d.get('result', {}).get('total', 0)


def item(it):
    p = it.get('point') or {}
    return {'id': it['id'].split('_')[0], 'name': it.get('name', ''), 'a': it.get('address_name') or '', 'full': it.get('full_address_name') or '',
            'p': [round(p.get('lon', 0), 6), round(p.get('lat', 0), 6)]}


if MODE == 'korzinka':
    found = {}
    # Tashkent and its ring in overlapping 3 km tiles
    for i in range(-5, 6):
        for j in range(-4, 5):
            lon, lat = 69.2787 + i * 0.045, 41.3123 + j * 0.034
            items, total = search('Korzinka', lon, lat, 3000)
            if total > 50:
                print('  dense tile', lon, lat, total)
            for it in items:
                if 'orzinka' in it.get('name', '') or 'орзинк' in it.get('name', '').lower():
                    found[it['id'].split('_')[0]] = item(it)
    print('tashkent', len(found), 'calls', calls)
    towns = json.load(open('scripts/data/towns.json'))
    for name, (lon, lat, r) in towns.items():
        items, total = search('Korzinka', lon, lat, r * 1000)
        n = 0
        for it in items:
            if 'orzinka' in it.get('name', '') or 'орзинк' in it.get('name', '').lower():
                found[it['id'].split('_')[0]] = item(it)
                n += 1
        print(name, n, 'of', total)
    json.dump(sorted(found.values(), key=lambda x: x['p']), open('scripts/data/korzinka_2gis.json', 'w'), ensure_ascii=False, indent=0)
    print('total', len(found), 'calls', calls)

elif MODE == 'venues':
    deck = json.load(open('scripts/data/venues.json'))
    horeca = json.load(open('scripts/data/horeca_deck.json'))
    cities = json.load(open('public/data/places.json'))['cities']
    out = {}

    def norm(s):
        s = s.lower().replace('ʻ', "'").replace('’', "'").replace('‘', "'")
        s = re.sub(r'milli+y taomlar(i)?|restoran|restaurant|kafe|cafe|food court|osh markazi|кафе|ресторан', '', s)
        return re.sub(r'[^a-zа-яё0-9ўқғҳ]+', '', s)

    def best(items, name, near, max_km):
        n = norm(name)
        cands = []
        for it in items:
            m = norm(it.get('name', '').split(',')[0])
            if not m or not n:
                continue
            if n in m or m in n or (len(n) > 4 and n[:5] == m[:5]):
                p = it.get('point') or {}
                d = math.hypot((p.get('lon', 0) - near[0]) * 85, (p.get('lat', 0) - near[1]) * 111)
                if d <= max_km:
                    cands.append((d, it))
        cands.sort(key=lambda c: c[0])
        return cands[0][1] if cands else None

    for key, lst in deck.items():
        c = cities[key]
        for v in lst:
            if v['kind'] == 'korzinka':
                continue
            q = re.sub(r'\s*·\s*', ' ', v['n'])
            items, _ = search(q, c[0], c[1], 15000)
            hit = best(items, v['n'], c, 15)
            out[f"{key}|{v['n']}"] = item(hit) if hit else None
            print(key, v['n'], '→', hit and hit['name'], hit and hit.get('address_name'))
    for v in horeca:
        near = v.get('p') or cities['toshkent']
        radius = 1500 if v.get('p') else 20000
        if v.get('town') == 'chirchiq':
            near, radius = cities['chirchiq'], 12000
        items, _ = search(v['n'].title(), near[0], near[1], radius)
        hit = best(items, v['n'], near, radius / 1000)
        out[f"horeca|{v['n']}|{v['mark']}"] = item(hit) if hit else None
        print('horeca', v['n'], '|', v['mark'], '→', hit and hit['name'], hit and hit.get('address_name'))
    json.dump(out, open('scripts/data/venues_2gis.json', 'w'), ensure_ascii=False, indent=0)
    print('placed', sum(1 for x in out.values() if x), 'of', len(out), 'calls', calls)
