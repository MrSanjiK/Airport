# Map data pipeline

Sources (fetched 2026-10-05):
- Relief: Mapzen/AWS Terrain Tiles, terrarium z7 (`dem_tiles_z7.txt`), resampled to `public/data/dem-1600.bin` / `dem-800.bin` (uint16 LE, `(h + 200) * 8`).
- Borders: Natural Earth via `world-atlas@2/countries-10m.json`; rivers and lakes: Natural Earth 10m.
- Places: OpenStreetMap (ODbL) via Overpass (`maps.mail.ru` mirror): city nodes, Korzinka (brand/name), HoReCa venues matched by name to the deck list, airport terminals/runways/taxiways/aprons around TAS, Tashkent main roads and national trunk roads.

`process_geo.py` builds `public/data/{dem-*.bin, vectors.json, places.json, meta.json}`; roads were simplified with shapely into `public/data/roads.json`.
Korzinka/HoReCa points were enriched with branch, street, opening hours and nearest OSM town.
To geocode the full deck address lists precisely, add a 2GIS Catalog API key and geocode the addresses from the PDFs.
