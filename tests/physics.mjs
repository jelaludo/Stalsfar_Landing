import assert from 'node:assert/strict';
import {CONFIG,createTerrain,createVehicle,evaluateTouchdown,createDirector,flightStep} from '../landing/lander.js';
const terrain=createTerrain(7),v=createVehicle(terrain,0);v.x=terrain.pads[0].x;v.y=terrain.height(v.x)+11.25;v.legs=1;v.vy=-2;v.vx=0;v.angle=0;
assert.equal(evaluateTouchdown(v,terrain).outcome,'perfect');
v.vy=-5;assert.equal(evaluateTouchdown(v,terrain).outcome,'hard');
v.vy=-6.1;assert.equal(evaluateTouchdown(v,terrain).outcome,'wreck');
v.vy=-2;v.legs=0;assert.match(evaluateTouchdown(v,terrain).verdict,/LEGS/);
v.legs=1;v.x=terrain.pads[3].x;assert.equal(evaluateTouchdown(v,terrain).outcome,'wreck');
const right={...v,vx:0,angle:.2,fuel:100,throttle:1};flightStep(right,{thrust:true,turn:0},CONFIG.sim.dt);assert(right.vx>0);
function run(fps,pilot=false){const d=createDirector(20260907);d.state.phase='flying';let acc=0,frames=0;while(d.state.phase!=='done'&&frames++<fps*600){acc+=1/fps;while(acc+1e-12>=CONFIG.sim.dt){const v=d.state.v,agl=v.y-d.state.terrain.height(v.x)-11.25;
const target=d.state.terrain.pads[d.state.index].x;
const targetVx=Math.max(-10,Math.min(10,(target-v.x)*.25));
const angleLimit=agl<35?.09:.38;
const desiredAngle=Math.max(-angleLimit,Math.min(angleLimit,(targetVx-v.vx)*.12));
const turn=Math.max(-1,Math.min(1,(desiredAngle-v.angle)*5-v.angVel*2));
const desiredSink=Math.min(40,Math.sqrt(Math.max(0,agl)*8)+1.2);
const thrust=pilot&&(-v.vy>desiredSink||agl<3&&v.vy<-1.5);
d.step({thrust,turn:pilot?turn:0});acc-=CONFIG.sim.dt;}}
assert.equal(d.state.phase,'done');return d.result();}
const a=run(30),b=run(60),c=run(144);assert.deepEqual(a,b);assert.deepEqual(b,c);assert.equal(a.landings.length,6);
const p=run(60,true);assert.deepEqual(p,run(30,true));assert.deepEqual(p,run(144,true));
const occupied=createTerrain(7),ov=createVehicle(occupied,0);ov.legs=1;ov.vy=-1;occupied.occupied.push({...ov,width:34,outcome:'wreck'});assert.match(evaluateTouchdown(ov,occupied).verdict,/OCCUPIED/);
const delayed=createDirector(7);delayed.state.phase='flying';delayed.state.time=30;delayed.state.v.x=delayed.state.terrain.pads[0].x;delayed.state.v.vx=0;delayed.state.v.angle=0;delayed.state.v.legs=1;delayed.state.v.vy=-1;delayed.resolve();for(let i=0;i<340;i++)delayed.step({thrust:false,turn:0});assert.equal(delayed.state.index,1);assert(delayed.state.v.fuel<CONFIG.entries[1].fuel);assert(delayed.state.v.fuel>=CONFIG.queue.minFuel);
console.log(JSON.stringify({deterministic:true,unpiloted:a.landings.map(x=>x.verdict),piloted:p.landings.map(x=>({outcome:x.outcome,verdict:x.verdict,fuel:x.fuelLeft})),duration:p.durationMs,recovered:p.survivors},null,2));
assert(p.survivors>=5,'Scripted clean burns must recover at least five');

// Crash bodies fall under the same gravity; sleep only after contact and low energy.
const {createWreck,stepWreck,wreckHull}=await import('../landing/lander.js');
const flat={height:()=>0};
const airborne=createWreck({x:500,y:100,vx:0,vy:0,angle:0,angVel:0,index:0},flat,7);
stepWreck(airborne,flat,CONFIG.sim.dt);
assert.equal(airborne.vy,-CONFIG.sim.gravity*CONFIG.sim.dt);
assert(airborne.y<100);
for(const vx of [-15,0,15])for(const vy of [-2,-8,-40]){
 const body=createWreck({x:500,y:11.25,vx,vy,angle:0,angVel:0,index:0},flat,7);
 const shardInitial=body.debris.map(p=>({...p}));
 for(let i=0;i<4800;i++)stepWreck(body,flat,CONFIG.sim.dt);
 assert(body.settled,'Wreck must settle rather than block progression');
 if(!body.parts)assert(Math.abs(body.angle)>1,'Unbroken failed booster must topple');
 else assert(body.parts.some(p=>Math.abs(p.angle)>.25),'Broken sections rotate independently');
 assert(body.y<8,'Center of mass falls toward ground');
 assert(wreckHull(body).every(p=>p.y>=-.03),'No hull points below the ground');
 assert(body.debris.every(p=>p.rest),'Debris settles under gravity');
 assert(body.debris.some((p,i)=>Math.abs(p.x-shardInitial[i].x)>1),'Impact scatters visible debris');
 assert(body.width>=CONFIG.wreck.debrisWidth,'Persistent footprint includes crash site');
}
console.log('Wreck gravity, whole-body toppling, contact, debris, and settling passed.');

// Regression: a wreck's wide debris metadata must not form a floating platform.
const {findObstacle}=await import('../landing/lander.js');
const ledge=createTerrain(7);
ledge.height=x=>x<520?100:0;
const fallen={x:500,y:104,angle:Math.PI/2,legs:1,outcome:'wreck',width:300,top:120,
 debris:[{x:600,y:.4,size:.8,angle:0,rest:true}]};
ledge.occupied.push(fallen);
const next={...createVehicle(ledge,0),x:550,y:30,angle:0,legs:1,vx:0,vy:-1};
assert.equal(findObstacle(next,ledge),null,'Air over lower ground is clear despite broad debris bounds');
next.y=11.25;
assert.equal(evaluateTouchdown(next,ledge).outcome,'perfect','Clear ground beside wreck remains landable');
next.x=500;next.y=110;
assert.equal(findObstacle(next,ledge),fallen,'Actual rotated wreck is still solid');
next.x=600;next.y=11.25;
assert.equal(findObstacle(next,ledge),fallen,'Visible settled debris remains a local contact hazard');
console.log('No floating crash platform; real wreck and debris contacts preserved.');

const {openingCameraY}=await import('../landing/lander.js');
assert.equal(openingCameraY(0),2);assert.equal(openingCameraY(CONFIG.cinematic.ignitionHold),2);
assert.equal(openingCameraY(CONFIG.cinematic.opening),CONFIG.cinematic.launchYEnd);
let prior=2;for(let t=0;t<=CONFIG.cinematic.opening;t+=.05){assert(openingCameraY(t)<=prior);prior=openingCameraY(t);}
for(const [speed,count] of [[2,1],[12,2],[25,3],[40,4]]){
 const broken=createWreck({x:500,y:11.25,vx:0,vy:-speed,angle:.2,angVel:0,index:0},flat,7);
 assert.equal(broken.parts?.length??1,count);
 if(count>1){
  assert(Math.abs(broken.parts.reduce((h,p)=>h+p.section.high-p.section.low,0)-21.4)<1e-9,'Cuts cover the entire source sprite');
  assert(new Set(broken.parts.map(p=>p.angVel)).size>1,'Sections have independent spin');
 }
}
const split=createWreck({x:500,y:11.25,vx:0,vy:-40,angle:0,angVel:0,index:0},flat,7);
split.debris=[];split.parts.forEach((p,i)=>{p.x=i<2?400:600;p.y=10;});
assert.equal(findObstacle({...next,x:500,y:11.25},{occupied:[split]}),null,'Empty space between sections is never solid');
console.log('Severity-driven cuts, independent section motion, collision gaps, and Y trajectory passed.');
