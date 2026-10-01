const CORE="kron-core-v1",MEDIA="kron-media-v1";
const INDEX=new URL("index.html",self.registration.scope).href;
const inflight={};

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CORE);await c.add(new Request(INDEX,{cache:"reload"}));
    const m=await caches.open(MEDIA);
    for(const f of ["1.mp3","2.mp3"]){
      const u=new URL(f,self.registration.scope).href;
      if(!(await m.match(u))){const r=await fetch(u);if(r.ok)await m.put(u,r)}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==CORE&&k!==MEDIA)await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(/\.mp3$/i.test(u.pathname))e.respondWith(audio(r));
  else if((r.mode==="navigate"&&u.href.startsWith(self.registration.scope))||u.href===INDEX)e.respondWith(page(e));
});

// Sayfa: önce önbellek, arkada güncelle (yeni sürüm bir sonraki açılışta görünür)
async function page(e){
  const c=await caches.open(CORE),hit=await c.match(INDEX);
  const up=fetch(INDEX,{cache:"no-cache"}).then(r=>{if(r.ok)c.put(INDEX,r.clone());return r}).catch(()=>null);
  e.waitUntil(up);
  return hit||(await up)||new Response("Çevrimdışı",{status:503});
}
// Ses: ilk çalışta tamamını indirip saklar, sonra internetsiz çalar
async function audio(req){
  const m=await caches.open(MEDIA),u=req.url;
  let res=await m.match(u);
  if(!res){
    try{
      await (inflight[u]||(inflight[u]=fetch(u).then(r=>{if(!r.ok)throw 0;return m.put(u,r)}).finally(()=>{delete inflight[u]})));
      res=await m.match(u);
    }catch(_){}
    if(!res)return fetch(req);
  }
  return ranged(req,res);
}
async function ranged(req,res){
  const h=req.headers.get("range"),g=h&&/bytes=(\d*)-(\d*)/.exec(h);
  if(!g||(g[1]===""&&g[2]===""))return res;
  const buf=await res.arrayBuffer(),n=buf.byteLength;
  const s=g[1]===""?Math.max(0,n-parseInt(g[2],10)):parseInt(g[1],10);
  const e=g[1]===""||g[2]===""?n-1:Math.min(parseInt(g[2],10),n-1);
  if(s>=n||e<s)return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+n}});
  return new Response(buf.slice(s,e+1),{status:206,headers:{"Content-Type":"audio/mpeg","Content-Length":String(e-s+1),"Content-Range":"bytes "+s+"-"+e+"/"+n,"Accept-Ranges":"bytes"}});
}
