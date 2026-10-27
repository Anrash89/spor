import assert from 'node:assert/strict';
import {Race,DT,COLORS,resolvePair,DIAMETER} from './docs/engine.js';
import {Course,TYPES} from './docs/course.js';
const make=n=>Array.from({length:n},(_,i)=>({id:'ball-'+i,name:'Вариант '+i,color:COLORS[i%8]}));
const body=(s,lane,speed,laneV,slot)=>({s,lane,speed,laneV,slot,height:0});
const close=(a,b,tol=1e-7)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
// A moving ball transfers momentum to a stationary ball, without overlap.
{
 const a=body(0,0,10,0,0),b=body(1,0,0,0,1);
 assert(resolvePair(a,b)>0);close(a.speed+b.speed,10);
 assert(b.speed>a.speed);assert(b.s-a.s>=DIAMETER);
}
// Side contact, including the former exactly-one-unit separation regression.
{
 const a=body(0,0,0,3,0),b=body(0,1,0,-3,1);
 resolvePair(a,b);close(b.lane-a.lane,DIAMETER+.00005);
 assert(a.laneV<0&&b.laneV>0);close(a.laneV+b.laneV,0);
}
{
 const a=body(0,0,0,0,0),b=body(0,0,0,0,1);
 resolvePair(a,b);assert(Math.hypot(a.s-b.s,a.lane-b.lane)>=DIAMETER);
 const c=body(0,0,5,0,2),d=body(.5,0,0,0,3);d.height=2;
 assert.equal(resolvePair(c,d),null);close(c.s,0);
}
let runs=0,allEvents=new Set(),obstacleHits=0,contacts=0,repairs=0;
function run(entries,seed,options={},batch=1){
 const r=new Race(entries,seed,options);let steps=0;
 while(!r.done&&steps<12000){for(let j=0;j<batch&&!r.done;j++){
  r.step(DT);steps++;for(const e of r.events)allEvents.add(e.type);
  if(steps%120===0)for(const b of r.balls){
   assert(Number.isFinite(b.s)&&Number.isFinite(b.lane)&&Number.isFinite(b.speed));
   assert(b.hp>=0&&b.hp<=100);
   assert(b.vortex||Math.abs(b.lane)<=r.course.halfWidth-.72+1e-6);
  }
 }}
 assert(r.done,`Race stuck: ${seed}`);assert.equal(r.finishers.length,entries.length);
 for(const b of r.balls){assert(b.finish>0);assert.equal(b.p,1);}
 contacts+=r.contactCount;obstacleHits+=r.obstacleContacts;
 repairs+=r.balls.reduce((s,b)=>s+b.repairCount,0);runs++;return r;
}
const summary=r=>r.finishers.map(b=>({id:b.id,time:b.finish,hp:b.hp,hits:b.hits}));
const a=run(make(6),'DETERMINISTIC-V2');
assert.deepEqual(summary(a),summary(run(make(6),'DETERMINISTIC-V2')));
for(const batch of [2,4,7,24])assert.deepEqual(summary(a),summary(run(make(6),'DETERMINISTIC-V2',{},batch)),'render speed must not change outcome');
assert.deepEqual(summary(a),summary(run(make(6).map(e=>({...e,name:'Другое имя 🐈',color:'#000000',image:'data:image/png;base64,unused'})),'DETERMINISTIC-V2')),'cosmetics must not influence simulation');
for(const n of [2,6,24])for(const duration of [45,60,90])for(const damage of [false,true]){
 const r=run(make(n),`SIZE-${n}-${duration}`,{duration,damage});
 assert(r.time>duration*.55&&r.time<duration*2.2,`duration outlier: ${r.time}`);
 if(!damage)assert(r.balls.every(b=>b.hp===100));
}
assert.throws(()=>new Race(make(1),'BAD'));assert.throws(()=>new Race(make(25),'BAD'));
const kinds=new Set(),types=new Set(),signatures=new Set(),exampleSeeds={};
for(let i=0;i<80;i++){
 const seed='COURSE-'+i,c=new Course(seed);kinds.add(c.kind);exampleSeeds[c.kind]??=seed;
 signatures.add(JSON.stringify(c.samples.filter((_,j)=>j%100===0)));
 for(const o of c.obstacles)types.add(o.type);
 assert(c.length>150&&c.length<1000);assert(c.size.y>30);
 assert.deepEqual(c.samples,new Course(seed).samples);
}
assert.equal(kinds.size,6);assert.equal(signatures.size,80);assert.deepEqual([...types].sort(),[...TYPES].sort());
// Controlled obstacle checks: effects must alter simulation, not just appearance.
for(const type of TYPES){
 const r=new Race(make(2),'MECHANISM');r.obstacles=[{id:100,s:80,p:80/r.course.length,type,lane:0,phase:0,speed:1}];
 const b=r.balls[0];b.s=type==='vortex'?74.1:79.9;b.speed=r.baseSpeed;b.lane=0;b.laneV=0;b.hp=40;b.target=0;b.decision=100;
 if(type==='gate')b.lane=4;
 if(type==='bumper')b.s=79;
 if(type==='spinner')b.s=79.2;
 r.forces(b,DT);
 if(type==='vortex'){
  assert(b.vortex);const start=b.vortexTimer;let minLane=Infinity,maxLane=-Infinity;
  for(let i=0;i<400&&b.vortex;i++){r.time+=DT;r.forces(b,DT);minLane=Math.min(minLane,b.lane);maxLane=Math.max(maxLane,b.lane);}
  assert(start>2);assert.equal(b.vortex,null);assert(b.s>87);assert(maxLane-minLane>2,'ball must circulate in bowl');
 }
 if(type==='slow')assert(b.speed<r.baseSpeed);
 if(type==='boost')assert(b.boost>0);
 if(type==='jump')assert(b.vertical>0);
 if(type==='repair')assert.equal(b.hp,70);
 if(['spinner','gate','bumper'].includes(type))assert(r.obstacleContacts>0,`${type} must produce a contact`);
}
let wins=Array(6).fill(0),min=Infinity,max=0;
for(let i=0;i<240;i++){
 const r=run(make(6),'BALANCE-V2-'+i);wins[Number(r.finishers[0].id.split('-')[1])]++;
 min=Math.min(min,r.finishers[0].finish);max=Math.max(max,r.finishers.at(-1).finish);
}
// Gross positional bias smoke test, not a proof of uniform probabilities.
assert(wins.every(n=>n>19&&n<65),`gross bias in sample: ${wins}`);
for(const e of ['collision','hit','vortex','release','jump','boost','repair','finish','respawn'])assert(allEvents.has(e),`missing event ${e}`);
assert(contacts>100&&obstacleHits>100&&repairs>0);
console.log(JSON.stringify({passed:true,simulationRuns:runs,winsOver240:wins,fastestWinner:min.toFixed(2),slowestFinisher:max.toFixed(2),contacts,obstacleHits,repairs,exampleSeeds,checks:['head-on momentum','side collision regression','coincident centers','airborne separation','all 8 obstacle mechanics','vortex circulation and release','6 distinct architectures','80 unique geometries','deterministic replay','frame-batch independence','cosmetics independence','2–24 participants','45/60/90 seconds','damage disabled','finite bounded state','all finish']},null,2));
