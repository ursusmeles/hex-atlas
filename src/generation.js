import { radius, waterKeys, mountainKeys, villageKey, forestKeys } from './map-data.js';

const TOP_RADIUS = 0.92,
  PROP_GAP = 0.025,
  TOKEN_ANCHOR = { x: 0.5, z: 0.16, r: 0.1 };
const NEIGHBOURS = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ],
  APOTHEM = Math.sqrt(3) / 2;
function randomStream(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fitsHex(x, z, r) {
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    if (x * Math.cos(a) + z * Math.sin(a) > APOTHEM * TOP_RADIUS - r - 0.018) return false;
  }
  return true;
}
function fitsTree(cell, x, z, r) {
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3,
      margin = cell.links[k] ? r * 0.17 : r;
    if (x * Math.cos(a) + z * Math.sin(a) > APOTHEM * TOP_RADIUS - margin - 0.018) return false;
  }
  return true;
}
function smoothstep(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function ridgeHeight(range, x, z) {
  let edgeDistance = Infinity;
  for (const [a, b] of range.boundary)
    edgeDistance = Math.min(edgeDistance, segmentDistance(x, z, a, b));
  let backboneDistance = Infinity;
  for (const [a, b] of range.spines)
    backboneDistance = Math.min(backboneDistance, segmentDistance(x, z, a, b));
  const c = Math.cos(range.angle),
    s = Math.sin(range.angle),
    u = x * c + z * s,
    v = -x * s + z * c;
  const rolling =
    0.57 +
    0.1 * Math.sin(u * 2.3 + range.phase) +
    0.055 * Math.cos(v * 3.1 - u * 0.8 + range.phase);
  const broadRidge = rolling * Math.exp(-Math.pow(backboneDistance / 0.7, 2)) + 0.14;
  const texture = 0.014 * Math.sin(x * 8.1 + range.phase) * Math.sin(z * 6.7 - range.phase);
  return Math.max(0, broadRidge + texture) * smoothstep(0, 0.57, edgeDistance);
}
function ridgeSurface(cell, range) {
  const vertices = [],
    triangles = [],
    lookup = new Map(),
    n = 8,
    corners = cell.corners;
  function vertex(x, z, onBoundary) {
    const key =
      (Math.abs(x) < 1e-6 ? 0 : x).toFixed(7) + ',' + (Math.abs(z) < 1e-6 ? 0 : z).toFixed(7);
    if (lookup.has(key)) return lookup.get(key);
    if (!onBoundary && Math.hypot(x, z) > 0.01) {
      const salt = (x + cell.wx) * 197 + (z + cell.wz) * 313 + range.phase;
      x += Math.sin(salt * 7) * 0.014;
      z += Math.cos(salt * 11) * 0.014;
    }
    const index = vertices.length;
    vertices.push([x, ridgeHeight(range, cell.wx + x, cell.wz + z), z]);
    lookup.set(key, index);
    return index;
  }
  for (let sector = 0; sector < 6; sector++) {
    const A = corners[sector],
      B = corners[(sector + 1) % 6];
    const at = (i, j) => vertex((i * A[0] + j * B[0]) / n, (i * A[1] + j * B[1]) / n, i + j === n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        triangles.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (i + j < n - 1) triangles.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
  }
  return { vertices, triangles };
}
function surfaceHeight(surface, x, z) {
  for (const [ia, ib, ic] of surface.triangles) {
    const a = surface.vertices[ia],
      b = surface.vertices[ib],
      c = surface.vertices[ic];
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    const wa = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d,
      wb = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d,
      wc = 1 - wa - wb;
    if (wa >= -1e-7 && wb >= -1e-7 && wc >= -1e-7) return wa * a[1] + wb * b[1] + wc * c[1];
  }
  return 0;
}
function lowProp(kind) {
  return kind === 'rock' || kind === 'grass' || kind === 'ripple';
}
function minimumSpacing(a, b) {
  if (a.kind === 'tree' && b.kind === 'tree') return (a.footprint + b.footprint) * 0.59;
  if (a.kind === 'tree' && lowProp(b.kind)) return 0.035 + b.footprint * 0.8;
  if (b.kind === 'tree' && lowProp(a.kind)) return 0.035 + a.footprint * 0.8;
  if (lowProp(a.kind) && lowProp(b.kind)) return (a.footprint + b.footprint) * 0.85;
  return a.footprint + b.footprint + PROP_GAP;
}
function hexDistance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
}
function curvePoint(curve, t) {
  const u = 1 - t;
  return [
    u * u * curve[0][0] + 2 * u * t * curve[1][0] + t * t * curve[2][0],
    u * u * curve[0][1] + 2 * u * t * curve[1][1] + t * t * curve[2][1],
  ];
}
function curveTangent(curve, t) {
  const dx = (1 - t) * (curve[1][0] - curve[0][0]) + t * (curve[2][0] - curve[1][0]),
    dz = (1 - t) * (curve[1][1] - curve[0][1]) + t * (curve[2][1] - curve[1][1]),
    d = Math.hypot(dx, dz);
  return [dx / d, dz / d];
}
function tubeValue(x, z, segment) {
  const [a, b, ra, rb] = segment,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - (ra + (rb - ra) * t);
}
function riverBankValue(river, x, z) {
  let value = Infinity;
  for (const segment of river.channel) value = Math.min(value, tubeValue(x, z, segment));
  return (
    value +
    0.048 * Math.sin(x * 2.7 + z * 1.3 + river.phase) +
    0.023 * Math.sin(z * 4.1 - x * 1.7 - river.phase)
  );
}
function riverIslandValue(river, x, z) {
  let value = -Infinity;
  for (const segment of river.islands) value = Math.max(value, -tubeValue(x, z, segment));
  return value;
}
function riverLandValue(river, x, z) {
  return Math.max(riverBankValue(river, x, z), riverIslandValue(river, x, z));
}
function riverBankHeight(river, x, z) {
  let weight = 0,
    height = 0;
  for (const edge of river.landEdges) {
    const [a, b, ha, hb] = edge,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))),
      distance = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (distance < 1e-7) return ha + (hb - ha) * t;
    const w = 1 / Math.pow(distance + 0.002, 5);
    weight += w;
    height += (ha + (hb - ha) * t) * w;
  }
  return weight ? height / weight : 0.14;
}
function riverGroundHeight(river, x, z) {
  const bank = riverBankValue(river, x, z),
    island = riverIslandValue(river, x, z);
  if (Math.max(bank, island) < 0) return 0;
  return island > bank ? 0.045 : riverBankHeight(river, x, z);
}
function insideRiverTile(cell, x, z, margin = 0) {
  for (let k = 0; k < 6; k++) {
    const a = cell.riverCorners[k],
      b = cell.riverCorners[(k + 1) % 6],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    if ((x - a[0]) * dz - (z - a[1]) * dx < margin * Math.hypot(dx, dz) - 1e-9) return false;
  }
  return true;
}
// Clip planar bank tops at the exact shoreline, then add vertical cliff faces.
// No submerged, triangulated slope crosses the water plane.
function riverSurface(cell) {
  const vertices = [],
    triangles = [],
    shore = [],
    lookup = new Map(),
    n = 28,
    corners = cell.riverCorners;
  function raw(x, z) {
    return { x, z, v: riverLandValue(cell.river, cell.wx + x, cell.wz + z) };
  }
  function intersection(a, b) {
    const t = a.v / (a.v - b.v);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, v: 0 };
  }
  function vertex(p) {
    const key = p.x.toFixed(8) + ',' + p.z.toFixed(8);
    if (lookup.has(key)) return lookup.get(key);
    const x = cell.wx + p.x,
      z = cell.wz + p.z,
      island = riverIslandValue(cell.river, x, z),
      bank = riverBankValue(cell.river, x, z),
      y = island > bank ? 0.045 : riverBankHeight(cell.river, x, z),
      index = vertices.length;
    vertices.push([p.x, y, p.z]);
    lookup.set(key, index);
    return index;
  }
  function triangle(points) {
    const clipped = [],
      cross = [];
    for (let i = 0; i < 3; i++) {
      const a = points[i],
        b = points[(i + 1) % 3];
      if (a.v >= 0) clipped.push(a);
      if ((a.v < 0 && b.v >= 0) || (a.v >= 0 && b.v < 0)) {
        const p = intersection(a, b);
        clipped.push(p);
        cross.push(p);
      }
    }
    if (clipped.length >= 3) {
      const a = vertex(clipped[0]);
      for (let k = 1; k < clipped.length - 1; k++)
        triangles.push([a, vertex(clipped[k]), vertex(clipped[k + 1])]);
    }
    if (cross.length === 2) shore.push(cross.map((p) => vertices[vertex(p)]));
  }
  const rawLookup = new Map(),
    atPoint = (x, z) => {
      const key = x.toFixed(8) + ',' + z.toFixed(8);
      if (!rawLookup.has(key)) rawLookup.set(key, raw(x, z));
      return rawLookup.get(key);
    };
  for (let k = 0; k < 6; k++) {
    const a = corners[k],
      b = corners[(k + 1) % 6],
      at = (i, j) => atPoint((i * a[0] + j * b[0]) / n, (i * a[1] + j * b[1]) / n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        triangle([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (i + j < n - 1) triangle([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
  }
  return { vertices, triangles, shore };
}
function bridgeMaterialFor(size) {
  return ['large', 'town', 'city'].includes(size) ? 'stone' : 'wood';
}
function crossingChoice(seed, settlement, riverId) {
  const rand = randomStream(
      seed * 63029 + (settlement.q + 13) * 8191 + (settlement.r + 13) * 4133 + riverId * 7717,
    ),
    roll = rand();
  return {
    kind: roll < 0.5 ? 'bridge' : roll < 0.8 ? 'ferry' : null,
    roll,
    boatPosition: 0.4 + rand() * 0.2,
  };
}
function crossingSite(cell) {
  for (const t of [0.5, 0.35, 0.65, 0.23, 0.77, 0.12, 0.88, 0.06, 0.94]) {
    const center = curvePoint(cell.riverCurve, t),
      tangent = curveTangent(cell.riverCurve, t),
      normal = [-tangent[1], tangent[0]],
      ends = [];
    if (riverIslandValue(cell.river, ...center) > -0.13) continue;
    let clear = true;
    for (const sign of [-1, 1]) {
      let end = null;
      for (let d = 0.04; d < 1.16; d += 0.012) {
        const p = [center[0] + normal[0] * d * sign, center[1] + normal[1] * d * sign];
        if (!insideRiverTile(cell, p[0] - cell.wx, p[1] - cell.wz, 0.008)) {
          let side = 0,
            projection = -Infinity;
          for (let k = 0; k < 6; k++) {
            const v =
              (p[0] - cell.wx) * Math.cos((k * Math.PI) / 3) +
              (p[1] - cell.wz) * Math.sin((k * Math.PI) / 3);
            if (v > projection) {
              projection = v;
              side = k;
            }
          }
          if (cell.riverLandSides[side])
            end = [p[0] + normal[0] * sign * 0.03, p[1] + normal[1] * sign * 0.03];
          break;
        }
        if (riverIslandValue(cell.river, ...p) > -0.115) {
          clear = false;
          break;
        }
        if (riverBankValue(cell.river, ...p) > 0.018) {
          end = p;
          break;
        }
      }
      if (!end) {
        clear = false;
        break;
      }
      ends.push(end);
    }
    if (clear && ends.length === 2)
      return {
        a: [ends[0][0] - cell.wx, ends[0][1] - cell.wz],
        b: [ends[1][0] - cell.wx, ends[1][1] - cell.wz],
        heights: ends.map((p) => riverBankHeight(cell.river, ...p)),
      };
  }
  return null;
}
function createIslandGroups(component, river, seed, neighbour) {
  const seen = new Set();
  for (const start of component) {
    if (!start.hasIsland || seen.has(start.key)) continue;
    const group = [],
      queue = [start];
    seen.add(start.key);
    while (queue.length) {
      const cell = queue.shift();
      group.push(cell);
      for (let k = 0; k < 6; k++) {
        const next = neighbour(cell, k);
        if (next?.hasIsland && next.type === 'Water' && !seen.has(next.key)) {
          seen.add(next.key);
          queue.push(next);
        }
      }
    }
    const keys = new Set(group.map((c) => c.key)),
      degree = (c) => c.riverDirections.filter((k) => keys.has(neighbour(c, k)?.key)).length;
    let current = group.find((c) => degree(c) < 2) || group[0],
      previous = null;
    const ordered = [];
    while (current) {
      ordered.push(current);
      const next = current.riverDirections
        .map((k) => neighbour(current, k))
        .find((c) => c && keys.has(c.key) && c !== previous && !ordered.includes(c));
      previous = current;
      current = next;
    }
    const path = [];
    for (let i = 0; i < ordered.length; i++) {
      const c = ordered[i],
        before = ordered[i - 1],
        after = ordered[i + 1];
      let reverse = false;
      if (before) reverse = neighbour(c, c.riverDirections[1])?.key === before.key;
      else if (after) reverse = neighbour(c, c.riverDirections[0])?.key === after.key;
      for (let j = 0; j <= 32; j++) {
        let t = j / 32;
        if (i === 0 && t < 0.33) continue;
        if (i === ordered.length - 1 && t > 0.67) continue;
        const point = curvePoint(c.riverCurve, reverse ? 1 - t : t);
        if (
          !path.length ||
          Math.hypot(point[0] - path[path.length - 1][0], point[1] - path[path.length - 1][1]) >
            1e-6
        )
          path.push(point);
      }
    }
    const rand = randomStream(seed * 7103 + (start.q + 9) * 317 + (start.r + 9) * 911),
      phase = rand() * 6.28,
      fragmented = ordered.length > 1 && rand() < 0.3;
    const distances = [0];
    for (let i = 1; i < path.length; i++)
      distances.push(
        distances[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]),
      );
    const length = distances[distances.length - 1];
    const along = (s) => {
      let i = 1;
      while (i < distances.length - 1 && distances[i] < s) i++;
      const t = (s - distances[i - 1]) / (distances[i] - distances[i - 1]);
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ];
    };
    const pieces = fragmented ? 2 + (ordered.length > 2 && rand() < 0.5 ? 1 : 0) : 1;
    for (let piece = 0; piece < pieces; piece++) {
      const gap = fragmented ? 0.16 : 0,
        from = (piece * length) / pieces + (piece ? gap / 2 : 0),
        to = ((piece + 1) * length) / pieces - (piece < pieces - 1 ? gap / 2 : 0),
        width =
          (ordered.length === 1 ? 0.145 : 0.17) * (fragmented ? 0.82 : 1) * (0.92 + rand() * 0.15),
        count = Math.max(18, Math.ceil((to - from) * 32)),
        samples = [];
      for (let j = 0; j <= count; j++) {
        const t = j / count,
          s = from + (to - from) * t,
          p = along(s),
          a = along(Math.max(0, s - 0.01)),
          b = along(Math.min(length, s + 0.01)),
          d = Math.hypot(b[0] - a[0], b[1] - a[1]),
          offset = 0.035 * Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 2 + phase),
          radius =
            width * Math.pow(Math.sin(Math.PI * t), 0.72) * (1 + 0.09 * Math.sin(t * 6.28 + phase));
        samples.push([
          [p[0] - ((b[1] - a[1]) / d) * offset, p[1] + ((b[0] - a[0]) / d) * offset],
          Math.max(0.004, radius),
        ]);
      }
      for (let j = 0; j < samples.length - 1; j++)
        river.islands.push([samples[j][0], samples[j + 1][0], samples[j][1], samples[j + 1][1]]);
    }
    river.islandGroups.push({ keys: ordered.map((c) => c.key), fragmented, pieces, length });
  }
}
function prepareRivers(cells, seed) {
  const byKey = new Map(cells.map((c) => [c.key, c])),
    water = cells.filter((c) => c.type === 'Water'),
    neighbour = (c, k) => byKey.get(c.q + NEIGHBOURS[k][0] + ',' + (c.r + NEIGHBOURS[k][1]));
  const fullCorners = Array.from({ length: 6 }, (_, k) => [
    Math.sin((k * Math.PI) / 3),
    Math.cos((k * Math.PI) / 3),
  ]);
  const worldCornerKey = (x, z) =>
      (Math.abs(x) < 1e-6 ? 0 : x).toFixed(6) + ',' + (Math.abs(z) < 1e-6 ? 0 : z).toFixed(6),
    cornerHeights = new Map();
  // All banks use the actual adjacent land height at their outer edge.
  for (const c of cells)
    if (c.type !== 'Water')
      for (const [x, z] of fullCorners) {
        const key = worldCornerKey(c.wx + x, c.wz + z);
        if (!cornerHeights.has(key)) cornerHeights.set(key, []);
        cornerHeights.get(key).push(c.top);
      }
  for (const c of cells)
    if (c.type !== 'Water') {
      c.shoreLinks = NEIGHBOURS.map((_, k) => neighbour(c, k)?.type === 'Water');
      if (c.shoreLinks.some(Boolean)) {
        c.tone = false;
        c.shoreCornerHeights = fullCorners.map(([x, z]) => {
          const h = cornerHeights.get(worldCornerKey(c.wx + x, c.wz + z));
          return h.reduce((s, v) => s + v, 0) / h.length;
        });
      }
      if (c.type === 'Village' && !c.settlementSize) c.settlementSize = 'small';
    }
  for (const cell of water) {
    const rand = randomStream(seed * 49009 + (cell.q + 13) * 7381 + (cell.r + 13) * 8191);
    cell.hasIsland = rand() < 0.15;
    cell.riverWidth = 0.55 + rand() * 0.065;
    cell.riverShared = NEIGHBOURS.map((_, k) => neighbour(cell, k)?.type === 'Water');
    cell.riverLandSides = NEIGHBOURS.map((_, k) => {
      const n = neighbour(cell, k);
      return !!n && n.type !== 'Water';
    });
    cell.riverCorners = fullCorners.map((c) => c.slice());
    const directions = cell.riverShared.map((v, k) => (v ? k : -1)).filter((k) => k >= 0),
      entry = directions[0] ?? 1,
      exit = directions[1] ?? (entry + 3) % 6;
    cell.riverDirections = [entry, exit];
    const port = (k) => {
      const d = cell.riverShared[k] ? APOTHEM : 1.14;
      return [cell.wx + Math.cos((k * Math.PI) / 3) * d, cell.wz + Math.sin((k * Math.PI) / 3) * d];
    };
    cell.riverCurve = [port(entry), [cell.wx, cell.wz], port(exit)];
  }
  const visited = new Set();
  let componentId = 0;
  for (const start of water) {
    if (visited.has(start.key)) continue;
    const component = [],
      queue = [start];
    visited.add(start.key);
    while (queue.length) {
      const c = queue.shift();
      component.push(c);
      for (let k = 0; k < 6; k++) {
        const next = neighbour(c, k);
        if (next?.type === 'Water' && !visited.has(next.key)) {
          visited.add(next.key);
          queue.push(next);
        }
      }
    }
    const river = {
      id: componentId++,
      channel: [],
      islands: [],
      landEdges: [],
      islandGroups: [],
      phase: randomStream(seed * 19183 + 97)() * 6.28,
    };
    for (const cell of component) {
      cell.river = river;
      const [entry, exit] = cell.riverDirections,
        entryCell = neighbour(cell, entry),
        exitCell = neighbour(cell, exit),
        wa =
          entryCell?.type === 'Water'
            ? (cell.riverWidth + entryCell.riverWidth) / 2
            : cell.riverWidth,
        wb =
          exitCell?.type === 'Water'
            ? (cell.riverWidth + exitCell.riverWidth) / 2
            : cell.riverWidth,
        width = (t) => (1 - t) * (1 - t) * wa + 2 * (1 - t) * t * cell.riverWidth + t * t * wb;
      for (let j = 0; j < 32; j++)
        river.channel.push([
          curvePoint(cell.riverCurve, j / 32),
          curvePoint(cell.riverCurve, (j + 1) / 32),
          width(j / 32),
          width((j + 1) / 32),
        ]);
      for (let sector = 0; sector < 6; sector++) {
        const other = neighbour(cell, (7 - sector) % 6);
        if (!other || other.type === 'Water') continue;
        const a = fullCorners[sector].map((v, i) => v + (i ? cell.wz : cell.wx)),
          b = fullCorners[(sector + 1) % 6].map((v, i) => v + (i ? cell.wz : cell.wx));
        const height = (p) => {
          const h = cornerHeights.get(worldCornerKey(...p));
          return h.reduce((s, v) => s + v, 0) / h.length - 0.2;
        };
        river.landEdges.push([a, b, height(a), height(b)]);
      }
    }
    createIslandGroups(component, river, seed, neighbour);
    for (const cell of component) cell.riverSurface = riverSurface(cell);
  }
  const placed = [];
  for (const settlement of cells.filter((c) => c.type === 'Village')) {
    const nearby = water.filter((c) => hexDistance(c, settlement) <= 2),
      riverIds = [...new Set(nearby.map((c) => c.river.id))];
    settlement.crossingRolls = [];
    for (const riverId of riverIds) {
      const choice = crossingChoice(seed, settlement, riverId);
      settlement.crossingRolls.push({ riverId, kind: choice.kind, roll: choice.roll });
      if (!choice.kind) continue;
      const candidates = nearby
        .filter((c) => c.river.id === riverId)
        .sort(
          (a, b) =>
            hexDistance(a, settlement) - hexDistance(b, settlement) || a.q - b.q || a.r - b.r,
        );
      for (const cell of candidates) {
        if (
          cell.crossing ||
          placed.some(
            (c) =>
              c.river.id === riverId &&
              c.crossing.kind === choice.kind &&
              hexDistance(c, cell) <= 5,
          )
        )
          continue;
        const site = crossingSite(cell);
        if (!site) continue;
        cell.crossing = {
          kind: choice.kind,
          ...site,
          boatPosition: choice.boatPosition,
          material: bridgeMaterialFor(settlement.settlementSize),
          settlementKey: settlement.key,
        };
        placed.push(cell);
        break;
      }
    }
  }
}

function makeLayout(seed) {
  const descriptors = [],
    byKey = new Map();
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) > radius) continue;
      const key = q + ',' + r,
        type = waterKeys.has(key)
          ? 'Water'
          : key === villageKey
            ? 'Village'
            : mountainKeys.has(key)
              ? 'Mountains'
              : forestKeys.has(key)
                ? 'Woodland'
                : 'Meadow';
      const rand = randomStream(
        (seed * 1103515245) ^ ((q + 11) * 73856093) ^ ((r + 11) * 19349663),
      );
      const top =
        type === 'Water'
          ? 0.2
          : type === 'Mountains'
            ? 0.34
            : type === 'Woodland'
              ? [0.34, 0.39, 0.44][Math.floor(rand() * 3)]
              : [0.3, 0.34, 0.44][Math.floor(rand() * 3)];
      const sparse = type === 'Woodland' && rand() < 0.25;
      const cell = {
        key,
        q,
        r,
        wx: Math.sqrt(3) * (q + r / 2),
        wz: 1.5 * r,
        type,
        top,
        sparse,
        links: Array(6).fill(null),
        shared: Array(6).fill(false),
        props: [],
        surface: null,
        tone: rand() > 0.55,
        rand,
      };
      descriptors.push(cell);
      byKey.set(key, cell);
    }
  const neighbour = (cell, k) =>
    byKey.get(cell.q + NEIGHBOURS[k][0] + ',' + (cell.r + NEIGHBOURS[k][1]));
  // Each edge gets one shared decision and one shared crossing point.
  const edgeRand = randomStream(seed * 29009 + 431);
  for (const cell of descriptors) {
    if (cell.type === 'Woodland')
      for (let k = 0; k < 3; k++) {
        const other = neighbour(cell, k);
        if (!other || other.type !== 'Woodland') continue;
        const chance =
          cell.sparse && other.sparse ? 0.1 : cell.sparse || other.sparse ? 0.32 : 0.76;
        if (edgeRand() > chance) continue;
        const cross = (edgeRand() - 0.5) * 0.2,
          scale = 0.66 + edgeRand() * 0.06;
        const link = { cross, scale, variant: Math.floor(edgeRand() * 3) };
        cell.links[k] = link;
        other.links[k + 3] = { ...link, cross: -cross };
      }
    if (cell.type === 'Mountains') {
      cell.shared = NEIGHBOURS.map((_, k) => neighbour(cell, k)?.type === 'Mountains');
      cell.corners = Array.from({ length: 6 }, (_, k) => {
        const r = cell.shared[(7 - k) % 6] || cell.shared[(8 - k) % 6] ? 1 : TOP_RADIUS;
        return [Math.sin((k * Math.PI) / 3) * r, Math.cos((k * Math.PI) / 3) * r];
      });
    }
  }
  // A whole mountain range shares a height field; only its outside perimeter tapers down.
  const visited = new Set();
  for (const start of descriptors) {
    if (start.type !== 'Mountains' || visited.has(start.key)) continue;
    const component = [],
      queue = [start];
    visited.add(start.key);
    while (queue.length) {
      const cell = queue.shift();
      component.push(cell);
      for (let k = 0; k < 6; k++) {
        const other = neighbour(cell, k);
        if (other?.type === 'Mountains' && !visited.has(other.key)) {
          visited.add(other.key);
          queue.push(other);
        }
      }
    }
    const rand = randomStream(seed * 8731 + component.length * 19 + start.q * 743 + start.r * 103),
      range = { phase: rand() * Math.PI * 2, angle: rand() * Math.PI, boundary: [], spines: [] };
    for (const cell of component) {
      for (let sector = 0; sector < 6; sector++)
        if (!cell.shared[(7 - sector) % 6]) {
          const a = cell.corners[sector],
            b = cell.corners[(sector + 1) % 6];
          range.boundary.push([
            [cell.wx + a[0], cell.wz + a[1]],
            [cell.wx + b[0], cell.wz + b[1]],
          ]);
        }
      for (let k = 0; k < 3; k++)
        if (cell.shared[k]) {
          const other = neighbour(cell, k);
          range.spines.push([
            [cell.wx, cell.wz],
            [other.wx, other.wz],
          ]);
        }
      if (!cell.shared.some(Boolean))
        range.spines.push([
          [cell.wx - 0.43 * Math.cos(range.angle), cell.wz - 0.43 * Math.sin(range.angle)],
          [cell.wx + 0.43 * Math.cos(range.angle), cell.wz + 0.43 * Math.sin(range.angle)],
        ]);
    }
    for (const cell of component) cell.surface = ridgeSurface(cell, range);
  }
  prepareRivers(descriptors, seed);
  for (const cell of descriptors) {
    const { rand, type, props } = cell,
      integer = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const linkedDirections = cell.links.map((l, k) => (l ? k : -1)).filter((k) => k >= 0),
      lead = linkedDirections.length
        ? (linkedDirections[integer(0, linkedDirections.length - 1)] * Math.PI) / 3
        : null;
    const cluster = {
      x: (rand() - 0.5) * 0.15 + (lead === null ? -0.1 : 0.2 * Math.cos(lead)),
      z: (rand() - 0.5) * 0.15 + (lead === null ? -0.05 : 0.2 * Math.sin(lead)),
      angle: rand() * Math.PI,
    };
    function tryPlace(kind, x, z, footprint, extra = {}) {
      const inside =
        type === 'Water'
          ? insideRiverTile(cell, x, z, footprint + 0.015)
          : kind === 'tree' && type === 'Woodland'
            ? fitsTree(cell, x, z, footprint)
            : fitsHex(x, z, footprint);
      if (!inside) return false;
      if (type === 'Water') {
        const value = riverLandValue(cell.river, cell.wx + x, cell.wz + z);
        if (kind === 'ripple' ? value > -0.1 : value < footprint + 0.035) return false;
        if (
          cell.crossing &&
          segmentDistance(x, z, cell.crossing.a, cell.crossing.b) < 0.19 + footprint
        )
          return false;
      }
      if (
        !lowProp(kind) &&
        Math.hypot(x - TOKEN_ANCHOR.x, z - TOKEN_ANCHOR.z) < TOKEN_ANCHOR.r + footprint * 0.48
      )
        return false;
      const candidate = { kind, x, z, footprint };
      if (props.some((p) => Math.hypot(x - p.x, z - p.z) < minimumSpacing(candidate, p)))
        return false;
      if (
        extra.zone === 'outlier' &&
        (Math.hypot(x - cluster.x, z - cluster.z) < 0.47 ||
          props.some(
            (p) =>
              p.kind === 'tree' && Math.hypot(x - p.x, z - p.z) < footprint + p.footprint + 0.035,
          ))
      )
        return false;
      const y = cell.surface
        ? surfaceHeight(cell.surface, x, z)
        : type === 'Water' && kind !== 'ripple'
          ? Math.max(0, surfaceHeight(cell.riverSurface, x, z))
          : 0;
      if (extra.flank && (y < 0.025 || y > 0.28)) return false;
      props.push({
        ...candidate,
        y,
        angle: rand() * Math.PI * 2,
        detailSeed: integer(1, 1000000),
        ...extra,
      });
      return true;
    }
    function place(kind, footprint, extra = {}) {
      for (let n = 0; n < 700; n++) {
        const angle = rand() * Math.PI * 2,
          d = Math.sqrt(rand());
        let x, z;
        if (kind === 'tree' && type === 'Woodland' && !cell.sparse && extra.zone !== 'outlier') {
          const rx = 0.47 + (n > 450 ? 0.045 : 0),
            rz = 0.36 + (n > 450 ? 0.035 : 0),
            u = Math.cos(angle) * d * rx,
            v = Math.sin(angle) * d * rz;
          x = cluster.x + u * Math.cos(cluster.angle) - v * Math.sin(cluster.angle);
          z = cluster.z + u * Math.sin(cluster.angle) + v * Math.cos(cluster.angle);
        } else {
          const radius = type === 'Water' ? 0.91 : 0.76;
          x = Math.cos(angle) * d * radius;
          z = Math.sin(angle) * d * radius;
        }
        if (tryPlace(kind, x, z, footprint, extra)) return true;
      }
      return false;
    }
    if (type === 'Woodland') {
      // Close crowns at the boundary, with a short cluster extending inward.
      for (let k = 0; k < 6; k++)
        if (cell.links[k]) {
          const link = cell.links[k],
            a = (k * Math.PI) / 3,
            nx = Math.cos(a),
            nz = Math.sin(a),
            tx = -nz,
            tz = nx;
          for (const inward of cell.sparse ? [0.744] : [0.744, 0.55, 0.36]) {
            const t = link.cross + (inward === 0.744 ? 0 : (rand() - 0.5) * 0.07),
              scale = link.scale;
            tryPlace('tree', nx * inward + tx * t, nz * inward + tz * t, 0.24 * scale, {
              scale,
              variant: link.variant,
              zone: 'edge',
            });
          }
        }
      const species = integer(0, 2),
        count = cell.sparse ? integer(3, 5) : integer(12, 16);
      for (let n = props.length; n < count; n++) {
        const scale = 0.57 + rand() * 0.2;
        place('tree', 0.24 * scale, { scale, variant: species, zone: 'cluster' });
      }
      if (!cell.sparse && rand() < 0.44) {
        const count = integer(1, 2);
        for (let n = 0; n < count; n++) {
          const scale = 0.54 + rand() * 0.14;
          place('tree', 0.24 * scale, { scale, variant: species, zone: 'outlier' });
        }
      }
    }
    if (type === 'Mountains') {
      const count = integer(3, 5);
      for (let n = 0; n < count; n++) {
        const scale = 0.36 + rand() * 0.14;
        place('tree', 0.24 * scale, { scale, variant: 0, flank: true });
      }
    }
    if (type === 'Village') {
      const castle = rand() > 0.35;
      if (castle) place('tower', 0.2, { scale: 0.59 });
      const count = castle ? integer(2, 3) : integer(3, 4),
        orientation = (integer(0, 5) * Math.PI) / 3;
      for (let n = 0; n < count; n++) {
        const scale = 0.49 + rand() * 0.13;
        place('house', 0.36 * scale, {
          scale,
          angle: orientation + (rand() - 0.5) * 0.2,
          variant: integer(0, 2),
        });
      }
    }
    if (type === 'Water') {
      const tangent = curveTangent(cell.riverCurve, 0.5),
        direction = -Math.atan2(tangent[1], tangent[0]),
        count = integer(2, 4);
      for (let n = 0; n < count; n++)
        place('ripple', 0.1, { scale: 0.7 + rand() * 0.5, angle: direction });
      if (rand() < 0.2) {
        if (rand() < 0.55) place('rock', 0.055 + rand() * 0.025, { variant: integer(0, 2) });
        else place('grass', 0.045, { scale: 0.6 + rand() * 0.2, variant: 0 });
      }
    } else {
      const rockCount =
          type === 'Meadow' ? integer(1, 3) : type === 'Mountains' ? integer(1, 2) : integer(0, 2),
        grassCount = integer(1, 2);
      for (let n = 0; n < rockCount; n++) {
        const footprint = 0.065 + rand() * 0.045;
        place('rock', footprint, { variant: integer(0, 2) });
      }
      for (let n = 0; n < grassCount; n++)
        place('grass', 0.065, { scale: 0.7 + rand() * 0.4, variant: integer(0, 2) });
      if (!props.length) place('grass', 0.065, { scale: 1, variant: 0 });
    }
    delete cell.rand;
  }
  return descriptors;
}

export {
  randomStream,
  fitsHex,
  fitsTree,
  smoothstep,
  segmentDistance,
  ridgeHeight,
  ridgeSurface,
  surfaceHeight,
  lowProp,
  minimumSpacing,
  hexDistance,
  curvePoint,
  curveTangent,
  tubeValue,
  riverBankValue,
  riverIslandValue,
  riverLandValue,
  riverBankHeight,
  riverGroundHeight,
  insideRiverTile,
  riverSurface,
  bridgeMaterialFor,
  crossingChoice,
  crossingSite,
  createIslandGroups,
  prepareRivers,
  makeLayout,
  TOP_RADIUS,
  PROP_GAP,
  TOKEN_ANCHOR,
  NEIGHBOURS,
  APOTHEM,
};
