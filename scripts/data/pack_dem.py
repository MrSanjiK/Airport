"""Pack the DEM for the web: 1 m steps, row-wise deltas, byte planes split, zlib.

Usage: python3 scripts/data/pack_dem.py public/data/dem-2048.bin 2048
Writes <name>.z next to the input. src/scene/terrain.js (loadHeights) reverses it. Values stay (h + 200).
"""
import array
import sys
import zlib

src, w = sys.argv[1], int(sys.argv[2])
a = array.array('H', open(src, 'rb').read())
q = array.array('H', [(v + 4) // 8 for v in a])
d = array.array('H', [0] * len(q))
for i in range(len(q)):
    left = q[i - 1] if i % w else (q[i - w] if i >= w else 0)
    d[i] = (q[i] - left) & 0xFFFF
b = d.tobytes()
out = src.rsplit('.', 1)[0] + '.z'
open(out, 'wb').write(zlib.compress(b[0::2] + b[1::2], 9))
print(out, len(open(out, 'rb').read()))
