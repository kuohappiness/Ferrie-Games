export const limits = { minX: -35, maxX: 35, minZ: -27, maxZ: 27 };
export const pickup = { x: -18, z: 13 };
export const destinations = [
  { x: 28, z: -14, name: '信義商圈', limit: 45 },
  { x: -29, z: -12.4, name: '大稻埕河岸', limit: 40 },
  { x: 15, z: 13, name: '夜市入口', limit: 32 },
];
export const initialCars = [
  { x: -14.7, z: 14.3, angle: Math.PI / 2, color: '#ed8260', name: '橘色小車', topSpeed: 11.5, handling: 1.95 },
  { x: 5, z: 13.6, angle: Math.PI / 2, color: '#5dc3ff', name: '藍色跑車', topSpeed: 15, handling: 1.7 },
  { x: 26, z: -10, angle: Math.PI, color: '#efe080', name: '黃色休旅車', topSpeed: 10.2, handling: 1.52 },
];
export const buildings = [
  [-26,-18,10,7,11,'#e49179'],[-15,-19,8,6,7,'#d6bb83'],
  [-4,-18,8,7,13,'#8bafba'],[7,-18,8,7,9,'#9faddc'],[18,-18,8,8,7,'#d6a985'],
  [-27,-4,9,9,12,'#9caede'],[-15,-4,8,8,7,'#c797bb'],
  [7,-5,8,8,13,'#8caebf'],[18,-5,8,8,9,'#db957f'],
  [-26,6,9,6,8,'#e2be81'],[-16,6,7,6,5,'#91b5b2'],
  [7,6,8,6,6,'#a3aad6'],[17,6,7,6,9,'#c18986'],
  [-22,22,10,5,4,'#d58c69'],[-9,22,10,5,4,'#9bb8c9'],
  [8,22,11,5,5,'#a9b7c8'],[19,22,8,5,4,'#d7ae7a'],
];
export const roads = [
  [0, 12.7, 70, 6.4],[0,-12.6,70,5.8],[-7,-4.5,5.8,45],[26.5,0,6.4,54],
];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function clearAt(x, z, radius) {
  if (x < limits.minX + radius || x > limits.maxX - radius ||
      z < limits.minZ + radius || z > limits.maxZ - radius) return false;
  return !buildings.some(([bx,bz,width,length]) =>
    Math.abs(x - bx) < width / 2 + radius && Math.abs(z - bz) < length / 2 + radius);
}

export function move(body, dx, dz, radius) {
  let hit = false;
  if (clearAt(body.x + dx, body.z, radius)) body.x += dx;
  else hit = true;
  if (clearAt(body.x, body.z + dz, radius)) body.z += dz;
  else hit = true;
  return hit;
}

export function parkingSpot(car) {
  for (const side of [1, -1]) {
    const x = car.x + Math.cos(car.angle) * 2.15 * side;
    const z = car.z - Math.sin(car.angle) * 2.15 * side;
    if (clearAt(x,z,.4)) return { x, z };
  }
  return null;
}
