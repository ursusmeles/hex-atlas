# Working on this prototype

Read `README.md` and `docs/PROJECT_STATE.md` before making changes.

- Keep the existing visual direction: orthographic/isometric hexes, restrained three-seed palettes with OKLCH variations, deep contrast and low-poly props.
- Preserve current visuals when refactoring. Keep `reference/hex-smooth-riverlands.html` as the original snapshot.
- Use `src/generation.js` for deterministic placement/surface rules, `src/map-data.js` for the current topology, and `src/main.js` for rendering/interactions.
- Preserve the light bottom-right token clearance; do not create a large empty centre. Grass and rocks can occupy that area.
- Forests should include dense touching crowns, occasional sparse tiles and optional neighbouring connections. Mountains should be broad connected ranges emerging from the base.
- Keep river-bank continuity, terrain-height cliffs, occasional shaped islands, and the explicit 50% bridge / 30% ferry / 20% neither roll. Ferries have two docks and a boat; bridges use wood near small settlements and stone near future large ones.
- Avoid unrelated new features or renderer/framework/dependency migrations during visual fixes. Three.js is intentionally pinned to the existing version.
- For generation changes, run `npm test`. For runnable source changes, run `npm run build`. Use `npm run format:check` for formatting. For visual changes, inspect in a real browser when available and state any verification limitation.
