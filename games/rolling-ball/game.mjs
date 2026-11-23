import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { createCanvasRenderer } from './canvas.mjs';
import { courses, surfaceAt, surfaceHeight } from './course.mjs';

const find = id => document.getElementById(id);
const view = find('view');
const level = find('level');
const result = find('result');
const status = find('status');
const time = find('time');
const best = find('best');
const progress = find('progress');
const brake = find('brake');
const joystick = find('joystick');
const stick = find('stick');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x94b7e8, .019);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 120);
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2', { antialias: true });
let renderer;
if (gl) {
  renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setClearColor(0x94b7e8);
} else {
  renderer = createCanvasRenderer(camera);
}
view.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf3f8ff, 0x7282aa, 2.1));
const sun = new THREE.DirectionalLight(0xffecd0, 2.1);
sun.position.set(-8, 14, 9);
scene.add(sun);

const coursePieces = new THREE.Group();
scene.add(coursePieces);
const radius = .39;
const ball = new THREE.Group();
ball.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20),
  new THREE.MeshStandardMaterial({ color: 0x1858c4, roughness: .29, metalness: .19 })));
const stripe = new THREE.Mesh(new THREE.TorusGeometry(radius * .994, .025, 8, 36),
  new THREE.MeshStandardMaterial({ color: 0xa4e0ff, roughness: .4 }));
ball.add(stripe);
scene.add(ball);

const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.14, 24),
  new THREE.MeshBasicMaterial({ color: 0x162658, transparent: true, opacity: .23, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);
const velocity = new THREE.Vector3();
const rotationAxis = new THREE.Vector3();
const look = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const position = ball.position;

const ice = new THREE.MeshStandardMaterial({ color: 0x4ccdbc });
const lilac = new THREE.MeshStandardMaterial({ color: 0x9596e1 });
const checkpointMaterial = new THREE.MeshStandardMaterial({ color: 0xf8be5e });
const goalMaterial = new THREE.MeshStandardMaterial({ color: 0xffda8a });
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe9fff6 });
const decorations = new THREE.Group();
const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xc6d8f0, roughness: 1 });
const cloudGeometry = new THREE.IcosahedronGeometry(1, 0);
for (let index = 0; index < 18; index++) {
  const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloud.position.set(Math.sin(index * 5) * (12 + index % 4 * 3), -5 - index % 5, 4 - index * 3.6);
  cloud.scale.set(2.8 + index % 3, .7, 2);
  decorations.add(cloud);
}
scene.add(decorations);

let courseIndex = 0;
let course;
let checkpoint;
let elapsed = 0;
let state = 'ready';
let notice = 0;
let bestTime = null;
let gamepadSeen = false;
const keys = new Set();
const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space']);
const touch = { id: null, x: 0, z: 0 };
let brakePointer = null;

function makePlatform(platform, index) {
  const geometry = new THREE.BoxGeometry(platform.width, .55, platform.length);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    vertices.setY(i, vertices.getY(i) - .275 + surfaceHeight(platform, platform.z + vertices.getZ(i)));
  }
  geometry.computeVertexNormals();
  const material = platform.kind === 'checkpoint' ? checkpointMaterial :
    platform.kind === 'finish' ? goalMaterial : index % 2 ? lilac : ice;
  const block = new THREE.Mesh(geometry, material);
  block.position.set(platform.x, 0, platform.z);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial);
  block.add(outline);
  coursePieces.add(block);
  if (platform.kind === 'finish') {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.9, .14, 10, 28), goalMaterial);
    marker.position.set(platform.x, surfaceHeight(platform, platform.z) + 1.05, platform.z);
    coursePieces.add(marker);
  }
}

function syncCamera(immediate = false, dt = 0) {
  const factor = immediate ? 1 : 1 - Math.exp(-dt * 5);
  const height = Math.max(position.y, (checkpoint ?? course.platforms[0]).height);
  cameraTarget.set(position.x * .8, height + 7.6, position.z + 8.7);
  lookTarget.set(position.x * .86, height - .2, position.z - 3.65);
  camera.position.lerp(cameraTarget, factor);
  look.lerp(lookTarget, factor);
  camera.lookAt(look);
}

function respawn() {
  const platform = checkpoint ?? course.platforms[0];
  position.set(platform.x, surfaceHeight(platform, platform.z) + radius, platform.z);
  velocity.set(0, 0, 0);
  ball.rotation.set(0, 0, 0);
  shadow.visible = true;
  shadow.position.set(position.x, position.y - radius + .015, position.z);
  syncCamera(true);
}

function bestKey() {
  return 'come-to-play:rolling-ball:' + courseIndex;
}

function readBest() {
  try {
    const saved = Number(localStorage.getItem(bestKey()));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

function reset(index) {
  if (result.open) result.close();
  clearInputs();
  courseIndex = index;
  level.value = String(index);
  course = courses[index];
  for (const child of [...coursePieces.children]) {
    child.traverse(object => object.geometry?.dispose());
    coursePieces.remove(child);
  }
  course.platforms.forEach(makePlatform);
  elapsed = 0;
  checkpoint = null;
  state = 'ready';
  notice = 0;
  time.value = '0.00';
  bestTime = readBest();
  best.value = bestTime === null ? '—' : bestTime.toFixed(2);
  status.textContent = '往前滾，穿過金色終點';
  progress.value = '0 / 1';
  respawn();
}

function finish() {
  state = 'won';
  const record = bestTime === null || elapsed < bestTime;
  if (record) {
    bestTime = elapsed;
    best.value = bestTime.toFixed(2);
    try {
      localStorage.setItem(bestKey(), String(bestTime));
    } catch {
      // The result remains visible for this visit.
    }
  }
  find('result-time').textContent = elapsed.toFixed(2) + ' 秒' + (record ? ' · 新紀錄' : '');
  find('next').hidden = courseIndex + 1 >= courses.length;
  clearInputs();
  result.showModal();
}

function gamepadInput() {
  const pad = navigator.getGamepads?.().find(candidate => candidate?.mapping === 'standard');
  if (!pad) return { x: 0, z: 0, brake: false };
  if (!gamepadSeen) {
    find('hint').textContent = '左搖桿移動 · A／× 煞車';
    gamepadSeen = true;
  }
  const axis = index => Math.abs(pad.axes[index] ?? 0) > .17 ? pad.axes[index] : 0;
  const button = index => Number(pad.buttons[index]?.pressed ?? false);
  return { x: axis(0) + button(15) - button(14), z: axis(1) + button(13) - button(12), brake: !!button(0) };
}

function step(dt) {
  if (state === 'won') return;
  const pad = gamepadInput();
  const held = (...codes) => Number(codes.some(code => keys.has(code)));
  let x = held('ArrowRight', 'KeyD') - held('ArrowLeft', 'KeyA') + touch.x + pad.x;
  let z = held('ArrowDown', 'KeyS') - held('ArrowUp', 'KeyW') + touch.z + pad.z;
  const magnitude = Math.max(1, Math.hypot(x, z));
  x /= magnitude;
  z /= magnitude;
  const braking = keys.has('Space') || brakePointer !== null || pad.brake;

  if (state === 'ready' && Math.hypot(x, z) > .1) {
    state = 'running';
    status.textContent = '';
  }
  if (state === 'ready') return;
  elapsed += dt;
  time.value = elapsed.toFixed(2);
  if (notice > 0) {
    notice -= dt;
    if (notice <= 0) status.textContent = '';
  }

  if (state === 'falling') {
    velocity.y -= dt * 13;
    position.addScaledVector(velocity, dt);
    if (position.y < -5) {
      respawn();
      state = 'running';
      status.textContent = checkpoint ? '已回到檢查點' : '已回到起點';
      notice = 1.4;
    }
    return;
  }

  const damping = Math.exp(-(braking ? 9.5 : 1.55) * dt);
  velocity.x = velocity.x * damping + (braking ? 0 : x * 8.6 * dt);
  velocity.z = velocity.z * damping + (braking ? 0 : z * 8.6 * dt);
  position.addScaledVector(velocity, dt);
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed > .01) {
    rotationAxis.set(velocity.z / speed, 0, -velocity.x / speed);
    ball.rotateOnWorldAxis(rotationAxis, speed * dt / radius);
  }
  const platform = surfaceAt(course.platforms, position.x, position.z);
  shadow.visible = Boolean(platform);
  if (!platform) {
    state = 'falling';
    status.textContent = '掉出賽道';
    return;
  }
  position.y = surfaceHeight(platform, position.z) + radius;
  shadow.position.set(position.x, position.y - radius + .015, position.z);
  if (platform.kind === 'checkpoint' && checkpoint !== platform) {
    checkpoint = platform;
    progress.value = '1 / 1';
    status.textContent = '已通過檢查點';
    notice = 1.4;
  }
  if (platform.kind === 'finish' && Math.hypot(position.x - platform.x, position.z - platform.z) < 1.25) finish();
}

function releaseTouch() {
  touch.id = null;
  touch.x = 0;
  touch.z = 0;
  stick.style.transform = '';
}

function releaseBrake() {
  brakePointer = null;
  delete brake.dataset.active;
}

function clearInputs() {
  keys.clear();
  releaseTouch();
  releaseBrake();
}

function steer(event) {
  const rect = joystick.getBoundingClientRect();
  const cap = rect.width * .31;
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const length = Math.max(cap, Math.hypot(x, y));
  touch.x = x / length;
  touch.z = y / length;
  stick.style.transform = 'translate(' + touch.x * cap + 'px,' + touch.z * cap + 'px)';
}

joystick.addEventListener('pointerdown', event => {
  if (touch.id !== null || event.button !== 0) return;
  touch.id = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  steer(event);
});
joystick.addEventListener('pointermove', event => {
  if (event.pointerId === touch.id) steer(event);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  joystick.addEventListener(name, event => {
    if (event.pointerId === touch.id) releaseTouch();
  });
  brake.addEventListener(name, event => {
    if (event.pointerId === brakePointer) releaseBrake();
  });
}
brake.addEventListener('pointerdown', event => {
  if (brakePointer !== null) return;
  brake.setPointerCapture(event.pointerId);
  brakePointer = event.pointerId;
  brake.dataset.active = 'true';
});
window.addEventListener('keydown', event => {
  if (result.open || !movementKeys.has(event.code) || event.target.closest('button, select, a')) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', clearInputs);
result.addEventListener('cancel', event => event.preventDefault());
function play(index) {
  reset(index);
  find('stage').focus({ preventScroll: true });
}

find('retry').addEventListener('click', () => play(courseIndex));
find('next').addEventListener('click', () => play(courseIndex + 1));
find('restart').addEventListener('click', () => play(courseIndex));
find('restart').disabled = false;
courses.forEach(({ name }, index) => level.add(new Option(name, index)));
level.addEventListener('change', () => play(Number(level.value)));

const coarse = matchMedia('(any-pointer: coarse)');
function updateControls() {
  joystick.hidden = !coarse.matches;
  brake.hidden = !coarse.matches;
  find('hint').textContent = coarse.matches ? '拖動搖桿，鬆手會繼續滾動' : '方向鍵／WASD 移動 · 空白鍵煞車';
}
coarse.addEventListener('change', updateControls);
updateControls();

function resize() {
  const { clientWidth: width, clientHeight: height } = view;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = camera.aspect < .8 ? 66 : 55;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
resize();
reset(0);
let lastFrame = performance.now();
function frame(now) {
  const dt = document.hidden ? 0 : Math.min(Math.max(0, (now - lastFrame) / 1000), .04);
  lastFrame = now;
  if (dt) step(dt);
  syncCamera(false, dt);
  if (gl) renderer.render(scene, camera);
  else renderer.render(course, position, shadow, radius, ball.rotation);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
