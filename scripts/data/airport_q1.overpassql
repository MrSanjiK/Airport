[out:json][timeout:60];
(
  nwr["aeroway"~"control_tower|tower|jet_bridge|gate|parking_position|holding_position|terminal|hangar|apron"](41.235,69.24,41.29,69.32);
  nwr["man_made"="tower"](41.235,69.24,41.29,69.32);
  nwr["building"](41.255,69.258,41.272,69.278);
  way["amenity"="parking"](41.255,69.255,41.275,69.28);
);
out tags geom;
