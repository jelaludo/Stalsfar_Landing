import * as T from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

// Loaded only for a completed run with three or more recovered boosters.
export async function mountRecovery(stage,signal){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 stage.prepend(renderer.domElement);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-35,35,35,-35,.1,400);
 scene.add(new T.HemisphereLight(0xe5f6ff,0x4f6460,2));
 const key=new T.DirectionalLight(0xfff4df,3.5);key.position.set(-30,65,35);scene.add(key);
 const fill=new T.DirectionalLight(0x90c9e4,1);fill.position.set(20,10,-20);scene.add(fill);
 let root,mixer,raf=0,last=0,time=0,disposed=false,bounds;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const disposeRoot=object=>{object?.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())if(m){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});};
 const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);disposeRoot(root);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 const resize=()=>{
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h);
  if(bounds){
   const center=bounds.getCenter(new T.Vector3());camera.position.copy(center).add(new T.Vector3(85,85,85));camera.lookAt(center);camera.updateMatrixWorld();
   let x=0,y=0;
   for(const a of [bounds.min.x,bounds.max.x])for(const b of [bounds.min.y,bounds.max.y])for(const c of [bounds.min.z,bounds.max.z]){const p=new T.Vector3(a,b,c).applyMatrix4(camera.matrixWorldInverse);x=Math.max(x,Math.abs(p.x));y=Math.max(y,Math.abs(p.y));}
   const half=Math.max(y,x/(w/h))*1.1;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  }
  renderer.render(scene,camera);
 };
 const observer=new ResizeObserver(resize);observer.observe(stage);signal.addEventListener('abort',cleanup,{once:true});
 if(signal.aborted){cleanup();return;}
 try{
  const bytes=await fetch(new URL('./assets/recovery/hugin.glb',import.meta.url),{signal}).then(r=>{if(!r.ok)throw Error('HUGIN unavailable');return r.arrayBuffer();});
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  if(disposed){disposeRoot(gltf.scene);return;}
  root=gltf.scene;scene.add(root);mixer=new T.AnimationMixer(root);
  const clip=gltf.animations[0];if(clip)mixer.clipAction(clip).play();
  // Fit the entire motion envelope once, so moving cargo never moves the camera.
  bounds=new T.Box3();for(let t=0;t<=(clip?.duration??0);t+=.5){mixer.setTime(t);bounds.union(new T.Box3().setFromObject(root,true));}mixer.setTime(0);resize();
  stage.dataset.ready='true';stage.querySelector('.recovery-status').textContent='HUGIN / CARGO RECOVERY';
  const frame=stamp=>{if(disposed)return;raf=requestAnimationFrame(frame);if(document.hidden){last=stamp;return;}if(stamp-last<1000/30)return;const dt=last?Math.min((stamp-last)/1000,.1):0;last=stamp;if(!reduced){time+=dt;mixer.setTime(time);}renderer.render(scene,camera);};
  raf=requestAnimationFrame(frame);
 }catch(error){cleanup();if(!signal.aborted){stage.dataset.failed='true';stage.querySelector('.recovery-status').textContent='HUGIN / RECOVERY SECURED';}}
 return cleanup;
}
