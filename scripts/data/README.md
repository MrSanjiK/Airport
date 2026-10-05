# Map data pipeline

Sources (fetched 2026-10-05):
- Relief: Mapzen/AWS Terrain Tiles, terrarium z7 (`dem_tiles_z7.txt`), resampled to uint16 LE `(h + 200) * 8` grids by `process_geo.py`, then packed for the web by `pack_dem.py` into `public/data/dem-2048.z` / `dem-1024.z` (1 m steps, row deltas, split byte planes, zlib; decoded in `src/scene/terrain.js`).
- Borders: Natural Earth via `world-atlas@2/countries-10m.json`; rivers and lakes: Natural Earth 10m.
- Places: OpenStreetMap (ODbL) via Overpass (`maps.mail.ru` mirror): city nodes, Korzinka (brand/name), HoReCa venues matched by name to the deck list, airport terminals/runways/taxiways/aprons around TAS, Tashkent main roads and national trunk roads.

`process_geo.py` builds `public/data/{dem-*.bin, vectors.json, places.json, meta.json}`; roads were simplified with shapely into `public/data/roads.json`.
Korzinka/HoReCa points were enriched with branch, street, opening hours and nearest OSM town.
To geocode the full deck address lists precisely, add a 2GIS Catalog API key and geocode the addresses from the PDFs.

- Satellite imagery: `satellite.py` fetches Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) and NASA Black Marble 2016 (public domain) as EPSG:4326 WMS images into `public/img/sat/` and writes `src/data/satellite.json`.
- Airport detail: `airport_detail.py` turns the two Overpass results (`airport_q1/q2.overpassql`) into `public/data/airport-detail.json`.
