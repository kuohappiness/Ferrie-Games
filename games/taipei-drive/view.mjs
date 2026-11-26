import { buildings, limits, roads } from './city.mjs';

const ground = { minX: limits.minX - 1, maxX: limits.maxX + 1, minZ: limits.minZ - 1, maxZ: limits.maxZ + 1 };

export function drawCity(canvas, map, state) {
  const ctx = canvas.getContext('2d');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = Math.min(devicePixelRatio, 1.7);
  const pixelsX = Math.round(width * ratio);
  const pixelsY = Math.round(height * ratio);
  if (canvas.width !== pixelsX || canvas.height !== pixelsY) {
    canvas.width = pixelsX;
    canvas.height = pixelsY;
  }
  if (!width || !height) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const zoom = Math.max(7, Math.min(width / 32, height / 46, 18));
  const { camera, cars, person, active, target, frame } = state;
  function point(x, y, z) {
    const dx = x - camera.x;
    const dz = z - camera.z;
    return [width * .5 + (dx - dz) * .87 * zoom, height * .54 + ((dx + dz) * .44 - y) * zoom];
  }
  function poly(points, color) {
    ctx.beginPath();
    for (const p of points) ctx.lineTo(...p);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function rect(x, z, w, d, color) {
    poly([point(x-w/2,0,z-d/2),point(x+w/2,0,z-d/2),point(x+w/2,0,z+d/2),point(x-w/2,0,z+d/2)], color);
  }
  function prism(x, z, w, d, bottom, top, angle, colors) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const corners = [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]
      .map(([dx,dz]) => [x + dx*c + dz*s, z + dz*c - dx*s]);
    for (let i = 0; i < 4; i++) {
      const [ax,az] = corners[i];
      const [bx,bz] = corners[(i+1)%4];
      if (bz - az <= bx - ax) continue;
      poly([point(ax,top,az),point(bx,top,bz),point(bx,bottom,bz),point(ax,bottom,az)], colors[i%2+1]);
    }
    poly(corners.map(([cx,cz]) => point(cx,top,cz)), colors[0]);
  }
  const water = ctx.createLinearGradient(0, 0, width, height);
  water.addColorStop(0, '#377a9a');
  water.addColorStop(1, '#70bab8');
  ctx.fillStyle = water;
  ctx.fillRect(0,0,width,height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#d5fcf753';
  for (let i = 0; i < 56; i++) {
    const x = -48 + i % 8 * 1.46;
    const z = -39 + Math.floor(i / 8) * 12 + Math.sin(i) * 2;
    ctx.beginPath();
    ctx.moveTo(...point(x,0,z));
    ctx.lineTo(...point(x,0,z + 1.6 + Math.sin(frame * 2 + i) * .35));
    ctx.stroke();
  }
  rect(0,0,ground.maxX-ground.minX,ground.maxZ-ground.minZ,'#c9c5ac');
  rect(-32,0,4,53,'#a6bf92');
  for (const [x,z,w,d] of roads) {
    rect(x,z,w,d,'#4c5a6c');
    const across = w > d;
    for (let a = -(across?w:d)/2 + 1.5; a < (across?w:d)/2; a += 3) {
      const px = x + (across?a:0);
      const pz = z + (across?0:a);
      const intersection = roads.some(([rx,rz,rw,rd]) => (rw > rd) !== across &&
        Math.abs(rx-px) < rw/2 && Math.abs(rz-pz) < rd/2);
      if (!intersection) rect(px,pz,across?1.35:.13,across?.13:1.35,'#ecd596');
    }
  }
  for (const [x,z] of [[-7,9],[26.5,9],[-7,-9],[26.5,-9]]) {
    for (let i=-2;i<=2;i++) rect(x+i*.82,z,.48,1.45,'#eef1de');
  }
  const [tx,ty] = point(target.x, .02, target.z);
  ctx.fillStyle = '#ffe89355';
  ctx.strokeStyle = '#ffdb64';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const pulse = 1.65 + .13 * Math.sin(frame * 4);
  ctx.ellipse(tx,ty,pulse*zoom,pulse*zoom*.52,0,0,Math.PI*2);
  ctx.fill();
  ctx.stroke();

  const shapes = buildings.map(([x,z,w,d,h,color], index) => ({
    depth: x + z + (w+d)*.38, paint() {
      prism(x,z,w,d,0,h,0,['#f2d6ba',color,index%2?'#748999':'#877a91']);
      for (let floor=2;floor<h-1;floor+=2.2) {
        for (let col=-w/2+1.1;col<w/2-.35;col+=1.8) {
          const corners = [point(x+col,floor,z+d/2+.01),point(x+col+.85,floor,z+d/2+.01),
            point(x+col+.85,floor+.8,z+d/2+.01),point(x+col,floor+.8,z+d/2+.01)];
          poly(corners, floor>3?'#f9e7b8':'#435877');
        }
      }
      if (index === 3) {
        for (let tier=0;tier<4;tier++) prism(x,z,4.9-tier*.75,4.6-tier*.64,h+tier*1.65,h+(tier+1)*1.65,0,
          ['#b3dcd4','#639a9d','#477780']);
        prism(x,z,.26,.26,h+6.6,h+8,0,['#faffec','#b2d7df','#719eaa']);
      }
      if ([9,10,11,12,13].includes(index)) {
        const [sx,sy] = point(x,1.55,z+d/2+.08);
        ctx.font = 'bold '+Math.max(8,zoom*.64)+'px system-ui';
        ctx.textAlign = 'center';
        const sign = ({9:'早午餐',10:'豆花',11:'台灣茶',12:'夜市',13:'車庫'})[index];
        ctx.fillStyle = '#252740';
        ctx.fillRect(sx-zoom*1.53,sy-zoom*.95,zoom*3.06,zoom*1.17);
        ctx.fillStyle = '#ffe3a1';
        ctx.fillText(sign,sx,sy-.14*zoom);
      }
    },
  }));
  for (const car of cars) shapes.push({ depth: car.x+car.z, paint() {
    prism(car.x,car.z,1.65,3.1,.19,.83,car.angle,[car.color,car.color,'#46596d']);
    prism(car.x,car.z,1.32,1.63,.83,1.28,car.angle,['#a2c5d7','#526782','#344961']);
  } });
  if (!active) shapes.push({depth:person.x+person.z,paint() {
    const [x,y] = point(person.x,0,person.z);
    ctx.fillStyle = '#172d42';
    ctx.beginPath(); ctx.ellipse(x,y,zoom*.42,zoom*.2,0,0,Math.PI*2); ctx.fill();
    prism(person.x,person.z,.61,.5,.2,1.32,0,['#ffe1a5','#f49b64','#a65c67']);
    const [hx,hy] = point(person.x,1.5,person.z);
    ctx.fillStyle = '#ffe1b1';
    ctx.beginPath(); ctx.arc(hx,hy,zoom*.24,0,Math.PI*2); ctx.fill();
  }});
  shapes.sort((a,b) => a.depth-b.depth);
  for (const shape of shapes) shape.paint();

  const local = map.getContext('2d');
  const mapX = x => 12 + (x-limits.minX)/70*152;
  const mapY = z => 12 + (z-limits.minZ)/54*128;
  local.clearRect(0,0,map.width,map.height);
  local.fillStyle = '#7898a3';
  local.fillRect(12,12,152,128);
  local.fillStyle = '#314762';
  for (const [x,z,w,d] of roads) local.fillRect(mapX(x-w/2),mapY(z-d/2),w*152/70,d*128/54);
  const dot = (x,z,r,color) => {
    local.fillStyle = color; local.beginPath(); local.arc(mapX(x),mapY(z),r,0,Math.PI*2); local.fill();
  };
  for (const car of cars) dot(car.x,car.z,4,'#77d9ff');
  dot(target.x,target.z,6,'#ffe47c');
  const player = active || person;
  dot(player.x,player.z,4,'#fff');
}
