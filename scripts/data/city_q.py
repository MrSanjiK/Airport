"""Overpass query for one city model. Usage: python3 scripts/data/city_q.py <key> <lon> <lat> <roads radius m> <buildings radius m>
Writes <key>.json in the current directory (an OSM cache dir for cities.py). Radii used: andijon/fargona/namangan 4500/2600,
margilon 3500/2000, asaka 3000/1800, qoqon 4000/2400, samarqand 5500/2800, buxoro 5000/2600, jizzax 3500/2500, qarshi 4500/2400."""
import sys, urllib.request, urllib.parse, json, time
key, lon, lat, R, Rb = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
q = f"""[out:json][timeout:180];
(
 way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|pedestrian|service)$"](around:{R},{lat},{lon});
 way["building"](around:{Rb},{lat},{lon});
 relation["building"](around:{Rb},{lat},{lon});
 way["landuse"~"^(grass|forest|recreation_ground|cemetery|village_green)$"](around:{R},{lat},{lon});
 way["leisure"~"^(park|garden|stadium|pitch)$"](around:{R},{lat},{lon});
 way["natural"~"^(water|wood)$"](around:{R},{lat},{lon});
 way["waterway"~"^(river|canal)$"](around:{R},{lat},{lon});
 nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|food_court|marketplace)$"](around:{R},{lat},{lon});
 nwr["name"]["shop"~"^(supermarket|mall|department_store|convenience)$"](around:{R},{lat},{lon});
 nwr["brand"~"Korzinka|Makro|Макро|Корзинка",i](around:{R},{lat},{lon});
);
out tags geom;"""
for url in ['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter']:
    for att in range(3):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent':'MediaPortSite/1.0'}), timeout=200).read()
            if data[:1] != b'{': raise ValueError(data[:120])
            open(f'{key}.json','wb').write(data); print(key, len(data)//1024, 'KB'); sys.exit(0)
        except Exception as e:
            print('retry', url[:30], att, str(e)[:80]); time.sleep(6)
sys.exit(1)
