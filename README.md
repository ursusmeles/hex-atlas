# Hex sandbox — The quiet frontier

A visual prototype for an isometric hex-based TTRPG campaign map. This checkpoint preserves the smooth-riverlands demo and moves its code into a small, runnable project.

## Run locally

Use Node.js 24 (see `.nvmrc`), then:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. The scene needs a browser with WebGL enabled. Drag to pan, scroll or pinch to zoom, click a hex or use the selection list, change palettes, and regenerate the landscape dressing.

```sh
npm test
npm run build
npm run preview
```

The production build is written to `dist/`. There is no server, account, API key, database, or environment-variable setup.

## What exists

- An orthographic Three.js map with 37 fixed hexes, selection, pan and zoom.
- Bevelled land tiles, varied elevation, procedural rocks, grass, settlements, sparse/dense woodland and forest connections across hexes.
- Connected mountain ranges and a river with shaped banks, cliffs, islands, wooden bridges, or two ferry docks with a boat.
- Four presets and three editable seed colours, with OKLCH-derived variations.
- Seeded generation. The initial seed is `1`; Regenerate chooses a new seed. Generation can be called directly through `makeLayout(seed)`.

**Regenerate changes props, elevation and river details. The terrain assignments and river route remain fixed.** Reloading resets the state; nothing is saved.

This is a visual prototype, not a campaign-management application yet. There is no hex editing, map expansion, save/load, account system, token placement, campaign entities, game-time tracking, tables, or world simulation.

## Code map

| File                                   | Responsibility                                                           |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `index.html`                           | Standalone page and existing controls                                    |
| `src/main.js`                          | Three.js scene, meshes, palettes and interaction                         |
| `src/styles.css`                       | Page and control styling                                                 |
| `src/map-data.js`                      | Fixed demonstration topology                                             |
| `src/generation.js`                    | Seeded layout, placement constraints and surface geometry data           |
| `tests/generation.test.js`             | Crossing probabilities, material rules, determinism and river seams      |
| `reference/hex-smooth-riverlands.html` | Exact original inline demo snapshot; retained as a visual/code reference |
| `docs/PROJECT_STATE.md`                | Known limits and the next small development steps                        |

The stack is vanilla JavaScript modules, Three.js **0.160.1**, and Vite. Three.js stays at the demo's version to avoid mixing a renderer upgrade with the project extraction. Dependencies are pinned and a lockfile is included. Run `npm run format` after editing; the untouched reference snapshot is excluded.

## Start a GitHub repository

Create an empty repository, then run these commands from this folder, replacing the URL:

```sh
git init -b main
git add .
git commit -m "Preserve hex-map prototype as a standalone project"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Choose the repository visibility explicitly. `private: true` in `package.json` only prevents accidental npm publishing; it does not set GitHub visibility. No open-source licence has been selected for this checkpoint.
