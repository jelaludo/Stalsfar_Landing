const CACHE='six-down-08';
const ASSETS=["./", "index.html", "landing/", "landing/index.html", "landing/launch-plume.js", "landing/starship-intro.js", "landing/fleet.js", "landing/recovery.js", "landing/lander.js", "landing/audio.js", "landing/style.css", "landing/touch-pilot.js", "landing/manifest.webmanifest", "landing/pwa.js", "landing/icons/icon-192.png", "landing/icons/icon.svg", "landing/icons/icon-180.png", "landing/icons/icon-512.png", "landing/assets/hugin_deployed.png", "landing/assets/hugin_wreck.png", "landing/assets/hugin_stowed.png", "landing/assets/atlas.json", "landing/assets/recovery/hugin.glb", "landing/assets/audio/launch.mp3", "landing/assets/audio/handoff.mp3", "landing/assets/audio/alarm.mp3", "landing/assets/audio/crash.mp3", "landing/assets/audio/impact.mp3", "landing/vendor/three/three.module.js", "landing/vendor/three/three.core.js", "landing/vendor/three/GLTFLoader.js", "landing/vendor/three/BufferGeometryUtils.js"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('six-down-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return cache.match(new URL('landing/',self.registration.scope));throw error;}})());
});
