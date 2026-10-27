import * as T from './vendor/three.module.js';
import {hash,rng,shuffle} from './random.js';
export const TRACK_NAMES=['HELIX / Спираль','CROSSOVER / Восьмёрка','ORBIT / Орбитальная','SWITCHBACK / Каскад','CLOVER / Трилистник','DRIFT / Магистраль'];
export const TYPES=['spinner','gate','bumper','slow','vortex','boost','jump','repair'];
export const TYPE_NAMES={spinner:'Ротор',gate:'Шлюз',bumper:'Отбойник',slow:'Тормозное поле',vortex:'Воронка',boost:'Ускоритель',jump:'Трамплин',repair:'Ремонт'};
export class Course{
 constructor(seed){this.seed=seed;const r=rng(hash(seed+'topology-v2'));this.kind=hash(seed+'layout-v2')%6;this.name=TRACK_NAMES[this.kind];this.accent=[0xc5fc63,0x67d5fb,0xffad5e,0xee7d83,0xb49bf5,0xe3ecf0][this.kind];const pts=[],angle=r()*Math.PI*2,mirror=r()<.5?-1:1,scale=.82+r()*.3,turns=1.5+r()*.6,phase=r()*3;
  if(this.kind===3){const n=7+Math.floor(r()*4);for(let i=0;i<n;i++)pts.push(new T.Vector3((i%2?1:-1)*(20+r()*20),45-i*40/(n-1),30-i*26));}
  else{const n=72;for(let i=0;i<=n;i++){const u=i/n;let x,z,y=48-44*u;
   if(this.kind===0){let t=u*Math.PI*2*turns,rad=30+8*Math.sin(u*4+phase);x=Math.cos(t)*rad;z=Math.sin(t)*rad;y=65-60*u;}
   if(this.kind===1){let t=u*Math.PI*2*(.9+rng(hash(seed+'laps'))()*.4)-.4;x=48*Math.sin(t);z=30*Math.sin(t*2);y=57-51*u;}
   if(this.kind===2){let t=u*Math.PI*4.4;x=Math.sin(t)*(27+7*Math.cos(u*5));z=-u*150+Math.cos(t)*23;y=50-45*u;}
   if(this.kind===4){let t=u*Math.PI*2;x=(2+Math.cos(3*t))*18*Math.cos(2*t);z=(2+Math.cos(3*t))*18*Math.sin(2*t);y=72-u*66+Math.sin(3*t)*5;}
   if(this.kind===5){x=36*Math.sin(u*Math.PI*(2.5+rng(hash(seed+'sweep'))()*2)+phase)+15*Math.sin(u*13);z=20-u*210;y=46-u*40+Math.sin(u*10)*2;}
   pts.push(new T.Vector3(x*scale,y,z*scale));}}
  for(const p of pts){p.x*=mirror;p.applyAxisAngle(new T.Vector3(0,1,0),angle);}
  this.curve=new T.CatmullRomCurve3(pts,false,'centripetal');this.curve.arcLengthDivisions=3000;this.curve.updateArcLengths();this.length=this.curve.getLength();this.halfWidth=5.1;this.samples=[];this.bounds=new T.Box3();
  for(let i=0;i<=1500;i++){let p=this.curve.getPointAt(i/1500),t=this.curve.getTangentAt(i/1500),len=Math.hypot(t.x,t.z);this.samples.push({x:p.x,y:p.y,z:p.z,tx:t.x/len,tz:t.z/len,slope:t.y});this.bounds.expandByPoint(p);}
  this.center=this.bounds.getCenter(new T.Vector3());this.size=this.bounds.getSize(new T.Vector3());
  const rr=rng(hash(seed+'obstacles-v2'));const n=16+Math.floor(rr()*7),bag=shuffle([...TYPES,...TYPES,...TYPES],rr);let vortices=0;
  this.obstacles=Array.from({length:n},(_,i)=>{let p=.065+(i+rr()*.35)*.86/n,type=bag[i];if(type==='vortex'&&++vortices>2)type='spinner';return{id:i,p,s:p*this.length,type,lane:(rr()-.5)*5.3,phase:rr()*Math.PI*2,speed:(.7+rr()*1.1)*(rr()<.5?-1:1),radius:type==='vortex'?7:0};});
  // Keep bowl rims apart even on the shortest route.
  this.obstacles=this.obstacles.filter((o,i,a)=>i===0||o.s-a[i-1].s>(o.type==='vortex'||a[i-1].type==='vortex'?15:7));
 }
 sample(s){let f=Math.max(0,Math.min(1,s/this.length))*1500,i=Math.min(1499,Math.floor(f)),k=f-i,a=this.samples[i],b=this.samples[i+1];return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,z:a.z+(b.z-a.z)*k,tx:a.tx+(b.tx-a.tx)*k,tz:a.tz+(b.tz-a.tz)*k,slope:a.slope+(b.slope-a.slope)*k};}
 at(s,lane=0){const a=this.sample(s),q=new T.Vector3(a.x-a.tz*lane,a.y,a.z+a.tx*lane);const bowl=this.obstacles?.find(o=>o.type==='vortex'&&Math.abs(s-o.s)<11);if(bowl){const t=this.sample(bowl.s),u=s-bowl.s,w=Math.max(0,Math.min(1,(11-Math.abs(u))/4));q.lerp(new T.Vector3(t.x+t.tx*u-t.tz*lane,t.y,t.z+t.tz*u+t.tx*lane),w*w*(3-2*w));}return q;}
 bowlAt(o,s,lane){const a=this.sample(o.s),u=s-o.s,rad=Math.hypot(u,lane),y=a.y-3+3*Math.min(1,(rad/7)**2);return new T.Vector3(a.x+a.tx*u-a.tz*lane,y,a.z+a.tz*u+a.tx*lane);}
 pose(b){return (b.vortex?this.bowlAt(b.vortex,b.s,b.lane):this.at(b.s,b.lane)).add(new T.Vector3(0,.72+(b.height||0),0));}
 heading(s){const t=this.sample(s);return Math.atan2(t.tx,t.tz);}
}
