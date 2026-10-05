"""Airport plate detail from OpenStreetMap.

Usage: python3 scripts/data/airport_detail.py <osm1.json> <osm2.json> public/data/airport-detail.json
  osm1: result of airport_q1.overpassql (aeroway features, towers, buildings, parking)
  osm2: result of airport_q2.overpassql (roads, green areas, trees)

Everything within RADIUS km of the Terminal 2 centroid is kept, rounded to ~1 m.
"""
import json
import math
import sys

T2 = (69.2687, 41.2634)
RADIUS = 0.62
KX = 111.32 * math.cos(math.radians(41.26))
KZ = 110.57


def km(lon, lat):
    return ((lon - T2[0]) * KX, -(lat - T2[1]) * KZ)


def near(geom, r=RADIUS):
    return any(math.hypot(*km(p['lon'], p['lat'])) < r for p in geom)


def ring(geom):
    return [[round(p['lon'], 6), round(p['lat'], 6)] for p in geom]


def area_m2(geom):
    pts = [km(p['lon'], p['lat']) for p in geom]
    a = 0.0
    for i in range(len(pts) - 1):
        a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(a) / 2 * 1e6


def height_m(t):
    for k in ('height', 'building:height'):
        if k in t:
            try:
                return float(str(t[k]).split()[0].replace(',', '.'))
            except ValueError:
                pass
    if 'building:levels' in t:
        try:
            return float(t['building:levels']) * 3.3 + 1.5
        except ValueError:
            pass
    return 7.0


ROAD_W = {'trunk': 16, 'trunk_link': 9, 'primary': 14, 'primary_link': 8, 'secondary': 11, 'secondary_link': 7,
          'tertiary': 9, 'residential': 7, 'living_street': 6, 'unclassified': 7, 'service': 5}

a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
out = {'jetBridges': [], 'tower': None, 'buildings': [], 'parking': [], 'roads': [], 'green': [], 'trees': [], 'stands': []}

for e in a['elements']:
    t = e.get('tags', {})
    g = e.get('geometry')
    if t.get('aeroway') == 'jet_bridge' and g:
        out['jetBridges'].append(ring(g))
    elif t.get('aeroway') in ('control_center', 'control_tower') and g:
        lon = sum(p['lon'] for p in g) / len(g)
        lat = sum(p['lat'] for p in g) / len(g)
        out['tower'] = [round(lon, 6), round(lat, 6)]
    elif t.get('aeroway') == 'parking_position' and g and near(g, 0.5):
        out['stands'].append(ring(g))
    elif t.get('amenity') == 'parking' and g and e['type'] == 'way' and near(g):
        out['parking'].append(ring(g))
    elif 'building' in t and g and e['type'] == 'way' and t.get('aeroway') not in ('terminal',):
        if near(g) and area_m2(g) > 60:
            out['buildings'].append({'g': ring(g), 'h': round(height_m(t), 1)})

for e in b['elements']:
    t = e.get('tags', {})
    g = e.get('geometry')
    hw = t.get('highway')
    if hw in ROAD_W and g and near(g):
        out['roads'].append({'w': ROAD_W[hw], 'g': ring(g)})
    elif (t.get('landuse') in ('grass', 'forest', 'recreation_ground') or t.get('leisure') in ('park', 'garden') or t.get('natural') in ('wood', 'scrub')) and g and near(g):
        if g[0]['lon'] == g[-1]['lon'] and g[0]['lat'] == g[-1]['lat']:
            out['green'].append({'k': 'wood' if t.get('natural') == 'wood' or t.get('landuse') == 'forest' else 'grass', 'g': ring(g)})
    elif t.get('natural') == 'tree' and 'lon' in e and math.hypot(*km(e['lon'], e['lat'])) < RADIUS:
        out['trees'].append([round(e['lon'], 6), round(e['lat'], 6)])
    elif t.get('natural') == 'tree_row' and g and near(g):
        # a tree every ~9 m along the row
        for i in range(len(g) - 1):
            x0, z0 = km(g[i]['lon'], g[i]['lat'])
            x1, z1 = km(g[i + 1]['lon'], g[i + 1]['lat'])
            n = max(1, int(math.hypot(x1 - x0, z1 - z0) / 0.009))
            for j in range(n):
                f = j / n
                out['trees'].append([round(g[i]['lon'] + (g[i + 1]['lon'] - g[i]['lon']) * f, 6), round(g[i]['lat'] + (g[i + 1]['lat'] - g[i]['lat']) * f, 6)])

json.dump(out, open(sys.argv[3], 'w'), separators=(',', ':'))
print({k: (len(v) if isinstance(v, list) else v) for k, v in out.items()})
