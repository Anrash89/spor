import * as T from './vendor/three.module.js';
import {rng,hash,makeObstacles} from './engine.js';
import {SoftwareRenderer} from './software-renderer.js';
const INK=0x354b3d;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export class World {
 constructor(canvas,labels) {
  this.canvas=canvas;this.labels=labels;this.scene=new T.Scene();this.scene.background=new T.Color('#e5ebd6');this.scene.fog=new T.Fog('#e5ebd6',130,360);
  try {this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch{this.renderer=new SoftwareRenderer(canvas);}this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.camera=new T.PerspectiveCamera(40,1,.1,800);this.camera.position.set(51,49,62);this.look=V(0,12,-22);this.camera.lookAt(this.look);
  this.scene.add(new T.HemisphereLight(0xfff8de,0x819a78,2.3));const sun=new T.DirectionalLight(0xfff7dc,3.1);sun.position.set(45,110,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:100,bottom:-180,near:1,far:400});sun.shadow.bias=-.0008;sun.shadow.normalBias=.08;this.scene.add(sun);this.sun=sun;
  this.gradient=new T.DataTexture(new Uint8Array([110,165,220,255]),4,1,T.RedFormat);this.gradient.needsUpdate=true;this.gradient.minFilter=T.NearestFilter;this.gradient.magFilter=T.NearestFilter;
  this.root=new T.Group();this.scene.add(this.root);this.ballGroup=new T.Group();this.scene.add(this.ballGroup);this.balls=new Map();this.effects=[];this.mode=0;this.followId=null;this.yaw=0;this.zoom=1;this.drag=null;this.pointerMap=new Map();this.pinchDistance=0;this.orbitControls();
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
 }
 mat(color,extra={}){return new T.MeshToonMaterial({color,gradientMap:this.gradient,...extra});}
 mesh(geo,mat,parent=this.root){let m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 outline(m){const line=new T.LineSegments(new T.EdgesGeometry(m.geometry,27),new T.LineBasicMaterial({color:INK,transparent:true,opacity:.38}));m.add(line);return m;}
 box(w,h,d,color,pos,parent=this.root,edge=true){let m=this.mesh(new T.BoxGeometry(w,h,d),this.mat(color),parent);m.position.copy(pos);if(edge)this.outline(m);return m;}
 disposeGroup(group){const geos=new Set(),mats=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(let m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);if(m.map)textures.add(m.map);}});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();}
 generate(seed){
  this.disposeGroup(this.root);const r=rng(hash(seed+'landscape'));this.r=r;
  const pts=[],rows=9+Math.floor(r()*5),sweep=18+r()*10,flip=r()<.5?-1:1;for(let i=0;i<rows;i++)pts.push(V(flip*(i%2?-1:1)*(sweep*(.72+r()*.4)),22-i/(rows-1)*19+(i===0?1:0),12-i/(rows-1)*242));
  this.curve=new T.CatmullRomCurve3(pts,false,'catmullrom',.45);this.curve.arcLengthDivisions=1200;this.curve.updateArcLengths();this.length=this.curve.getLength();
  this.trackRibbon(-4.25,4.25,0,0xecc769);this.trackRibbon(-4.3,-4.05,.6,0xc6a657);this.trackRibbon(4.05,4.3,.6,0xc6a657);
  this.rail(-4.24,.62);this.rail(4.24,.62);
  // Track side walls give the ribbon a visible cut-paper thickness.
  for(const side of [-4.25,4.25]){let verts=[],idx=[];for(let i=0;i<=500;i++){let q=this.at(i/500,side);verts.push(q.x,q.y+.6,q.z,q.x,q.y-1,q.z);if(i<500){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();this.mesh(g,this.mat(0xc3a365,{side:T.DoubleSide}));}
  // Fine imperfect lines evoke pencil on the track, without glossy materials.
  const lines=[];for(let i=0;i<160;i++){let p=r();let q=this.at(p,(r()-.5)*7.6);let t=this.curve.getTangentAt(p);lines.push(q.x,q.y+.025,q.z,q.x+t.x*(.3+r()*.8),q.y+.03,q.z+t.z*(.3+r()*.8));}const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lines,3));this.root.add(new T.LineSegments(lg,new T.LineBasicMaterial({color:0x9c8c53,transparent:true,opacity:.25})));
  const ground=this.mesh(new T.PlaneGeometry(1400,1400),this.mat(0xe2e8d1));ground.rotation.x=-Math.PI/2;ground.position.y=-4;ground.castShadow=false;
  const island=this.mesh(new T.BoxGeometry(103,5,281),this.mat(0xb7c398));island.position.set(0,-3,-110);island.receiveShadow=true;island.castShadow=false;
  // Irregular faceted knolls and illustrated trees along the course.
  for(let i=0;i<65;i++){
   let p=r(),side=(r()<.5?-1:1)*(9+r()*21),q=this.at(p,side);q.y=-.5;
   let h=2+r()*5;let hill=this.mesh(new T.IcosahedronGeometry(1,0),this.mat([0xb5c49a,0xc4ceaa,0xaabb8f,0xd2d8b5][i%4]));hill.position.copy(q);hill.scale.set(4+r()*5,h,3+r()*5);hill.castShadow=false;
   if(i%2===0)this.tree(q.x,q.z,h*.35,3+r()*3,r);
  }
  for(let i=0;i<45;i++){
   let p=i/44;let q=this.at(p);if(i%3===0){let pole=this.mesh(new T.CylinderGeometry(.35,.65,q.y+1,7),this.mat(0x95a486));pole.position.set(q.x,(q.y-1)/2,q.z);}
   const q2=this.at(p,(i%2?1:-1)*(7+r()*12));this.grass(q2.x,q2.z,r);
  }
  for(let i=0;i<8;i++){let q=this.at((i+.5)/8,(i%2?1:-1)*12);this.tree(q.x,q.z,0,5+r()*3,r);}
  this.gate(.007,'СТАРТ',0xf7f0d7);this.gate(.991,'ФИНИШ',0x344f42);
  for(let j=0;j<4;j++)for(let k=0;k<10;k++){const q=this.at(.984+j*.0014,(k-4.5)*.8);let m=this.mesh(new T.PlaneGeometry(.8,.62),this.mat((j+k)%2?0x3d5243:0xfff5da));m.rotation.x=-Math.PI/2;m.rotation.z=-this.heading(.99);m.position.copy(q);m.position.y+=.035;}
  this.obstacles=makeObstacles(seed).map(o=>this.obstacle(o));
  for(let i=0;i<11;i++){let p=.05+i*.087;let q=this.at(p,-5.8);const flag=new T.Group();this.root.add(flag);flag.position.copy(q);this.box(.12,3,.12,0x60725b,V(0,1.5,0),flag,false);let f=this.mesh(new T.PlaneGeometry(1.8,.9),this.mat([0xe58e72,0x82aba0,0xd4b65d][i%3],{side:T.DoubleSide}),flag);f.position.set(.9,2.5,0);flag.rotation.y=this.heading(p);}
  this.yaw=0;this.zoom=1;
 }
 trackRibbon(left,right,height,color){let verts=[],uv=[],idx=[];for(let i=0;i<=500;i++) {for(const side of [left,right]){let q=this.at(i/500,side);verts.push(q.x,q.y+height,q.z);uv.push(side===left?0:1,i/50);}if(i<500){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();this.mesh(g,this.mat(color,{side:T.DoubleSide}));}
 rail(side,height){let points=[];for(let i=0;i<=700;i++){const p=this.at(i/700,side);p.y+=height;points.push(p);}let geo=new T.BufferGeometry().setFromPoints(points);this.root.add(new T.Line(geo,new T.LineBasicMaterial({color:0x736c40,transparent:true,opacity:.7})));}
 at(p,lane=0){p=T.MathUtils.clamp(p,0,1);let q=this.curve.getPointAt(p);let t=this.curve.getTangentAt(p);return q.add(V(-t.z,0,t.x).normalize().multiplyScalar(lane));}
 heading(p){const t=this.curve.getTangentAt(p);return Math.atan2(t.x,t.z);}
 tree(x,z,y,size,r){const g=new T.Group();this.root.add(g);g.position.set(x,y,z);this.box(.45,size*.9,.45,0x9a8c6b,V(0,size*.4,0),g,false);for(let j=0;j<3;j++){let leaf=this.mesh(new T.ConeGeometry(size*(.5-j*.08),size*.75,6),this.mat([0x7e9d79,0x96af83,0xabc192][j]),g);leaf.position.set(0,size*(.65+j*.28),0);leaf.rotation.y=r()*2;this.outline(leaf);} }
 grass(x,z,r){const g=new T.BufferGeometry();let a=[];for(let i=0;i<5;i++){let xx=x+(r()-.5)*3,zz=z+(r()-.5)*3;a.push(xx,0,zz,xx+(r()-.5)*.4,.45+r()*.4,zz);}g.setAttribute('position',new T.Float32BufferAttribute(a,3));this.root.add(new T.LineSegments(g,new T.LineBasicMaterial({color:0x9dac86})));}
 textTexture(text,bg,fg,w=512,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.strokeRect(7,7,w-14,h-14);ctx.fillStyle=fg;ctx.font='bold 58px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w-40);let map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return map;}
 gate(p,text,color){const g=new T.Group();this.root.add(g);g.position.copy(this.at(p));g.rotation.y=this.heading(p);for(let s of [-1,1]){this.box(.32,5.8,.4,0x65765a,V(s*4.7,2.8,0),g);let f=this.mesh(new T.SphereGeometry(.3,8,6),this.mat(0xf0bf50),g);f.position.set(s*4.7,5.9,0);}const banner=this.mesh(new T.BoxGeometry(9.5,1.6,.15),this.mat(color),g);banner.position.y=5.3;const front=this.mesh(new T.PlaneGeometry(9.3,1.5),new T.MeshBasicMaterial({map:this.textTexture(text,text==='СТАРТ'?'#f7f0d7':'#344f42',text==='СТАРТ'?'#344f42':'#f7f0d7'),side:T.DoubleSide}),g);front.position.set(0,5.3,.09);}
 obstacle(o){const g=new T.Group();this.root.add(g);g.position.copy(this.at(o.p));g.rotation.y=this.heading(o.p);o.group=g;
  if(o.type==='spinner'){
   this.box(.55,3,.55,0xa17e60,V(-4,1.5,0),g);let bridge=this.box(8.6,.25,.4,0xa17e60,V(0,3,0),g);let moving=new T.Group();g.add(moving);o.moving=moving;let ball=this.mesh(new T.IcosahedronGeometry(1.15,1),this.mat(0xe98670),moving);ball.position.y=.7;this.outline(ball);this.box(.13,2.1,.13,0x80715b,V(0,2,0),moving,false);
   const wind=new T.Group();g.add(wind);wind.position.set(-4,3.1,0);for(let i=0;i<4;i++){let arm=this.box(.38,3,.16,i%2?0xf2e3b8:0xe9ad64,V(),wind);arm.rotation.z=i*Math.PI/2;arm.position.set(Math.sin(i*Math.PI/2)*1.15,Math.cos(i*Math.PI/2)*1.15,0);}o.wind=wind;
  }else if(o.type==='bumper'){
   let bumper=this.mesh(new T.CylinderGeometry(1.1,1.25,1.4,10),this.mat(0xb29bcc),g);bumper.position.set(-o.lane,.7,0);this.outline(bumper);let top=this.mesh(new T.CylinderGeometry(.75,.8,.15,10),this.mat(0xede2ee),g);top.position.set(-o.lane,1.48,0);
  }else if(o.type==='boost'){
   this.box(3.9,.08,4.6,0x7db4aa,V(-o.lane,.07,0),g);for(let i=0;i<3;i++){for(let s of [-1,1]){const arrow=this.box(.13,.04,1.1,0xf7f4ce,V(-o.lane+s*.38,.14,-1.3+i*1.3),g,false);arrow.rotation.y=s*.8;}}
  }else if(o.type==='jump'){
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-4,0,-1.7,4,0,-1.7,-4,.8,1.6,4,.8,1.6],3));geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();this.mesh(geo,this.mat(0xe9a765,{side:T.DoubleSide}),g);for(let s of [-1,1]){this.box(.2,1.4,.2,0x967b58,V(s*3.9,.7,1.5),g);}
  }else{
   let ring=this.mesh(new T.TorusGeometry(3.6,.16,5,24,Math.PI),this.mat(0x89b89c),g);ring.position.y=.2;let cross=this.box(.4,1.8,.25,0x6b9c83,V(0,4.2,0),g);this.box(1.8,.4,.25,0x6b9c83,V(0,4.2,0),g);o.cross=cross;
  }return o;
 }
 makeTexture(entry){let c=document.createElement('canvas');c.width=512;c.height=256;let ctx=c.getContext('2d');const draw=()=>{ctx.fillStyle=entry.color;ctx.fillRect(0,0,512,256);ctx.strokeStyle='#ffffff40';ctx.lineWidth=14;for(let x=-200;x<700;x+=92){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+150,256);ctx.stroke();}ctx.lineWidth=1;ctx.strokeStyle='#29453620';for(let x=0;x<512;x+=12){ctx.beginPath();ctx.moveTo(x,200);ctx.lineTo(x+17,226);ctx.stroke();}};draw();let map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  if(entry.image){let im=new Image();im.onload=()=>{draw();for(let x of [128,384]){ctx.save();ctx.beginPath();ctx.arc(x,128,79,0,Math.PI*2);ctx.clip();ctx.drawImage(im,x-79,49,158,158);ctx.restore();}map.needsUpdate=true;};im.src=entry.image;}
  return map;
 }
 setEntries(entries){for(const fx of this.effects){this.scene.remove(fx.m);fx.m.geometry.dispose();fx.m.material.dispose();}this.effects=[];this.disposeGroup(this.ballGroup);this.balls.clear();this.labels.replaceChildren();for(let e of entries){let group=new T.Group();this.ballGroup.add(group);const sphere=this.mesh(new T.SphereGeometry(.69,20,12),this.mat(0xffffff,{map:this.makeTexture(e)}),group);const outline=this.mesh(new T.SphereGeometry(.716,16,12),new T.MeshBasicMaterial({color:INK,side:T.BackSide}),group);outline.castShadow=false;
   const shadow=this.mesh(new T.CircleGeometry(.78,16),new T.MeshBasicMaterial({color:0x52623d,opacity:.18,transparent:true,depthWrite:false}),this.ballGroup);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
   let label=document.createElement('div');label.className='ball-label';let name=document.createElement('span');name.textContent=e.name;label.append(name);let hp=document.createElement('i');hp.className='hp';label.append(hp);this.labels.append(label);this.balls.set(e.id,{group,sphere,outline,shadow,label,hp,entry:e});}
  this.stageEntries=entries;
 }
 snapToStart(){this.look.copy(this.at(.011));this.camera.position.copy(this.look).add(V(22,30,34));this.camera.lookAt(this.look);this.camera.updateMatrixWorld();}
 resize(){const rect=this.canvas.parentElement.getBoundingClientRect();this.width=rect.width;this.height=rect.height;this.renderer.setSize(rect.width,rect.height,false);this.camera.aspect=rect.width/rect.height;this.camera.updateProjectionMatrix();}
 orbitControls(){this.canvas.addEventListener('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);this.pointerMap.set(e.pointerId,{x:e.clientX,y:e.clientY});this.drag={x:e.clientX,y:e.clientY};if(this.pointerMap.size===2){const a=[...this.pointerMap.values()];this.pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}});this.canvas.addEventListener('pointermove',e=>{if(!this.pointerMap.has(e.pointerId))return;this.pointerMap.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointerMap.size===2){const a=[...this.pointerMap.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(this.pinchDistance>0)this.zoom=T.MathUtils.clamp(this.zoom*this.pinchDistance/d,.45,2);this.pinchDistance=d;}else if(this.drag){this.yaw+=(e.clientX-this.drag.x)*.008;this.drag={x:e.clientX,y:e.clientY};}});const release=e=>{this.pointerMap.delete(e.pointerId);this.drag=null;this.pinchDistance=0;};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=T.MathUtils.clamp(this.zoom*Math.exp(e.deltaY*.001),.45,2);},{passive:false});}
 burst(id,type){let b=this.balls.get(id);if(!b)return;let r=rng(hash(id+type+performance.now()));for(let i=0;i<(type==='finish'?30:9);i++){let m=this.mesh(new T.IcosahedronGeometry(type==='finish'?.18:.11,0),this.mat(type==='hit'?0xefae6a:type==='repair'?0x91b799:[0xf0c449,0xe28570,0x7aaea6][i%3]),this.scene);m.position.copy(b.group.position);this.effects.push({m,v:V((r()-.5)*7,2+r()*6,(r()-.5)*7),life:1+r()});}}
 frame(race,dt,now,state){if(!this.curve)return;const active=race?.balls;const rank=race?.ranking();const leader=rank?.[0];let focusP=0;
  if(race&&this.mode!==0){focusP=this.mode===2?(race.balls.find(b=>b.id===this.followId)||leader).p:leader.p;}
  const desiredLook=this.mode===0?V(0,9,-74):this.at(Math.min(.992,focusP+.011));let offset=this.mode===0?V(101,126,132):V(22,30,34);if(!race&&this.mode!==0){desiredLook.copy(this.at(.025));offset=V(27,34,36);}
  if(this.width<600&&this.mode===0){offset.multiplyScalar(1.3);desiredLook.z=-70;}
  offset.applyAxisAngle(V(0,1,0),this.yaw).multiplyScalar(this.zoom);let desiredPos=desiredLook.clone().add(offset);const ease=1-Math.exp(-dt*2.7);this.look.lerp(desiredLook,ease);this.camera.position.lerp(desiredPos,ease);this.camera.lookAt(this.look);this.camera.updateMatrixWorld();
  const t=race?race.time:now*.6;
  for(let o of this.obstacles){if(o.moving){o.moving.position.x=-Math.sin(t*o.speed+o.phase)*2.5;o.moving.rotation.z=Math.sin(t*o.speed+o.phase)*.15;o.wind.rotation.z=t*o.speed;}if(o.cross)o.cross.rotation.y=t*.5;}
  let index=0,labelRects=[];for(let [id,item] of this.balls){let b=active?.find(b=>b.id===id);let p=b?b.p:0;let lane=b?b.lane:((index%6)-2.5)*1.25;let q=this.at(b?p:Math.min(.012,Math.floor(index/6)*.003),lane);let hop=b?.jump?Math.sin((1-b.jump)*Math.PI)*2.8:0;if(b?.finish!==null&&b?.finish!==undefined){q=this.at(1,((rank.findIndex(v=>v.id===id)%6)-2.5)*1.25);q.add(V(0,0,-Math.floor(rank.findIndex(v=>v.id===id)/6)*1.6));}
   item.shadow.position.copy(q);item.shadow.position.y+=.045;item.shadow.scale.setScalar(1-hop*.1);q.y+=.72+hop+(b?.stun>0?Math.abs(Math.sin(t*12))*.15:0);item.group.position.copy(q);
   if(b){item.sphere.rotation.x=-b.p*this.length/.69;item.sphere.rotation.z=b.lane*.4;item.sphere.material.color.set(b.flash>0?0xffcf9a:0xffffff);item.hp.style.width=b.hp+'%';item.hp.style.background=b.hp<35?'#d78269':'#75a47c';}else{item.sphere.rotation.y=now*.12;item.hp.style.width='100%';}
   const projected=q.clone().add(V(0,1.1,0)).project(this.camera);const visible=projected.z<1&&projected.z>-1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1;
   item.label.style.display=visible&&b&&(this.mode!==0||leader?.id===id)?'block':'none';let lx=(projected.x+1)*this.width/2,ly=(-projected.y+1)*this.height/2;const lw=Math.min(130,item.entry.name.length*6+14);if(visible&&b){for(let tries=0;tries<8&&labelRects.some(v=>Math.abs(lx-v.x)<(lw+v.w)/2+4&&Math.abs(ly-v.y)<23);tries++)ly-=23;labelRects.push({x:lx,y:ly,w:lw});}item.label.style.left=lx+'px';item.label.style.top=ly+'px';item.label.classList.toggle('lead',leader?.id===id);item.label.style.opacity=this.mode===0&&active&&index>7?'.45':'1';index++;
  }
  for(let i=this.effects.length-1;i>=0;i--){let fx=this.effects[i];fx.life-=dt;fx.v.y-=dt*9;fx.m.position.addScaledVector(fx.v,dt);fx.m.rotation.x+=dt*4;if(fx.life<=0){this.scene.remove(fx.m);fx.m.geometry.dispose();fx.m.material.dispose();this.effects.splice(i,1);}}
  this.renderer.render(this.scene,this.camera);
 }
}
