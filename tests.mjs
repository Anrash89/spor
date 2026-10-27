import assert from 'node:assert/strict';
import {Race,DT,COLORS,makeObstacles} from './docs/engine.js';
const make=n=>Array.from({length:n},(_,i)=>({id:'ball-'+i,name:'Вариант '+i,color:COLORS[i%8]}));
function run(entries,seed,options={},batch=1){const r=new Race(entries,seed,options);let steps=0;while(!r.done&&steps<14000){for(let j=0;j<batch&&!r.done;j++){r.step(DT);steps++;}}assert(r.done,'Race must finish');assert.equal(r.finishers.length,entries.length);for(const b of r.balls){assert(Number.isFinite(b.p));assert(b.hp>=0&&b.hp<=100);assert(b.finish>0);assert(Math.abs(b.lane)<4);}return r;}
const summary=r=>r.finishers.map(b=>({id:b.id,time:b.finish,hp:b.hp,hits:b.hits}));
const a=run(make(6),'DETERMINISTIC-TEST');
assert.deepEqual(summary(a),summary(run(make(6),'DETERMINISTIC-TEST')));
for(const batch of [2,4,7,24])assert.deepEqual(summary(a),summary(run(make(6),'DETERMINISTIC-TEST',{},batch)),'speed/render batch must not change outcome');
assert.deepEqual(summary(a),summary(run(make(6).map(e=>({...e,name:'Другое имя 🐈',color:'#000000',image:'data:image/png;base64,unused'})),'DETERMINISTIC-TEST')),'cosmetics must not influence simulation');
for(const n of [2,12,24])for(const duration of [45,60,90])for(const damage of [false,true]){const race=run(make(n),`SIZE-${n}-${duration}`,{duration,damage});assert(race.time>duration*.65&&race.time<duration*1.6);if(!damage)assert(race.balls.every(b=>b.hp===100));}
assert.notDeepEqual(makeObstacles('A'),makeObstacles('B'));
assert.throws(()=>new Race(make(1),'BAD'));assert.throws(()=>new Race(make(25),'BAD'));
let wins=Array(6).fill(0),min=Infinity,max=0,repairs=0;
for(let i=0;i<600;i++){const r=run(make(6),'BALANCE-'+i);wins[Number(r.finishers[0].id.split('-')[1])]++;min=Math.min(min,r.finishers[0].finish);max=Math.max(max,r.finishers.at(-1).finish);repairs+=r.balls.reduce((s,b)=>s+b.repairCount,0);}
// A smoke test for gross positional bias, not a proof of statistical fairness.
assert(wins.every(n=>n>55&&n<145),`gross bias in sample: ${wins}`);
console.log(JSON.stringify({passed:true,simulationRuns:625,winsOver600:wins,fastestWinner:min.toFixed(2),slowestFinisher:max.toFixed(2),repairs,checks:['replay','frame-batch independence','cosmetics independence','2–24 participants','45/60/90 seconds','damage disabled','bounded health','all finish','varied courses','invalid participant counts']},null,2));
