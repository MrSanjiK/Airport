[out:json][timeout:180];
(
  nwr["building"](41.2460,69.2480,41.2720,69.2960);
  nwr["building:part"](41.2460,69.2480,41.2720,69.2960);
  nwr["aeroway"](41.2440,69.2440,41.2720,69.3000);
  nwr["landuse"~"grass|forest|meadow|construction|recreation_ground"](41.2460,69.2480,41.2720,69.2960);
  nwr["natural"~"wood|tree|tree_row|scrub|grassland"](41.2460,69.2480,41.2720,69.2960);
  nwr["leisure"~"park|garden"](41.2460,69.2480,41.2720,69.2960);
  way["highway"](41.2460,69.2480,41.2720,69.2960);
  way["amenity"="parking"](41.2460,69.2480,41.2720,69.2960);
  node["man_made"~"flagpole|mast"](41.2460,69.2480,41.2720,69.2960);
);
out tags geom;
