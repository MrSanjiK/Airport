"""Satellite textures for the map.

Usage: python3 scripts/data/satellite.py <scratch-dir>

Day imagery is Sentinel-2 cloudless 2016 by EOX IT Services GmbH (CC BY 4.0, commercial use allowed with
attribution: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus
Sentinel data 2016 & 2017)"). Night lights are NASA Black Marble 2016 (VIIRS, public domain) via NASA GIBS.

Both are fetched as EPSG:4326 WMS images, so pixel rows and columns are linear in latitude and longitude,
the same projection as the map (src/scene/geo.js). Output: public/img/sat/*.webp plus src/data/satellite.json.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

OUT = 'public/img/sat'
SCRATCH = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
UA = {'User-Agent': 'MediaPortSite/1.0 (website build; imagery reused under its licence with attribution)'}
EOX = 'https://tiles.maps.eox.at/wms?service=WMS&request=GetMap&version=1.1.1&layers=s2cloudless&styles=&srs=EPSG:4326&format=image/jpeg'
GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=VIIRS_Black_Marble&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg&TIME=2016-01-01'

# name: (lon0, lon1, lat0, lat1, desktop px, mobile px, quality)
LAYERS = {
    'base': (50.5, 80.5, 33.5, 48.5, (4096, 2048), (2048, 1024), 72),
    'core': (63.6, 73.6, 37.6, 42.6, (4096, 2048), (2048, 1024), 72),
    'fergana': (70.4, 73.2, 40.2, 41.4, (3072, 1316), (1536, 658), 74),
    'tashkent': (68.8, 69.8, 40.9, 41.6, (2560, 1792), (1280, 896), 74),
    'samarkand': (66.75, 67.15, 39.55, 39.8, (1024, 640), (512, 320), 76),
    'bukhara': (64.25, 64.65, 39.68, 39.88, (1024, 512), (512, 256), 76),
}


def fetch(url, path):
    for attempt in range(4):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
            if data[:2] != b'\xff\xd8':
                raise ValueError(data[:200])
            open(path, 'wb').write(data)
            return
        except Exception as e:  # noqa: BLE001
            print('retry', attempt, e)
            time.sleep(4 + attempt * 4)
    raise SystemExit(f'failed: {url}')


def webp(src, dst, size, q):
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-resize', str(size[0]), str(size[1]), src, '-o', dst], check=True)


os.makedirs(OUT, exist_ok=True)
meta = {'attribution': 'Sentinel-2 cloudless — s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 & 2017) · Night lights: NASA Black Marble', 'layers': {}}
for name, (l0, l1, a0, a1, dsk, mob, q) in LAYERS.items():
    src = f'{SCRATCH}/sat-{name}.jpg'
    if not os.path.exists(src):
        fetch(f'{EOX}&bbox={l0},{a0},{l1},{a1}&width={dsk[0]}&height={dsk[1]}', src)
        time.sleep(1)
    # balance_satellite.py writes a seam-free version next to the raw download; encode that when present
    bal = f'{SCRATCH}/sat-{name}-bal.jpg'
    enc = bal if os.path.exists(bal) else src
    webp(enc, f'{OUT}/{name}.webp', dsk, q)
    webp(enc, f'{OUT}/{name}-m.webp', mob, q)
    meta['layers'][name] = {'bounds': [l0, l1, a0, a1], 'size': list(dsk), 'mobile': list(mob)}
    print(name, os.path.getsize(f'{OUT}/{name}.webp') // 1024, 'KB', os.path.getsize(f'{OUT}/{name}-m.webp') // 1024, 'KB')

l0, l1, a0, a1 = LAYERS['base'][:4]
src = f'{SCRATCH}/sat-night.jpg'
if not os.path.exists(src):
    fetch(f'{GIBS}&BBOX={l0},{a0},{l1},{a1}&WIDTH=4096&HEIGHT=2048', src)
webp(src, f'{OUT}/night.webp', (4096, 2048), 80)
webp(src, f'{OUT}/night-m.webp', (2048, 1024), 80)
meta['layers']['night'] = {'bounds': [l0, l1, a0, a1], 'size': [4096, 2048], 'mobile': [2048, 1024]}
json.dump(meta, open('src/data/satellite.json', 'w'), indent=1)
print('night', os.path.getsize(f'{OUT}/night.webp') // 1024, 'KB')
