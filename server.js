import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
const root=path.resolve('public'),file=path.resolve(process.env.DATA_FILE||'locations.json'),port=Number(process.env.PORT||3000),password=process.env.ADMIN_PASSWORD,secret=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
if(!password){console.error('Set ADMIN_PASSWORD first');process.exit(1)}
const sign=x=>crypto.createHmac('sha256',secret).update(x).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const auth=req=>{let t=/(?:^|; )admin=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(!t)return false;let [e,s]=t.split('.');return Number(e)>Date.now()&&equal(s,sign(e))};
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const input=async req=>{let s='';for await(const c of req){s+=c;if(s.length>200000)throw Error('Too large')}return JSON.parse(s)};
const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
const valid=a=>Array.isArray(a)&&a.length<200&&a.every(x=>/^[a-z0-9-]{1,40}$/.test(x.id)&&typeof x.name==='string'&&x.name.length<101&&Number.isFinite(x.x)&&x.x>=0&&x.x<=1198&&Number.isFinite(x.y)&&x.y>=0&&x.y<=1313&&typeof x.node==='string')&&new Set(a.map(x=>x.id)).size===a.length;
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');
if(u.pathname==='/api/data')return send(res,200,read());
if(u.pathname==='/api/auth')return send(res,200,{admin:auth(req)});
if(u.pathname==='/api/login'&&req.method==='POST'){const b=await input(req);if(!equal(b.password||'',password))return send(res,401,{error:'Incorrect password'});const e=String(Date.now()+86400000);res.setHeader('Set-Cookie',`admin=${e}.${sign(e)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);return send(res,200,{admin:true})}
if(u.pathname==='/api/logout'&&req.method==='POST'){res.setHeader('Set-Cookie','admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{admin:false})}
if(u.pathname==='/api/save'&&req.method==='POST'){if(!auth(req))return send(res,401,{error:'Sign in first'});const b=await input(req);if(!valid(b.rooms)||!valid(b.scans))return send(res,400,{error:'Invalid locations'});fs.writeFileSync(file+'.tmp',JSON.stringify(b,null,2));fs.renameSync(file+'.tmp',file);return send(res,200,{saved:true})}
if (u.pathname.startsWith('/api/qr/')) {
  const id = decodeURIComponent(u.pathname.slice(8));

  const base =
    process.env.PUBLIC_URL?.replace(/\/$/, '') ||
    `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

  // Floor QR codes
  const floorMatch = id.match(/^floor-(0|1|2|3)$/);

  let targetUrl;

  if (floorMatch) {
    const floor = floorMatch[1];

    targetUrl = `${base}/?floor=${floor}`;
  } else {
    // Keep existing QR points working
    if (!read().scans.some((s) => s.id === id)) {
      return send(res, 404, { error: 'Unknown QR point' });
    }

    targetUrl = `${base}/?from=${encodeURIComponent(id)}`;
  }

  const png = await QRCode.toBuffer(
    targetUrl,
    {
      width: 360,
      margin: 2
    }
  );

  res.writeHead(200, {
    'Content-Type': 'image/png'
  });

  return res.end(png);
}
const target=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!target.startsWith(root+path.sep))return send(res,403,{error:'Forbidden'});const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpeg':'image/jpeg'};fs.readFile(target,(err,data)=>{if(err)return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(data)})
}catch(e){send(res,400,{error:e.message})}}).listen(port,()=>console.log(`Open http://localhost:${port}`));
