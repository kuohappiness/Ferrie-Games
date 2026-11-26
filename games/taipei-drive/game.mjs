import { clearAt, destinations, distance, initialCars, move, parkingSpot, pickup } from './city.mjs';
import { drawCity } from './view.mjs';

const find = id => document.getElementById(id);
const scene = find('scene');
const map = find('map');
const joystick = find('joystick');
const stick = joystick.querySelector('span');
const brake = find('brake');
const interact = find('interact');
const keys = new Set();
const movement = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space']);
const touch = { x: 0, y: 0, pointer: null };
let brakePointer = null;
let messageUntil = 0;
let active = null;
let selected = 0;
let delivered = 0;
let mission = null;
let person;
let cars;
let camera;
let profile;
let frame = 0;
const ready = '到車庫的黃色圓圈接單';
lobbyPlayer.visit('taipei-drive');

function message(text) {
  find('notice').textContent = text;
  messageUntil = performance.now() + 3100;
}

function reset() {
  person = { x: -19.6, z: 13.9 };
  camera = { ...person };
  cars = initialCars.map(car => ({ ...car, speed: 0 }));
  active = null;
  mission = null;
  profile = lobbyPlayer.read().active;
  clearInput();
  find('notice').textContent = '';
}

function nearestCar() {
  return cars.find(car => distance(person, car) < 2.5);
}

function action() {
  const body = active || person;
  if (!mission && distance(body, pickup) < 2.5) return '接單';
  if (mission && active && distance(active, mission.destination) < 3.1 && Math.abs(active.speed) < 2.3) return '交貨';
  if (active) return '下車';
  return nearestCar() ? '上車' : '互動';
}

function useAction() {
  switch (action()) {
    case '接單':
      mission = { destination: destinations[selected % destinations.length], elapsed: 0 };
      message('接單成功。上車開往黃色標記。');
      break;
    case '交貨': {
      const fast = mission.elapsed <= mission.destination.limit;
      delivered++;
      lobbyPlayer.complete('taipei-drive', mission.destination.name, undefined, profile);
      message(fast ? '準時送達！回車庫可接下一站。' : '已送達。下次試著在限時內抵達！');
      mission = null;
      selected++;
      break;
    }
    case '上車':
      active = nearestCar();
      message('已上車 · ' + active.name);
      break;
    case '下車': {
      if (Math.abs(active.speed) >= 1.5) {
        message('先煞停，再下車。');
        break;
      }
      const spot = parkingSpot(active);
      if (!spot) {
        message('請把車停到空曠處。');
        break;
      }
      person = spot;
      active = null;
      message('已下車。靠近一台車可以換車。');
      break;
    }
    default:
      message('靠近車輛、車庫或送貨點即可互動。');
  }
}

function travelBlocked(x, z, radius, ignore) {
  return !clearAt(x,z,radius) || cars.some(car => car !== ignore && distance(car, {x,z}) < radius + .9);
}

function update(dt) {
  const held = (...codes) => Number(codes.some(code => keys.has(code)));
  const steer = Math.max(-1, Math.min(1, held('ArrowRight','KeyD')-held('ArrowLeft','KeyA')+touch.x));
  const forward = Math.max(-1, Math.min(1, held('ArrowUp','KeyW')-held('ArrowDown','KeyS')-touch.y));
  if (active) {
    const braking = keys.has('Space') || brakePointer !== null;
    const drag = braking ? 9 : forward ? .62 : 1.85;
    active.speed = active.speed * Math.exp(-drag*dt) + (braking ? 0 : forward*9.5*dt);
    active.speed = Math.max(-4.6, Math.min(active.topSpeed, active.speed));
    active.angle += steer * Math.sign(active.speed) * Math.min(active.handling, Math.abs(active.speed)*.38)*dt;
    const dx = Math.sin(active.angle)*active.speed*dt;
    const dz = Math.cos(active.angle)*active.speed*dt;
    if (travelBlocked(active.x+dx,active.z+dz,1.05,active)) active.speed *= -.19;
    else move(active,dx,dz,1.05);
  } else {
    const length = Math.max(1, Math.hypot(steer,forward));
    const dx = (steer-forward)*3.1*dt/length;
    const dz = (-steer-forward)*3.1*dt/length;
    if (!travelBlocked(person.x+dx,person.z+dz,.38,null)) move(person,dx,dz,.38);
  }
  if (mission) mission.elapsed += dt;
  const player = active || person;
  const easing = 1 - Math.exp(-dt*5);
  camera.x += (player.x-camera.x)*easing;
  camera.z += (player.z-camera.z)*easing;
}

function clearInput() {
  keys.clear();
  touch.x = touch.y = 0;
  touch.pointer = brakePointer = null;
  stick.style.transform = '';
}

function steerTouch(event) {
  const box = joystick.getBoundingClientRect();
  const x = event.clientX - box.left - box.width / 2;
  const y = event.clientY - box.top - box.height / 2;
  const cap = box.width*.32;
  const length = Math.max(cap, Math.hypot(x,y));
  touch.x = x/length;
  touch.y = y/length;
  stick.style.transform = `translate(${touch.x*cap}px,${touch.y*cap}px)`;
}

joystick.addEventListener('pointerdown', event => {
  if (touch.pointer !== null || event.button !== 0) return;
  touch.pointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  steerTouch(event);
});
joystick.addEventListener('pointermove', event => {
  if (touch.pointer === event.pointerId) steerTouch(event);
});
brake.addEventListener('pointerdown', event => {
  brakePointer = event.pointerId;
  brake.setPointerCapture(event.pointerId);
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) {
  joystick.addEventListener(name, event => {
    if (touch.pointer !== event.pointerId) return;
    touch.x = touch.y = 0;
    touch.pointer = null;
    stick.style.transform = '';
  });
  brake.addEventListener(name, event => {
    if (brakePointer === event.pointerId) brakePointer = null;
  });
}
window.addEventListener('keydown', event => {
  if (event.code === 'KeyE' && !event.repeat) useAction();
  if (movement.has(event.code) && !(event.code === 'Space' && event.target.closest('button, a'))) {
    event.preventDefault();
    keys.add(event.code);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
interact.addEventListener('click', useAction);
find('reset').addEventListener('click', () => { reset(); message('已回到車庫。'); });

reset();
let previous = performance.now();
function render(now) {
  const dt = document.hidden ? 0 : Math.min(.045, Math.max(0, (now-previous)/1000));
  previous = now;
  frame += dt;
  update(dt);
  const target = mission?.destination || pickup;
  const remaining = mission ? Math.ceil(mission.destination.limit - mission.elapsed) : 0;
  find('objective').textContent = mission ? '送貨到' + target.name + ' · ' +
    (remaining > 0 ? remaining + ' 秒' : '已超時，仍可送達') : ready;
  find('trip').textContent = (active ? active.name + ' · ' + Math.round(Math.abs(active.speed)*5) + ' km/h' : '步行') + ' · 已送達 ' + delivered;
  interact.textContent = action();
  if (now > messageUntil && find('notice').textContent) find('notice').textContent = '';
  drawCity(scene,map,{camera,cars,person,active,target,frame});
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
