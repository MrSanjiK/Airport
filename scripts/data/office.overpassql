[out:json][timeout:120];
(
  nwr["building"](41.3040,69.2420,41.3200,69.2640);
  nwr["building:part"](41.3040,69.2420,41.3200,69.2640);
  way["highway"](41.3040,69.2420,41.3200,69.2640);
  nwr["landuse"~"grass|forest|meadow|recreation_ground|village_green|flowerbed"](41.3040,69.2420,41.3200,69.2640);
  nwr["leisure"~"park|garden|pitch|playground"](41.3040,69.2420,41.3200,69.2640);
  nwr["natural"~"wood|tree|tree_row|scrub|grassland|water"](41.3040,69.2420,41.3200,69.2640);
  way["waterway"](41.3040,69.2420,41.3200,69.2640);
  way["amenity"="parking"](41.3040,69.2420,41.3200,69.2640);
);
out tags geom;
