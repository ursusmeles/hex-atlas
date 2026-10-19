export const TOP_RADIUS = 0.92;

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

export { randomStream, surfaceHeight };
