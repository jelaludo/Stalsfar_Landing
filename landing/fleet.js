import {CONFIG,createDirector,createVehicle,createRng,flightStep,feet,findObstacle,stepWreck} from './lander.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createFleetDirector(seed,assists={}){
 const base=createDirector(seed,6,assists),s=base.state,t=s.terrain,rng=createRng(`${seed}/fleet`),events=[],impacts=[];
 const order=[0,5,2,1,3];for(let i=order.length-1;i>0;i--){const j=Math.floor(rng.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const manual=order[Math.floor(rng.random()*3)],times=[19,20,24,28,29].map(n=>n+rng.random()*3);
 s.mode='fleet';s.controlled=manual;s.firstManual=manual;s.offer=null;s.noticeUntil=4;s.fleet=[];
 for(let i=0;i<6;i++){
  const pad=t.pads[[0,1,2,4,5,6][i]],v=createVehicle(t,i,160),duration=i===4?46+rng.random()*6:times[order.indexOf(i)];
  const height=i===manual?340:430+rng.random()*120;
  Object.assign(v,{x:pad.x,y:pad.y+11.25+height,vx:0,vy:i===manual?-26:-height/duration,angle:i===manual?.12:0,angVel:0});
  s.fleet.push({v,pad,duration,height,success:rng.random()<(i===4?.5:.9),manual:i===manual,resolved:false});
 }
 const focus=i=>{s.controlled=i;s.index=i;s.v=s.fleet[i].v;s.previous={...s.v};s.selected=s.fleet[i].pad.id;s.orient=false;s.entryTime=s.time;};focus(manual);
 const complete=unit=>{
  const active=s.v,index=s.index,phase=s.phase,current=s.currentWreck;
  s.v=unit.v;s.index=unit.v.index;
  const r=base.resolve();unit.resolved=true;unit.outcome=r.outcome;r.control=unit.manual?'manual':'automatic';
  s.v=active;s.index=index;s.phase=phase;s.currentWreck=current;
  events.push({type:'contact',result:r,manual:unit.manual});
  if(unit.v.index===s.controlled){
   s.controlled=null;s.noticeUntil=0;s.verdict=`H-${unit.v.index+1} / ${r.outcome.toUpperCase()}`;
   if(unit.v.index===manual&&r.outcome!=='wreck'&&!s.fleet[4].resolved){s.offer={until:s.time+9};events.push({type:'damaged'});}
  }
 };
 const choose=take=>{
  if(!s.offer)return;s.offer=null;
  if(take&&!s.fleet[4].resolved){s.fleet[4].manual=true;focus(4);s.noticeUntil=s.time+3;events.push({type:'takeover'});}
 };
 const step=(input={},dt=CONFIG.sim.dt)=>{
  if(['ready','done'].includes(s.phase))return;
  if(s.phase==='opening'){s.openingTime+=dt;if(s.openingTime>=CONFIG.cinematic.opening)s.phase='ready';return;}
  if(s.phase==='arrival'){s.arrivalTime+=dt*CONFIG.cinematic.speed;if(s.arrivalTime>=CONFIG.cinematic.arrival)s.phase='flying';return;}
  s.time+=dt;s.previous={...s.v};
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
     const altitude=(2*q*q*q-3*q*q+1)*h+(q*q*q-2*q*q+q)*(-h)+(q*q*q-q*q)*(-1.5*d);
     v.vy=((6*q*q-6*q)*h+(3*q*q-4*q+1)*(-h)+(3*q*q-2*q)*(-1.5*d))/d;
     v.y=unit.pad.y+11.25+altitude;v.throttle=clamp(.27+q*.25,0,1);v.fuel=Math.max(25,160-s.time*2);v.legs=clamp((220-altitude)/50,0,1);
    }
    if(unit.success&&s.time>=unit.duration||feet(v).some(p=>p.y<=t.height(p.x)))complete(unit);
   }
  }
  if(s.fleet.every(u=>u.resolved)){s.transition+=dt;if(s.transition>3&&t.occupied.every(o=>o.outcome!=='wreck'||o.settled))s.phase='done';}
 };
 return {state:s,step,wind:()=>0,result:status=>({...base.result(status),mode:'fleet'}),choose,drainEvents:()=>events.splice(0),drainImpacts:()=>impacts.splice(0)};
}
