# Map data pipeline

Sources (fetched 2026-10-05):
- Relief: Mapzen/AWS Terrain Tiles, terrarium z7 (`dem_tiles_z7.txt`), resampled to uint16 LE `(h + 200) * 8` grids by `process_geo.py`, then packed for the web by `pack_dem.py` into `public/data/dem-2048.z` / `dem-1024.z` (1 m steps, row deltas, split byte planes, zlib; decoded in `src/scene/terrain.js`).
- Borders: Natural Earth via `world-atlas@2/countries-10m.json`; rivers and lakes: Natural Earth 10m.
- Places: OpenStreetMap (ODbL) via Overpass (`maps.mail.ru` mirror): city nodes, Korzinka (brand/name), HoReCa venues matched by name to the deck list, airport terminals/runways/taxiways/aprons around TAS, Tashkent main roads and national trunk roads.

`process_geo.py` builds `public/data/{dem-*.bin, vectors.json, places.json, meta.json}`; roads were simplified with shapely into `public/data/roads.json`.
Korzinka/HoReCa points were enriched with branch, street, opening hours and nearest OSM town.
To geocode the full deck address lists precisely, add a 2GIS Catalog API key and geocode the addresses from the PDFs.

- Airport model: `airport_model.py` turns two Overpass results (`airport_all.overpassql`, `airport_rel.overpassql`) into `public/data/airport-model.json`: the 3D building parts of the terminals, every airside and nearby building, runways, taxiways, aprons, stands, car parks, roads, green and trees, plus building shadows unioned with shapely. Send Overpass requests with a User-Agent header; the main instance answers 406 without one.
- City models: `city_q.py` fetches each network city from Overpass, `cities.py` builds `public/data/city/<key>.json` (streets, buildings, parks, water) and places the deck venues (`venues.json`, from the Region and Korzinka decks) by OSM name, house address, mapped Korzinka store or street, with Nominatim as a second opinion. Set `YANDEX_KEY` to geocode every venue that is not house-exact with the Yandex Geocoder API instead.
- Every site with network venues (`sites.json`: the regional cities, Tashkent, the Tashkent region's towns and the single-store towns) gets a model. Korzinka branches come from the 2GIS Catalog API (`geocode_2gis.py korzinka`, needs `DGIS_KEY` in the environment, never in the repo); the HORECA deck's restaurants from 2GIS by name near their landmark, else the landmark itself via Nominatim (`horeca_geo.py`, `geocode_2gis.py venues`).
