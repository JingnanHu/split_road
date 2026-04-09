# Split Road Segments from OpenStreetMap

## Overview

This project fetches road data from the OpenStreetMap (OSM) API within a given polygon and splits roads into smaller **drivable segments** at junction nodes.

It demonstrates:

* Working with OSM data (`node` and `way`)
* Spatial filtering (bounding box + polygon)
* Graph-like road segmentation

## How to Run

```bash
npx tsx split.ts
```
## TODO / Improvements

* When the polygon area is so large, then it might take loog time to road. Maybe divided the area into small parts when the pylogon area is over a specific number.
