"""Colour-balance the Sentinel-2 cloudless mosaic against NASA Blue Marble.

The 2016 Sentinel-2 cloudless mosaic carries visible seams between acquisitions (a lighter square over the
Kyzylkum, for one). Blue Marble Next Generation is seam-free but soft. Each layer keeps Sentinel-2's detail and
takes its broad colour from Blue Marble: out = S2 * blur(BM) / blur(S2). Every layer is balanced against the same
reference, so the finer layers also meet the base layer without a step in colour.

Usage (after satellite.py has cached the WMS images in <scratch>):
  python scripts/data/balance_satellite.py <scratch>     # needs numpy + Pillow
Writes balanced JPEGs back into <scratch> as sat-<name>-bal.jpg; satellite.py --balanced encodes those.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter

SCRATCH = sys.argv[1]
meta = json.load(open('src/data/satellite.json'))['layers']
BASE = meta['base']['bounds']
bm = Image.open(f'{SCRATCH}/bm-BlueMarble_NextGeneration.jpg').convert('RGB')
BW, BH = bm.size


def crop_bm(b, size):
    l0, l1, a0, a1 = b
    x0 = (l0 - BASE[0]) / (BASE[1] - BASE[0]) * BW
    x1 = (l1 - BASE[0]) / (BASE[1] - BASE[0]) * BW
    y0 = (BASE[3] - a1) / (BASE[3] - BASE[2]) * BH
    y1 = (BASE[3] - a0) / (BASE[3] - BASE[2]) * BH
    return bm.resize(size, Image.BICUBIC, box=(x0, y0, x1, y1))


for name, info in meta.items():
    if name == 'night':
        continue
    s = Image.open(f'{SCRATCH}/sat-{name}.jpg').convert('RGB')
    w, h = s.size
    l0, l1 = info['bounds'][:2]
    km_px = (l1 - l0) * 84.0 / w
    # blur radius: about two Blue Marble pixels (500 m each), never below 6 px
    r = max(6.0, 1.0 / km_px * 1.0) if name != 'base' else 10.0
    ref = crop_bm(info['bounds'], (w, h))
    S = np.asarray(s, dtype=np.float32) + 2.0
    lowS = np.asarray(s.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) + 2.0
    lowB = np.asarray(ref.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32) + 2.0
    gain = np.clip(lowB / lowS, 0.45, 2.2)
    out = np.clip(S * gain - 2.0, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(f'{SCRATCH}/sat-{name}-bal.jpg', quality=93)
    print(name, w, h, 'r', round(r, 1))
