"""City models for the regional network: streets, buildings, parks, water and every network venue placed on them.

Usage: python3 scripts/data/cities.py <osm-cache-dir> [city ...]
  <osm-cache-dir>/<key>.json is an Overpass result for the city (see scripts/data/city_q.py).
  Writes public/data/city/<key>.json.

Venue placement, most precise first:
  1. the deck's venue (Region 2026 / Korzinka 2026 decks, scripts/data/venues.json) matched to a named OSM
     shop or restaurant in the city                                            → exact
  2. its street and house number matched to an OSM building address           → exact (building)
  3. Korzinka stores mapped in OSM inside the city                             → exact
  4. its street matched to an OSM street: the point of that street nearest the centre  → street
With YANDEX_KEY set, every venue that is not exact is geocoded with the Yandex Geocoder HTTP API instead.

Coordinates are stored as integer offsets from the city centre in 1e-5 degrees (≈1 m).
"""
import difflib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request

CACHE = sys.argv[1]
ONLY = set(sys.argv[2:])
OUT = 'public/data/city'
os.makedirs(OUT, exist_ok=True)
CITIES = json.load(open('public/data/places.json'))['cities']
KOR = json.load(open('public/data/places.json'))['korzinka']
VENUES = json.load(open('scripts/data/venues.json'))
RADIUS = {'andijon': 4.5, 'fargona': 4.5, 'namangan': 4.5, 'margilon': 3.5, 'asaka': 3.0, 'qoqon': 4.0,
          'samarqand': 5.5, 'buxoro': 5.0, 'jizzax': 3.5, 'qarshi': 4.5}
YKEY = os.environ.get('YANDEX_KEY')
NCACHE = f'{CACHE}/nominatim.json'
NOM = json.load(open(NCACHE)) if os.path.exists(NCACHE) else {}


def nominatim(street, city):
    # OSM's own geocoder: catches address points and interpolations the building query does not carry
    k = f'{street}|{city}'
    if k not in NOM:
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'street': street, 'city': city, 'country': 'Uzbekistan', 'format': 'jsonv2', 'limit': 1, 'addressdetails': 0})
        try:
            NOM[k] = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MediaPortSite/1.0 (city venue geocoding)'}), timeout=30))
        except Exception as e:  # noqa: BLE001
            print('  nominatim failed', e)
            NOM[k] = []
        time.sleep(1.1)
        json.dump(NOM, open(NCACHE, 'w'), ensure_ascii=False)
    r = NOM[k]
    if not r:
        return None
    hit = r[0]
    # only house-level answers beat our own street fallback
    if hit.get('addresstype') in ('building', 'house', 'place', 'shop', 'amenity') or hit.get('category') in ('building', 'place', 'shop', 'amenity'):
        return float(hit['lon']), float(hit['lat'])
    return None

CYR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюяўқғҳ',
               ['a', 'b', 'v', 'g', 'd', 'e', 'yo', 'j', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'x', 'ts', 'ch', 'sh', 'sh', '', 'i', '', 'e', 'yu', 'ya', 'o', 'q', 'g', 'h']))
STOP = {'ul', 'ulitsa', 'ulica', 'kochasi', 'kocha', 'koch', 'shox', 'shoh', 'prospekt', 'prospekti', 'pr', 'mfy', 'mfy', 'maxalla', 'mahalla',
        'mahallasi', 'g', 'gorod', 'shahri', 'massiv', 'massivi', 'tor', 'berk', 'pereulok', 'proyezd', 'kafe', 'cafe', 'restoran', 'restaurant',
        'restorani', 'choyxona', 'choyxonasi', 'milliy', 'taomlari', 'taomlar', 'osh', 'markazi', 'dom', 'uy', 'korzinka', 'korzinkauz', 'va', 'i'}


def latin(s):
    s = s.lower().replace('ʻ', "'").replace('ʼ', "'").replace('’', "'").replace('‘', "'")
    return ''.join(CYR.get(ch, ch) for ch in s)


def words(s):
    return [w for w in re.split(r"[^a-z0-9]+", latin(s).replace("'", '')) if w and w not in STOP and (len(w) > 1 or w.isdigit())]


def stem(w):
    # Russian genitive endings on Uzbek names: Rashidova → rashidov, Karimova → karimov, Navoi → navoiy
    for suf in ('ogo', 'ova', 'eva', 'ina', 'ana', 'iya', 'ya', 'a', 'y'):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def sim(a, b):
    wa, wb = [stem(w) for w in words(a) if not w.isdigit()], [stem(w) for w in words(b) if not w.isdigit()]
    if not wa or not wb:
        return 0
    score = 0
    for x in wa:
        score += max(difflib.SequenceMatcher(None, x, y).ratio() for y in wb)
    return score / len(wa)


def house(s):
    m = re.search(r'(\d+\s*[а-яa-z]?(?:/\d+)?)\s*$', s.strip().lower())
    return latin(m.group(1)).replace(' ', '') if m else None


def street_part(addr):
    # "ул. Шарафа Рашидова, 12" → "Шарафа Рашидова"; drops city/district prefixes
    parts = [p.strip() for p in addr.split(',')]
    for p in parts:
        if re.search(r'(ул\.|улиц|проспект|пр\.|ko.?ch|kocha|shoh|переулок|массив|street|avenue)', p, re.I):
            return re.sub(r'^(ул\.|улица|проспект|пр\.)\s*', '', p, flags=re.I)
    return parts[0]


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L))
        d = math.hypot(px - a[0] - t * dx, py - a[1] - t * dy)
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [a, b]


def yandex(query):
    url = 'https://geocode-maps.yandex.ru/1.x/?' + urllib.parse.urlencode({'apikey': YKEY, 'geocode': query, 'format': 'json', 'lang': 'ru_RU', 'results': 1})
    try:
        d = json.load(urllib.request.urlopen(url, timeout=20))
        m = d['response']['GeoObjectCollection']['featureMember']
        if not m:
            return None
        g = m[0]['GeoObject']
        prec = g['metaDataProperty']['GeocoderMetaData']['precision']
        lon, lat = map(float, g['Point']['pos'].split())
        return lon, lat, prec
    except Exception as e:  # noqa: BLE001
        print('  yandex failed', e)
        return None


ROAD = {'motorway': 0, 'trunk': 0, 'primary': 0, 'motorway_link': 0, 'trunk_link': 0, 'primary_link': 0,
        'secondary': 1, 'secondary_link': 1, 'tertiary': 1, 'tertiary_link': 1,
        'unclassified': 2, 'residential': 2, 'living_street': 2, 'pedestrian': 2, 'service': 3}

for key, (lon0, lat0) in CITIES.items():
    if key not in RADIUS or (ONLY and key not in ONLY):
        continue
    src = f'{CACHE}/{key}.json'
    if not os.path.exists(src):
        print('missing', key)
        continue
    R = RADIUS[key]
    kx = 111.32 * math.cos(math.radians(lat0))
    km = lambda lon, lat: ((lon - lon0) * kx, (lat - lat0) * 110.57)
    q = lambda lon, lat: [round((lon - lon0) * 1e5), round((lat - lat0) * 1e5)]
    els = json.load(open(src))['elements']
    roads, blds, green, water, canals, pois, streets = [], [], [], [], [], [], {}
    for e in els:
        t = e.get('tags', {})
        g = e.get('geometry')
        if e['type'] == 'way' and g and t.get('highway') in ROAD:
            cls = ROAD[t['highway']]
            pts = [(p['lon'], p['lat']) for p in g]
            if cls == 3 and min(math.hypot(*km(*p)) for p in pts) > R * 0.6:
                continue
            pts = simplify(pts, 1.2e-5)
            roads.append([cls] + [v for p in pts for v in q(*p)])
            for nm in {t.get('name'), t.get('name:uz'), t.get('name:ru'), t.get('old_name')} - {None}:
                streets.setdefault(nm, []).append(pts)
        elif e['type'] == 'way' and g and 'building' in t:
            pts = [(p['lon'], p['lat']) for p in g]
            xy = [km(*p) for p in pts]
            area = abs(sum(xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1] for i in range(len(xy) - 1))) / 2 * 1e6
            if area < 35:
                continue
            h = None
            for k in ('height', 'building:height'):
                if k in t:
                    try:
                        h = float(re.sub(r'[^0-9.]', '', t[k]) or 'x')
                    except ValueError:
                        pass
            if h is None and 'building:levels' in t:
                try:
                    h = float(re.sub(r'[^0-9.]', '', t['building:levels'])) * 3.2 + 1
                except ValueError:
                    pass
            if h is None:
                h = 15 if t.get('building') in ('apartments', 'residential') and area > 400 else (4 if area < 160 else 7 if area < 700 else 10)
            pts = simplify(pts[:-1], 0.8e-5) if len(pts) > 4 else pts[:-1]
            blds.append({'h': round(min(h, 90)), 'pts': pts, 'area': area, 'street': t.get('addr:street', ''), 'no': t.get('addr:housenumber', ''),
                         'name': t.get('name', ''), 'c': (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))})
        elif e['type'] == 'way' and g and (t.get('landuse') in ('grass', 'forest', 'recreation_ground', 'cemetery', 'village_green') or t.get('leisure') in ('park', 'garden', 'stadium', 'pitch') or t.get('natural') == 'wood'):
            if g[0] == g[-1]:
                green.append([v for p in simplify([(p['lon'], p['lat']) for p in g], 1.5e-5) for v in q(*p)])
        elif e['type'] == 'way' and g and t.get('natural') == 'water':
            if g[0] == g[-1]:
                water.append([v for p in simplify([(p['lon'], p['lat']) for p in g], 1.5e-5) for v in q(*p)])
        elif e['type'] == 'way' and g and t.get('waterway') in ('river', 'canal'):
            canals.append([v for p in simplify([(p['lon'], p['lat']) for p in g], 1.5e-5) for v in q(*p)])
        if t.get('name') and (t.get('amenity') or t.get('shop') or t.get('brand')):
            if 'lat' in e:
                c = (e['lon'], e['lat'])
            elif g:
                c = (sum(p['lon'] for p in g) / len(g), sum(p['lat'] for p in g) / len(g))
            elif 'bounds' in e:
                b = e['bounds']
                c = ((b['minlon'] + b['maxlon']) / 2, (b['minlat'] + b['maxlat']) / 2)
            else:
                continue
            pois.append({'name': t['name'], 'names': [t.get(k) for k in ('name', 'name:uz', 'name:ru', 'name:en', 'brand') if t.get(k)], 'c': c,
                         'street': t.get('addr:street', ''), 'no': t.get('addr:housenumber', '')})

    def seg_dist(c, a, b):
        # km from point c to segment ab, all (lon, lat)
        px, py = km(*c)
        ax, ay = km(*a)
        bx, by = km(*b)
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
        return math.hypot(px - ax - t * dx, py - ay - t * dy)

    def building_at(c):
        # the building whose footprint holds the point, else the nearest centroid within 25 m
        x, y = c
        for b in blds:
            pts = b['pts']
            inside = False
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[i - 1]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                    inside = not inside
            if inside:
                return b
        near = min(blds, key=lambda b: math.hypot(*km(*b['c'])) if False else (b['c'][0] - x) ** 2 + (b['c'][1] - y) ** 2, default=None)
        if near and math.hypot((near['c'][0] - x) * kx, (near['c'][1] - y) * 110.57) * 1000 < 25:
            return near
        return None

    def by_street(addr):
        st = street_part(addr)
        no = house(addr)
        best, score = None, 0
        for nm, segs in streets.items():
            s = sim(st, nm)
            if s > score:
                best, score = nm, s
        if not best or score < 0.72:
            return None
        if no:
            for b in blds:
                if b['no'] and latin(b['no']).replace(' ', '') == no and sim(st, b['street']) > 0.72:
                    return b['c'], 'building', best
        pts = [p for seg in streets[best] for p in seg]
        p = min(pts, key=lambda p: math.hypot(*km(*p)))
        return p, 'street', best

    venues = []
    used = set()
    for v in VENUES.get(key, []):
        name, addr = v['n'], v.get('a', '')
        place, how, street_name = None, None, None
        cand = [] if v.get('kind') == 'korzinka' else [(max(sim(name, n) for n in p['names']), p) for p in pois]
        cand = [c for c in cand if c[0] > 0.86]
        if cand:
            cand.sort(key=lambda c: -c[0])
            # several branches of one brand: prefer the one on the deck's street
            if len(cand) > 1 and addr:
                cand.sort(key=lambda c: -(c[0] + sim(street_part(addr), c[1]['street'] or '') * 0.5))
            place, how = cand[0][1]['c'], 'poi'
        if not place and v.get('kind') == 'korzinka':
            stores = [k for k in KOR if math.hypot(*km(*k['p'])) < R and id(k) not in used]
            if addr and stores:
                st = street_part(addr)
                # a mapped store without an address is known by the street it stands on
                def store_score(k):
                    # every street within 90 m counts: a corner store answers to both of its streets
                    names = [k['a']] if k.get('a') else []
                    for nm, segs in streets.items():
                        if any(seg_dist(k['p'], seg[i], seg[i + 1]) < 0.09 for seg in segs for i in range(len(seg) - 1)):
                            names.append(nm)
                    return max([sim(st, nm) for nm in names] or [0])
                scored = sorted(((store_score(k), k) for k in stores), key=lambda x: -x[0])
                if scored[0][0] > 0.72:
                    place, how = tuple(scored[0][1]['p']), 'osm-store'
                    used.add(id(scored[0][1]))
        fallback = None
        if not place and addr:
            r = by_street(addr)
            if r:
                if r[1] == 'building':
                    place, how, street_name = r
                else:
                    fallback = r
        if not place and v.get('au') and house(v['au']):
            n = nominatim(re.sub(r'^(.*?),\s*(\S+)$', r'\2 \1', v['au']), v.get('cityUz', key))
            if n and math.hypot(*km(*n)) < R * 1.3:
                place, how = n, 'nominatim'
        if not place and fallback:
            place, how, street_name = fallback
        if YKEY and how not in ('poi', 'osm-store', 'building'):
            y = yandex(f"Узбекистан, {v.get('city', key)}, {addr or name}")
            time.sleep(0.25)
            if y:
                place, how = (y[0], y[1]), f'yandex-{y[2]}'
        if not place:
            print('  unplaced', key, name, '|', addr)
            continue
        if how == 'street':
            taken = [tuple(x['p']) for x in venues]
            pts = sorted({p for seg in streets[street_name] for p in seg}, key=lambda p: math.hypot(*km(*p)))
            for p in pts:
                if all(abs(q(*p)[0] - t[0]) > 25 or abs(q(*p)[1] - t[1]) > 25 for t in taken):
                    place = p
                    break
        b = building_at(place) if how != 'street' else None
        venues.append({'n': name, 'nr': v.get('nr', ''), 'a': v.get('au', ''), 'ar': addr, 'k': v.get('kind', 'cafe'),
                       'p': q(*place), 'how': how, 'b': blds.index(b) if b else -1})
    # Korzinka stores mapped in OSM inside the city but not named in the deck
    for k in KOR:
        if id(k) in used or math.hypot(*km(*k['p'])) > R:
            continue
        if any(abs(v['p'][0] - q(*k['p'])[0]) < 40 and abs(v['p'][1] - q(*k['p'])[1]) < 40 for v in venues):
            continue
        b = building_at(tuple(k['p']))
        venues.append({'n': 'Korzinka' + (f" · {k['b']}" if k.get('b') else ''), 'nr': '', 'a': k.get('a', ''), 'ar': '', 'k': 'korzinka',
                       'p': q(*k['p']), 'how': 'osm-store', 'h': k.get('h', ''), 'b': blds.index(b) if b else -1})

    # keep the centre whole, thin the outskirts to the larger buildings, and always keep the venues' blocks
    vpts = [(lon0 + v['p'][0] / 1e5, lat0 + v['p'][1] / 1e5) for v in venues]
    def keep(b):
        d = math.hypot(*km(*b['c']))
        if any(math.hypot((b['c'][0] - x) * kx, (b['c'][1] - y) * 110.57) < 0.35 for x, y in vpts):
            return True
        return b['area'] >= (35 if d < 1.1 else 110 if d < 1.9 else 260)
    keepset = [b for b in blds if keep(b)]
    keepset.sort(key=lambda b: math.hypot(*km(*b['c'])))
    keepset = keepset[:16000]
    index = {id(b): i for i, b in enumerate(keepset)}
    for v in venues:
        v['b'] = index.get(id(blds[v['b']]), -1) if v['b'] >= 0 else -1
    blds = keepset
    out = {'c': [lon0, lat0], 'r': R,
           'roads': roads,
           'bld': [[b['h']] + [v for p in b['pts'] for v in q(*p)] for b in blds],
           'green': green, 'water': water, 'canals': canals,
           'venues': venues}
    path = f'{OUT}/{key}.json'
    json.dump(out, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    hows = {}
    for v in venues:
        hows[v['how']] = hows.get(v['how'], 0) + 1
    print(key, os.path.getsize(path) // 1024, 'KB', len(roads), 'roads', len(blds), 'bld', len(venues), 'venues', hows)
