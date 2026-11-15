const encoder=new TextEncoder();
const now=()=>Date.now();
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
const randomHex=size=>hex(crypto.getRandomValues(new Uint8Array(size)));
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const cookie=(value,age)=>`session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
function fail(status,code) {throw Object.assign(new Error(code),{status,code});}
async function body(request) {
  if (request.headers.get('content-type')?.split(';')[0]!=='application/json') fail(415,'format');
  const reader=request.body?.getReader();
  if (!reader) fail(400,'format');
  const decoder=new TextDecoder();
  let length=0;
  let input='';
  while (true) {
    const {done,value}=await reader.read();
    if (done) break;
    length+=value.byteLength;
    if (length>8192) {await reader.cancel(); fail(413,'format');}
    input+=decoder.decode(value,{stream:true});
  }
  try {
    const data=JSON.parse(input+decoder.decode());
    if (data && typeof data==='object' && !Array.isArray(data)) return data;
  } catch {}
  fail(400,'format');
}
async function derive(password,salt) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));
}
async function verify(password,salt,secret) {
  const computed=await derive(password,salt);
  let difference=computed.length^secret.length;
  for (let i=0;i<computed.length;i++) difference|=computed.charCodeAt(i)^secret.charCodeAt(i);
  return difference===0;
}
function pair(code,peer) {return code<peer?[code,peer]:[peer,code];}
const limits=new Map();
function throttle(key,max) {
  const time=now();
  for (const [id,record] of limits) if (record.until<=time) limits.delete(id);
  const record=limits.get(key)||{count:0,until:time+60000};
  record.count++;
  limits.set(key,record);
  if (record.count>max) fail(429,'slow');
}
function credentials(data) {
  const name=typeof data.name==='string'?data.name.trim():'';
  const password=data.password;
  if (!/^[\p{L}\p{N}_-]{2,24}$/u.test(name)||typeof password!=='string'||password.length<8||password.length>128) fail(400,'credentials');
  return {name,password};
}
export default {async fetch(request,env) {
  const path=new URL(request.url).pathname;
  if (request.method==='GET'&&Object.hasOwn(assets,path)) {
    const type=path==='/'?'text/html':'application/javascript';
    return new Response(assets[path],{headers:{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}});
  }
  const send=(status,value,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
  try {
    const db=env.DB;
    const statement=(query,...args)=>db.prepare(query).bind(...args);
    const sql=(query,...args)=>statement(query,...args).run();
    const get=(query,...args)=>statement(query,...args).first();
    const all=async(query,...args)=>(await statement(query,...args).all()).results;
    async function profile(code) {
      const record=await get('SELECT u.code,u.name,u.best,u.largest,f.alias AS friendCode FROM users u LEFT JOIN friend_codes f ON f.account=u.code WHERE u.code=?',code);
      if (!record || record.friendCode) return record;
      for (let attempt=0;attempt<16;attempt++) {
        const random=crypto.getRandomValues(new Uint32Array(1))[0]%1757600;
        const letters=Math.floor(random/100);
        const alias=String.fromCharCode(65+Math.floor(letters/676),65+Math.floor(letters/26)%26,65+letters%26)+String(random%100).padStart(2,'0');
        await sql('INSERT OR IGNORE INTO friend_codes(account,alias) SELECT code,? FROM users WHERE code=?',alias,code);
        const assigned=await get('SELECT alias FROM friend_codes WHERE account=?',code);
        if (assigned) return {...record,friendCode:assigned.alias};
      }
      fail(503,'server');
    }
    const blocked=(code,peer)=>get('SELECT 1 FROM blocks WHERE (owner=? AND peer=?) OR (owner=? AND peer=?)',code,peer,peer,code);
    const token=request.headers.get('cookie')?.match(/(?:^|; )session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const key=token?await digest(token):'';
    async function session(code,old) {
      const token=randomHex(32);
      const hash=await digest(token);
      await db.batch([
        statement('DELETE FROM sessions WHERE expires<=? OR digest=?',now(),old),
        statement('INSERT INTO sessions VALUES(?,?,?)',hash,code,now()+2592000000)
      ]);
      return cookie(token,2592000);
    }
    if (!path.startsWith('/api/')) fail(404,'missing');
    const route=path.slice(5);
    const method=request.method;
    if (method!=='POST'&&method!=='GET') fail(405,'missing');
    if (method==='POST' && request.headers.get('sec-fetch-site')==='cross-site') fail(403,'forbidden');
    if (method==='POST'&&['register','login'].includes(route)) {
      throttle('auth:'+(request.headers.get('cf-connecting-ip')||'local'),12);
      const {name,password}=credentials(await body(request));
      let user=await get('SELECT * FROM users WHERE name=?',name);
      if (route==='register') {
        if (user) fail(409,'taken');
        const code=randomHex(6);
        const salt=randomHex(16);
        const secret=await derive(password,salt);
        const created=await sql('INSERT OR IGNORE INTO users(code,name,salt,secret) VALUES(?,?,?,?)',code,name,salt,secret);
        if (!created.meta.changes) fail(409,'taken');
        user={code};
      } else {
        const valid=await verify(password,user?.salt||'unregistered',user?.secret||'0'.repeat(64));
        if (!user||!valid) fail(401,'wrong');
      }
      return send(200,{user:await profile(user.code)},{'set-cookie':await session(user.code,key)});
    }
    const code=(await get('SELECT code FROM sessions WHERE digest=? AND expires>?',key,now()))?.code;
    if (!code) fail(401,'login');
    if (method==='GET'&&route==='me') return send(200,{user:await profile(code)});
    if (method==='GET'&&route==='friends') {
      const people=await all(`
        SELECT u.code,u.name,u.best,u.largest,f.sender,f.accepted,
          (SELECT count(*) FROM messages m WHERE m.sender=u.code AND m.recipient=? AND m.seen=0) AS unread
        FROM friends f JOIN users u ON u.code=CASE WHEN f.a=? THEN f.b ELSE f.a END
        WHERE f.a=? OR f.b=? ORDER BY u.best DESC,u.name
      `,code,code,code,code);
      const blockedPeople=await all('SELECT u.code,u.name FROM blocks b JOIN users u ON u.code=b.peer WHERE b.owner=? ORDER BY u.name',code);
      return send(200,{people,blocked:blockedPeople});
    }
    if (method!=='POST') fail(404,'missing');
    throttle('user:'+code,120);
    const data=await body(request);
    if (route==='logout') {
      await sql('DELETE FROM sessions WHERE digest=?',key);
      return send(200,{ok:true},{'set-cookie':cookie('',0)});
    }
    if (route==='delete') {
      const user=await get('SELECT * FROM users WHERE code=?',code);
      if (typeof data.password!=='string'||data.password.length>128||!await verify(data.password,user.salt,user.secret)) fail(401,'wrong');
      await sql('DELETE FROM users WHERE code=?',code);
      return send(200,{ok:true},{'set-cookie':cookie('',0)});
    }
    if (route==='sync') {
      const {best,largest}=data;
      if (!Number.isSafeInteger(best)||best<0||!Number.isSafeInteger(largest)||largest<0||
         (largest!==0&&(largest<2||!Number.isInteger(Math.log2(largest))))) fail(400,'format');
      await sql('UPDATE users SET best=max(best,?),largest=max(largest,?) WHERE code=?',best,largest,code);
      return send(200,{user:await profile(code)});
    }
    const supplied=typeof data.peer==='string'?data.peer.trim():'';
    let peer=supplied.toLowerCase();
    if (route==='invite' && /^[a-z]{3}[0-9]{2}$/i.test(supplied)) {
      peer=(await get('SELECT account FROM friend_codes WHERE alias=?',supplied.toUpperCase()))?.account||'';
    }
    if (!/^[a-f0-9]{12}$/.test(peer)||peer===code||!await get('SELECT code FROM users WHERE code=?',peer)) fail(404,'peer');
    const [a,b]=pair(code,peer);
    const friend=await get('SELECT sender,accepted FROM friends WHERE a=? AND b=?',a,b);
    if (route==='block') {
      await db.batch([statement('INSERT OR IGNORE INTO blocks VALUES(?,?)',code,peer),statement('DELETE FROM friends WHERE a=? AND b=?',a,b)]);
    } else if (route==='unblock') {
      await sql('DELETE FROM blocks WHERE owner=? AND peer=?',code,peer);
    } else if (route==='report') {
      const message=await get('SELECT id,sender,body FROM messages WHERE id=? AND sender=? AND recipient=?',Number.isSafeInteger(data.id)?data.id:-1,peer,code);
      if (!message) fail(404,'missing');
      await sql('INSERT OR IGNORE INTO reports VALUES(?,?,?,?,?)',code,message.id,peer,message.body,now());
    } else {
      if (await blocked(code,peer)) fail(403,'forbidden');
      if (route==='invite') {
        await sql(`INSERT OR IGNORE INTO friends(a,b,sender) SELECT ?,?,?
          WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE (owner=? AND peer=?) OR (owner=? AND peer=?))`,a,b,code,code,peer,peer,code);
      } else if (route==='accept') {
        if (!friend||friend.sender===code) fail(403,'forbidden');
        await sql('UPDATE friends SET accepted=1 WHERE a=? AND b=?',a,b);
      } else if (route==='remove') {
        await sql('DELETE FROM friends WHERE a=? AND b=?',a,b);
      } else {
        if (!friend?.accepted) fail(403,'forbidden');
        if (route==='messages') {
          const messages=await all(`SELECT id,sender,body,created FROM (
            SELECT id,sender,body,created FROM messages
            WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY id DESC LIMIT 100
          ) ORDER BY id`,code,peer,peer,code);
          const latest=messages.at(-1)?.id;
          if (latest) await sql('UPDATE messages SET seen=1 WHERE sender=? AND recipient=? AND id<=?',peer,code,latest);
          return send(200,{messages});
        }
        if (route!=='send') fail(404,'missing');
        const message=typeof data.text==='string'?data.text.trim():'';
        if (!message||message.length>500) fail(400,'message');
        const saved=await sql(`INSERT INTO messages(sender,recipient,body,created) SELECT ?,?,?,?
          WHERE EXISTS (SELECT 1 FROM friends WHERE a=? AND b=? AND accepted=1)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE (owner=? AND peer=?) OR (owner=? AND peer=?))`,code,peer,message,now(),a,b,code,peer,peer,code);
        if (!saved.meta.changes) fail(403,'forbidden');
      }
    }
    return send(200,{ok:true});
  } catch(error) {
    if (!error.status) console.error(error);
    return send(error.status||500,{error:error.status?error.code:'server'});
  }
}};
