import assert from 'node:assert/strict';
import {createFleetDirector} from '../landing/fleet.js';
function run(seed,pilot=false,take=false){
 const d=createFleetDirector(seed),s=d.state;s.phase='flying';let offered=false,taken=false;
 for(let i=0;i<24000&&s.phase!=='done';i++){
  const v=s.v,agl=v.y-s.terrain.height(v.x)-11.25,target=s.terrain.pads[s.selected].x;
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
for(let seed=0;seed<100;seed++){const r=run(seed);for(const unit of r.s.fleet){if(unit.manual)continue;const success=unit.outcome!=='wreck';assert.equal(success,unit.success,`seed ${seed}, unit ${unit.v.index}: planned reliability matches landing`);if(unit.v.index===4)last+=success;else{regular+=success;regularTotal++;}}}
assert(regular/regularTotal>.8&&regular/regularTotal<.98);assert(last>30&&last<70);
console.log(`Fleet: six concurrent units, successful optional takeover, refusal/expiry, failure path, deterministic runs. Auto success ${regular}/${regularTotal}; final ${last}/100.`);
