"""The head office's neighbourhood from OpenStreetMap: Nest One (block C) and everything within ~900 m.

Usage: python3 scripts/data/office_model.py <office.json> public/data/office-model.json   (needs shapely)
  office.json: result of office.overpassql (buildings and 3D parts, roads, green, water, canals, trees, car parks)

Coordinates are local metres [x east, z south] from the office point (Nest One, block C), to 0.1 m.
"""
import json
import math
import sys
from shapely.geometry import Polygon, MultiPolygon
from shapely.affinity import translate
from shapely.ops import unary_union

O = (69.2527619, 41.3120115)
KX = 111320 * math.cos(math.radians(O[1]))
KZ = 110570
R = 900

els = json.load(open(sys.argv[1]))['elements']
ways = [e for e in els if e['type'] == 'way' and e.get('geometry')]
nodes = [e for e in els if e['type'] == 'node']


def m(lon, lat): return [round((lon - O[0]) * KX, 1), round(-(lat - O[1]) * KZ, 1)]
def ring(e): return [m(p['lon'], p['lat']) for p in e['geometry']]
def closed(e): g = e['geometry']; return len(g) > 3 and g[0]['lon'] == g[-1]['lon'] and g[0]['lat'] == g[-1]['lat']
def dist(p): return math.hypot(p[0], p[1])
def centroid(r): return [sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)]
def near(r, d=R): return any(dist(p) < d for p in r)


def inside(pt, r):
    c = False
    for i in range(len(r)):
        (xi, yi), (xj, yj) = r[i], r[i - 1]
        if (yi > pt[1]) != (yj > pt[1]) and pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi:
            c = not c
    return c


def num(v):
    try:
        return float(str(v).split()[0].replace(',', '.'))
    except (ValueError, TypeError):
        return None


def height(t):
    h = num(t.get('height'))
    if h is None and num(t.get('building:levels')) is not None:
        h = num(t['building:levels']) * 3.3 + 1.2
    return h if h is not None else 9.0


# ── buildings: 3D parts where mapped, outlines elsewhere ──
parts = [e for e in ways if 'building:part' in e.get('tags', {}) and closed(e)]
part_c = [centroid(ring(e)) for e in parts]
nest = next((ring(e) for e in ways if e.get('tags', {}).get('name') == 'Nest One' and 'building' in e['tags']), None)
bld = []


def add(e, is_part):
    t = e['tags']
    r = ring(e)[:-1]
    if len(r) < 3:
        return
    c = centroid(r)
    if dist(c) > R:
        return
    try:
        if Polygon(r).area < 20:
            return
    except Exception:
        return
    cls = 'gen'
    if t.get('name') == 'C' and is_part:
        cls = 'office'
    elif nest and inside(c, nest):
        cls = 'nest'
    elif height(t) >= 40:
        cls = 'tower'
    item = {'g': r, 'h': round(min(height(t), 300), 1), 'c': cls}
    b = num(t.get('min_height'))
    if b:
        item['b'] = round(b, 1)
    bld.append(item)


for e in parts:
    add(e, True)
for e in ways:
    t = e.get('tags', {})
    if 'building' not in t or not closed(e):
        continue
    r = ring(e)
    if any(inside(pc, r) for pc in part_c):
        continue
    add(e, False)

# ── ground ──
def rings(sel):
    return [ring(e)[:-1] for e in sel if closed(e) and near(ring(e))]


def tag(k, *vals):
    return [e for e in ways if e.get('tags', {}).get(k) in vals]


grass = rings(tag('landuse', 'grass', 'meadow', 'recreation_ground', 'village_green', 'flowerbed') + tag('leisure', 'park', 'garden', 'playground') + tag('natural', 'grassland', 'scrub'))
wood = rings(tag('natural', 'wood') + tag('landuse', 'forest'))
water = rings(tag('natural', 'water'))
pitches = rings(tag('leisure', 'pitch'))
parking = rings([e for e in ways if e.get('tags', {}).get('amenity') == 'parking'])
canals = [{'w': 18 if e['tags']['waterway'] == 'canal' else 5, 'g': ring(e)} for e in tag('waterway', 'canal', 'ditch', 'river', 'stream') if near(ring(e))]
ROAD_W = {'trunk': 22, 'primary': 20, 'primary_link': 9, 'secondary': 14, 'secondary_link': 7, 'tertiary': 11, 'residential': 8,
          'living_street': 7, 'unclassified': 8, 'service': 5, 'pedestrian': 6, 'footway': 2.4, 'cycleway': 2.4, 'path': 2}
roads = [{'w': ROAD_W[e['tags']['highway']], 'g': ring(e)} for e in ways if e.get('tags', {}).get('highway') in ROAD_W and near(ring(e))
         and e['tags'].get('area') != 'yes' and not (e['tags']['highway'] == 'service' and e['tags'].get('service') == 'parking_aisle')]
trees = [m(e['lon'], e['lat']) for e in nodes if e.get('tags', {}).get('natural') == 'tree' and dist(m(e['lon'], e['lat'])) < R]
for e in tag('natural', 'tree_row'):
    g = ring(e)
    for i in range(len(g) - 1):
        (x0, z0), (x1, z1) = g[i], g[i + 1]
        n = max(1, int(math.hypot(x1 - x0, z1 - z0) / 8))
        for j in range(n):
            f = j / n
            p = [round(x0 + (x1 - x0) * f, 1), round(z0 + (z1 - z0) * f, 1)]
            if dist(p) < R:
                trees.append(p)

# ── shadows: each volume swept along the sun (north-west, as on the airport), unioned ──
SUN = (0.62, 0.42)
vols = []
for b in bld:
    try:
        poly = Polygon(b['g']).buffer(0)
    except Exception:
        continue
    if poly.is_empty:
        continue
    k = b['h'] * 0.55
    dx, dz = SUN[0] * k, SUN[1] * k
    shade = [poly, translate(poly, dx, dz)]
    rr = list(poly.exterior.coords)
    for i in range(len(rr) - 1):
        (x0, z0), (x1, z1) = rr[i], rr[i + 1]
        q = Polygon([(x0, z0), (x1, z1), (x1 + dx, z1 + dz), (x0 + dx, z0 + dz)]).buffer(0)
        if not q.is_empty:
            shade.append(q)
    vols.append(unary_union(shade).difference(poly))
sh = unary_union(vols).simplify(0.4)
shadows = []
for g in (sh.geoms if isinstance(sh, MultiPolygon) else [sh]):
    if g.is_empty or g.area < 4:
        continue
    shadows.append({'o': [[round(x, 1), round(z, 1)] for x, z in list(g.exterior.coords)[:-1]],
                    'h': [[[round(x, 1), round(z, 1)] for x, z in list(r.coords)[:-1]] for r in g.interiors if Polygon(r).area > 4]})

office = next((b for b in bld if b['c'] == 'office'), None)
out = {'o': list(O), 'office': centroid(office['g']) + [office['h']] if office else [0, 0, 70],
       'bld': bld, 'grass': grass, 'wood': wood, 'water': water, 'pitches': pitches, 'parking': parking,
       'canals': canals, 'roads': roads, 'trees': trees, 'shadows': shadows}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
from collections import Counter
print({k: len(v) for k, v in out.items() if isinstance(v, list)}, Counter(b['c'] for b in bld), 'office', out['office'])
