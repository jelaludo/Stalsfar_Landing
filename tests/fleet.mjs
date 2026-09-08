import assert from 'node:assert/strict';
import {createFleetDirector} from '../landing/fleet.js';
function run(seed,pilot=false,take=false){
 const d=createFleetDirector(seed),s=d.state;s.phase='flying';let offered=false,taken=false;
 for(let i=0;i<24000&&s.phase!=='done';i++){
  const v=s.v,agl=v.y-s.terrain.height(v.x)-11.25,target=s.terrain.pads[s.selected]?.x??v.x;
  const targetVx=Math.max(-10,Math.min(10,(target-v.x)*.25)),limit=agl<35?.09:.38;
  const angle=Math.max(-limit,Math.min(limit,(targetVx-v.vx)*.12));
  const turn=Math.max(-1,Math.min(1,(angle-v.angle)*5-v.angVel*2));
  const desiredSink=Math.min(40,Math.sqrt(Math.max(0,agl)*8)+1.2);
  d.step({thrust:pilot&&(-v.vy>desiredSink||agl<3&&v.vy<-1.5),turn:pilot?turn:0});
  if(s.offer){offered=true;if(take){d.choose(true);taken=true;}}
 }
 assert.equal(s.phase,'done',`seed ${seed} must finish`);assert.equal(s.landings.length,6);assert.equal(new Set(s.landings.map(r=>r.index)).size,6);
 return {result:d.result(),offered,taken,s};
}
const a=run(7,true,true);assert(a.offered&&a.taken);assert.equal(a.result.landings.filter(r=>r.control==='manual'&&r.outcome!=='wreck').length,2);
assert.deepEqual(a.result,run(7,true,true).result);
assert.equal(run(7,false).offered,false);
assert.equal(run(7,true,false).taken,false);
let regular=0,regularTotal=0,last=0;
for(let seed=0;seed<100;seed++){const r=run(seed);for(const unit of r.s.fleet){if(unit.manual)continue;const success=unit.outcome!=='wreck';assert.equal(success,unit.success,`seed ${seed}, unit ${unit.v.index}: planned reliability matches landing`);if(unit.v.index===r.s.lastUnit)last+=success;else{regular+=success;regularTotal++;}}}
assert(regular/regularTotal>.8&&regular/regularTotal<.98);assert(last>30&&last<70);
console.log(`Fleet: six concurrent units, successful optional takeover, refusal/expiry, failure path, deterministic runs. Auto success ${regular}/${regularTotal}; final ${last}/100.`);
const {fleetLateral}=await import('../landing/fleet.js');
const crossing=createFleetDirector(7).state.fleet.filter(u=>!u.manual);
let crossings=0;
for(const u of crossing){assert.equal(fleetLateral(u,u.crossingTime+1),u.pad.x);assert(Math.abs(fleetLateral(u,0)-u.pad.x)>40);}
for(let i=0;i<crossing.length;i++)for(let j=i+1;j<crossing.length;j++)if((fleetLateral(crossing[i],0)-fleetLateral(crossing[j],0))*(crossing[i].pad.x-crossing[j].pad.x)<0)crossings++;
assert(crossings>=3);console.log(`Crossing approaches: ${crossings} pairs change horizontal order, then align with their pads.`);
for(const u of crossing){
 assert(2*Math.abs(u.entryOffset)/u.crossingTime**2<=4.50001,'Lateral braking stays within thrust capability');
 let previous=fleetLateral(u,0);
 for(let time=.1;time<=u.crossingTime;time+=.1){const x=fleetLateral(u,time);assert((x-previous)*u.entryOffset<=.00001,'No reversal or swerving');previous=x;}
}
assert(new Set(createFleetDirector(7).state.fleet.map(u=>u.pad.id)).size===6);
console.log('Smooth one-way braking arcs, acceleration limits and shuffled pads passed.');

const waiting=createFleetDirector(7);waiting.state.phase='flying';
for(let i=0;i<1200;i++)waiting.step({thrust:true,turn:1});
assert.equal(waiting.state.controlled,null);assert.equal(waiting.state.selected,-1);assert(waiting.state.fleet.every(u=>!u.manual));
assert.equal(new Set(Array.from({length:100},(_,i)=>createFleetDirector(i).state.firstManual)).size,6);
const first=a.result.landings.find(r=>r.index===a.s.firstManual),near=a.result.landings.filter(r=>r.control==='automatic'&&Math.abs(r.touchdownTime-first.touchdownTime)<3);
assert(near.some(r=>r.padId<first.padId)&&near.some(r=>r.padId>first.padId),'Neighbouring touchdowns bracket the player within three seconds');
console.log('Hidden assignment, all six possible failures, and overlapping left/right touchdowns passed.');
