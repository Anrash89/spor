/* Pure deterministic arcade simulation. Presentation never consumes these RNG streams. */
export const DT = 1 / 60;
export const COLORS = ['#f27760','#55a9aa','#a998ce','#e9b444','#7d9f60','#719bc9','#d483a4','#c8956f'];
export function hash(text) { let h=2166136261; for(const ch of String(text)) {h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
export function rng(seed) { let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
export function freshSeed() { const n=new Uint32Array(2);crypto.getRandomValues(n);return [...n].map(x=>x.toString(36)).join('-').toUpperCase(); }
export function shuffle(a,r) { for(let i=a.length-1;i>0;i--) {const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
export function makeObstacles(seed) {const r=rng(hash(seed+'course'));return Array.from({length:15},(_,i)=>({p:.065+i*.059,type:['spinner','bumper','boost','jump','repair'][i%5],phase:r()*Math.PI*2,lane:(r()-.5)*4.3,speed:.8+r()*1.2}));}
export class Race {
 constructor(entries,seed,options={}) {
  if(entries.length<2||entries.length>24) throw Error('Нужно от 2 до 24 шариков');
  this.seed=seed;this.duration=Number(options.duration)||60;this.damage=options.damage!==false;this.time=0;this.done=false;this.events=[];this.obstacles=makeObstacles(seed);this.finishers=[];
  const r=rng(hash(seed+'start'));const slots=shuffle(Array.from({length:entries.length},(_,i)=>i),r);
  this.balls=entries.map((entry,i)=>{let slot=slots[i];let rand=rng(hash(seed+'ball'+slot));return {id:entry.id,name:entry.name,color:entry.color,image:entry.image||'',slot,rand,p:0,prevP:0,lane:(rand()-.5)*5.7,laneV:0,target:0,pace:1,v:1,hp:100,hits:0,boost:0,stun:0,jump:0,flash:0,decision:0,nextObstacle:0,finish:null,repairCount:0,tie:rand()};});
 }
 step(dt=DT) {
  if(this.done)return;this.events=[];const start=this.time;this.time+=dt;
  for(const b of this.balls) {
   if(b.finish!==null)continue;
   b.prevP=b.p;b.flash=Math.max(0,b.flash-dt);b.jump=Math.max(0,b.jump-dt);b.boost=Math.max(0,b.boost-dt);b.stun=Math.max(0,b.stun-dt);b.decision-=dt;
   if(b.decision<=0) {b.decision=.6+b.rand()*.9;b.target=(b.rand()-.5)*6;b.pace=.77+b.rand()*.50;}
   b.laneV+=(b.target-b.lane)*dt*4;b.laneV*=Math.exp(-dt*3);b.lane+=b.laneV*dt;
   if(Math.abs(b.lane)>3.25) {b.lane=Math.sign(b.lane)*3.25;b.laneV*=-.7;}
   let target=b.pace*(b.boost>0?1.48:1)*(b.stun>0?.2:1);
   b.v+=(target-b.v)*Math.min(1,dt*3);
   b.p+=dt/this.duration*b.v;
   while(b.nextObstacle<this.obstacles.length&&b.p>=this.obstacles[b.nextObstacle].p) {
    const o=this.obstacles[b.nextObstacle++];let effect=null;
    if(o.type==='spinner'||o.type==='bumper') {
     const lane=o.type==='spinner'?Math.sin(this.time*o.speed+o.phase)*2.5:o.lane;
     if(Math.abs(b.lane-lane)<(o.type==='spinner'?1.7:1.4)) {
      b.v*=.48;b.laneV+=(b.lane>=lane?1:-1)*3;b.hits++;b.flash=.45;
      if(this.damage)b.hp=Math.max(0,b.hp-18-Math.floor(b.rand()*15));
      effect='hit';if(b.hp===0){b.stun=2.2;b.hp=100;b.repairCount++;effect='respawn';}
     }
    }else if(o.type==='boost'){if(Math.abs(b.lane-o.lane)<2.1){b.boost=2.3;effect='boost';}}
    else if(o.type==='jump'){b.jump=1.0;b.boost=.6;effect='jump';}
    else if(o.type==='repair'){b.hp=Math.min(100,b.hp+24);effect='repair';}
    if(effect)this.events.push({id:b.id,type:effect,p:b.p});
   }
   if(b.p>=1){b.finish=start+dt*(1-b.prevP)/(b.p-b.prevP);b.p=1;this.events.push({id:b.id,type:'finish',p:1});}
  }
  // Resolve unordered pairs symmetrically. Collisions transfer lateral momentum,
  // never silently favor the first participant in an array.
  const ordered=[...this.balls].sort((a,b)=>a.slot-b.slot);
  for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
   const a=ordered[i],b=ordered[j];if(a.finish!==null||b.finish!==null)continue;
   if(Math.abs(a.p-b.p)<.0018&&Math.abs(a.lane-b.lane)<.68){
    const sign=a.lane>=b.lane?1:-1;const force=(.68-Math.abs(a.lane-b.lane))*dt*10;
    a.laneV+=sign*force;b.laneV-=sign*force;
   }
  }
  this.finishers=this.balls.filter(b=>b.finish!==null).sort((a,b)=>a.finish-b.finish||a.tie-b.tie);
  this.done=this.finishers.length===this.balls.length;
 }
 ranking(){return [...this.balls].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish||a.tie-b.tie:a.finish!==null?-1:b.finish!==null?1:b.p-a.p||a.tie-b.tie);}
}
