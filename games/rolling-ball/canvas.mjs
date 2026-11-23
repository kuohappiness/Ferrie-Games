import { Vector3 } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { surfaceHeight } from './course.mjs';

// Draw the same 3D course using a 2D canvas when WebGL is unavailable.
export function createCanvasRenderer(camera) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const point = new Vector3();
  let width = 0;
  let height = 0;

  function project(x, y, z) {
    point.set(x, y, z).project(camera);
    return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
  }

  function paintPolygon(points, fill) {
    context.beginPath();
    for (const [x, y] of points) context.lineTo(x, y);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = '#ffffff55';
    context.stroke();
  }

  function paintPlatform(platform, index) {
    const { x, z, width: size, length } = platform;
    if (z - length / 2 > camera.position.z - .8) return;
    const near = Math.min(z + length / 2, camera.position.z - .8);
    const far = z - length / 2;
    const left = x - size / 2;
    const right = x + size / 2;
    const points = [[left, near], [right, near], [right, far], [left, far]];
    const top = points.map(([px, pz]) => project(px, surfaceHeight(platform, pz), pz));
    const bottom = points.map(([px, pz]) => project(px, surfaceHeight(platform, pz) - .55, pz));
    const color = platform.kind === 'checkpoint' || platform.kind === 'finish' ? '#ffd181' :
      index % 2 ? '#a8a4eb' : '#73e0cc';
    if (camera.position.x < left) paintPolygon([top[0], top[3], bottom[3], bottom[0]], '#6277ae');
    if (camera.position.x > right) paintPolygon([top[1], top[2], bottom[2], bottom[1]], '#6778b4');
    paintPolygon([top[0], top[1], bottom[1], bottom[0]], '#536ba9');
    paintPolygon(top, color);
    if (platform.kind === 'finish') {
      const ground = surfaceHeight(platform, z);
      context.beginPath();
      for (let segment = 0; segment <= 32; segment++) {
        const angle = segment * Math.PI / 16;
        context.lineTo(...project(x + Math.cos(angle) * .9, ground + 1.05 + Math.sin(angle) * .9, z));
      }
      context.lineWidth = Math.max(2, Math.min(10, (top[1][0] - top[0][0]) / 24));
      context.strokeStyle = '#fff4a9';
      context.stroke();
      context.lineWidth = 1;
    }
  }

  function render({ platforms }, position, shadow, radius, rotation) {
    camera.updateMatrixWorld();
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#6b8ed3');
    sky.addColorStop(1, '#d0ecff');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#e2f1ff83';
    for (let index = 0; index < 18; index++) {
      const z = 4 - index * 3.6;
      if (z > camera.position.z - 2) continue;
      const [x, y] = project(Math.sin(index * 5) * (12 + index % 4 * 3), -5 - index % 5, z);
      const size = Math.min(125, width * 2 / (camera.position.z - z));
      context.beginPath();
      context.ellipse(x, y, size, size * .19, -.12, 0, Math.PI * 2);
      context.fill();
    }

    for (let i = platforms.length - 1; i >= 0; i--) paintPlatform(platforms[i], i);
    const [x, y] = project(position.x, position.y, position.z);
    const size = Math.max(2, Math.abs(project(position.x + radius, position.y, position.z)[0] - x));
    if (shadow.visible) {
      const [sx, sy] = project(shadow.position.x, shadow.position.y, shadow.position.z);
      context.fillStyle = '#16265843';
      context.beginPath();
      context.ellipse(sx, sy, size, size * .42, 0, 0, Math.PI * 2);
      context.fill();
    }
    const blue = context.createRadialGradient(x - size * .3, y - size * .4, 0, x, y, size);
    blue.addColorStop(0, '#9ce8ff');
    blue.addColorStop(.5, '#3b8aef');
    blue.addColorStop(1, '#173e96');
    context.fillStyle = blue;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#c1efff9c';
    context.beginPath();
    context.ellipse(x, y, size * .92, size * .31, rotation.z + rotation.x, 0, Math.PI);
    context.stroke();
  }

  return {
    domElement: canvas,
    setSize(w, h) {
      width = w;
      height = h;
      const ratio = Math.min(devicePixelRatio, 1.65);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    render,
  };
}
