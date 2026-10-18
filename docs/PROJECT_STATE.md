# Project state

## This checkpoint

The original demo was a roughly 54 KB HTML fragment with inline CSS, one JavaScript closure and a CDN-loaded Three.js global. It was useful for fast visual iteration but had no package/build setup or source modules.

This extraction adds a standalone page, local dependency imports, a lockfile, formatting, targeted generator tests, and a separation between fixed map data, procedural generation and rendering. The original fragment is preserved unchanged in `reference/`. No terrain rules or campaign features were intentionally changed.

## Verification of this extraction

- `npm test`: all seven tests passed.
- `npm run build`: passed. Vite reports a JavaScript chunk above its 500 KB advisory threshold (about 692 KB minified / 181 KB gzip, including Three.js); bundle optimisation is deferred.
- `npm run format:check`: passed.
- The extracted generator produced identical serialised output to the original fragment for seeds 1, 7, 8 and 10. The reference snapshot is byte-for-byte unchanged.
- No new real-browser visual or interaction test was completed for this extraction. Build and numerical checks do not replace that check.

## Current limitations

- `makeLayout(seed)` still imports fixed topology. It is not yet a general map editor or a reusable campaign-data API.
- Rendering, palettes, controls and camera state still share one module/closure. A component mount/unmount API and complete resource/listener teardown are not implemented.
- The code is JavaScript, with implicit object shapes and shared river objects. Persistence needs an explicit, versioned map-data format rather than saving Three.js meshes.
- Rivers assume a simple channel with up to two directions per tile. Branches, confluences and arbitrary painted water regions need further design and testing.
- Crossing probabilities are rolled once per nearby settlement and river component. A placement attempt can fail on unsupported geometry; a 50/30/20 roll is not a guarantee of those exact final proportions on arbitrary future maps.
- Same-type crossing spacing is limited to five hexes on the same river. The fixed demo has only one small settlement, so larger settlement interactions are not exercised by the current scene. Stone bridge code is present for future larger settlements.
- Island flags are rolled at 15% per river tile. Connected flagged tiles share a shaped island group that can split into smaller islands.
- The renderer rebuilds the map on regeneration, using many separate meshes. Large-map performance, instancing and chunking have not been evaluated.
- Automated tests cover selected seeds and numerical constraints. They do not prove all possible generated maps are visually correct, accessible or fast on mobile devices.

## Next small steps

1. Commit this checkpoint and inspect it locally in a real browser, including touch controls if relevant.
2. Make map data an input to generation and rendering, keeping seeded dressing reproducible. Introduce a small map schema and stable hex IDs before adding editing or save/load.
3. Add renderer lifecycle boundaries when embedding the map in a larger UI. The choice of a future UI framework can remain open.

Keep visual work incremental. The palette, proportions, dense forests, connected ranges and smooth river banks are part of the established direction. A framework rewrite is not required to continue.
