import {Course} from './course.js';
import {rng,hash,shuffle} from './random.js';
export {rng,hash,shuffle,freshSeed} from './random.js';
export const DT=1/60,RADIUS=.72,DIAMETER=RADIUS*2;
export const COLORS=['#e6ff64','#55cef5','#ff8967','#ac94ef','#64d9a2','#f19ebc','#f0c260','#bdc9dc'];
export function makeObstacles(seed){return new Course(seed).obstacles;}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Equal-mass disc contacts on the curvilinear track surface. Impulses change
// both longitudinal and lateral velocity, and penetration is resolved explicitly.
export function resolvePair(a,b,restitution=.62,heightA=a.height||0,heightB=b.height||0){
 let dx=b.s-a.s,dy=b.lane-a.lane,dz=heightB-heightA,d=Math.hypot(dx,dy);if(Math.abs(dz)>=DIAMETER)return null;const contact=Math.sqrt(DIAMETER*DIAMETER-dz*dz);if(d>=contact)return null;
 const originalDistance=d;if(d<1e-8){dx=a.slot<b.slot?1:-1;dy=0;d=1;}
 let nx=dx/d,ny=dy/d,penetration=contact-originalDistance;const correction=Math.max(0,penetration+.00005)*.5;a.s-=nx*correction;b.s+=nx*correction;a.lane-=ny*correction;b.lane+=ny*correction;
 let closing=(b.speed-a.speed)*nx+(b.laneV-a.laneV)*ny;if(closing<0){let j=-(1+restitution)*closing*.5;a.speed-=j*nx;b.speed+=j*nx;a.laneV-=j*ny;b.laneV+=j*ny;return -closing;}return 0;
}
export class Race{
 constructor(entries,seed,options={}){if(entries.length<2||entries.length>24)throw Error('Нужно 2–24 шарика');this.seed=seed;this.course=new Course(seed);this.obstacles=this.course.obstacles;this.duration=Number(options.duration)||60;this.damage=options.damage!==false;this.baseSpeed=this.course.length/this.duration*1.2;this.time=0;this.done=false;this.events=[];this.finishers=[];this.contactCount=0;this.obstacleContacts=0;
  const r=rng(hash(seed+'grid-v2')),slots=shuffle(entries.map((_,i)=>i),r),cols=Math.min(5,entries.length);
  this.balls=entries.map((e,i)=>{const slot=slots[i],rand=rng(hash(seed+'body-v2-'+slot)),s=10-Math.floor(slot/cols)*1.7;return{...e,slot,rand,s,prevS:s,p:s/this.course.length,lane:(slot%cols-(cols-1)/2)*1.7,speed:0,v:0,laneV:0,target:0,pace:1,hp:100,hits:0,ballHits:0,repairCount:0,boost:0,stun:0,flash:0,jump:0,height:0,vertical:0,decision:0,hitCooldown:0,finish:null,tie:rand(),triggered:new Set(),vortex:null,vortexTimer:0};});
 }
 hit(b,amount,type='hit'){if(b.hitCooldown>0)return;b.hitCooldown=.22;b.flash=.2;b.hits++;if(type==='collision')b.ballHits++;if(this.damage)b.hp=Math.max(0,b.hp-amount);this.events.push({id:b.id,type,p:b.p});if(b.hp<=0){b.hp=100;b.stun=1.4;b.repairCount++;this.events.push({id:b.id,type:'respawn',p:b.p});}}
 solid(b,x,y,r,vx=0,vy=0){if(b.height>1.6)return;let dx=b.s-x,dy=b.lane-y,d=Math.hypot(dx,dy),min=RADIUS+r;if(d>=min)return;const separation=d;if(d<.0001){dx=-1;dy=0;d=1;}const nx=dx/d,ny=dy/d;b.s+=nx*(min-separation+.0001);b.lane+=ny*(min-separation+.0001);const incoming=(b.speed-vx)*nx+(b.laneV-vy)*ny;if(incoming<0){b.speed-=(1.55*incoming)*nx;b.laneV-=(1.55*incoming)*ny;this.hit(b,8+Math.min(8,Math.floor(-incoming)));this.obstacleContacts++;}}
 forces(b,h){b.flash=Math.max(0,b.flash-h);b.hitCooldown=Math.max(0,b.hitCooldown-h);b.boost=Math.max(0,b.boost-h);b.stun=Math.max(0,b.stun-h);b.decision-=h;
  if(b.decision<=0){b.decision=.6+b.rand()*.8;b.target=(b.rand()-.5)*7.8;b.pace=.84+b.rand()*.34;}
  if(b.height>0||b.vertical>0){b.vertical-=12*h;b.height+=b.vertical*h;if(b.height<0){b.height=0;b.vertical=0;}}b.jump=b.height>0?1:0;
  if(b.vortex){let o=b.vortex,dx=b.s-o.s,dy=b.lane,rad=Math.max(.2,Math.hypot(dx,dy));b.vortexTimer-=h;const targetRadius=1.8+3.8*Math.max(0,b.vortexTimer/b.vortexDuration),tang=6.5*o.speed;const radial=(targetRadius-rad)*5;const desiredX=-dy/rad*tang+dx/rad*radial,desiredY=dx/rad*tang+dy/rad*radial;b.speed+=(desiredX-b.speed)*h*4;b.laneV+=(desiredY-b.laneV)*h*4;b.s+=b.speed*h;b.lane+=b.laneV*h;if(b.vortexTimer<=0){b.vortex=null;b.s=o.s+7.9;b.lane=clamp(b.lane,-3.5,3.5);b.speed=this.baseSpeed*1.2;b.vertical=3;b.height=.1;this.events.push({id:b.id,type:'release',p:b.p});}return;}
  let slow=1;for(let o of this.obstacles)if(o.type==='slow'&&Math.abs(b.s-o.s)<4.5&&b.height<.8)slow=.38;
  const slope=this.course.sample(b.s).slope;let desired=this.baseSpeed*b.pace*slow*(b.boost>0?1.55:1)*(b.stun>0?.18:1)*(1+clamp(-slope,-.12,.2));b.speed+=(desired-b.speed)*h*1.35;
  b.laneV+=((b.target-b.lane)*2.2-b.laneV*2)*h;b.s+=b.speed*h;b.lane+=b.laneV*h;
  for(let o of this.obstacles){const near=b.s-o.s;if(Math.abs(near)>9)continue;
   if(o.type==='spinner'){let angle=this.time*o.speed+o.phase;for(let k=0;k<2;k++){let a=angle+k*Math.PI/2,ux=Math.sin(a),uy=Math.cos(a),projection=clamp(near*ux+b.lane*uy,-4,4),x=o.s+ux*projection,y=uy*projection;this.solid(b,x,y,.24,Math.cos(a)*o.speed*projection,-Math.sin(a)*o.speed*projection);}}
   if(o.type==='bumper'){let y=o.lane+Math.sin(this.time*o.speed+o.phase)*1.1;this.solid(b,o.s,y,1.15,0,Math.cos(this.time*o.speed+o.phase)*o.speed*1.1);}
   if(o.type==='gate'){let center=Math.sin(this.time*o.speed+o.phase)*2.1;for(let side of [-1,1]){const y=side<0?clamp(b.lane,-5.4,center-1.55):clamp(b.lane,center+1.55,5.4);this.solid(b,o.s,y,.28,0,Math.cos(this.time*o.speed+o.phase)*o.speed*2.1);}}
   if(!b.triggered.has(o.id)&&near>=-(o.type==='vortex'?Math.sqrt(Math.max(0,49-b.lane*b.lane))-.1:1)&&near<8){b.triggered.add(o.id);if(o.type==='vortex'){b.vortex=o;b.vortexDuration=2.4+b.rand()*2.1;b.vortexTimer=b.vortexDuration;b.speed*=.6;b.height=0;b.vertical=0;this.events.push({id:b.id,type:'vortex',p:b.p});break;}if(o.type==='boost'&&Math.abs(b.lane-o.lane)<2.6){b.boost=2;this.events.push({id:b.id,type:'boost',p:b.p});}if(o.type==='jump'){b.vertical=5+b.rand();b.height=.05;this.events.push({id:b.id,type:'jump',p:b.p});}if(o.type==='repair'){b.hp=Math.min(100,b.hp+30);this.events.push({id:b.id,type:'repair',p:b.p});}}
  }
 }
 step(dt=DT){if(this.done)return;this.events=[];const before=this.time;for(const b of this.balls)b.prevS=b.s;
  for(let sub=0;sub<2;sub++){const h=dt/2;this.time+=h;for(const b of this.balls)if(b.finish===null)this.forces(b,h);const bodies=this.balls.filter(b=>b.finish===null).sort((a,b)=>a.slot-b.slot);
   for(let iter=0;iter<6;iter++){for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j];if(Math.abs(a.s-b.s)>DIAMETER)continue;const inBowl=a.vortex||b.vortex;const impact=inBowl?resolvePair(a,b,.62,this.course.pose(a).y,this.course.pose(b).y):resolvePair(a,b);if(impact!==null&&impact>.6&&iter===0){this.contactCount++;this.hit(a,Math.min(6,2+Math.floor(impact)),'collision');this.hit(b,Math.min(6,2+Math.floor(impact)),'collision');}}
    for(const b of bodies){if(!b.vortex){const limit=this.course.halfWidth-RADIUS;if(Math.abs(b.lane)>limit){b.lane=clamp(b.lane,-limit,limit);b.laneV*=-.65;}b.s=Math.max(.2,b.s);}else{let dx=b.s-b.vortex.s,rad=Math.hypot(dx,b.lane);if(rad>6.2){b.s=b.vortex.s+dx/rad*6.2;b.lane=b.lane/rad*6.2;}}}
   }
   for(const b of bodies){b.speed=clamp(b.speed,-this.baseSpeed*.85,this.baseSpeed*2.6);b.laneV=clamp(b.laneV,-14,14);}
  }
  for(const b of this.balls){b.p=clamp(b.s/this.course.length,0,1);b.v=b.speed/this.baseSpeed;if(b.finish===null&&b.s>=this.course.length&&!b.vortex){const f=clamp((this.course.length-b.prevS)/(b.s-b.prevS||1),0,1);b.finish=before+dt*f;b.p=1;this.events.push({id:b.id,type:'finish',p:1});}}
  this.finishers=this.balls.filter(b=>b.finish!==null).sort((a,b)=>a.finish-b.finish||a.tie-b.tie);this.done=this.finishers.length===this.balls.length;
 }
 ranking(){return [...this.balls].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish||a.tie-b.tie:a.finish!==null?-1:b.finish!==null?1:b.p-a.p||a.tie-b.tie);}
}
