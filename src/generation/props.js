import { DIRECTIONS, neighbours, distance } from './hex.js';
import { randomFor } from './seed.js';
import { fitsHex, fitsTree, minimumSpacing, lowProp } from './legacy.js';
import { surfaceHeight } from './math.js';
import { POI_ANCHOR } from './points-of-interest.js';

export const TOKEN_ANCHOR = { x: 0.5, z: 0.16, r: 0.1 };
const forest = (cell) => cell.terrain === 'light forest' || cell.terrain === 'dense forest';

export function generatePropDressing(world, variant, mountainSurfaces) {
  const states = world.cells.map((cell) => {
    const random = randomFor(world.seed, `props:${variant}:${cell.key}`);
    return {
      ...cell,
      random,
      props: [],
      links: Array(6).fill(null),
      sparse: random() < (cell.terrain === 'dense forest' ? 0.1 : 0.32),
    };
  });
  const byKey = new Map(states.map((cell) => [cell.key, cell]));
  const waveDirection = randomFor(world.seed, 'water-wave-direction')() * Math.PI * 2;
  const waveSites = [];
  const mouths = new Set(
    world.cells.filter((cell) => cell.water === 'river').map((cell) => cell.downstream),
  );
  const edges = randomFor(world.seed, `forest-edges:${variant}`);
  for (const cell of states) {
    if (!forest(cell) || cell.pointOfLight) continue;
    for (let k = 0; k < 3; k++) {
      const [q, r] = DIRECTIONS[k];
      const other = byKey.get(`${cell.q + q},${cell.r + r}`);
      if (!other || !forest(other) || other.pointOfLight || other.elevation !== cell.elevation)
        continue;
      const chance =
        cell.sparse && other.sparse
          ? 0.1
          : cell.terrain === 'dense forest' && other.terrain === 'dense forest'
            ? 0.82
            : 0.4;
      if (edges() > chance) continue;
      const link = {
        cross: (edges() - 0.5) * 0.2,
        scale: 0.66 + edges() * 0.06,
        variant: edges() < 0.5 ? cell.treeVariant : other.treeVariant,
      };
      cell.links[k] = link;
      other.links[k + 3] = { ...link, cross: -link.cross };
    }
  }
  return states.map((cell) => {
    const random = cell.random;
    const integer = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const props = cell.props;
    const surface = mountainSurfaces.get(cell.key)?.surface;
    for (const poi of cell.pointsOfInterest) {
      const heights = Array.from({ length: 12 }, (_, k) =>
        surface
          ? surfaceHeight(
              surface,
              POI_ANCHOR.x + Math.cos((k * Math.PI) / 6) * POI_ANCHOR.r,
              POI_ANCHOR.z + Math.sin((k * Math.PI) / 6) * POI_ANCHOR.r,
            )
          : 0,
      );
      heights.push(surface ? surfaceHeight(surface, POI_ANCHOR.x, POI_ANCHOR.z) : 0);
      props.push({
        kind: 'poi',
        poiKind: poi.kind,
        variant: poi.variant,
        detailSeed: poi.detailSeed,
        temperature: poi.temperature,
        x: POI_ANCHOR.x,
        z: POI_ANCHOR.z,
        y: Math.max(...heights),
        footprint: POI_ANCHOR.r,
        pedestalDepth: Math.max(...heights) - Math.min(...heights) + 0.035,
      });
    }
    const linked = cell.links.findIndex(Boolean);
    const lead = linked < 0 ? null : (linked * Math.PI) / 3;
    const cluster = {
      x: (random() - 0.5) * 0.15 + (lead === null ? -0.1 : 0.2 * Math.cos(lead)),
      z: (random() - 0.5) * 0.15 + (lead === null ? -0.05 : 0.2 * Math.sin(lead)),
      angle: random() * Math.PI,
    };
    function tryPlace(kind, x, z, footprint, extra = {}) {
      if (
        !(kind === 'tree' && forest(cell) && !cell.pointOfLight
          ? fitsTree(cell, x, z, footprint)
          : fitsHex(x, z, footprint))
      )
        return false;
      if (
        !lowProp(kind) &&
        Math.hypot(x - TOKEN_ANCHOR.x, z - TOKEN_ANCHOR.z) < TOKEN_ANCHOR.r + footprint * 0.48
      )
        return false;
      const candidate = { kind, x, z, footprint };
      // Even low props yield their entire footprint to the POI corner.
      if (
        props.some(
          (prop) =>
            prop.kind === 'poi' &&
            Math.hypot(x - prop.x, z - prop.z) <
              footprint + prop.footprint + (kind === 'tree' ? 0.14 : 0.025),
        )
      )
        return false;
      if (
        props.some((prop) => Math.hypot(x - prop.x, z - prop.z) < minimumSpacing(candidate, prop))
      )
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
      const y = surface ? surfaceHeight(surface, x, z) : 0;
      if (extra.flank && (y < 0.025 || y > 0.18)) return false;
      const species = extra.variant ?? cell.treeVariant;
      const temperature =
        cell.pointOfLight || cell.terrain === 'farmlands'
          ? 1
          : cell.terrain === 'wetlands'
            ? -1
            : kind === 'tree'
              ? species === 1
                ? 1
                : -1
              : 0;
      props.push({
        ...candidate,
        y,
        angle: random() * Math.PI * 2,
        detailSeed: integer(1, 1000000),
        temperature: (temperature * integer(0, 3)) / 3,
        ...extra,
      });
      return true;
    }
    function place(kind, footprint, extra = {}) {
      for (let attempt = 0; attempt < 420; attempt++) {
        const angle = random() * Math.PI * 2,
          d = Math.sqrt(random());
        let x, z;
        if (
          kind === 'tree' &&
          forest(cell) &&
          !cell.pointOfLight &&
          !cell.sparse &&
          extra.zone !== 'outlier'
        ) {
          const u = Math.cos(angle) * d * (attempt > 250 ? 0.515 : 0.47),
            v = Math.sin(angle) * d * (attempt > 250 ? 0.395 : 0.36);
          x = cluster.x + u * Math.cos(cluster.angle) - v * Math.sin(cluster.angle);
          z = cluster.z + u * Math.sin(cluster.angle) + v * Math.cos(cluster.angle);
        } else {
          x = Math.cos(angle) * d * 0.76;
          z = Math.sin(angle) * d * 0.76;
        }
        if (tryPlace(kind, x, z, footprint, extra)) return true;
      }
      return false;
    }
    if (cell.water) {
      if (
        cell.water !== 'river' &&
        !mouths.has(cell.key) &&
        random() < 0.22 &&
        neighbours(cell, byKey).filter((next) => next.water === 'ocean' || next.water === 'lake')
          .length >= 2 &&
        waveSites.every((other) => distance(cell, other) >= 2)
      ) {
        props.push({
          kind: 'wave',
          x: 0,
          y: 0.008,
          z: 0,
          footprint: 0.5,
          scale: 1,
          angle: waveDirection,
          phase: random(),
          temperature: 0,
          detailSeed: integer(1, 1000000),
        });
        waveSites.push(cell);
      }
      return {
        key: cell.key,
        placementSeed: integer(0, 4294967295),
        props,
        links: cell.links,
        sparse: cell.sparse,
      };
    }
    if (cell.pointOfLight) {
      const { type, id, centre } = cell.pointOfLight;
      const orientation =
        (Math.floor(randomFor(world.seed, `settlement-angle:${id}:${variant}`)() * 6) * Math.PI) /
        3;
      if (type === 'city' && centre) place('hall', 0.25, { scale: 0.75 });
      else if (type === 'town' || (type === 'village' && random() < 0.35))
        place('tower', 0.16, { scale: 0.55 });
      const count = type === 'city' ? (centre ? 12 : 10) : type === 'town' ? 8 : 4;
      for (let n = 0; n < count; n++) {
        const scale =
          type === 'city'
            ? 0.36 + random() * 0.08
            : type === 'town'
              ? 0.42 + random() * 0.1
              : 0.49 + random() * 0.13;
        place('house', 0.36 * scale, {
          scale,
          variant: integer(0, 2),
          angle: orientation + (random() - 0.5) * 0.2,
        });
      }
    } else if (forest(cell)) {
      for (let k = 0; k < 6; k++) {
        const link = cell.links[k];
        if (!link) continue;
        const angle = (k * Math.PI) / 3,
          nx = Math.cos(angle),
          nz = Math.sin(angle);
        for (const inward of cell.sparse ? [0.744] : [0.744, 0.55, 0.36]) {
          const cross = link.cross + (inward === 0.744 ? 0 : (random() - 0.5) * 0.07);
          tryPlace('tree', nx * inward - nz * cross, nz * inward + nx * cross, 0.24 * link.scale, {
            scale: link.scale,
            variant: link.variant,
            zone: 'edge',
          });
        }
      }
      const count = cell.sparse
        ? integer(3, 5)
        : cell.terrain === 'dense forest'
          ? integer(12, 16)
          : integer(6, 9);
      for (let n = props.length; n < count; n++) {
        const scale = 0.57 + random() * 0.2;
        const species = cell.treeVariant === 0 && random() < 0.2 ? 2 : cell.treeVariant;
        place('tree', 0.24 * scale, { scale, variant: species, zone: 'cluster' });
      }
      if (!cell.sparse && random() < 0.44) {
        const scale = 0.54 + random() * 0.14;
        place('tree', 0.24 * scale, { scale, variant: cell.treeVariant, zone: 'outlier' });
      }
    } else if (cell.terrain === 'wetlands') {
      for (let n = 0, count = integer(2, 3); n < count; n++) {
        const footprint = 0.16 + random() * 0.12;
        place('puddle', footprint, { scale: 1, variant: integer(0, 2) });
      }
      for (let n = 0, count = integer(4, 7); n < count; n++)
        place('reeds', 0.065, { scale: 0.8 + random() * 0.3, variant: integer(0, 2) });
      if (random() < 0.25) place('tree', 0.12, { scale: 0.5, variant: 1 });
    } else if (cell.terrain === 'farmlands') {
      for (let n = 0, count = integer(2, 3); n < count; n++) {
        const scale = 0.85 + random() * 0.2;
        place('crops', 0.28 * scale, {
          scale,
          angle: (Math.floor(random() * 3) * Math.PI) / 3,
          variant: integer(0, 2),
        });
      }
      if (random() < 0.25) place('tree', 0.12, { scale: 0.5, variant: cell.treeVariant });
    } else if (surface) {
      for (let n = 0; n < 3; n++) {
        const scale = 0.36 + random() * 0.14;
        place('tree', 0.24 * scale, { scale, variant: 0, flank: true });
      }
    }
    const rockCount = cell.terrain === 'meadow' ? integer(1, 3) : integer(0, 2);
    for (let n = 0; n < rockCount; n++)
      place('rock', 0.065 + random() * 0.045, { variant: integer(0, 2) });
    for (let n = 0, count = integer(1, 2); n < count; n++)
      place('grass', 0.065, { scale: 0.7 + random() * 0.4, variant: integer(0, 2) });
    return {
      key: cell.key,
      placementSeed: integer(0, 4294967295),
      props,
      links: cell.links,
      sparse: cell.sparse,
    };
  });
}
