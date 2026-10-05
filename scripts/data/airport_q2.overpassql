[out:json][timeout:60];
(
  way["highway"](41.2555,69.258,41.2715,69.279);
  way["landuse"~"grass|forest|recreation_ground"](41.2555,69.258,41.2715,69.279);
  way["leisure"~"park|garden"](41.2555,69.258,41.2715,69.279);
  way["natural"~"wood|tree_row|scrub"](41.2555,69.258,41.2715,69.279);
  node["natural"="tree"](41.2555,69.258,41.2715,69.279);
);
out tags geom;
