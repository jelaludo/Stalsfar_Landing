import { createLandingAudio } from './audio.js';
import { createFleetDirector } from './fleet.js';
import { createLaunchPlume } from './launch-plume.js';
// Six Down — a standalone 2D landing experiment. Model by jelaludo.
export const CONFIG = {
  sim: { dt: 1 / 120, maxSteps: 8, gravity: 3.2, drag: 0.0016 }, // Seconds; catch-up bound; m/s²; thin atmosphere.
  vehicle: { height: 21.4, thrust: 12, burnRate: 8, spool: 4, torque: 3, damping: 3.5,
    foot: 5.1, legHeight: 11.25, legTime: .6, autoLegsAlt: 200, minThrottle: .35 }, // Metres from supplied atlas; dry COM estimate.
  terrain: { width: 1400, step: 2, base: 35, ridge: 45, detail: 6, separation: 155,
    pads: [{tier:'BARGE',width:64,mult:1},{tier:'APRON',width:42,mult:1.6},
      {tier:'BULLSEYE',width:22,mult:2.5},{tier:'SHELF',width:38,mult:1.4,slope:11},
      {tier:'DUSTY',width:48,mult:1.8},{tier:'APRON',width:38,mult:1.6},{tier:'BARGE',width:56,mult:1}] }, // Seven options for six entries; tighter site than ten-entry spec.
  land: { sinkPerfect:2.5,sinkHard:6,latPerfect:1.5,latHard:4,tiltPerfect:4,tiltHard:11,slopePerfect:5,slopeHard:9 }, // m/s and degrees, worst reading decides.
  queue: { interval:18,holdBurn:3.5,minFuel:45,transition:2.8 }, // Longer cadence for six-entry PoC: ~100–150 seconds with deliberate flying.
  wreck: { debrisWidth:34,particles:20,breakSpeeds:[10,22,34],tipImpulse:1.8,inertia:42,restitution:.12,friction:.7,angularDrag:.22,contactIterations:8,sleepSpeed:.18,sleepTime:.65 }, // Metres; shards; impact rad/s; normalized inertia; contact and settling parameters.
  cinematic: { opening:8,ignitionHold:3,launchYEnd:-1048576,arrival:2.6,speed:3,reentryTime:4.5 }, // Presentation seconds; physics starts after camera handoff.
  wind: { frequency:.19 }, // Smooth seeded gust frequency.
  score: { base:{propellant:6,alloy:10,crew:1,credits:100},hardMultiplier:.55,roughMultiplier:.5,
    salvage:{propellant:0,alloy:3,crew:0,credits:15},skipBundle:{propellant:40,alloy:40,crew:4,credits:400},
    gradeBands:[1250,950,650,350],noAssistBonus:1.25 }, // Six-entry grade bands; surviving crew remain whole people.
  hud: { predictorSeconds:35,predictorDt:.15,margin:6,callouts:[500,200,100,50,20,10] }, // Extended lookahead: 2 seconds cannot reach terrain at entry altitude.
  view: { dprCap:2,closeScale:5.2,zoomAltitude:380,sky:'#060e14',ground:'#112c2c',edge:'#4c9383',hot:'#ffcb85',good:'#8de0b4',bad:'#f18b7b' },
  entries: [ // Altitude AGL, sink m/s, fuel units, wind m/s². Tuned for six manual flights.
    {alt:460,sink:38,fuel:110,wind:0,tilt:-.32,lateral:12}, {alt:500,sink:43,fuel:108,wind:.12,tilt:.28,lateral:-12},
    {alt:540,sink:47,fuel:105,wind:.2,tilt:-.32,lateral:13}, {alt:580,sink:51,fuel:102,wind:.3,tilt:.3,lateral:-13},
    {alt:620,sink:55,fuel:100,wind:.4,tilt:-.35,lateral:14}, {alt:650,sink:58,fuel:98,wind:.5,tilt:.35,lateral:-14} ],
};
export function openingCameraY(time) {
 const c=CONFIG.cinematic;
 const p=Math.max(0,Math.min(1,(time-c.ignitionHold)/(c.opening-c.ignitionHold-.4)));
 if(p>=1)return c.launchYEnd;
 if(p<=.55){const q=p/.55;return 2-10*q*q*(3-2*q);}
 if(p<=.7)return -8;
 return -8*Math.pow(Math.abs(c.launchYEnd)/8,(p-.7)/.3);
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const deg=x=>x*180/Math.PI;
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));

// RNG: separate deterministic noise and random stream; rendering consumes neither.
export function createRng(seed) {
 let hash=2166136261; for(const c of String(seed)) hash=Math.imul(hash^c.charCodeAt(0),16777619);
 let state=hash>>>0;
 const random=()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
 const sample=i=>{let x=Math.imul(i^hash,374761393);x=Math.imul(x^x>>>13,1274126177);return((x^x>>>16)>>>0)/4294967295*2-1;};
 const noise=x=>{const i=Math.floor(x),t=x-i;return lerp(sample(i),sample(i+1),t*t*(3-2*t));};
 return {random,noise};
}
export function createTerrain(seed) {
 const rng=createRng(seed),cfg=CONFIG.terrain,heights=[];
 for(let x=0;x<=cfg.width;x+=cfg.step) heights.push(cfg.base+cfg.ridge*(1-Math.abs(rng.noise(x*.004)))+cfg.detail*rng.noise(x*.031));
 const pads=cfg.pads.map((p,i)=>({...p,id:i,x:230+i*cfg.separation+(rng.random()-.5)*25,slope:p.slope||0}));
 for(const p of pads){p.y=heights[Math.round(p.x/cfg.step)];for(let j=0;j<heights.length;j++){const x=j*cfg.step;if(Math.abs(x-p.x)<=p.width/2+cfg.step) heights[j]=p.y+Math.tan(p.slope*Math.PI/180)*(x-p.x);}}
 const height=x=>{const f=clamp(x/cfg.step,0,heights.length-1),i=Math.floor(f);return lerp(heights[i],heights[Math.min(i+1,heights.length-1)],f-i);};
 const slope=x=>deg(Math.atan2(height(x+CONFIG.vehicle.foot)-height(x-CONFIG.vehicle.foot),2*CONFIG.vehicle.foot));
 return {heights,pads,occupied:[],height,slope,noise:rng.noise};
}
export function createVehicle(terrain,index,fuel) {
 const c=CONFIG.entries[index%CONFIG.entries.length],pad=terrain.pads[index%terrain.pads.length];
 return {x:pad.x-c.lateral*8,y:terrain.height(pad.x)+c.alt+CONFIG.vehicle.legHeight,vx:c.lateral,vy:-c.sink,
  angle:c.tilt,angVel:0,fuel:fuel??c.fuel,throttle:0,legs:0,deploy:false,alive:true,index};
}
export function flightStep(v,input,dt,wind=0) {
 const c=CONFIG.vehicle;
 v.throttle+=clamp((input.thrust?1:0)-v.throttle,-c.spool*dt,c.spool*dt);
 if(v.fuel<=0)v.throttle=0;
 const actual=v.throttle>0?Math.max(c.minThrottle,v.throttle):0;
 v.angVel+=(input.turn*c.torque-v.angVel*(input.stability===false?1:c.damping))*dt;
 v.angle=wrap(v.angle+v.angVel*dt);
 const drag=CONFIG.sim.drag+(v.legs===1?.0009:0);
 // Clockwise angle from vertical: positive thrust x agrees with the rendered nose.
 v.vx+=(Math.sin(v.angle)*c.thrust*actual+wind-drag*v.vx*Math.abs(v.vx))*dt;
 v.vy+=(Math.cos(v.angle)*c.thrust*actual-CONFIG.sim.gravity-drag*v.vy*Math.abs(v.vy))*dt;
 v.fuel=Math.max(0,v.fuel-c.burnRate*actual*dt);
 if(v.deploy)v.legs=Math.min(1,v.legs+dt/c.legTime);
 v.x+=v.vx*dt;v.y+=v.vy*dt;
}
export function feet(v) {
 const c=CONFIG.vehicle,s=Math.sin(v.angle),k=Math.cos(v.angle);
 return [-c.foot,c.foot].map(x=>({x:v.x+x*k-c.legHeight*s,y:v.y-x*s-c.legHeight*k}));
}
// Convex geometry is the narrow collision test. A crash's debris-range width is
// metadata only: it must never become a horizontal platform or a solid column.
function convexHull(points) {
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const side=list=>{const result=[];for(const p of list){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
 return [...side(sorted).slice(0,-1),...side(sorted.reverse()).slice(0,-1)];
}
function bodyPolygon(body) {
 return convexHull(wreckHull(body));
}
function debrisPolygon(p) {
 const c=Math.cos(p.angle),s=Math.sin(p.angle);
 return [[-1,.5],[1,.3],[.4,-.65]].map(([x,y])=>({x:p.x+p.size*(x*c+y*s),y:p.y+p.size*(-x*s+y*c)}));
}
function polygonsTouch(a,b) {
 for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=p.y-q.y,ny=q.x-p.x;
  let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
  for(const r of a){const d=r.x*nx+r.y*ny;amin=Math.min(amin,d);amax=Math.max(amax,d);}
  for(const r of b){const d=r.x*nx+r.y*ny;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
  if(amax<bmin||bmax<amin)return false;
 }
 return true;
}
export function findObstacle(vehicle,terrain) {
 const rocket=bodyPolygon(vehicle);
 for(const body of terrain.occupied){
  if((body.parts??[body]).some(part=>polygonsTouch(rocket,bodyPolygon(part))))return body;
  for(const shard of body.debris??[])if(shard.rest&&polygonsTouch(rocket,debrisPolygon(shard)))return body;
 }
 return null;
}
function padOccupied(pad,terrain) {
 const strip=[{x:pad.x-pad.width/2,y:pad.y+CONFIG.vehicle.height},{x:pad.x+pad.width/2,y:pad.y+CONFIG.vehicle.height},
  {x:pad.x+pad.width/2,y:pad.y-8},{x:pad.x-pad.width/2,y:pad.y-8}];
 return terrain.occupied.some(body=>(body.parts??[body]).some(part=>polygonsTouch(strip,bodyPolygon(part)))||(body.debris??[]).some(p=>p.rest&&polygonsTouch(strip,debrisPolygon(p))));
}

export function evaluateTouchdown(v,terrain) {
 const l=CONFIG.land,points=feet(v),slope=Math.abs(deg(Math.atan2(terrain.height(points[1].x)-terrain.height(points[0].x),Math.abs(points[1].x-points[0].x)||.001)));
 const readings=[['SINK',Math.max(0,-v.vy),l.sinkPerfect,l.sinkHard,'m/s'],['DRIFT',Math.abs(v.vx),l.latPerfect,l.latHard,'m/s'],['TILT',Math.abs(deg(v.angle)),l.tiltPerfect,l.tiltHard,'°'],['SLOPE',slope,l.slopePerfect,l.slopeHard,'°']];
 let worst=0,deciding=readings[0];
 for(const r of readings){const grade=r[1]>r[3]?2:r[1]>r[2]?1:0;if(grade>worst || (grade===worst&&r[1]/r[3]>deciding[1]/deciding[3])){worst=grade;deciding=r;}}
 let verdict=`${deciding[0]} ${deciding[1].toFixed(1)}${deciding[4]} · LIMIT ${(worst?deciding[3]:deciding[2]).toFixed(1)}${deciding[4]}`;
 if(v.legs<1){worst=2;verdict=`LEGS ${Math.round(v.legs*100)}% · REQUIRED 100%`;}
 const obstacle=findObstacle(v,terrain);
 if(obstacle){worst=2;verdict='SITE OCCUPIED · FOOTPRINT MUST BE CLEAR';}
 if(v.x<Math.min(...points.map(p=>p.x))||v.x>Math.max(...points.map(p=>p.x))){worst=2;verdict='TIPOVER · CENTER OF MASS OUTSIDE FEET';}
 const pad=terrain.pads.find(p=>points.every(f=>Math.abs(f.x-p.x)<=p.width/2));
 return {outcome:['perfect','hard','wreck'][worst],sink:Math.max(0,-v.vy),lateral:Math.abs(v.vx),tilt:Math.abs(deg(v.angle)),slope,padId:pad?.id??null,padTier:pad?.tier??'ROUGH',verdict,fuelLeft:v.fuel};
}
export function predictImpact(v,terrain,wind=0) {
 const p={...v};const path=[];
 for(let t=0;t<CONFIG.hud.predictorSeconds;t+=CONFIG.hud.predictorDt){
  flightStep(p,{thrust:v.throttle>.5,turn:0},CONFIG.hud.predictorDt,wind);
  if(path.length<70&&Math.round(t/CONFIG.hud.predictorDt)%3===0)path.push({x:p.x,y:p.y});
  if(p.y-CONFIG.vehicle.legHeight<=terrain.height(p.x)) return {x:p.x,y:terrain.height(p.x),path,reached:true};
 }return {x:p.x,y:p.y,path,reached:false};
}

// Clockwise 2D rigid body. The collision envelope follows the complete damaged sprite.
export function wreckHull(body) {
 if(body.parts)return body.parts.flatMap(wreckHull);
 const c=Math.cos(body.angle),s=Math.sin(body.angle);
 return (body.localHull??[[-5.5,-11.25],[5.5,-11.25],[-2.9,-7],[2.9,-7],[-2.9,6],[2.9,6],[-1.6,9],[1.6,9],[0,10.15]].map(([x,y])=>({x,y}))).map(({x,y})=>({x:body.x+x*c+y*s,y:body.y-x*s+y*c}));
}
function clipSection(polygon,level,above) {
 const result=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],ain=above?a.y>=level:a.y<=level,bin=above?b.y>=level:b.y<=level;
  if(ain)result.push(a);
  if(ain!==bin){const f=(level-a.y)/(b.y-a.y);result.push({x:lerp(a.x,b.x,f),y:level});}
 }
 return result;
}
export function breakWreck(body,impactSpeed,rng) {
 const thresholds=CONFIG.wreck.breakSpeeds;
 const count=impactSpeed>thresholds[2]?4:impactSpeed>thresholds[1]?3:impactSpeed>thresholds[0]?2:1;
 if(count===1)return;
 const cuts=count===4?[-11.25,-5,.5,5.5,10.15]:count===3?[-11.25,-3,4.5,10.15]:[-11.25,3.8,10.15];
 const source=convexHull(wreckHull({...body,x:0,y:0,angle:0}));
 body.parts=Array.from({length:count},(_,i)=>{
  const low=cuts[i],high=cuts[i+1],center=(low+high)/2;
  const outline=clipSection(clipSection(source,low,true),high,false).map(p=>({x:p.x,y:p.y-center}));
  const spread=(i-(count-1)/2)*Math.min(4,impactSpeed*.075);
  return {...body,parts:undefined,debris:[],section:{low,high,center},localHull:outline,
   x:body.x+center*Math.sin(body.angle),y:body.y+center*Math.cos(body.angle),
   vx:body.vx+spread,vy:body.vy+Math.abs(spread)*.5,
   angVel:body.angVel+(rng.random()-.5)*1.5+(i-(count-1)/2)*.3,
   inertia:Math.max(2,((high-low)**2+36)/12),tipImpulse:.45,
   width:Math.max(...outline.map(p=>p.x))-Math.min(...outline.map(p=>p.x))};
 });
 body.breakCount=count;
}

export function createWreck(v,terrain,seed) {
 const rng=createRng(`${seed}:impact:${v.index}`),direction=Math.sign(v.vx)||Math.sign(v.angle)||1;
 const body={...v,alive:false,outcome:'wreck',legs:1,throttle:0,age:0,settled:false,quiet:0,
  impactX:v.x,tipDirection:direction,tipApplied:false,angle:v.angle,angVel:v.angVel,
  vx:v.vx*.4,vy:Math.max(-45,v.vy),width:CONFIG.wreck.debrisWidth,top:v.y+10.15};
 body.debris=Array.from({length:CONFIG.wreck.particles},()=>({x:v.x+(rng.random()-.5)*7,y:Math.max(terrain.height(v.x)+1,v.y-7)+rng.random()*3,
  vx:(rng.random()-.5)*10+v.vx*.08,vy:3+rng.random()*9,angle:rng.random()*6.28,spin:(rng.random()-.5)*8,
  size:.3+rng.random()*.85,rest:false,heat:.4+rng.random()*.6}));
 breakWreck(body,Math.hypot(Math.max(0,-v.vy),v.vx, v.angVel*CONFIG.vehicle.height*.5),rng);
 return body;
}
export function stepWreck(body,terrain,dt,onImpact) {
 const cfg=CONFIG.wreck,g=CONFIG.sim.gravity,inertia=body.inertia??cfg.inertia;
 body.age+=dt;
 if(body.parts){
  for(const part of body.parts)stepWreck(part,terrain,dt,onImpact);
  body.settled=body.parts.every(p=>p.settled);
  body.x=body.parts.reduce((sum,p)=>sum+p.x,0)/body.parts.length;body.y=body.parts.reduce((sum,p)=>sum+p.y,0)/body.parts.length;
  body.angle=body.parts[0].angle;
 }else if(!body.settled){
  body.vy-=g*dt;body.vx*=Math.exp(-.08*dt);body.angVel*=Math.exp(-cfg.angularDrag*dt);
  body.x+=body.vx*dt;body.y+=body.vy*dt;body.angle=wrap(body.angle+body.angVel*dt);
  let touching=false,peakImpact=0;
  for(let iteration=0;iteration<cfg.contactIterations;iteration++){
   const contacts=wreckHull(body).map(p=>({...p,depth:terrain.height(p.x)-p.y})).filter(p=>p.depth>=-.015).sort((a,b)=>b.depth-a.depth);
   if(!contacts.length)break;touching=true;
   for(const p of contacts){
    const slope=(terrain.height(p.x+.15)-terrain.height(p.x-.15))/.3,norm=Math.hypot(slope,1),nx=-slope/norm,ny=1/norm;
    const rx=p.x-body.x,ry=p.y-body.y,lever=ry*nx-rx*ny;
    const normalSpeed=(body.vx+body.angVel*ry)*nx+(body.vy-body.angVel*rx)*ny;
    peakImpact=Math.max(peakImpact,-normalSpeed);
    if(normalSpeed<0){
     const restitution=normalSpeed<-1?cfg.restitution:0;
     const impulse=-(1+restitution)*normalSpeed/(1+lever*lever/inertia);
     body.vx+=impulse*nx;body.vy+=impulse*ny;body.angVel+=lever*impulse/inertia;
     const tx=ny,ty=-nx,tangentLever=ry*tx-rx*ty;
     const slip=(body.vx+body.angVel*ry)*tx+(body.vy-body.angVel*rx)*ty;
     const friction=clamp(-slip/(1+tangentLever*tangentLever/inertia),-impulse*cfg.friction,impulse*cfg.friction);
     body.vx+=friction*tx;body.vy+=friction*ty;body.angVel+=tangentLever*friction/inertia;
    }
   }
   const depth=contacts[0].depth;if(depth>0)body.y+=depth+.001;
  }
  if(touching&&peakImpact>2.5&&body.age-(body.lastImpactAt??-100)>.18){
   body.lastImpactAt=body.age;onImpact?.({x:body.x,speed:peakImpact,age:body.age});
  }
  // Asymmetric leg failure supplies the impact impulse, after ground shock is resolved.
  if(touching&&!body.tipApplied){body.angVel+=body.tipDirection*(body.tipImpulse??cfg.tipImpulse);body.tipApplied=true;}
  const moving=Math.hypot(body.vx,body.vy)+Math.abs(body.angVel)*5;
  body.quiet=touching&&moving<cfg.sleepSpeed?body.quiet+dt:0;
  if(body.quiet>=cfg.sleepTime){body.settled=true;body.vx=body.vy=body.angVel=0;}
 }
 for(const p of body.debris){
  if(p.rest)continue;p.vy-=g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
  const ground=terrain.height(p.x)+p.size*.4;
  if(p.y<=ground){p.y=ground;p.vy=Math.abs(p.vy)*.16;p.vx*=.55;p.spin*=.4;if(p.vy<.5&&Math.abs(p.vx)<.5){p.rest=true;p.vx=p.vy=p.spin=0;}}
 }
 const hull=wreckHull(body),xs=[body.impactX-cfg.debrisWidth/2,body.impactX+cfg.debrisWidth/2,...hull.map(p=>p.x),...body.debris.map(p=>p.x)];
 body.width=2*Math.max(body.x-Math.min(...xs),Math.max(...xs)-body.x);
 body.top=Math.max(...hull.map(p=>p.y));
}

export function createDirector(seed,entries=6,assists={}) {
 const impacts=[],terrain=createTerrain(seed),count=clamp(Math.floor(entries)||6,1,6);
 const state={seed,count,terrain,v:createVehicle(terrain,0),previous:null,time:0,entryTime:0,index:0,phase:'ready',
  transition:0,openingTime:0,arrivalTime:0,currentWreck:null,selected:0,landings:[],verdict:'CHOOSE YOUR GROUND. MAKE IT HOME.',
  assists:{predictor:true,stabilityHold:true,autoLegs:true,slowMo:false,...assists},used:new Set(),callout:'',orient:false};
 state.previous={...state.v};
 const wind=()=>CONFIG.entries[state.index].wind*terrain.noise(state.time*CONFIG.wind.frequency);
 const resolve=forced=>{
  const v=state.v,r=forced??evaluateTouchdown(v,terrain);v.alive=false;
  const mult=(terrain.pads.find(p=>p.id===r.padId)?.mult??CONFIG.score.roughMultiplier)*(r.outcome==='hard'?CONFIG.score.hardMultiplier:1);
  r.index=state.index;r.payout=r.outcome==='wreck'?{...CONFIG.score.salvage}:{propellant:Math.round(CONFIG.score.base.propellant*mult+v.fuel),alloy:Math.round(CONFIG.score.base.alloy*mult),crew:1,credits:Math.round(CONFIG.score.base.credits*mult)};
  state.landings.push(r);state.verdict=`${r.outcome.toUpperCase()} / ${r.verdict}`;
  const wreck=r.outcome==='wreck';
  state.currentWreck=wreck&&r.padTier!=='OUTSIDE'?createWreck(v,terrain,seed):null;
  if(state.currentWreck)terrain.occupied.push(state.currentWreck);
  else if(!wreck)terrain.occupied.push({...v,y:terrain.height(v.x)+CONFIG.vehicle.legHeight,angle:r.outcome==='hard'?.055:0,legs:1,landedAt:state.time,landingSink:r.sink,outcome:r.outcome,width:CONFIG.vehicle.foot*2+4,top:terrain.height(v.x)+CONFIG.vehicle.height});
  state.phase='resolved';state.transition=0;
  return r;
 };
 const step=(input,dt=CONFIG.sim.dt)=>{
  if(state.phase==='ready'||state.phase==='done')return null;
  if(state.phase==='opening'){state.openingTime+=dt;if(state.openingTime>=CONFIG.cinematic.opening)state.phase='ready';return null;}
  if(state.phase==='arrival'){state.arrivalTime+=dt*CONFIG.cinematic.speed;if(state.arrivalTime>=CONFIG.cinematic.arrival)state.phase='flying';return null;}
  state.time+=dt;
  for(const body of terrain.occupied)if(body.outcome==='wreck')stepWreck(body,terrain,dt,impact=>impacts.push({...impact,time:state.time}));
  if(state.phase==='resolved'){
   state.transition+=dt;
   if(state.transition>=CONFIG.queue.transition&&(!state.currentWreck||state.currentWreck.settled)){
    if(state.index+1===count){state.phase='done';return null;}
    const overlap=Math.max(0,state.time-state.entryTime-CONFIG.queue.interval);
    state.index++;state.v=createVehicle(terrain,state.index,Math.max(CONFIG.queue.minFuel,CONFIG.entries[state.index].fuel-overlap*CONFIG.queue.holdBurn));
    state.previous={...state.v};state.entryTime=state.time;state.selected=state.index;state.phase='flying';state.orient=false;state.currentWreck=null;
   }return null;
  }
  const v=state.v,agl=v.y-terrain.height(v.x)-CONFIG.vehicle.legHeight;
  for(const [k,on] of Object.entries(state.assists))if(on)state.used.add(k);
  if(state.assists.autoLegs&&agl<=CONFIG.vehicle.autoLegsAlt)v.deploy=true;
  let turn=input.turn;
  if(turn)state.orient=false;
  if(state.orient){const target=clamp(Math.atan2(-v.vx,Math.max(1,-v.vy)),-.7,.7);turn=clamp(wrap(target-v.angle)*4-v.angVel*2,-1,1);}
  state.previous={...v};flightStep(v,{...input,turn,stability:state.assists.stabilityHold},dt,wind());
  const nextAgl=v.y-terrain.height(v.x)-CONFIG.vehicle.legHeight;
  for(const alt of CONFIG.hud.callouts)if(agl>alt&&nextAgl<=alt)state.callout=`${alt} metres`;
  if(v.x<0||v.x>CONFIG.terrain.width||v.y>2000)return resolve({outcome:'wreck',sink:Math.max(0,-v.vy),lateral:Math.abs(v.vx),tilt:Math.abs(deg(v.angle)),slope:0,padId:null,padTier:'OUTSIDE',fuelLeft:v.fuel,verdict:'OUT OF SECTOR · VEHICLE LOST'});
  const occupied=findObstacle(v,terrain);
  if(occupied||feet(v).some(p=>p.y<=terrain.height(p.x)))return resolve();
  return null;
 };
 const result=(status='completed')=>{
  const resources={propellant:0,alloy:0,crew:0,credits:0};
  for(const r of state.landings)for(const key of Object.keys(resources))resources[key]+=r.payout[key];
  let streak=0,best=0;for(const r of state.landings){streak=r.outcome==='perfect'?streak+1:0;best=Math.max(best,streak);}
  const survivors=state.landings.filter(r=>r.outcome!=='wreck').length;
  const bonuses={perfectStreak:Math.max(0,best-1)*25,allSix:survivors===6?150:0,siteEfficiency:new Set(state.landings.filter(r=>r.outcome!=='wreck'&&r.padId!==null).map(r=>r.padId)).size*10};
  resources.credits+=Object.values(bonuses).reduce((a,b)=>a+b,0);
  if(!state.used.size)resources.credits=Math.round(resources.credits*CONFIG.score.noAssistBonus);
  const finalResources=status==='skipped'?{...CONFIG.score.skipBundle}:resources;
  return {status,seed,durationMs:Math.round(state.time*1000),grade:status==='skipped'?'D':['S','A','B','C','D'][CONFIG.score.gradeBands.findIndex(b=>finalResources.credits>=b)===-1?4:CONFIG.score.gradeBands.findIndex(b=>finalResources.credits>=b)],resources:finalResources,
   landings:state.landings.map(r=>({...r})),bonuses,assistsUsed:[...state.used].sort(),survivors,reconstructionUnlocked:status==='completed'&&survivors>=5};
 };
 return {state,step,wind,result,resolve,drainImpacts:()=>impacts.splice(0)};
}

// View owns only presentation state. World units stay metres, +Y up.
export function landingCompression(age,sink) {
 if(age<0||age>1.5)return 0;
 return Math.min(.8,.14+sink*.11)*Math.exp(-3.8*age)*Math.sin(11*age);
}
function createView(canvas,ui,director) {
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas2D unavailable');
 
 const {state,wind}=director,t=state.terrain,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let launchEffect=!reduced&&state.phase==='opening'?createLaunchPlume(ui):null;
 if(state.phase==='opening'&&!launchEffect)state.phase='ready';
 let width=0,height=0,dpr=1,camX=700,camY=320,scale=1,lastIndex=-1,sprites=null,atlas=null;
 let fps=60,debug=false,lastHud=0,prediction=null,playCenter=350,playBottom=600;
 const starRng=createRng('sky');const stars=Array.from({length:95},()=>({x:starRng.random(),y:starRng.random(),r:starRng.random()*1.2+.3}));
 const resize=()=>{width=canvas.clientWidth;height=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,CONFIG.view.dprCap);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);};
 resize();
 const pt=(x,y)=>({x:width/2+(x-camX)*scale,y:playCenter+(camY-y)*scale});
 const line=(a,b,color,w=1)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
 const label=(text,x,y,color=CONFIG.view.edge,size=11)=>{ctx.font=`${size}px ui-monospace, SFMono-Regular, monospace`;ctx.fillStyle=color;ctx.fillText(text,x,y);};
 const drawVehicle=(v,outcome,absoluteTime)=>{
  const compression=!reduced&&v.landedAt!==undefined?landingCompression(state.time-v.landedAt,v.landingSink):0;
  const p=pt(v.x+compression*Math.sin(v.angle),v.y-compression*Math.cos(v.angle));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(v.angle);
  if(outcome)ctx.globalAlpha=outcome==='wreck'?.9:.8;
  if(v.section){const cut=v.section;ctx.beginPath();ctx.rect(-20*scale,(cut.center-cut.high)*scale,40*scale,(cut.high-cut.low)*scale);ctx.clip();ctx.translate(0,cut.center*scale);}
  // Draw articulated struts behind the intact skin; feet stay planted as the body settles.
  if(outcome!=='wreck'&&v.legs>0){
   const deployment=v.legs*v.legs*(3-2*v.legs);
   ctx.save();ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
   for(const sign of [-1,1]){
    const hip={x:sign*2.5,y:5.8},knee={x:sign*(3+deployment*(1.5+compression*.55)),y:7.8+deployment*.65-compression*.45};
    const foot={x:sign*(2.9+deployment*2.2),y:8.8+deployment*2.45-compression};
    const stroke=(points,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    stroke([hip,knee,foot],'#343530',.48);
    stroke([hip,knee,foot],'#9b9989',.22);
    stroke([{x:sign*2.55,y:7.5},knee],'#575c56',.28);
    stroke([{x:sign*2.55,y:7.5},{x:(sign*2.55+knee.x)*.5,y:(7.5+knee.y)*.5}],'#b0b6ae',.13);
    ctx.fillStyle='#b7b4a0';for(const joint of [hip,knee]){ctx.beginPath();ctx.arc(joint.x,joint.y,.24,0,Math.PI*2);ctx.fill();}
    stroke([{x:foot.x-.65,y:foot.y},{x:foot.x+.65,y:foot.y}],'#85877a',.24);
   }
   ctx.restore();
  }
  const kind=outcome==='wreck'?'wreck':'stowed';
  if(sprites&&atlas){const factor=scale/atlas.pixels_per_metre;ctx.drawImage(sprites[kind],-atlas.sprites[kind].pivot_px[0]*factor,-atlas.sprites[kind].pivot_px[1]*factor,atlas.image_size_px[0]*factor,atlas.image_size_px[1]*factor);}
  else {ctx.scale(scale,scale);ctx.fillStyle=outcome==='wreck'?'#755b49':'#c9d8d3';ctx.beginPath();ctx.moveTo(0,-10.15);ctx.lineTo(2.8,-6);ctx.lineTo(2.8,8);ctx.lineTo(-2.8,8);ctx.lineTo(-2.8,-6);ctx.closePath();ctx.fill();ctx.strokeStyle='#96b5ae';ctx.lineWidth=.7;for(const sign of outcome==='wreck'?[-1,1]:[]){ctx.beginPath();ctx.moveTo(sign*2,4);ctx.lineTo(sign*(v.legs>=1?5.1:2.9),v.legs>=1?11.25:7);ctx.lineTo(sign*(v.legs>=1?6:3.3),v.legs>=1?11.25:7);ctx.stroke();}ctx.scale(1/scale,1/scale);}
  if(!outcome&&v.throttle>0){const flame=(5+v.throttle*16)*(reduced?1:1+.1*Math.sin(absoluteTime*41));ctx.fillStyle=CONFIG.view.hot;ctx.beginPath();ctx.moveTo(-1.4*scale,8*scale);ctx.lineTo(0,(8+flame)*scale);ctx.lineTo(1.4*scale,8*scale);ctx.fill();ctx.fillStyle='#fff6d3';ctx.fillRect(-.5*scale,8*scale,scale,flame*scale*.45);}
  ctx.restore();
 };
 const drawReentry=(v,intensity,absoluteTime)=>{
  if(reduced||intensity<=0)return;
  const p=pt(v.x,v.y),speed=Math.hypot(v.vx,v.vy),dx=v.vx/speed,dy=-v.vy/speed;
  const radius=Math.max(10,scale*8),length=radius*(8.5+.6*Math.sin(absoluteTime*42));
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(dy,dx));ctx.globalCompositeOperation='lighter';
  const aura=ctx.createRadialGradient(radius*.35,0,0,0,0,radius*2.5);
  aura.addColorStop(0,'#d8f4ffbb');aura.addColorStop(.3,'#59baff66');aura.addColorStop(1,'#258cff00');
  ctx.globalAlpha=intensity;ctx.fillStyle=aura;ctx.fillRect(-radius*2.5,-radius*2.5,radius*5,radius*5);
  for(let layer=0;layer<3;layer++){
   const breadth=[1.2,.8,.38][layer],tail=length*(1-layer*.16);
   const trail=ctx.createLinearGradient(-tail,0,radius,0);
   trail.addColorStop(0,'#2e83ff00');trail.addColorStop(.35,['#3c95ff77','#ffbc3877','#fff6be66'][layer]);
   trail.addColorStop(.85,['#84d8ffcc','#ffe273ee','#ffffffff'][layer]);trail.addColorStop(1,'#ffffff');
   ctx.fillStyle=trail;ctx.beginPath();ctx.moveTo(-tail,0);
   ctx.quadraticCurveTo(-radius*2,-radius*breadth,radius*.75,-radius*.42*breadth);
   ctx.quadraticCurveTo(radius*1.3,0,radius*.75,radius*.42*breadth);
   ctx.quadraticCurveTo(-radius*2,radius*breadth,-tail,0);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#ffdd50';ctx.lineWidth=Math.max(3,scale*.7);ctx.beginPath();ctx.arc(0,0,radius*1.1,-.95,.95);ctx.stroke();
  ctx.strokeStyle='#f2fcff';ctx.lineWidth=Math.max(2,scale*.4);ctx.beginPath();ctx.arc(0,0,radius,-.85,.85);ctx.stroke();
  for(let i=0;i<24;i++){
   const q=(absoluteTime*5.1+i*.137)%1,x=-radius-q*length,y=Math.sin(i*31)*radius*(.3+q);
   ctx.globalAlpha=intensity*(1-q);ctx.strokeStyle=i%3===0?'#72caff':i%3===1?'#fffefa':'#ffe174';
   ctx.lineWidth=Math.max(1,scale*.22);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-radius*(.3+q),y);ctx.stroke();
  }
  ctx.restore();
 };
 const draw=(dt,absoluteTime,alpha=1)=>{
  fps=lerp(fps,1/Math.max(.001,dt),.04);
  if(state.phase==='opening'){launchEffect?.draw(state.openingTime,openingCameraY(state.openingTime),width,height);return;}
  if(launchEffect){launchEffect.destroy();launchEffect=null;}
  const v={...state.v,x:lerp(state.previous.x,state.v.x,alpha),y:lerp(state.previous.y,state.v.y,alpha),angle:state.previous.angle+wrap(state.v.angle-state.previous.angle)*alpha};
  const arrival=state.phase==='arrival',arrivalProgress=clamp(state.arrivalTime/CONFIG.cinematic.arrival,0,1),pullback=1-Math.pow(1-arrivalProgress,3);
  if(arrival){const lead=CONFIG.cinematic.arrival-state.arrivalTime;v.x-=v.vx*lead;v.y-=v.vy*lead;}
  if(state.phase==='resolved'&&state.currentWreck){v.x=state.currentWreck.x;v.y=t.height(v.x)+CONFIG.vehicle.legHeight;}
  const agl=Math.max(0,v.y-t.height(v.x)-CONFIG.vehicle.legHeight),mobile=width<700;
  const deckTop=ui.querySelector('.flight-deck').offsetTop-24;
  playBottom=state.phase==='opening'?height-65:arrival?lerp(height-65,deckTop,arrivalProgress*arrivalProgress*(3-2*arrivalProgress)):deckTop;
  const playTop=mobile?160:180;playCenter=(playTop+playBottom)/2;
  const usable=Math.max(120,playBottom-playTop);
  const wide=Math.min(width/1550,usable/750),zoom=reduced?0:Math.pow(1-clamp(agl/CONFIG.view.zoomAltitude,0,1),1.5);
  const flightScale=Math.min(lerp(wide,Math.min(CONFIG.view.closeScale,width/95),zoom),Math.max(wide,usable*.85/(agl+20)));
  const targetScale=arrival?lerp(Math.min(12,width/38),wide,pullback):state.mode==='fleet'&&(state.controlled===null||state.time<11)?wide:flightScale;
  const targetX=arrival?v.x+(700-v.x)*wide/targetScale*pullback:state.mode==='fleet'&&(state.controlled===null||state.time<11)?700:v.x+(700-v.x)*wide/targetScale*(1-zoom)+v.vx*.3*zoom;
  if(lastIndex!==state.index){scale=wide;camX=700;camY=330;lastIndex=state.index;}
  const ease=1-Math.exp(-dt*10);scale=lerp(scale,targetScale,ease);camX=lerp(camX,targetX,ease);camY=t.height(v.x)+(playBottom-playCenter-30)/scale;
  if(arrival){scale=targetScale;camX=targetX+width*.2*(1-arrivalProgress)/scale;const wideRocketY=playBottom-30-(v.y-t.height(v.x))*wide;
   const screenY=lerp(playCenter-height*.2*(1-arrivalProgress),wideRocketY,pullback);camY=v.y+(screenY-playCenter)/scale;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=CONFIG.view.sky;ctx.fillRect(0,0,width,height);
  const glow=ctx.createRadialGradient(width*.52,height*.4,0,width*.52,height*.4,width*.7);glow.addColorStop(0,'#143034');glow.addColorStop(1,'#060e14');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  for(const s of stars){ctx.globalAlpha=.25+s.r*.2;ctx.fillStyle='#bdd7ce';ctx.fillRect(s.x*width,s.y*height*.7,s.r,s.r);}ctx.globalAlpha=1;
  // Distant ring and ridgelines supply depth without any runtime 3D.
  ctx.strokeStyle='#24433f';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(width*.78,height*.22,width*.15,width*.035,-.3,0,Math.PI*2);ctx.stroke();
  for(let layer=0;layer<2;layer++){ctx.beginPath();ctx.moveTo(0,height);for(let x=0;x<=width+10;x+=10){const wx=(x-width/2)/Math.max(.1,scale*.35)+camX;const y=pt(wx,120+layer*70+t.noise(wx*.002+layer*14)*65).y;ctx.lineTo(x,y);}ctx.lineTo(width,height);ctx.fillStyle=layer?'#0b2027':'#10292e';ctx.fill();}
  ctx.beginPath();const first=pt(0,t.heights[0]);ctx.moveTo(first.x,height);ctx.lineTo(first.x,first.y);
  t.heights.forEach((y,i)=>{const p=pt(i*CONFIG.terrain.step,y);ctx.lineTo(p.x,p.y);});ctx.lineTo(pt(CONFIG.terrain.width,0).x,height);ctx.closePath();ctx.fillStyle=CONFIG.view.ground;ctx.fill();
  ctx.beginPath();t.heights.forEach((y,i)=>{const p=pt(i*CONFIG.terrain.step,y);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.strokeStyle=CONFIG.view.edge;ctx.lineWidth=1.6;ctx.stroke();
  // Subsurface survey contours.
  for(let depth=22;depth<180;depth+=26){ctx.beginPath();for(let x=0;x<=1400;x+=8){const p=pt(x,t.height(x)-depth);x?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.strokeStyle='#25433a';ctx.lineWidth=.6;ctx.stroke();}
  for(const pad of t.pads){const occupied=padOccupied(pad,t),selected=pad.id===state.selected;
   const a=pt(pad.x-pad.width/2,t.height(pad.x-pad.width/2)),b=pt(pad.x+pad.width/2,t.height(pad.x+pad.width/2));
   const color=occupied?'#987566':selected?CONFIG.view.hot:'#8ad0b0';line(a,b,color,selected?3:2);
   const center=pt(pad.x,pad.y);if(center.x>10&&center.x<width-10){label(`${String(pad.id+1).padStart(2,'0')}${occupied?' ×':''}`,center.x-8,center.y+20,color,11);if(selected){line({x:a.x-7,y:a.y-12},{x:a.x-7,y:a.y+5},color);line({x:b.x+7,y:b.y-12},{x:b.x+7,y:b.y+5},color);label('DESIGNATED',center.x-34,center.y-17,color,10);}}
  }
  for(const o of t.occupied){
   if(o.outcome==='wreck'){
    if(!reduced&&o.age<.6){const p=pt(o.impactX,t.height(o.impactX)),r=(5+o.age*22)*scale;ctx.save();ctx.globalAlpha=(1-o.age/.6)*.5;ctx.strokeStyle=CONFIG.view.hot;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.3,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
   }
   for(const part of o.parts??[o])drawVehicle(part,o.outcome,absoluteTime);
   for(const shard of o.debris??[]){if(reduced&&!shard.rest)continue;const p=pt(shard.x,shard.y),size=Math.max(1.5,shard.size*scale);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(shard.angle);ctx.fillStyle=o.age<1.5?'#e7af76':'#9c7863';ctx.beginPath();ctx.moveTo(-size,-size*.5);ctx.lineTo(size,-size*.3);ctx.lineTo(size*.4,size*.65);ctx.closePath();ctx.fill();ctx.restore();}
  }
  if(state.assists.predictor&&prediction&&state.phase==='flying'){
   ctx.setLineDash([3,7]);for(let i=1;i<prediction.path.length;i++)line(pt(prediction.path[i-1].x,prediction.path[i-1].y),pt(prediction.path[i].x,prediction.path[i].y),'#67867b77');ctx.setLineDash([]);
   if(prediction.reached){const p=pt(prediction.x,prediction.y);line({x:p.x-5,y:p.y-5},{x:p.x+5,y:p.y+5},'#88ad9b');line({x:p.x+5,y:p.y-5},{x:p.x-5,y:p.y+5},'#88ad9b');}
  }
  for(const unit of state.fleet??[]){if(unit.resolved||unit.v===state.v)continue;const other=unit.v;drawReentry(other,arrival?.6:clamp(1-state.time/11,0,.85),absoluteTime);drawVehicle(other,null,absoluteTime);const p=pt(other.x,other.y);label(`H-${other.index+1} AUTO`,clamp(p.x+8,8,width-90),clamp(p.y,playTop+50,playBottom-20),'#7bbaa4',9);}
  if(state.phase!=='resolved'&&state.phase!=='done'&&state.v.alive){drawReentry(v,arrival?1:state.phase==='flying'?clamp(1-(state.time-state.entryTime)/(state.mode==='fleet'?9:CONFIG.cinematic.reentryTime),0,1):0,absoluteTime);drawVehicle(v,null,absoluteTime);}
  const rocket=pt(v.x,v.y);
  if(state.phase==='flying'&&state.v.alive){
   // A fixed-size locator keeps the true-scale vehicle findable at wide zoom.
   const r=Math.max(14,CONFIG.vehicle.height*scale*.65);ctx.strokeStyle='#a4c7b477';ctx.beginPath();ctx.arc(rocket.x,rocket.y,r,-.6,.6);ctx.stroke();ctx.beginPath();ctx.arc(rocket.x,rocket.y,r,Math.PI-.6,Math.PI+.6);ctx.stroke();
   label(`H-${String(state.index+1).padStart(2,'0')}`,rocket.x+r+9,rocket.y-5,'#b2c6bb',10);
   label(`${Math.round(agl)} M`,rocket.x+r+9,rocket.y+10,'#729184',10);
  }
  if(debug){const lines=[`FPS ${fps.toFixed(0)}  DT ${CONFIG.sim.dt.toFixed(5)}  SEED ${state.seed}`,`x ${v.x.toFixed(2)} y ${v.y.toFixed(2)} vx ${v.vx.toFixed(2)} vy ${v.vy.toFixed(2)}`,`angle ${v.angle.toFixed(3)} ω ${v.angVel.toFixed(3)} fuel ${v.fuel.toFixed(2)}`,`time ${state.time.toFixed(2)} entry ${state.index} occupied ${t.occupied.length}`,`art ${sprites?'SPRITES':'VECTOR'} scale ${scale.toFixed(2)}`];ctx.fillStyle='#050b10dd';ctx.fillRect(18,145,460,108);lines.forEach((s,i)=>label(s,28,165+i*18,'#9cd8b1',11));}
  if(absoluteTime-lastHud>.08){lastHud=absoluteTime;prediction=predictImpact(state.v,t,wind());updateHud(ui,director,prediction);}
 };
 return {draw,resize,destroy:()=>launchEffect?.destroy(),toggleDebug:()=>debug=!debug,setArt:(s,a)=>{sprites=s;atlas=a;}};
}

function updateHud(ui,director,prediction) {
 const {state,wind}=director,v=state.v,t=state.terrain,agl=Math.max(0,v.y-t.height(v.x)-CONFIG.vehicle.legHeight),pad=t.pads[state.selected];
 const set=(name,value)=>{const el=ui.querySelector(`[data-read="${name}"]`);if(el&&el.textContent!==String(value))el.textContent=value;};
 set('entry',`${String(state.index+1).padStart(2,'0')} / ${String(state.count).padStart(2,'0')}`);set('clock',`${Math.floor(state.time/60).toString().padStart(2,'0')}:${Math.floor(state.time%60).toString().padStart(2,'0')}`);
 set('sink',Math.max(0,-v.vy).toFixed(1));set('drift',`${v.vx<0?'←':'→'} ${Math.abs(v.vx).toFixed(1)}`);set('alt',Math.round(agl).toLocaleString());set('fuel',(v.fuel/CONFIG.vehicle.burnRate).toFixed(1));set('tilt',`${deg(v.angle).toFixed(1)}°`);
 set('wind',`${wind()<0?'←':'→'} ${Math.abs(wind()).toFixed(2)} m/s²`);set('legs',v.legs>=1?'DEPLOYED':v.deploy?'DEPLOYING':agl<200?'DEPLOY LEGS':'STOWED');
 set('target',pad?`${String(pad.id+1).padStart(2,'0')} ${pad.tier} · ${Math.round(pad.x-v.x)} m`:'FREE FLIGHT');set('slope',`${(pad?.slope??t.slope(prediction?.x??v.x)).toFixed(1)}°`);
 set('verdict',state.verdict);set('callout',state.callout);
 set('saved',state.landings.filter(r=>r.outcome!=='wreck').length);
 const delay=Math.max(0,state.time-state.entryTime-CONFIG.queue.interval),eta=Math.max(0,CONFIG.queue.interval-(state.time-state.entryTime));
 set('queue',state.index+1>=state.count?'FINAL VEHICLE':delay?`HOLDING · −${(delay*CONFIG.queue.holdBurn).toFixed(0)} FUEL`:`NEXT ENTRY IN ${eta.toFixed(0)}s`);
 set('phase',state.phase==='ready'?'AWAITING ENTRY':state.phase==='resolved'?'CONTACT REPORT':agl<120?'FINAL APPROACH':'DESCENT / DESIGNATE');
 if(state.mode==='fleet'){
  const flying=state.phase==='flying';
  set('phase',state.controlled===null?'FLEET / MONITORING':'MANUAL OVERRIDE');
  set('queue',`${state.fleet.filter(u=>!u.resolved).length} STILL DESCENDING`);
  const alert=ui.querySelector('.crt-alert');alert.hidden=!flying||state.time>state.noticeUntil;
  alert.querySelector('strong').textContent=state.index===4?'LANDING MODULE DAMAGED':'LANDING MODULE BROKEN!';
  const offer=ui.querySelector('.takeover-card');offer.hidden=!flying||!state.offer;
  if(state.offer)ui.querySelector('[data-offer-time]').textContent=`${Math.ceil(state.offer.until-state.time)}s`;
  const strip=ui.querySelector('.fleet-status');strip.hidden=!flying;
  strip.innerHTML=state.fleet.map(u=>`<span class="${u.v.index===state.controlled?'manual':''}">H-${u.v.index+1}<b>${u.resolved?u.outcome.toUpperCase():u.v.index===state.controlled?'YOU':Math.round(Math.max(0,u.v.y-t.height(u.v.x)-11.25))+' M'}</b></span>`).join('');
 }
 ui.querySelector('[data-fuel]').style.width=`${clamp(v.fuel/110*100,0,100)}%`;
 ui.querySelector('[data-sink]').style.width=`${clamp(-v.vy/60*100,0,100)}%`;
 ui.querySelector('[data-sink]').style.background=-v.vy>6?'#f18b7b':'#8de0b4';
 ui.querySelector('[data-drift]').style.width=`${clamp(Math.abs(v.vx)/15*100,0,100)}%`;
 for(const b of ui.querySelectorAll('[data-pad]')){
  const p=t.pads[Number(b.dataset.pad)],occupied=padOccupied(p,t);
  // A conservative advisory, not a claim of exact reachability under every input.
  const dvAvailable=CONFIG.vehicle.thrust*v.fuel/CONFIG.vehicle.burnRate;
  const fall=Math.max(.1,agl/Math.max(10,-v.vy));
  const needed=Math.max(0,-v.vy-2.5)+CONFIG.sim.gravity*fall+2*Math.sqrt(Math.abs(p.x-v.x)*CONFIG.vehicle.thrust*Math.sin(.35))+CONFIG.hud.margin;
  const grade=occupied?'occupied':p.slope>CONFIG.land.slopeHard?'slope':needed<dvAvailable*.75?'good':needed<dvAvailable?'marginal':'low';
  b.classList.toggle('selected',p.id===state.selected);b.setAttribute('aria-pressed',String(p.id===state.selected));b.dataset.feasibility=grade;
  b.querySelector('small').textContent=occupied?'× OCCUPIED':grade==='slope'?'× UNSAFE SLOPE':grade==='good'?'✓ FUEL MARGIN':grade==='marginal'?'! TIGHT MARGIN':'! LOW MARGIN';
 }
}

const activeCanvases=new WeakSet();
export function runLandingIntro(canvas,options={}) {
 if(activeCanvases.has(canvas))throw new Error('A landing intro is already running on this canvas');
 activeCanvases.add(canvas);
 return new Promise(resolve=>{
  let director,view,ui,sounds,raf=0,ended=false,paused=false,last=0,acc=0,wall=0,skipPending=false;
  const abort=new AbortController(),keys=new Set(),touch=new Map();
  const finish=(status='completed')=>{
   if(ended)return;ended=true;cancelAnimationFrame(raf);abort.abort();sounds?.destroy();view?.destroy();ui?.remove();activeCanvases.delete(canvas);
   canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);
   resolve(director?director.result(status):{status:'skipped',seed:options.seed??20260907,durationMs:0,grade:'D',resources:{...CONFIG.score.skipBundle},landings:[],bonuses:{},assistsUsed:[],survivors:0,reconstructionUnlocked:false});
  };
  try {
   sounds=createLandingAudio(abort.signal);
   director=options.mode==='fleet'?createFleetDirector(options.seed??Date.now(),options.assists):createDirector(options.seed??20260907,options.entries??6,options.assists);const {state}=director;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;state.phase=reduced?'ready':'opening';
   ui=document.createElement('div');ui.className='cockpit';
   ui.innerHTML=`<header class="masthead"><a class="wordmark" href="./">STÅLSFÄR<span>ENTRY OPERATIONS</span></a><div class="run-id">SECTOR 07 / HUGIN RECOVERY<br><span>LOCAL FLIGHT EXPERIMENT · 2D</span></div><div class="header-actions"><button data-action="pause" aria-label="Pause flight">Ⅱ <span>PAUSE</span></button><button data-action="settings" aria-expanded="false">ASSISTS</button><button data-action="skip">SKIP ↗</button></div></header>
    <section class="mission"><div><span class="eyebrow">VEHICLE</span><strong data-read="entry">01 / 06</strong></div><div class="mission-detail"><span class="eyebrow" data-read="phase">AWAITING ENTRY</span><span data-read="queue">NEXT ENTRY IN 18s</span></div><div class="mission-end"><span class="eyebrow">MISSION TIME</span><span data-read="clock">00:00</span></div></section>
    <div class="crt-alert" hidden aria-live="assertive"><strong>LANDING MODULE BROKEN!</strong><span>MANUAL OVERRIDE</span></div><section class="takeover-card" hidden><strong>LANDING MODULE DAMAGED</strong><p>H-05 · 50% automatic recovery chance.<br>Take over the final booster? <b data-offer-time></b></p><button data-action="takeover">TAKE OVER</button><button data-action="leave-auto">LEAVE ON AUTO</button></section><div class="fleet-status" hidden></div><div class="site-note"><span class="dot"></span> ONE SITE. SIX CHANCES.<span class="site-sub">RECOVER 5 TO REBUILD THE LAUNCHER</span></div>
    <div class="assists-panel" hidden><h3>FLIGHT ASSISTS</h3><label><input type="checkbox" data-assist="predictor" checked> Impact predictor</label><label><input type="checkbox" data-assist="stabilityHold" checked> Angular damping</label><label><input type="checkbox" data-assist="autoLegs" checked> Auto legs at 200 m</label><label><input type="checkbox" data-assist="slowMo"> Slow final 10 metres</label><label><input type="checkbox" data-sound checked> Sound effects</label><label><input type="checkbox" data-contrast> High contrast</label><p>O: orient to retrograde<br>H: diagnostic overlay</p></div>
    <div class="cinematic-plate"><span class="eyebrow" data-cinematic-title>HUGIN / EXHAUST SIGNATURE</span><span class="cinematic-subtitle">STÅLSFÄR · ARRIVAL CORRIDOR 07</span><a class="shader-credit" href="https://github.com/pulkitxm/claude-directory/tree/main/shaders/launch-shader" target="_blank" rel="noreferrer">LAUNCH SHADER · PULKIT · MIT</a><button data-action="skip-cinematic">SKIP CINEMATIC →</button></div>
    <section class="start-card" hidden><span class="eyebrow">STÅLHEART / ARRIVAL SEQUENCE</span><h1>SIX DOWN<span>Bring them home.</span></h1><p>Pick a landing site. Arrest your fall.<br>Every rocket you save becomes a beginning.</p><nav class="mode-picker" aria-label="Game mode"><a href="?mode=classic">CLASSIC / SIX MANUAL</a><a href="?mode=fleet">FLEET / MANUAL OVERRIDE</a></nav><p class="mode-description">${state.mode==='fleet'?'Six simultaneous descents. One broken landing module. Save it to unlock a second rescue.':'Six consecutive descents. You pilot every booster.'}</p><div class="start-instructions"><span><kbd>SPACE</kbd><b>HOLD TO THRUST</b><small>Release to cut the engine</small></span><span><kbd>A / D</kbd><b>ROTATE</b><small>← / → also work</small></span><span><kbd>ESC</kbd><b>PAUSE</b><small>Press again to resume</small></span><span><kbd>1–7</kbd><b>CHOOSE A SITE</b><small>L: legs · O: retrograde</small></span></div><button class="primary" data-action="start">BEGIN DESCENT <span>↘</span></button><small>Touch: hold BURN + a rotation button together.<br>W / ↑ also thrust. Skip intro is in the menu.</small></section>
    <section class="pause-card" hidden><span class="eyebrow">FLIGHT SUSPENDED</span><h2>Take a breath.</h2><p>The queue is paused too.</p><button class="primary" data-action="pause">RESUME FLIGHT</button></section>
    <section class="skip-card" hidden><h2>Skip arrival?</h2><p>Continue with the default resource bundle.</p><button class="primary" data-action="confirm-skip">SKIP INTRO</button><button data-action="cancel-skip">KEEP FLYING</button></section>
    <footer class="flight-deck"><div class="verdict-row"><span class="eyebrow" data-read="verdict" aria-live="polite">CHOOSE YOUR GROUND. MAKE IT HOME.</span><span><b data-read="saved">0</b> / 6 RECOVERED</span></div><div class="target-head"><span>LANDING SITES <span class="muted">/ SELECT 1–7</span></span><span data-read="target">01 BARGE</span></div><div class="pad-list">${state.terrain.pads.map(p=>`<button data-pad="${p.id}" aria-pressed="${p.id===0}"><span class="pad-title"><b>${String(p.id+1).padStart(2,'0')}</b> ${p.tier}</span><span class="pad-meta">${p.width} m · ${p.slope}° · ×${p.mult.toFixed(1)}</span><small>✓ FUEL MARGIN</small></button>`).join('')}</div>
    <div class="instruments"><div class="instrument"><span class="eyebrow">ALTITUDE AGL</span><strong data-read="alt">460</strong><small>METRES</small></div><div class="instrument"><span class="eyebrow">SINK RATE</span><strong data-read="sink">38.0</strong><small>M/S <span class="muted">· LIMIT 6</span></small><div class="meter"><i data-sink></i></div></div><div class="instrument"><span class="eyebrow">LATERAL</span><strong data-read="drift">→ 0.0</strong><small>M/S <span class="muted">· LIMIT 4</span></small><div class="meter"><i data-drift></i></div></div><div class="instrument fuel"><span class="eyebrow">PROPELLANT</span><strong data-read="fuel">13.8</strong><small>SECONDS OF FULL BURN</small><div class="meter"><i data-fuel></i></div></div><div class="instrument secondary"><span class="eyebrow">ATTITUDE / SLOPE</span><strong class="small"><span data-read="tilt">0.0°</span> / <span data-read="slope">0.0°</span></strong><small data-read="legs">STOWED</small><small>WIND <span data-read="wind">→ 0.00 m/s²</span></small></div></div>
    <div class="control-strip"><span><kbd>SPACE / W / ↑</kbd> HOLD THRUST <kbd>A D / ← →</kbd> TILT <kbd>L</kbd> LEGS <kbd>O</kbd> RETROGRADE <kbd>ESC</kbd> PAUSE</span><span>MODEL BY <a href="https://jelaludo.github.io/SentryTowers_A6/" target="_blank" rel="noreferrer">JELALUDO</a></span></div>
    <div class="touch-controls"><button data-hold="left" aria-label="Rotate left">↶</button><button data-hold="right" aria-label="Rotate right">↷</button><button data-action="legs">LEGS</button><button data-action="orient">ALIGN</button><button data-hold="thrust">HOLD TO BURN ↑</button></div></footer><span class="sr-only" aria-live="polite" data-read="callout"></span>`;
   canvas.insertAdjacentElement('afterend',ui);view=createView(canvas,ui,director);
   for(const input of ui.querySelectorAll('[data-assist]'))input.checked=state.assists[input.dataset.assist];
   const on=(el,type,handler)=>el.addEventListener(type,handler,{signal:abort.signal});
   const clearInputs=()=>{sounds.thrust(false);keys.clear();touch.clear();ui.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));};
   const handoff=()=>{sounds.handoff();if(state.mode==='fleet'){sounds.alarm();state.noticeUntil=state.time+4;}};
   const syncPhase=()=>{
    const cinematic=state.phase==='opening'||state.phase==='arrival';ui.classList.toggle('is-cinematic',cinematic);ui.dataset.phase=state.phase;
    ui.querySelector('.start-card').hidden=state.phase!=='ready';ui.querySelector('.cinematic-plate').hidden=!cinematic;
    ui.querySelector('[data-cinematic-title]').textContent=state.phase==='opening'?'HUGIN / EXHAUST SIGNATURE':'HUGIN / ATMOSPHERIC ENTRY';
   };syncPhase();
   const setPause=value=>{paused=value;sounds.pause(value);clearInputs();ui.querySelector('[data-action="skip-cinematic"]').disabled=value;updateHud(ui,director,null);ui.querySelector('.pause-card').hidden=!paused||skipPending;ui.querySelector('[data-action="pause"]').setAttribute('aria-label',paused?'Resume flight':'Pause flight');};
   const action=name=>{
    if(name==='start'&&state.phase==='ready'){sounds.begin();clearInputs();state.phase=reduced?'flying':'arrival';state.arrivalTime=0;syncPhase();if(reduced)handoff();canvas.focus();}
    if(name==='takeover'||name==='leave-auto'){director.choose?.(name==='takeover');clearInputs();canvas.focus();}
    if(name==='skip-cinematic'){const wasArrival=state.phase==='arrival';clearInputs();state.phase=state.phase==='opening'?'ready':'flying';syncPhase();if(wasArrival)handoff();(state.phase==='ready'?ui.querySelector('[data-action="start"]'):canvas).focus();}
    if(name==='pause'&&state.phase!=='ready'&&!skipPending)setPause(!paused);
    if(name==='settings'){const p=ui.querySelector('.assists-panel');p.hidden=!p.hidden;ui.querySelector('[data-action="settings"]').setAttribute('aria-expanded',String(!p.hidden));}
    if(name==='legs')state.v.deploy=true;
    if(name==='orient')state.orient=true;
    if(name==='skip'){skipPending=true;setPause(true);ui.querySelector('.skip-card').hidden=false;ui.querySelector('[data-action="cancel-skip"]').focus();}
    if(name==='cancel-skip'){skipPending=false;ui.querySelector('.skip-card').hidden=true;setPause(false);}
    if(name==='confirm-skip')finish('skipped');
   };
   on(ui,'click',e=>{const b=e.target.closest('button');if(b?.dataset.action)action(b.dataset.action);if(b?.dataset.pad!==undefined)state.selected=Number(b.dataset.pad);});
   on(ui,'change',e=>{if(e.target.dataset.assist)state.assists[e.target.dataset.assist]=e.target.checked;if('sound' in e.target.dataset)sounds.mute(!e.target.checked);if('contrast' in e.target.dataset)ui.parentElement.classList.toggle('high-contrast',e.target.checked);});
   on(window,'keydown',e=>{
    const controlFocused=/^(INPUT|BUTTON|A)$/.test(e.target.tagName);
    if(e.code==='Escape'){e.preventDefault();if(!e.repeat)action(skipPending?'cancel-skip':'pause');return;}
    if(controlFocused&&(e.code==='Enter'||e.code==='Tab'||e.code==='Space'&&(paused||state.phase==='ready'||e.target.tagName==='INPUT')))return;
    if(e.code==='Tab'&&e.shiftKey)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
    if(!paused&&state.phase==='flying'&&!e.repeat)keys.add(e.code);if(e.repeat)return;
    if(e.code==='Enter'&&state.phase==='ready')action('start');
    if(e.code==='KeyL')action('legs');if(e.code==='KeyO')action('orient');if(e.code==='KeyH')view.toggleDebug();
    if(e.code==='Tab')state.selected=(state.selected+1)%state.terrain.pads.length;
    if(/^Digit[1-7]$/.test(e.code))state.selected=Number(e.code.slice(-1))-1;
   });
   on(window,'keyup',e=>keys.delete(e.code));on(window,'blur',()=>{clearInputs();if(state.phase!=='ready')setPause(true);});
   on(document,'visibilitychange',()=>{if(document.hidden&&state.phase!=='ready')setPause(true);});on(window,'resize',view.resize);
   for(const button of ui.querySelectorAll('[data-hold]')){
    on(button,'pointerdown',e=>{e.preventDefault();if(paused||state.phase!=='flying')return;button.setPointerCapture(e.pointerId);touch.set(e.pointerId,button.dataset.hold);button.classList.add('held');});
    const release=e=>{touch.delete(e.pointerId);button.classList.remove('held');};on(button,'pointerup',release);on(button,'pointercancel',release);on(button,'lostpointercapture',release);
   }
   const artBase=new URL('./assets/',import.meta.url);
   // A missing or malformed atlas leaves the vector vehicle active.
   (async()=>{try{
    const response=await fetch(new URL('atlas.json',artBase),{signal:abort.signal});if(!response.ok)throw new Error('Atlas unavailable');const atlas=await response.json();
    if(!(atlas.pixels_per_metre>0)||!atlas.sprites)throw new Error('Invalid atlas');const sprites={};
    await Promise.all(['stowed','deployed','wreck'].map(async kind=>{const img=new Image();img.src=new URL(atlas.sprites[kind].image,artBase);await img.decode();sprites[kind]=img;}));
    if(!ended)view.setArt(sprites,atlas);
   }catch{/* The vector fallback is a complete vehicle skin. */}})();
   const frame=timestamp=>{
    if(ended)return;
    try{
     const elapsed=last?Math.min(.25,(timestamp-last)/1000):0;last=timestamp;if(!paused)wall+=elapsed;
     if(!paused&&state.phase==='opening'){director.step({},elapsed);syncPhase();acc=0;}else if(!paused&&state.phase!=='ready'){
      const slow=state.assists.slowMo&&state.v.y-state.terrain.height(state.v.x)-CONFIG.vehicle.legHeight<10?.6:1;acc+=elapsed*slow;
      let steps=0;while(acc>=CONFIG.sim.dt&&steps<CONFIG.sim.maxSteps){
       const held=[...touch.values()];const input={thrust:keys.has('Space')||keys.has('KeyW')||keys.has('ArrowUp')||held.includes('thrust'),turn:Number(keys.has('KeyD')||keys.has('ArrowRight')||held.includes('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||held.includes('left'))};
       sounds.thrust(state.phase==='flying'&&(state.mode!=='fleet'||state.controlled!==null)&&input.thrust&&state.v.fuel>0);
       const beforePhase=state.phase;const r=director.step(input);
       if(state.phase!==beforePhase){if(beforePhase==='arrival'&&state.phase==='flying')handoff();syncPhase();if(beforePhase==='arrival'||beforePhase==='opening'){clearInputs();(state.phase==='ready'?ui.querySelector('[data-action="start"]'):canvas).focus();}}
       if(r)sounds.resolve(r.outcome==='wreck'&&r.padTier!=='OUTSIDE');
       for(const event of director.drainEvents?.()??[]){
        if(event.type==='contact'){if(event.manual)sounds.resolve(event.result.outcome==='wreck');else if(event.result.outcome==='wreck')sounds.crash();if(options.onEntryResolved)options.onEntryResolved(event.result);}
        if(event.type==='damaged')sounds.alarm();
        if(event.type==='takeover'){sounds.handoff();clearInputs();}
       }
       for(const impact of director.drainImpacts())sounds.impact(impact);
       if(r&&options.onEntryResolved)options.onEntryResolved(r);acc-=CONFIG.sim.dt;steps++;
      }if(steps===CONFIG.sim.maxSteps)acc%=CONFIG.sim.dt;
     }else acc=0;
     view.draw(paused?0:elapsed||1/60,wall,acc/CONFIG.sim.dt);
     if(state.phase==='done'){finish();return;}raf=requestAnimationFrame(frame);
    }catch(error){console.error('Landing intro recovered from an error',error);finish('skipped');}
   };raf=requestAnimationFrame(frame);
  }catch(error){console.error('Landing intro could not start',error);finish('skipped');}
 });
}
