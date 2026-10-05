// Equirectangular chart projection in kilometres, centred on Uzbekistan.
// Sheet extent: Uzbekistan with a wide margin so no camera framing ever reaches the paper's edge.
export const BBOX = { lon0: 50.5, lon1: 80.5, lat0: 33.5, lat1: 48.5 };
export const LONC = (BBOX.lon0 + BBOX.lon1) / 2;
export const LATC = (BBOX.lat0 + BBOX.lat1) / 2;
export const KX = Math.cos((LATC * Math.PI) / 180) * 111.32;
export const KZ = 110.57;
export const W = (BBOX.lon1 - BBOX.lon0) * KX;
export const D = (BBOX.lat1 - BBOX.lat0) * KZ;
export const EXAG = 6; // vertical exaggeration of relief

export const toXZ = (lon, lat) => [(lon - LONC) * KX, -(lat - LATC) * KZ];
export const toLonLat = (x, z) => [x / KX + LONC, -z / KZ + LATC];
export const toUV = (lon, lat) => [(lon - BBOX.lon0) / (BBOX.lon1 - BBOX.lon0), (BBOX.lat1 - lat) / (BBOX.lat1 - BBOX.lat0)];

export function formatDMS(lon, lat) {
  const f = (v, pos, neg) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
