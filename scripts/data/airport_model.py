"""Tashkent International Airport model from OpenStreetMap (3D building parts, terminals, airside, landside).

Usage: python3 scripts/data/airport_model.py <all.json> <rel.json> public/data/airport-model.json   (needs shapely)
  all.json: result of airport_all.overpassql (buildings and parts, aeroways, green, roads, car parks, flagpoles)
  rel.json: result of airport_rel.overpassql (the departure terminal, aerodrome and hangar multipolygons, with members)

Coordinates are written as local metres [x east, z south] from the Terminal 2 complex centre, to 0.1 m.
Roof classes follow what the terminal roofs look like from above: the arrivals hall is roofed green, the
departure hall in light grey; the rest of the airport takes muted greys and the odd painted tin roof.
"""
import json
import math
import sys

KX = 111320 * math.cos(math.radians(41.26))
KZ = 110570

a = json.load(open(sys.argv[1]))['elements']
rels = {e['id']: e for e in json.load(open(sys.argv[2]))['elements']}


def stitch(members, role):
    """Join a multipolygon's member ways into closed rings."""
    segs = [[(p['lon'], p['lat']) for p in m['geometry']] for m in members if m.get('role') == role and m.get('geometry')]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while cur[0] != cur[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]: cur += s[1:]
                elif s[-1] == cur[-1]: cur += s[::-1][1:]
                elif s[-1] == cur[0]: cur = s[:-1] + cur
                elif s[0] == cur[0]: cur = s[::-1][:-1] + cur
                else: continue
                segs.pop(i)
                changed = True
                break
        if len(cur) > 3: rings.append(cur)
    return rings


def ll(g): return [(p['lon'], p['lat']) for p in g]


def centroid(r):
    return (sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))


def inside(pt, ring):
    c = False
    for i in range(len(ring)):
        (xi, yi), (xj, yj) = ring[i], ring[i - 1]
        if (yi > pt[1]) != (yj > pt[1]) and pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi:
            c = not c
    return c


def area(r):
    s = 0.0
    for i in range(len(r)):
        (x0, y0), (x1, y1) = r[i - 1], r[i]
        s += (x0 * KX) * (y1 * KZ) - (x1 * KX) * (y0 * KZ)
    return abs(s) / 2


def perim(r):
    return sum(math.hypot((r[i][0] - r[i - 1][0]) * KX, (r[i][1] - r[i - 1][1]) * KZ) for i in range(len(r)))


def num(v):
    try:
        return float(str(v).split()[0].replace(',', '.'))
    except (ValueError, TypeError):
        return None


ways = [e for e in a if e['type'] == 'way' and e.get('geometry')]
nodes = [e for e in a if e['type'] == 'node']
by_tag = lambda k, v=None: [e for e in ways if k in e.get('tags', {}) and (v is None or e['tags'][k] == v)]

dep_rings = stitch(rels[12489357]['members'], 'outer')
arr_ring = next(ll(e['geometry']) for e in ways if e['id'] == 301372378)
aero_rings = stitch(rels[12345328]['members'], 'outer')
ctrl_ring = next((ll(e['geometry']) for e in ways if e.get('tags', {}).get('aeroway') == 'control_center'), None)

pts = [p for r in dep_rings for p in r] + arr_ring
O = ((min(p[0] for p in pts) + max(p[0] for p in pts)) / 2, (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2)


def m(p): return [round((p[0] - O[0]) * KX, 1), round(-(p[1] - O[1]) * KZ, 1)]


def M(r): return [m(p) for p in r]


def dist(p): return math.hypot((p[0] - O[0]) * KX, (p[1] - O[1]) * KZ)


def near(r, d): return any(dist(p) < d for p in r)


in_aero = lambda pt: any(inside(pt, r) for r in aero_rings)

# ── buildings: 3D parts where mapped, outlines elsewhere ──
parts = [e for e in ways if 'building:part' in e.get('tags', {})]
part_c = [centroid(ll(e['geometry'])) for e in parts]
bld = []


def height(t, cls):
    h = num(t.get('height'))
    if h is None and num(t.get('building:levels')) is not None:
        h = num(t['building:levels']) * 3.3 + 1.2
    if h is None:
        h = {'hangar': 15, 'tank': 11, 'term': 14, 'canopy': 5}.get(cls, 7)
    return h


def classify(t, r, is_part):
    c = centroid(r)
    if t.get('building') == 'roof' or (is_part and num(t.get('min_height')) and num(t.get('min_height')) >= 4 and area(r) < 900):
        return 'canopy'
    if inside(c, arr_ring):
        return 'arr'
    if any(inside(c, d) for d in dep_rings):
        return 'dep'
    if t.get('aeroway') == 'terminal':
        return 'term'
    if t.get('building') == 'hangar' or t.get('aeroway') == 'hangar':
        return 'hangar'
    ar, pe = area(r), perim(r)
    if len(r) > 12 and pe > 0 and 4 * math.pi * ar / pe ** 2 > 0.85 and ar < 2500:
        return 'tank'
    return 'gen'


def add(e, is_part):
    t = e.get('tags', {})
    r = ll(e['geometry'])
    if r[0] != r[-1] or len(r) < 4 or area(r) < 25:
        return
    c = centroid(r)
    if not (in_aero(c) or dist(c) < 720 or t.get('aeroway') == 'terminal'):
        return
    cls = classify(t, r, is_part)
    h = height(t, cls)
    b = num(t.get('min_height')) or 0
    # the control tower is modelled by hand (fluted shaft, crown and cab): its mapped tall parts are left out
    if ctrl_ring and inside(c, ctrl_ring) and h > 20:
        return
    item = {'g': M(r[:-1]), 'h': round(min(h, 65), 1), 'c': cls}
    if b: item['b'] = round(b, 1)
    bld.append(item)


for e in parts:
    add(e, True)
for e in by_tag('building'):
    r = ll(e['geometry'])
    if e['tags'].get('building') == 'roof' and e['tags'].get('name'):
        add(e, False)
        continue
    # an outline whose parts are mapped is not drawn again (Simple 3D Buildings)
    if any(inside(pc, r) for pc in part_c):
        continue
    add(e, False)
# Terminal 3 is mapped as an aeroway area only, without a building: it is raised from that outline
t3 = next(e for e in ways if e['id'] == 301033320)
bld.append({'g': M(ll(t3['geometry'])[:-1]), 'h': num(t3['tags'].get('height')) or 14, 'c': 'term'})
# multipolygon buildings: the Uzbekistan Airways hangar
hr = rels.get(12714078)
if hr:
    for r in stitch(hr['members'], 'outer'):
        bld.append({'g': M(r[:-1]), 'h': 18, 'c': 'hangar'})

# ── ground ──
def rings_of(sel):
    out = []
    for e in sel:
        r = ll(e['geometry'])
        if r[0] == r[-1] and len(r) > 3:
            out.append(M(r[:-1]))
    return out


grass = rings_of([e for e in ways if e['tags'].get('landuse') in ('grass', 'meadow', 'recreation_ground') or e['tags'].get('natural') in ('grassland', 'scrub') or e['tags'].get('leisure') in ('park', 'garden')])
wood = rings_of([e for e in ways if e['tags'].get('natural') == 'wood' or e['tags'].get('landuse') == 'forest'])
aprons = rings_of(by_tag('aeroway', 'apron'))
parking = rings_of([e for e in by_tag('amenity', 'parking') if near(ll(e['geometry']), 900)])
helipads = rings_of(by_tag('aeroway', 'helipad'))

lines = lambda sel: [[m(p) for p in ll(e['geometry'])] for e in sel]
taxiways = [{'w': num(e['tags'].get('width')) or 23, 'g': [m(p) for p in ll(e['geometry'])]} for e in by_tag('aeroway', 'taxiway')]
runways = [{'ref': e['tags'].get('ref', ''), 'w': num(e['tags'].get('width')) or 45, 'g': [m(p) for p in ll(e['geometry'])]} for e in by_tag('aeroway', 'runway')]
stands = lines(by_tag('aeroway', 'parking_position'))
holds = lines(by_tag('aeroway', 'holding_position'))
jet = lines(by_tag('aeroway', 'jet_bridge'))

ROAD_W = {'motorway': 20, 'trunk': 18, 'trunk_link': 9, 'primary': 15, 'primary_link': 8, 'secondary': 12, 'secondary_link': 7,
          'tertiary': 9, 'residential': 7, 'living_street': 6, 'unclassified': 7, 'service': 5}
roads = [{'w': ROAD_W[e['tags']['highway']], 'g': [m(p) for p in ll(e['geometry'])]}
         for e in by_tag('highway') if e['tags']['highway'] in ROAD_W and near(ll(e['geometry']), 900)
         and not (e['tags']['highway'] == 'service' and e['tags'].get('service') in ('parking_aisle', 'drive-through'))]

trees = []
for e in nodes:
    t = e.get('tags', {})
    if t.get('natural') == 'tree' and dist((e['lon'], e['lat'])) < 900:
        trees.append(m((e['lon'], e['lat'])))
for e in [w for w in ways if w['tags'].get('natural') == 'tree_row' and near(ll(w['geometry']), 900)]:
    g = ll(e['geometry'])
    for i in range(len(g) - 1):
        (x0, y0), (x1, y1) = g[i], g[i + 1]
        n = max(1, int(math.hypot((x1 - x0) * KX, (y1 - y0) * KZ) / 9))
        for j in range(n):
            f = j / n
            trees.append(m((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)))

flags = [{'p': m((e['lon'], e['lat'])), 'h': num(e['tags'].get('height')) or 12}
         for e in nodes if e.get('tags', {}).get('man_made') == 'flagpole' and dist((e['lon'], e['lat'])) < 900]
tower = m(centroid(ctrl_ring)) if ctrl_ring else None

terminals = {
    'T1': M(next(ll(e['geometry']) for e in ways if e['id'] == 108293331)[:-1]),
    'T3': M(next(ll(e['geometry']) for e in ways if e['id'] == 301033320)[:-1]),
    'ARR': M(arr_ring[:-1]),
    'DEP': [M(r[:-1]) for r in dep_rings],
}

# ── shadows: every volume swept along the sun (from the north-west, ~34° up), unioned so overlaps never darken twice ──
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
SUN = (0.62, 0.42)  # metres of shadow per metre of height, east and south
vols = []
for b in bld:
    try:
        poly = Polygon(b['g']).buffer(0)
    except Exception:
        continue
    if poly.is_empty:
        continue
    k = b['h'] * 1.15
    dx, dz = SUN[0] * k, SUN[1] * k
    from shapely.affinity import translate
    shade = [poly, translate(poly, dx, dz)]
    ring = list(poly.exterior.coords)
    for i in range(len(ring) - 1):
        (x0, z0), (x1, z1) = ring[i], ring[i + 1]
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

out = {
    'o': [round(O[0], 6), round(O[1], 6)],
    'shadows': shadows,
    'aerodrome': [M(r[:-1]) for r in aero_rings],
    'grass': grass, 'wood': wood, 'aprons': aprons, 'parking': parking, 'helipads': helipads,
    'taxiways': taxiways, 'runways': runways, 'stands': stands, 'holds': holds, 'jet': jet,
    'roads': roads, 'trees': trees, 'flags': flags, 'tower': tower,
    'terminals': terminals, 'bld': bld,
}
json.dump(out, open(sys.argv[3], 'w'), separators=(',', ':'))
from collections import Counter
print({k: (len(v) if isinstance(v, list) else v) for k, v in out.items() if k != 'terminals'})
print(Counter(b['c'] for b in bld))
