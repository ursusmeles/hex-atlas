import * as THREE from 'three';
import { randomStream } from '../generation/math.js';

// Small dioramas share the existing material roles and building components.
export function createPoiBuilder({ addMesh, propMaterial, makeHouse, makeTower, roofGeometry }) {
  return function makePoi(parent, prop) {
    const random = randomStream(prop.detailSeed);
    const integer = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
    const g = new THREE.Group();
    g.position.set(prop.x, prop.y, prop.z);
    g.rotation.y = 0.55;
    const material = (role) => propMaterial(role, prop.temperature);
    const mesh = (geometry, role, x, y, z) => addMesh(g, geometry, material(role), x, y, z);
    const box = (x, y, z, w, h, d, role = 'rock') =>
      mesh(new THREE.BoxGeometry(w, h, d), role, x, y, z);
    const cylinder = (x, y, z, r, h, role = 'rockLight', top = r, sides = 6) =>
      mesh(new THREE.CylinderGeometry(top, r, h, sides), role, x, y, z);
    const stone = (x, y, z, scale, role = 'rock') => {
      const part = mesh(new THREE.DodecahedronGeometry(scale, 0), role, x, y, z);
      part.scale.set(0.8, 1.3, 0.7);
      part.rotation.y = random() * Math.PI;
      return part;
    };
    cylinder(
      0,
      -prop.pedestalDepth / 2,
      0,
      prop.footprint,
      prop.pedestalDepth + 0.012,
      'rockMid',
      prop.footprint,
      12,
    );
    if (prop.poiKind === 'ruins') {
      if (prop.variant === 0) {
        box(-0.12, 0.1, -0.09, 0.065, 0.2, 0.2);
        box(0, 0.07, -0.17, 0.28, 0.14, 0.06);
        box(0.12, 0.13, -0.1, 0.065, 0.26, 0.11, 'rockLight');
        box(0.12, 0.24, -0.1, 0.095, 0.035, 0.12, 'rockLight');
      } else if (prop.variant === 1) {
        for (let k = 0; k < 5; k++) {
          const angle = (k * Math.PI) / 4,
            h = 0.13 + random() * 0.17;
          cylinder(Math.cos(angle) * 0.16, h / 2, Math.sin(angle) * 0.16, 0.027, h);
        }
        box(0, 0.04, -0.1, 0.18, 0.08, 0.08, 'rockLight');
      } else {
        cylinder(-0.04, 0.1, -0.03, 0.125, 0.2, 'rock', 0.11, 6);
        box(-0.1, 0.23, -0.1, 0.07, 0.11, 0.07, 'rockLight');
        box(0.05, 0.2, -0.1, 0.09, 0.065, 0.07);
      }
      for (let k = 0; k < 3; k++)
        stone((random() - 0.5) * 0.28, 0.025, 0.1 + random() * 0.06, 0.032);
    } else if (prop.poiKind === 'encampment') {
      const tents = integer(0, 3),
        fire = tents === 0 || random() < 0.65;
      for (let k = 0; k < tents; k++) {
        const a = k * 2.1,
          x = Math.cos(a) * 0.11,
          z = Math.sin(a) * 0.11;
        const tent = mesh(
          roofGeometry(0.15, 0.18, 0.14),
          k % 2 ? 'wall' : 'roofLight',
          x,
          0.015,
          z,
        );
        tent.rotation.y = -a;
        box(x, 0.055, z + 0.045, 0.035, 0.085, 0.012, 'door');
      }
      if (fire) {
        for (let k = 0; k < 7; k++)
          stone(
            Math.cos((k * Math.PI * 2) / 7) * 0.047,
            0.015,
            Math.sin((k * Math.PI * 2) / 7) * 0.047,
            0.016,
            'rockMid',
          );
        const log = box(0, 0.025, 0, 0.08, 0.025, 0.022, 'trunk');
        log.rotation.y = 0.65;
        mesh(new THREE.ConeGeometry(0.026, 0.075, 5), 'roofLight', 0, 0.06, 0);
      }
    } else if (prop.poiKind === 'watchtower') {
      if (prop.variant === 'watchtower')
        makeTower(g, { x: 0, y: 0, z: 0, angle: 0, scale: 0.55, temperature: prop.temperature });
      else {
        cylinder(0, 0.2, 0, 0.105, 0.4, 'wall', 0.073);
        cylinder(0, 0.405, 0, 0.12, 0.035, 'rockLight');
        cylinder(0, 0.48, 0, 0.07, 0.11, 'waterEdge');
        for (const x of [-0.064, 0.064])
          for (const z of [-0.045, 0.045]) box(x, 0.48, z, 0.014, 0.12, 0.014, 'door');
        mesh(new THREE.ConeGeometry(0.11, 0.09, 6), 'roof', 0, 0.58, 0);
      }
    } else if (prop.poiKind === 'stronghold') {
      const h = 0.15 + prop.variant * 0.035;
      box(0, h / 2, -0.05, 0.3, h, 0.21, 'wall');
      box(-0.12, 0.09, 0.12, 0.065, 0.18, 0.065, 'rockLight');
      box(0.12, 0.09, 0.12, 0.065, 0.18, 0.065, 'rockLight');
      box(0, 0.19, 0.12, 0.3, 0.055, 0.065, 'rockLight');
      box(0, 0.07, 0.13, 0.1, 0.14, 0.025, 'door');
      for (let k = 0; k <= prop.variant; k++) {
        const [x, z] = [
          [-0.13, -0.12],
          [0.13, -0.12],
          [0, 0],
        ][k];
        const height = 0.25 + random() * 0.14;
        cylinder(x, height / 2, z, 0.054, height, 'wall');
        cylinder(x, height + 0.01, z, 0.068, 0.045, 'rockLight');
        for (let i = 0; i < 4; i++)
          box(
            x + Math.cos((i * Math.PI) / 2) * 0.044,
            height + 0.05,
            z + Math.sin((i * Math.PI) / 2) * 0.044,
            0.032,
            0.04,
            0.032,
            'rockLight',
          );
      }
    } else if (prop.poiKind === 'lair') {
      if (prop.variant === 'nest') {
        const ring = mesh(new THREE.TorusGeometry(0.115, 0.035, 4, 9), 'trunk', 0, 0.045, 0);
        ring.rotation.x = Math.PI / 2;
        for (const x of [-0.04, 0.035]) {
          const egg = stone(x, 0.065, 0, 0.035, 'rockLight');
          egg.scale.set(0.75, 1.2, 0.75);
        }
      } else {
        box(0, 0.07, -0.025, 0.24, 0.14, 0.13, 'door');
        for (let k = 0; k < 7; k++) {
          const a = (k * Math.PI) / 6;
          stone(
            Math.cos(a) * 0.135,
            0.025 + Math.sin(a) * 0.15,
            0.06,
            0.057,
            k % 2 ? 'rockMid' : 'rock',
          );
        }
        stone(0, 0.11, -0.08, 0.1);
      }
    } else if (prop.poiKind === 'mystic') {
      if (prop.variant === 'portal') {
        const ring = mesh(
          new THREE.TorusGeometry(0.12, 0.035, 4, 8, Math.PI),
          'rockLight',
          0,
          0.16,
          0,
        );
        ring.rotation.z = 0;
        box(-0.12, 0.075, 0, 0.06, 0.15, 0.075);
        box(0.12, 0.075, 0, 0.06, 0.15, 0.075);
        box(0, 0.012, 0, 0.3, 0.024, 0.17, 'waterEdge');
      } else if (prop.variant === 'altar') {
        box(0, 0.075, 0, 0.13, 0.15, 0.1);
        box(0, 0.17, 0, 0.28, 0.045, 0.15, 'rockLight');
        cylinder(0, 0.215, 0, 0.035, 0.045, 'waterEdge');
      } else {
        const monolith = stone(0, 0.2, 0, 0.15, 'rockLight');
        monolith.scale.set(0.55, 1.6, 0.45);
        box(0.005, 0.23, 0.069, 0.025, 0.13, 0.008, 'waterEdge');
      }
    } else if (prop.poiKind === 'abbey') {
      makeHouse(g, {
        x: 0,
        y: 0,
        z: 0,
        angle: Math.PI / 2,
        scale: 0.62,
        variant: 1,
        temperature: prop.temperature,
      });
      cylinder(-0.12, 0.16, -0.07, 0.065, 0.32, 'wall', 0.065, 4);
      mesh(new THREE.ConeGeometry(0.095, 0.14, 4), 'roof', -0.12, 0.39, -0.07);
    } else if (prop.poiKind === 'battlefield') {
      cylinder(-0.065, 0.23, 0, 0.008, 0.46, 'trunk');
      box(0.015, 0.37, 0, 0.14, 0.11, 0.014, 'roofLight');
      for (let k = 0, count = integer(1, 3); k < count; k++) {
        const x = -0.1 + k * 0.09,
          z = 0.1 + random() * 0.035;
        stone(x, 0.028, z, 0.032, 'rockLight');
        box(x - 0.012, 0.034, z + 0.021, 0.011, 0.012, 0.009, 'door');
        box(x + 0.012, 0.034, z + 0.021, 0.011, 0.012, 0.009, 'door');
      }
    } else if (prop.poiKind === 'dungeon') {
      const mine = prop.variant === 'mine',
        role = mine ? 'trunk' : 'rockLight';
      box(0, 0.1, -0.025, 0.22, 0.2, 0.08, 'door');
      box(-0.12, 0.12, 0, 0.055, 0.24, 0.085, role);
      box(0.12, 0.12, 0, 0.055, 0.24, 0.085, role);
      box(0, 0.25, 0, 0.3, 0.065, 0.09, role);
      if (mine)
        for (const x of [-0.055, 0.055]) box(x, 0.014, 0.065, 0.012, 0.022, 0.25, 'rockMid');
      else for (let k = -2; k <= 2; k++) box(k * 0.037, 0.1, 0.024, 0.01, 0.2, 0.012, 'rockMid');
      for (const x of [-0.17, 0.17]) stone(x, 0.05, -0.075, 0.052);
    }
    parent.add(g);
  };
}
