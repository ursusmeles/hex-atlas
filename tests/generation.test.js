import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeLayout,
  crossingChoice,
  bridgeMaterialFor,
  hexDistance,
  NEIGHBOURS,
  riverLandValue,
  surfaceHeight,
} from '../src/generation.js';

test('crossing roll includes the 20% no-crossing outcome', () => {
  const counts = { bridge: 0, ferry: 0, none: 0 };
  for (let seed = 1; seed <= 10000; seed++) {
    counts[crossingChoice(seed, { q: 1, r: 1 }, 0).kind ?? 'none']++;
  }
  for (const [kind, expected] of [
    ['bridge', 5000],
    ['ferry', 3000],
    ['none', 2000],
  ]) {
    assert.ok(Math.abs(counts[kind] - expected) < 150, `${kind}: ${counts[kind]}`);
  }
});

test('bridge material follows settlement size', () => {
  assert.equal(bridgeMaterialFor('small'), 'wood');
  for (const size of ['large', 'town', 'city']) assert.equal(bridgeMaterialFor(size), 'stone');
});

test('the same seed produces the same layout', () => {
  assert.deepEqual(makeLayout(8), makeLayout(8));
});

for (const seed of [1, 7, 8, 10]) {
  test(`seed ${seed}: tile dressing, crossings, river mesh and bank seams`, () => {
    const cells = makeLayout(seed);
    assert.equal(cells.length, 37);
    assert.equal(new Set(cells.map((cell) => cell.key)).size, cells.length);
    const byKey = new Map(cells.map((cell) => [cell.key, cell]));
    const riverCells = cells.filter((cell) => cell.type === 'Water');
    const settlement = cells.find((cell) => cell.type === 'Village');
    const crossings = riverCells.filter((cell) => cell.crossing);
    const choice = settlement.crossingRolls[0].kind;
    assert.equal(crossings.length, choice === null ? 0 : 1);

    for (const cell of cells) {
      if (cell.type !== 'Water') assert.ok(cell.props.length > 0, `${cell.key} is empty`);
    }
    for (const cell of riverCells) {
      if (cell.crossing) {
        assert.equal(cell.crossing.kind, choice);
        assert.equal(cell.crossing.material, 'wood');
        assert.ok(hexDistance(cell, settlement) <= 2);
        assert.ok(cell.crossing.boatPosition >= 0.4 && cell.crossing.boatPosition <= 0.6);
      }
      assert.ok(cell.riverSurface.vertices.flat().every(Number.isFinite));
      let landArea = 0;
      for (const face of cell.riverSurface.triangles) {
        const [a, b, c] = face.map((index) => cell.riverSurface.vertices[index]);
        const area = ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])) / 2;
        assert.ok(area >= -1e-10, 'Bank triangle winding');
        landArea += area;
      }
      const waterFraction = 1 - landArea / ((3 * Math.sqrt(3)) / 2);
      // The clipped mesh approximates the intended 60–90% interval.
      assert.ok(waterFraction >= 0.59 && waterFraction <= 0.91);
      for (const segment of cell.riverSurface.shore) {
        for (const vertex of segment) assert.ok(vertex[1] > 0, 'Cliff above water');
      }
      for (let direction = 0; direction < 3; direction++) {
        if (!cell.riverShared[direction]) continue;
        const [dq, dr] = NEIGHBOURS[direction];
        const other = byKey.get(`${cell.q + dq},${cell.r + dr}`);
        const nx = Math.cos((direction * Math.PI) / 3);
        const nz = Math.sin((direction * Math.PI) / 3);
        for (let j = 0; j <= 56; j++) {
          const t = j / 56 - 0.5;
          const x = (cell.wx + other.wx) / 2 - nz * t;
          const z = (cell.wz + other.wz) / 2 + nx * t;
          if (riverLandValue(cell.river, x, z) < 0.008) continue;
          const height = surfaceHeight(cell.riverSurface, x - cell.wx, z - cell.wz);
          const otherHeight = surfaceHeight(other.riverSurface, x - other.wx, z - other.wz);
          assert.ok(Math.abs(height - otherHeight) < 1e-6, `Bank seam ${cell.key}/${other.key}`);
        }
      }
    }
  });
}
