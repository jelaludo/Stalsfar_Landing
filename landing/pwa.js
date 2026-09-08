let promptEvent,registration,reloading=false;
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;});
window.addEventListener('appinstalled',()=>{promptEvent=null;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-install]');if(!button)return;
 const help=button.parentElement.querySelector('[data-install-help]');
 if(registration?.waiting){reloading=true;registration.waiting.postMessage('ACTIVATE_UPDATE');return;}
 if(installed()){help.hidden=false;help.textContent='App installed. Ready to fly.';return;}
 if(promptEvent){const event=promptEvent;promptEvent=null;await event.prompt();await event.userChoice;return;}
 help.hidden=false;help.textContent=(/iPad|iPhone|iPod/.test(navigator.userAgent)||/Mac/.test(navigator.platform)&&navigator.maxTouchPoints>1)?'In Safari, tap Share → Add to Home Screen.':'Use your browser menu → Install app or Add to Home Screen.';
});
if('serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
 navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{updateViaCache:'none'}).then(r=>{
  registration=r;
  const announce=()=>{if(r.waiting)document.querySelectorAll('[data-install]').forEach(b=>{b.textContent='UPDATE READY · RELOAD';b.hidden=false;});};
  announce();if(installed()&&!r.waiting)document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',announce));
  new MutationObserver(()=>{announce();if(installed()&&!r.waiting)document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);}).observe(document.body,{childList:true});
 }).catch(()=>{/* Online play still works if offline installation is unavailable. */});
}
