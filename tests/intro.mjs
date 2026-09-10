import assert from 'node:assert/strict';
import {starshipSettings,STARSHIP_COUNT} from '../landing/starship-intro.js';
import {createDirector} from '../landing/lander.js';
import {createFleetDirector} from '../landing/fleet.js';

assert.equal(STARSHIP_COUNT,6);
assert.deepEqual(starshipSettings(0),{time:0,exposure:.05});
assert.deepEqual(starshipSettings(2.5),{time:7.5,exposure:2.025});
assert.deepEqual(starshipSettings(5),{time:15,exposure:4});
assert.deepEqual(starshipSettings(8),{time:24,exposure:4});
assert.deepEqual(starshipSettings(-1),{time:0,exposure:.05});
const stored=new Map();let writes=0;
globalThis.localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>{stored.set(key,value);writes++;}};
for(const [load,expected] of ['launch','starship','launch','starship'].entries()) {
 // A new module instance represents a fresh document; replay reuses that instance.
 const {openingVariant}=await import(`../landing/starship-intro.js?load=${load}`);
 assert.equal(openingVariant(),expected);
 assert.equal(openingVariant(),expected);
 assert.equal(writes,load+1,'Replay must not change the next intro');
}
globalThis.localStorage={getItem(){throw Error('Storage denied');}};
const blocked=await import('../landing/starship-intro.js?blocked');
assert.equal(blocked.openingVariant(),'launch');
assert.equal(blocked.openingVariant(),'launch');
delete globalThis.localStorage;
for(const create of [createDirector,createFleetDirector]) {
 const director=create(7);director.state.phase='opening';
 for(let i=0;i<50;i++)director.step({},.1);
 assert.equal(director.state.phase,'opening');
 assert.ok(Math.abs(starshipSettings(director.state.openingTime).exposure-4)<1e-12);
 for(let i=0;i<31;i++)director.step({},.1);
 assert.equal(director.state.phase,'ready');
}
console.log('Intro reload alternation, replay stability, storage fallback, 3× clock, five-second exposure ramp, and both mode handoffs passed.');
