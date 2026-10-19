import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPoiBuilder } from '../src/rendering/poi-props.js';
import { POI_ANCHOR } from '../src/generation/points-of-interest.js';

test('every POI model variant produces finite geometry within its reserved corner footprint', () => {
  const material = new THREE.MeshBasicMaterial();
  const addMesh = (parent, geometry, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  // Building and roof proxies retain the existing components' outer dimensions.
  const building = (geometry) => (parent, prop) => {
    const part = addMesh(parent, geometry(), material, prop.x, prop.y, prop.z);
    part.scale.setScalar(prop.scale);
  };
  const makePoi = createPoiBuilder({
    addMesh,
    propMaterial: () => material,
    makeHouse: building(() => new THREE.BoxGeometry(0.46, 0.7, 0.55)),
    makeTower: building(() => new THREE.CylinderGeometry(0.33, 0.33, 1.06, 6)),
    roofGeometry: (w, d, h) => new THREE.BoxGeometry(w, h, d),
  });
  const variants = {
    ruins: [0, 1, 2],
    encampment: [0, 1, 2],
    watchtower: ['watchtower', 'lighthouse'],
    stronghold: [0, 1, 2],
    lair: ['cave', 'nest'],
    mystic: ['portal', 'altar', 'standing stone'],
    abbey: [0],
    battlefield: [0, 1, 2],
    dungeon: ['mine', 'dungeon'],
  };
  for (const [poiKind, options] of Object.entries(variants))
    for (const variant of options)
      for (const detailSeed of [7, 17, 48]) {
        const root = new THREE.Group();
        makePoi(root, {
          poiKind,
          variant,
          detailSeed,
          x: 0,
          y: 0,
          z: 0,
          footprint: POI_ANCHOR.r,
          pedestalDepth: 0.035,
          temperature: -1,
        });
        root.updateMatrixWorld(true);
        let vertices = 0;
        root.traverse((object) => {
          if (!object.isMesh) return;
          const points = object.geometry.attributes.position;
          for (let i = 0; i < points.count; i++) {
            const p = new THREE.Vector3()
              .fromBufferAttribute(points, i)
              .applyMatrix4(object.matrixWorld);
            assert.ok([p.x, p.y, p.z].every(Number.isFinite));
            assert.ok(
              Math.hypot(p.x, p.z) <= POI_ANCHOR.r + 1e-6,
              `${poiKind}/${variant} remains in its reserved circle`,
            );
            vertices++;
          }
          object.geometry.dispose();
        });
        assert.ok(vertices > 20);
      }
  material.dispose();
});
