import * as THREE from 'three';
import './styles.css';
import { villageKey } from './map-data.js';
import {
  randomStream,
  surfaceHeight,
  riverBankValue,
  riverIslandValue,
  riverLandValue,
  riverBankHeight,
  riverSurface,
  makeLayout,
  TOP_RADIUS,
} from './generation.js';

(() => {
  const root = document.getElementById('hex-smooth-riverlands');
  const host = root.querySelector('#hp-scene'),
    loading = root.querySelector('#hp-loading');
  if (typeof THREE === 'undefined') {
    loading.textContent = 'The 3D scene could not load. Please reopen the preview.';
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
    });
  } catch (error) {
    loading.textContent = 'This preview needs WebGL support.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive isometric hex landscape with linked forest clusters, sparse woodland, continuous mountain ranges, a river with smooth banks, terrain-height cliffs, shaped island groups, and an optional wooden bridge or two ferry docks with a boat near the village. Select hexes using the list below; regenerate to vary the landscape.',
  );
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 90);
  camera.position.set(11, 14, 17);
  camera.lookAt(0, 0.3, 0);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x777777, 1.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-5, 12, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 1,
    far: 35,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  scene.add(sun);
  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShadowMaterial({ opacity: 0.17 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.12;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);
  const palettes = {
    dusk: ['#282039', '#237d89', '#e5b96e'],
    ember: ['#322333', '#2a6775', '#ed8965'],
    moss: ['#1e302c', '#477480', '#dad2a4'],
    alien: ['#30204c', '#d45b9d', '#bcf249'],
  };
  let seeds = palettes.dusk.slice();
  function linear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function encoded(v) {
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }
  function fromHex(hex) {
    const rgb = [1, 3, 5].map((n) => linear(parseInt(hex.slice(n, n + 2), 16) / 255));
    const [r, g, b] = rgb;
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
      m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
      s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function rgbOf(L, C, H) {
    const a = C * Math.cos(H),
      b = C * Math.sin(H);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3),
      m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3),
      s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }
  function color(index, L, Cscale = 1) {
    const seed = fromHex(seeds[index]);
    let C = seed[1] * Cscale;
    let rgb = rgbOf(Math.max(0.04, Math.min(0.96, L)), C, seed[2]);
    for (let n = 0; n < 25 && rgb.some((v) => v < 0 || v > 1); n++) {
      C *= 0.9;
      rgb = rgbOf(L, C, seed[2]);
    }
    return (
      '#' +
      rgb
        .map((v) =>
          Math.round(Math.max(0, Math.min(1, encoded(v))) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  }
  const materials = {};
  const roles = {
    ground: [0, 0.39, 1.1],
    groundLight: [0, 0.42, 0.95],
    side: [0, 0.26, 1],
    bevel: [0, 0.46, 0.9],
    water: [1, 0.48, 1.1],
    waterEdge: [1, 0.58, 0.85],
    waterDeep: [1, 0.33, 1],
    leaf: [2, 0.68, 1],
    leafLight: [2, 0.77, 0.85],
    leafDark: [2, 0.51, 0.9],
    trunk: [2, 0.32, 0.65],
    rock: [2, 0.65, 0.35],
    rockLight: [2, 0.82, 0.25],
    rockMid: [2, 0.55, 0.45],
    grass: [2, 0.63, 0.8],
    ridge: [0, 0.43, 0.8],
    ridgeLight: [0, 0.5, 0.55],
    ridgeDark: [0, 0.35, 0.85],
    ridgeMeadow: [0, 0.39, 1.1],
    wall: [2, 0.79, 0.4],
    roof: [2, 0.49, 1.1],
    roofLight: [2, 0.62, 1],
    door: [2, 0.26, 0.6],
    riverShore: [0, 0.35, 0.85],
    riverGround: [0, 0.39, 1.1],
    riverCliff: [0, 0.32, 0.9],
    bridgeWood: [2, 0.61, 0.7],
    bridgeLight: [2, 0.74, 0.65],
    bridgeDark: [2, 0.35, 0.65],
    rope: [2, 0.76, 0.4],
    active: [2, 0.94, 0.55],
  };
  Object.entries(roles).forEach(
    ([key, args]) =>
      (materials[key] = new THREE.MeshStandardMaterial({
        color: color(...args),
        roughness: 1,
        metalness: 0,
        flatShading: true,
      })),
  );
  materials.riverGround.flatShading = false;
  materials.riverCliff.flatShading = false;
  materials.grass.side = THREE.DoubleSide;
  materials.rock.side = THREE.DoubleSide;
  materials.rockMid.side = THREE.DoubleSide;
  materials.rockLight.side = THREE.DoubleSide;
  materials.line = new THREE.MeshBasicMaterial({
    color: color(2, 0.94, 0.55),
    side: THREE.DoubleSide,
  });
  materials.hover = new THREE.MeshBasicMaterial({
    color: color(2, 0.83, 0.4),
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const map = new THREE.Group();
  scene.add(map);
  const cells = [];
  let generation = 1;

  function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function geometryFrom(points) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    g.computeVertexNormals();
    return g;
  }
  function bevelTile(height, isWater, corners = null, shared = null) {
    const rings = isWater
      ? [
          [0.97, 0],
          [0.995, 0.025],
          [0.995, height - 0.025],
          [0.976, height],
        ]
      : [
          [0.955, 0],
          [0.995, 0.045],
          [0.995, height - 0.075],
          [TOP_RADIUS, height],
        ];
    const points = [],
      groups = [];
    const p = (radius, y, k, top = false) =>
      top && corners
        ? [corners[k % 6][0], y, corners[k % 6][1]]
        : [Math.sin((k * Math.PI) / 3) * radius, y, Math.cos((k * Math.PI) / 3) * radius];
    for (let j = 0; j < rings.length - 1; j++) {
      const start = points.length / 3;
      for (let k = 0; k < 6; k++) {
        if (shared && shared[(7 - k) % 6]) continue;
        const a = p(...rings[j], k),
          b = p(...rings[j], k + 1),
          c = p(...rings[j + 1], k, j === 2),
          d = p(...rings[j + 1], k + 1, j === 2);
        points.push(...a, ...b, ...c, ...b, ...d, ...c);
      }
      groups.push({ start, count: points.length / 3 - start, materialIndex: j === 2 ? 1 : 0 });
    }
    if (!corners) {
      const start = points.length / 3;
      for (let k = 0; k < 6; k++)
        points.push(0, height, 0, ...p(...rings[3], k), ...p(...rings[3], k + 1));
      groups.push({ start, count: 18, materialIndex: 2 });
    }
    const geo = geometryFrom(points);
    groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
    return geo;
  }
  function makeTree(parent, prop) {
    const g = new THREE.Group();
    g.position.set(prop.x, prop.y || 0, prop.z);
    g.rotation.y = prop.angle;
    g.scale.setScalar(prop.scale);
    addMesh(g, new THREE.CylinderGeometry(0.025, 0.04, 0.29, 5), materials.trunk, 0, 0.145, 0);
    if (prop.variant === 1) {
      const crown = addMesh(g, new THREE.DodecahedronGeometry(0.23, 0), materials.leaf, 0, 0.52, 0);
      crown.scale.set(1, 1.25, 0.9);
      addMesh(g, new THREE.DodecahedronGeometry(0.16, 0), materials.leafLight, 0, 0.73, 0);
    } else {
      addMesh(
        g,
        new THREE.ConeGeometry(0.24, 0.53, prop.variant === 2 ? 6 : 5),
        materials.leafDark,
        0,
        0.47,
        0,
      );
      addMesh(
        g,
        new THREE.ConeGeometry(
          prop.variant === 2 ? 0.16 : 0.19,
          prop.variant === 2 ? 0.63 : 0.49,
          5,
        ),
        materials.leaf,
        0,
        prop.variant === 2 ? 0.75 : 0.7,
        0,
      );
    }
    parent.add(g);
  }
  function makeRidge(parent, surface) {
    const points = [],
      groups = [],
      buckets = [[], [], [], []];
    for (const face of surface.triangles) {
      const [a, b, c] = face.map((i) => surface.vertices[i]),
        ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ],
        up = normal[1] / Math.hypot(...normal),
        height = (a[1] + b[1] + c[1]) / 3;
      const materialIndex = height < 0.14 ? 3 : up < 0.67 ? 2 : height > 0.48 ? 1 : 0;
      buckets[materialIndex].push(...a, ...b, ...c);
    }
    buckets.forEach((bucket, materialIndex) => {
      if (bucket.length) {
        groups.push({ start: points.length / 3, count: bucket.length / 3, materialIndex });
        points.push(...bucket);
      }
    });
    const geo = geometryFrom(points);
    groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
    addMesh(parent, geo, [
      materials.ridge,
      materials.ridgeLight,
      materials.ridgeDark,
      materials.ridgeMeadow,
    ]);
  }
  function roofGeometry(w, d, h) {
    const a = [-w / 2, 0, -d / 2],
      b = [w / 2, 0, -d / 2],
      c = [0, h, -d / 2],
      d0 = [-w / 2, 0, d / 2],
      e = [w / 2, 0, d / 2],
      f = [0, h, d / 2];
    return geometryFrom([
      ...a,
      ...c,
      ...b,
      ...d0,
      ...e,
      ...f,
      ...a,
      ...d0,
      ...f,
      ...a,
      ...f,
      ...c,
      ...b,
      ...c,
      ...f,
      ...b,
      ...f,
      ...e,
    ]);
  }
  function makeHouse(parent, prop) {
    const g = new THREE.Group();
    g.position.set(prop.x, prop.y || 0, prop.z);
    g.rotation.y = prop.angle;
    g.scale.setScalar(prop.scale);
    const height = prop.variant === 2 ? 0.43 : 0.33;
    addMesh(g, new THREE.BoxGeometry(0.36, height, 0.45), materials.wall, 0, height / 2, 0);
    const roof = addMesh(
      g,
      roofGeometry(0.46, 0.55, prop.variant === 1 ? 0.19 : 0.27),
      prop.variant === 1 ? materials.roofLight : materials.roof,
      0,
      height,
      0,
    );
    roof.material.side = THREE.DoubleSide;
    addMesh(g, new THREE.BoxGeometry(0.09, 0.18, 0.012), materials.door, 0.06, 0.09, 0.232);
    if (prop.variant === 2)
      addMesh(
        g,
        new THREE.BoxGeometry(0.065, 0.2, 0.07),
        materials.wall,
        -0.1,
        height + 0.14,
        -0.08,
      );
    parent.add(g);
  }
  function makeTower(parent, prop) {
    const g = new THREE.Group();
    g.position.set(prop.x, prop.y || 0, prop.z);
    g.rotation.y = prop.angle;
    g.scale.setScalar(prop.scale);
    addMesh(g, new THREE.CylinderGeometry(0.22, 0.25, 0.67, 6), materials.wall, 0, 0.335, 0);
    addMesh(g, new THREE.ConeGeometry(0.33, 0.39, 6), materials.roof, 0, 0.865, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.24, 0.015), materials.door, 0, 0.12, 0.22);
    parent.add(g);
  }
  function makeRock(parent, prop) {
    const rand = randomStream(prop.detailSeed),
      geo =
        prop.variant === 1
          ? new THREE.IcosahedronGeometry(1, 0)
          : new THREE.DodecahedronGeometry(1, 0);
    const mesh = addMesh(
      parent,
      geo,
      prop.variant === 2 ? materials.rockMid : materials.rock,
      prop.x,
      (prop.y || 0) + prop.footprint * 0.33,
      prop.z,
    );
    mesh.scale.set(
      prop.footprint * (0.8 + rand() * 0.2),
      prop.footprint * (0.48 + rand() * 0.22),
      prop.footprint * (0.65 + rand() * 0.25),
    );
    mesh.rotation.y = prop.angle;
  }
  function makeGrass(parent, prop) {
    const rand = randomStream(prop.detailSeed),
      vertices = [];
    const blades = 3 + prop.variant;
    for (let n = 0; n < blades; n++) {
      const a = (n * Math.PI * 2) / blades + prop.angle,
        bx = Math.cos(a) * 0.025,
        bz = Math.sin(a) * 0.025,
        h = (0.11 + rand() * 0.08) * prop.scale,
        lean = 0.02 + rand() * 0.015;
      vertices.push(
        bx - 0.014,
        0,
        bz,
        bx + 0.014,
        0,
        bz,
        bx + Math.cos(a) * lean,
        h,
        bz + Math.sin(a) * lean,
      );
    }
    const geo = geometryFrom(vertices);
    const mesh = addMesh(parent, geo, materials.grass, prop.x, prop.y || 0, prop.z);
    mesh.castShadow = false;
  }
  function smoothTerrainGeometry(surface, cell) {
    const geometry = new THREE.BufferGeometry(),
      points = surface.vertices.flat(),
      normals = [];
    for (const [x, y, z] of surface.vertices) {
      const wx = x + cell.wx,
        wz = z + cell.wz;
      if (riverIslandValue(cell.river, wx, wz) > riverBankValue(cell.river, wx, wz)) {
        normals.push(0, 1, 0);
        continue;
      }
      const e = 0.002,
        dx =
          (riverBankHeight(cell.river, wx + e, wz) - riverBankHeight(cell.river, wx - e, wz)) /
          (2 * e),
        dz =
          (riverBankHeight(cell.river, wx, wz + e) - riverBankHeight(cell.river, wx, wz - e)) /
          (2 * e),
        length = Math.hypot(dx, 1, dz);
      normals.push(-dx / length, 1 / length, -dz / length);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(surface.triangles.flat());
    return geometry;
  }
  function makeLandBankJoin(parent, data) {
    if (!data.shoreCornerHeights) return;
    const points = [];
    for (let sector = 0; sector < 6; sector++)
      if (data.shoreLinks[(7 - sector) % 6]) {
        const corner = (k, outer) => {
          k %= 6;
          const a = (k * Math.PI) / 3,
            x = outer ? Math.sin(a) : data.corners ? data.corners[k][0] : Math.sin(a) * TOP_RADIUS,
            z = outer ? Math.cos(a) : data.corners ? data.corners[k][1] : Math.cos(a) * TOP_RADIUS,
            y = outer
              ? data.shoreCornerHeights[k] - data.top
              : data.surface
                ? surfaceHeight(data.surface, x, z)
                : 0;
          return [x, y, z];
        };
        const a = corner(sector, false),
          b = corner(sector + 1, false),
          c = corner(sector, true),
          d = corner(sector + 1, true);
        points.push(...a, ...c, ...d, ...a, ...d, ...b);
      }
    if (points.length) addMesh(parent, geometryFrom(points), materials.riverGround);
  }
  function makeRiver(parent, data) {
    const surface = data.riverSurface,
      water = [],
      cliffs = [],
      normals = [];
    if (surface.triangles.length)
      addMesh(parent, smoothTerrainGeometry(surface, data), materials.riverGround);
    for (let k = 0; k < 6; k++) {
      const a = data.riverCorners[k],
        b = data.riverCorners[(k + 1) % 6];
      water.push(0, 0, 0, a[0], 0, a[1], b[0], 0, b[1]);
    }
    const waterMesh = addMesh(parent, geometryFrom(water), materials.water);
    waterMesh.castShadow = false;
    function normal(p) {
      const x = data.wx + p[0],
        z = data.wz + p[2],
        e = 0.002,
        dx = riverLandValue(data.river, x + e, z) - riverLandValue(data.river, x - e, z),
        dz = riverLandValue(data.river, x, z + e) - riverLandValue(data.river, x, z - e),
        length = Math.hypot(dx, dz) || 1;
      return [-dx / length, 0, -dz / length];
    }
    function wall(a, b, na = normal(a), nb = normal(b)) {
      if ((b[2] - a[2]) * na[0] - (b[0] - a[0]) * na[2] < 0) {
        [a, b] = [b, a];
        [na, nb] = [nb, na];
      }
      const c = [a[0], -0.008, a[2]],
        d = [b[0], -0.008, b[2]];
      cliffs.push(...a, ...b, ...c, ...b, ...d, ...c);
      normals.push(...na, ...nb, ...na, ...nb, ...nb, ...na);
    }
    for (const [a, b] of surface.shore) wall(a, b);
    // At the map edge, close exposed land. At neighbouring land, only close a
    // water-reaching section; otherwise the matching bank and land form one top.
    for (let k = 0; k < 6; k++)
      if (!data.riverShared[(7 - k) % 6]) {
        const a = data.riverCorners[k],
          b = data.riverCorners[(k + 1) % 6],
          land = data.riverLandSides[(7 - k) % 6],
          at = (t) => {
            const x = a[0] + (b[0] - a[0]) * t,
              z = a[1] + (b[1] - a[1]) * t;
            return { x, z, v: riverLandValue(data.river, data.wx + x, data.wz + z) };
          };
        for (let j = 0; j < 28; j++) {
          let p = at(j / 28),
            q = at((j + 1) / 28);
          const keep = (v) => (land ? v < 0 : v >= 0);
          if (!keep(p.v) && !keep(q.v)) continue;
          if (keep(p.v) !== keep(q.v)) {
            const t = p.v / (p.v - q.v),
              m = { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, v: 0 };
            if (keep(p.v)) q = m;
            else p = m;
          }
          const point = (p) => [
              p.x,
              riverBankHeight(data.river, data.wx + p.x, data.wz + p.z),
              p.z,
            ],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            length = Math.hypot(dx, dz),
            n = land ? [-dz / length, 0, dx / length] : [dz / length, 0, -dx / length];
          wall(point(p), point(q), n, n);
        }
      }
    if (cliffs.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(cliffs, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      addMesh(parent, g, materials.riverCliff);
    }
    if (data.crossing) makeCrossing(parent, data.crossing);
  }
  function timberBetween(parent, a, b, width, material) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = new THREE.Vector3().subVectors(end, start),
      mesh = addMesh(parent, new THREE.CylinderGeometry(width, width, delta.length(), 5), material);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }
  function makeStoneBridge(parent, length, heights) {
    const arch = (t) => heights[0] * (1 - t) + heights[1] * t + 0.025 + 0.1 * Math.sin(Math.PI * t),
      points = [];
    for (let j = 0; j < 20; j++) {
      const ta = j / 20,
        tb = (j + 1) / 20,
        xa = (ta - 0.5) * length,
        xb = (tb - 0.5) * length,
        ya = arch(ta),
        yb = arch(tb);
      const a = [xa, ya, -0.125],
        b = [xb, yb, -0.125],
        c = [xa, ya, 0.125],
        d = [xb, yb, 0.125];
      points.push(...a, ...c, ...b, ...b, ...c, ...d);
      for (const sign of [-1, 1]) {
        const z = sign * 0.125,
          lowA = ya - 0.085,
          lowB = yb - 0.085;
        points.push(xa, ya, z, xb, yb, z, xa, lowA, z, xb, yb, z, xb, lowB, z, xa, lowA, z);
      }
    }
    const mesh = addMesh(parent, geometryFrom(points), materials.rock);
    mesh.material.side = THREE.DoubleSide;
    for (const side of [-1, 1])
      for (let j = 0; j < 9; j++) {
        const t = (j + 0.5) / 9;
        addMesh(
          parent,
          new THREE.BoxGeometry((length / 9) * 0.98, 0.06, 0.035),
          materials.rockLight,
          (t - 0.5) * length,
          arch(t) + 0.025,
          side * 0.13,
        );
      }
    for (const side of [-1, 1]) {
      const y = heights[side === -1 ? 0 : 1] + 0.045;
      addMesh(
        parent,
        new THREE.BoxGeometry(0.12, y, 0.27),
        materials.rockMid,
        side * (length / 2 - 0.06),
        y / 2,
        0,
      );
    }
  }
  function makeCrossing(parent, crossing) {
    const { a, b } = crossing,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      g = new THREE.Group();
    g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    g.rotation.y = -Math.atan2(dz, dx);
    g.userData.crossing = crossing.kind;
    parent.add(g);
    if (crossing.kind === 'bridge') {
      if (crossing.material === 'stone') {
        makeStoneBridge(g, length, crossing.heights);
        return;
      }
      const count = Math.ceil(length / 0.085),
        arch = (t) =>
          crossing.heights[0] * (1 - t) +
          crossing.heights[1] * t +
          0.02 +
          0.075 * Math.sin(t * Math.PI);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count;
        addMesh(
          g,
          new THREE.BoxGeometry((length / count) * 0.94, 0.028, 0.225),
          j % 3 === 0 ? materials.bridgeLight : materials.bridgeWood,
          (t - 0.5) * length,
          arch(t),
          0,
        );
      }
      for (const z of [-0.127, 0.127]) {
        for (let j = 0; j < 5; j++) {
          const t = j / 4,
            x = (t - 0.5) * length,
            y = arch(t);
          addMesh(
            g,
            new THREE.CylinderGeometry(0.012, 0.014, 0.15, 5),
            materials.bridgeDark,
            x,
            y + 0.065,
            z,
          );
          if (j < 4) {
            const t2 = (j + 1) / 4;
            timberBetween(
              g,
              [x, y + 0.13, z],
              [(t2 - 0.5) * length, arch(t2) + 0.13, z],
              0.01,
              materials.bridgeLight,
            );
          }
        }
        for (let j = 0; j < 4; j++) {
          const t = j / 4,
            t2 = (j + 1) / 4;
          timberBetween(
            g,
            [(t - 0.5) * length, arch(t) - 0.035, z * 0.65],
            [(t2 - 0.5) * length, arch(t2) - 0.035, z * 0.65],
            0.018,
            materials.bridgeDark,
          );
        }
      }
      for (const t of [0.24, 0.76])
        for (const z of [-0.085, 0.085]) {
          const height = arch(t) - 0.02;
          addMesh(
            g,
            new THREE.CylinderGeometry(0.018, 0.024, height, 5),
            materials.bridgeDark,
            (t - 0.5) * length,
            height / 2,
            z,
          );
        }
    } else {
      for (const sign of [-1, 1]) {
        const dock = new THREE.Group();
        dock.userData.prop = 'dock';
        g.add(dock);
        const x = (sign * length) / 2,
          bank = crossing.heights[sign === -1 ? 0 : 1],
          height = bank + 0.018;
        for (let j = 0; j < 7; j++)
          addMesh(
            dock,
            new THREE.BoxGeometry(0.039, 0.025, 0.23),
            j % 2 ? materials.bridgeWood : materials.bridgeLight,
            x - sign * (j * 0.037),
            height,
            0,
          );
        for (const d of [0.025, 0.215])
          for (const z of [-0.095, 0.095]) {
            const h = height + 0.045;
            addMesh(
              dock,
              new THREE.CylinderGeometry(0.014, 0.018, h, 5),
              materials.bridgeDark,
              x - sign * d,
              h / 2,
              z,
            );
          }
        timberBetween(
          dock,
          [x, height - 0.028, -0.075],
          [x - sign * 0.24, height - 0.028, -0.075],
          0.015,
          materials.bridgeDark,
        );
        timberBetween(
          dock,
          [x, height - 0.028, 0.075],
          [x - sign * 0.24, height - 0.028, 0.075],
          0.015,
          materials.bridgeDark,
        );
      }
      const boat = new THREE.Group();
      boat.userData.prop = 'ferry';
      boat.position.x = (crossing.boatPosition - 0.5) * length;
      g.add(boat);
      const outline = [
          [-0.18, 0],
          [-0.11, -0.13],
          [0.12, -0.13],
          [0.19, 0],
          [0.12, 0.13],
          [-0.11, 0.13],
        ],
        hull = [];
      for (let k = 0; k < 6; k++) {
        const a = outline[k],
          b = outline[(k + 1) % 6],
          bottomA = [a[0] * 0.74, 0.008, a[1] * 0.74],
          bottomB = [b[0] * 0.74, 0.008, b[1] * 0.74],
          topA = [a[0], 0.072, a[1]],
          topB = [b[0], 0.072, b[1]];
        hull.push(...bottomA, ...topA, ...bottomB, ...bottomB, ...topA, ...topB);
      }
      const hullMesh = addMesh(boat, geometryFrom(hull), materials.bridgeDark);
      hullMesh.material.side = THREE.DoubleSide;
      for (let j = 0; j < 6; j++)
        addMesh(
          boat,
          new THREE.BoxGeometry(0.041, 0.019, 0.2),
          j % 2 ? materials.bridgeLight : materials.bridgeWood,
          -0.11 + j * 0.044,
          0.05,
          0,
        );
      for (const x of [-0.08, 0.085])
        addMesh(boat, new THREE.BoxGeometry(0.035, 0.025, 0.21), materials.bridgeWood, x, 0.088, 0);
      timberBetween(boat, [-0.13, 0.105, 0.04], [0.19, 0.105, 0.17], 0.008, materials.bridgeLight);
    }
  }

  function buildMap(seed) {
    const old = new Set();
    map.traverse((o) => {
      if (o.geometry) old.add(o.geometry);
    });
    map.clear();
    old.forEach((g) => g.dispose());
    cells.length = 0;
    const layout = makeLayout(seed);
    for (const data of layout) {
      const g = new THREE.Group();
      g.position.set(Math.sqrt(3) * (data.q + data.r / 2), 0, 1.5 * data.r);
      const water = data.type === 'Water';
      const tile = addMesh(
        g,
        bevelTile(
          data.top,
          water,
          water ? data.riverCorners : data.corners,
          water ? data.riverShared : data.surface ? data.shared : null,
        ),
        [
          materials.side,
          water ? materials.waterDeep : materials.bevel,
          water ? materials.water : data.tone ? materials.groundLight : materials.ground,
        ],
      );
      const content = new THREE.Group();
      content.position.y = data.top;
      g.add(content);
      if (data.surface) makeRidge(content, data.surface);
      if (water) makeRiver(content, data);
      else makeLandBankJoin(content, data);
      for (const prop of data.props) {
        if (prop.kind === 'tree') makeTree(content, prop);
        else if (prop.kind === 'house') makeHouse(content, prop);
        else if (prop.kind === 'tower') makeTower(content, prop);
        else if (prop.kind === 'rock') makeRock(content, prop);
        else if (prop.kind === 'grass') makeGrass(content, prop);
        else {
          const mesh = addMesh(
            content,
            new THREE.BoxGeometry(0.18 * prop.scale, 0.003, 0.015),
            materials.waterEdge,
            prop.x,
            0.003,
            prop.z,
          );
          mesh.rotation.y = prop.angle;
          mesh.castShadow = false;
        }
      }
      g.traverse((o) => {
        if (o.isMesh) o.userData.key = data.key;
      });
      map.add(g);
      cells.push({ ...data, g });
    }
    root.dataset.generation = String(seed);
  }
  function ringGeometry(cell) {
    const points = [],
      surface = cell.surface || cell.riverSurface,
      mountain = !!surface,
      n = cell.riverSurface ? 28 : mountain ? 8 : 1;
    const corners =
      cell.riverCorners ||
      cell.corners ||
      Array.from({ length: 6 }, (_, k) => [
        Math.sin((k * Math.PI) / 3),
        Math.cos((k * Math.PI) / 3),
      ]);
    function point(k, t, factor) {
      const a = corners[k],
        b = corners[(k + 1) % 6],
        x = (a[0] + (b[0] - a[0]) * t) * factor,
        z = (a[1] + (b[1] - a[1]) * t) * factor;
      return [x, cell.top + (mountain ? Math.max(0, surfaceHeight(surface, x, z)) : 0) + 0.018, z];
    }
    for (let k = 0; k < 6; k++)
      for (let j = 0; j < n; j++) {
        const a = point(k, j / n, mountain ? 0.966 : 0.932),
          b = point(k, j / n, mountain ? 0.996 : 0.977),
          c = point(k, (j + 1) / n, mountain ? 0.996 : 0.977),
          d = point(k, (j + 1) / n, mountain ? 0.966 : 0.932);
        points.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    return geometryFrom(points);
  }
  const activeRing = new THREE.Mesh(new THREE.BufferGeometry(), materials.line),
    hoverRing = new THREE.Mesh(new THREE.BufferGeometry(), materials.hover);
  scene.add(activeRing, hoverRing);
  hoverRing.visible = false;
  function setRing(ring, cell) {
    ring.geometry.dispose();
    ring.geometry = ringGeometry(cell);
    ring.position.set(cell.g.position.x, 0, cell.g.position.z);
  }
  let selected = villageKey,
    hovered = null,
    zoom = 1;
  const selection = root.querySelector('#hp-selection');
  buildMap(generation);
  cells.forEach((cell) => {
    const option = document.createElement('option');
    option.value = cell.key;
    selection.append(option);
  });
  function updateSelectionLabels() {
    for (const cell of cells) {
      const option = Array.from(selection.options).find((o) => o.value === cell.key);
      option.textContent =
        cell.q +
        ', ' +
        cell.r +
        ' · ' +
        (cell.type === 'Woodland'
          ? cell.sparse
            ? 'Light woodland'
            : 'Dense woodland'
          : cell.type === 'Water'
            ? 'River' +
              (cell.hasIsland ? ' · Island' : '') +
              (cell.crossing ? ' · ' + (cell.crossing.kind === 'bridge' ? 'Bridge' : 'Ferry') : '')
            : cell.type);
    }
  }
  function choose(key) {
    selected = key;
    hoverRing.visible = false;
    const cell = cells.find((c) => c.key === key);
    setRing(activeRing, cell);
    selection.value = key;
    updateSelectionLabels();
    draw();
  }
  selection.addEventListener('change', () => choose(selection.value));
  root.querySelector('#hp-regenerate').addEventListener('click', () => {
    generation = 1 + Math.floor(Math.random() * 1000000);
    buildMap(generation);
    hovered = null;
    hoverRing.visible = false;
    choose(selected);
  });
  function applyPalette() {
    const base = fromHex(seeds[0]);
    const bg = color(0, Math.min(0.25, Math.max(0.16, base[0] - 0.015)), 1);
    scene.background = new THREE.Color(bg);
    root.style.setProperty('--hp-bg', bg);
    root.style.setProperty('--hp-text', color(2, 0.91, 0.2));
    root.style.setProperty('--hp-muted', color(0, 0.73, 0.35));
    root.style.setProperty('--hp-line', color(0, 0.38, 0.7));
    Object.entries(roles).forEach(([key, args]) => materials[key].color.set(color(...args)));
    materials.line.color.set(color(2, 0.94, 0.55));
    materials.hover.color.set(color(2, 0.83, 0.4));
    ['ground', 'water', 'elements'].forEach((name, i) => {
      root.querySelector('#hp-' + name).value = seeds[i];
      root.querySelector('#hp-' + name + '-value').textContent = seeds[i];
    });
    draw();
  }
  root.querySelector('#hp-preset').addEventListener('change', (e) => {
    if (palettes[e.target.value]) {
      seeds = palettes[e.target.value].slice();
      applyPalette();
    }
  });
  ['ground', 'water', 'elements'].forEach((name, i) =>
    root.querySelector('#hp-' + name).addEventListener('input', (e) => {
      seeds[i] = e.target.value;
      root.querySelector('#hp-preset').value = 'custom';
      applyPalette();
    }),
  );
  function draw() {
    renderer.render(scene, camera);
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    const vertical = Math.max(4.4, 5.9 / (w / h));
    camera.left = (-vertical * w) / h;
    camera.right = (vertical * w) / h;
    camera.top = vertical;
    camera.bottom = -vertical;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    draw();
  }
  function changeZoom(factor) {
    zoom = Math.min(2.8, Math.max(0.7, zoom * factor));
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    draw();
  }
  root.querySelector('#hp-in').addEventListener('click', () => changeZoom(1.2));
  root.querySelector('#hp-out').addEventListener('click', () => changeZoom(1 / 1.2));
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  function hit(x, y) {
    const rect = host.getBoundingClientRect();
    mouse.set(((x - rect.left) / rect.width) * 2 - 1, (-(y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(map.children, true);
    return hits.length ? hits[0].object.userData.key : null;
  }
  const pointers = new Map();
  let last = null,
    start = null,
    pinched = false,
    pinchDistance = 0;
  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    host.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      last = { x: e.clientX, y: e.clientY };
      start = { ...last };
      pinched = false;
    } else {
      pinched = true;
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
    hoverRing.visible = false;
  });
  host.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance > 0) changeZoom(d / pinchDistance);
        pinchDistance = d;
        return;
      }
      if (last) {
        const dx = e.clientX - last.x,
          dy = e.clientY - last.y;
        const scale = (camera.right - camera.left) / (host.clientWidth * zoom);
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        camera.position.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
        last = { x: e.clientX, y: e.clientY };
        draw();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const key = hit(e.clientX, e.clientY);
      if (key !== hovered) {
        hovered = key;
        hoverRing.visible = !!key && key !== selected;
        if (hoverRing.visible) {
          const c = cells.find((c) => c.key === key);
          setRing(hoverRing, c);
        }
        draw();
      }
    }
  });
  function release(e) {
    const wasLast = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasLast && !pinched && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) {
      const key = hit(e.clientX, e.clientY);
      if (key) choose(key);
    }
    last = null;
    start = null;
    if (pointers.size === 1) last = [...pointers.values()][0];
  }
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    last = null;
    start = null;
  });
  host.addEventListener('pointerleave', () => {
    hoverRing.visible = false;
    draw();
  });
  host.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      changeZoom(Math.exp(-e.deltaY * 0.001));
    },
    { passive: false },
  );
  new ResizeObserver(resize).observe(host);
  applyPalette();
  choose(villageKey);
  resize();
  loading.hidden = true;
})();
