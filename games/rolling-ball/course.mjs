// Platforms run from back to front along negative Z.
// Heights describe the driving surface at the near and far edges.
export const courses = [
  {
    name: '薄荷天橋',
    platforms: [
      { x: 0, z: 0, width: 7, length: 8, height: 0, kind: 'start' },
      { x: 0, z: -8, width: 3.5, length: 9, height: 0, rise: 1.2 },
      { x: 1.3, z: -15.3, width: 8.6, length: 6, height: 1.2, kind: 'checkpoint' },
      { x: 4, z: -22, width: 2.7, length: 8, height: 1.2 },
      { x: 2.3, z: -28.5, width: 8, length: 5.5, height: 1.2 },
      { x: -.5, z: -34.8, width: 3, length: 7.5, height: 1.2, rise: -.7 },
      { x: -.5, z: -41.5, width: 6.8, length: 6.5, height: .5, kind: 'finish' },
    ],
  },
  {
    name: '日落迴廊',
    platforms: [
      { x: 0, z: 0, width: 6, length: 7, height: 0, kind: 'start' },
      { x: -1.7, z: -6.8, width: 2.5, length: 7, height: 0 },
      { x: -.25, z: -12.5, width: 7, length: 4.7, height: 0 },
      { x: 2.2, z: -18.5, width: 2.1, length: 7.8, height: 0, rise: 1.4 },
      { x: 2.2, z: -25, width: 6.6, length: 5.5, height: 1.4, kind: 'checkpoint' },
      { x: 4.3, z: -31.3, width: 1.9, length: 7.5, height: 1.4 },
      { x: 1.6, z: -37.4, width: 8.6, length: 5.1, height: 1.4 },
      { x: -1.6, z: -43, width: 2.1, length: 6.4, height: 1.4, rise: -.8 },
      { x: -1.6, z: -49.4, width: 7, length: 6.8, height: .6, kind: 'finish' },
    ],
  },
];

export function surfaceHeight(platform, z) {
  const fraction = Math.max(0, Math.min(1, (platform.z + platform.length / 2 - z) / platform.length));
  return platform.height + (platform.rise ?? 0) * fraction;
}

export function surfaceAt(platforms, x, z) {
  return platforms.findLast(platform =>
    Math.abs(platform.x - x) <= platform.width / 2 &&
    Math.abs(platform.z - z) <= platform.length / 2
  );
}
