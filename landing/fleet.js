import {CONFIG,createDirector,createVehicle,createRng,flightStep,feet,findObstacle,stepWreck} from './lander.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function fleetLateral(unit,time){
 const q=clamp(time/unit.crossingTime,0,1);
 // One continuous braking arc: constant lateral deceleration, zero drift at the pad.
 return unit.pad.x+unit.entryOffset*(1-q)**2;
}
export function createFleetDirector(seed,assists={}){
 const base=createDirector(seed,6,assists),s=base.state,t=s.terrain,rng=createRng(`${seed}/fleet`),events=[],impacts=[];
 const assignments=[0,1,2,4,5,6],routing=createRng(`${seed}/routing`);
 for(let i=5;i>0;i--){const j=Math.floor(routing.random()*(i+1));[assignments[i],assignments[j]]=[assignments[j],assignments[i]];}
 // The failure can affect any vehicle; its corridor has neighbours on both sides.
 const candidates=assignments.map((pad,i)=>({pad,i})).filter(u=>u.pad>0&&u.pad<6);
 const manual=candidates[Math.floor(rng.random()*candidates.length)].i;
 const lastCandidates=[0,1,2,3,4,5].filter(i=>i!==manual),lastUnit=lastCandidates[Math.floor(rng.random()*5)];
 const waveTime=22+rng.random()*1.5;
 s.mode='fleet';s.controlled=null;s.firstManual=manual;s.lastUnit=lastUnit;s.failureAt=3.5+rng.random();s.failureTriggered=false;s.offer=null;s.noticeUntil=0;s.fleet=[];
 for(let i=0;i<6;i++){
  const pad=t.pads[assignments[i]],v=createVehicle(t,i,160),duration=i===lastUnit?waveTime+24+rng.random()*3:i===manual?waveTime+(rng.random()-.5)*2:waveTime-2+(rng.random()-.5)*3;
  const height=(i===lastUnit?650:430)+rng.random()*45,entrySink=1.7*height/duration;
  Object.assign(v,{x:pad.x,y:pad.y+11.25+height,vx:0,vy:-entrySink,angle:0,angVel:0});
  s.fleet.push({v,pad,duration,height,entrySink,success:rng.random()<(i===lastUnit?.5:.9),manual:false,resolved:false});
 }
 // A separate stream keeps arrival timing and reliability stable for existing seeds.
 const approach=createRng(`${seed}/crossing`);
 for(const unit of s.fleet){
  unit.crossingTime=Math.min(18,unit.duration*.8);
  unit.entryOffset=(unit.pad.id%2?-1:1)*(75+approach.random()*35);
  if(unit.v.index===lastUnit)unit.entryOffset=0;

  if(!unit.manual){unit.v.x=fleetLateral(unit,0);unit.v.vx=-2*unit.entryOffset/unit.crossingTime;unit.v.angle=Math.atan2(2*unit.entryOffset/unit.crossingTime**2,CONFIG.sim.gravity+(-6*unit.height+4*unit.entrySink*unit.duration+3*unit.duration)/unit.duration**2);}
 }
 const focus=i=>{s.controlled=i;s.index=i;s.v=s.fleet[i].v;s.previous={...s.v};s.selected=s.fleet[i].pad.id;s.orient=false;s.entryTime=s.time;};s.v=s.fleet[0].v;s.previous={...s.v};s.selected=-1;s.verdict='FLEET TELEMETRY / AUTOMATIC DESCENT';
 const complete=unit=>{
  const active=s.v,index=s.index,phase=s.phase,current=s.currentWreck;
  s.v=unit.v;s.index=unit.v.index;
  const r=base.resolve();unit.resolved=true;unit.outcome=r.outcome;r.control=unit.manual?'manual':'automatic';r.touchdownTime=s.time;
  s.v=active;s.index=index;s.phase=phase;s.currentWreck=current;
  events.push({type:'contact',result:r,manual:unit.manual});
  if(unit.v.index===s.controlled){
   s.controlled=null;s.noticeUntil=0;s.verdict=`H-${unit.v.index+1} / ${r.outcome.toUpperCase()}`;
   if(unit.v.index===manual&&r.outcome!=='wreck'&&!s.fleet[lastUnit].resolved){s.offer={until:Math.min(s.time+12,s.fleet[lastUnit].duration-15)};events.push({type:'damaged'});}
  }
 };
 const choose=take=>{
  if(!s.offer)return;s.offer=null;
  if(take&&!s.fleet[lastUnit].resolved){s.fleet[lastUnit].manual=true;focus(lastUnit);s.noticeUntil=s.time+3;events.push({type:'takeover'});}
 };
 const step=(input={},dt=CONFIG.sim.dt)=>{
  if(['ready','done'].includes(s.phase))return;
  if(s.phase==='opening'){s.openingTime+=dt;if(s.openingTime>=CONFIG.cinematic.opening)s.phase='ready';return;}
  if(s.phase==='arrival'){s.arrivalTime+=dt*2.2;if(s.arrivalTime>=CONFIG.cinematic.arrival)s.phase='flying';return;}
  s.time+=dt;s.previous={...s.v};
  if(!s.failureTriggered&&s.time>=s.failureAt){s.failureTriggered=true;s.fleet[manual].manual=true;focus(manual);s.noticeUntil=s.time+4;s.verdict='LANDING MODULE BROKEN / MANUAL OVERRIDE';events.push({type:'failure'});}
  for(const body of t.occupied)if(body.outcome==='wreck')stepWreck(body,t,dt,event=>impacts.push({...event,time:s.time}));
  if(s.offer&&s.time>=s.offer.until)choose(false);
  for(const unit of s.fleet){
   if(unit.resolved)continue;const v=unit.v,agl=v.y-t.height(v.x)-11.25;
   if(unit.manual){
    for(const [key,on] of Object.entries(s.assists))if(on)s.used.add(key);
    if(s.assists.autoLegs&&agl<200)v.deploy=true;
    let turn=input.turn||0;if(turn)s.orient=false;
    if(s.orient)turn=clamp((Math.atan2(-v.vx,Math.max(1,-v.vy))-v.angle)*4-v.angVel*2,-1,1);
    flightStep(v,{...input,turn,stability:s.assists.stabilityHold},dt,0);
    if(v.x<0||v.x>1400||s.time>100){v.x=unit.pad.x;v.y=unit.pad.y+11.25;v.vy=-40;}
    if(findObstacle(v,t)||feet(v).some(p=>p.y<=t.height(p.x)))complete(unit);
   }else{
    // Hermite descent, then a seeded guidance failure physically drops the vehicle.
    if(!unit.success&&s.time>unit.duration-2.5){v.deploy=false;v.legs=0;flightStep(v,{thrust:false,turn:.12},dt,0);}
    else{
     const q=clamp(s.time/unit.duration,0,1),h=unit.height,d=unit.duration;
     const altitude=(2*q*q*q-3*q*q+1)*h+(q*q*q-2*q*q+q)*(-unit.entrySink*d)+(q*q*q-q*q)*(-1.5*d);
     v.vy=((6*q*q-6*q)*h+(3*q*q-4*q+1)*(-unit.entrySink*d)+(3*q*q-2*q)*(-1.5*d))/d;
     v.x=fleetLateral(unit,s.time);v.vx=(fleetLateral(unit,s.time+.01)-fleetLateral(unit,s.time-.01))/.02;
     const oldAngle=v.angle,brake=clamp((unit.crossingTime-s.time)/2,0,1),ax=2*unit.entryOffset/unit.crossingTime**2*brake,ay=((12*q-6)*h-(6*q-4)*unit.entrySink*d-(6*q-2)*1.5*d)/(d*d);v.angle=Math.atan2(ax,CONFIG.sim.gravity+ay);v.angVel=(v.angle-oldAngle)/dt;
     v.y=unit.pad.y+11.25+altitude;v.throttle=clamp(Math.hypot(ax,CONFIG.sim.gravity+ay)/CONFIG.vehicle.thrust,0,1);v.fuel=Math.max(25,160-s.time*2);v.legs=clamp((220-altitude)/50,0,1);
    }
    if(unit.success&&s.time>=unit.duration||feet(v).some(p=>p.y<=t.height(p.x)))complete(unit);
   }
  }
  if(s.fleet.every(u=>u.resolved)){s.transition+=dt;if(s.transition>3&&t.occupied.every(o=>o.outcome!=='wreck'||o.settled))s.phase='done';}
 };
 return {state:s,step,wind:()=>0,result:status=>({...base.result(status),mode:'fleet'}),choose,drainEvents:()=>events.splice(0),drainImpacts:()=>impacts.splice(0)};
}
