(() => {
'use strict';
if (!window.THREE) {
  document.body.innerHTML = '<div style="padding:30px;color:#eee;background:#050607;font:14px monospace">Three.js не загрузился. Запусти игру через START_WINDOWS.bat и проверь интернет-соединение.</div>';
  return;
}
const THREE = window.THREE;
const $ = id => document.getElementById(id);
const ui = {
  hud:$('hud'), questTitle:$('quest-title'), questDetail:$('quest-detail'), day:$('day-label'), time:$('time-label'),
  prompt:$('prompt'), promptText:$('prompt-text'), held:$('held-item'), heldIcon:$('held-icon'), heldName:$('held-name'),
  dialogue:$('dialogue'), portrait:$('portrait'), speaker:$('speaker'), dialogueText:$('dialogue-text'),
  inventory:$('inventory'), inventoryGrid:$('inventory-grid'), qte:$('qte'), qteTitle:$('qte-title'), qteDescription:$('qte-description'),
  qteZone:$('qte-zone'), qteMarker:$('qte-marker'), qteCount:$('qte-count'), memory:$('memory'), memoryText:$('memory-text'), memoryKicker:$('memory-kicker'),
  title:$('title-screen'), chapter:$('chapter-card'), chapterSmall:$('chapter-small'), chapterTitle:$('chapter-title'), chapterSubtitle:$('chapter-subtitle'),
  ending:$('ending'), sleepFade:$('sleep-fade'), mobile:$('mobile'), stick:$('stick'), stickKnob:$('stick-knob'), crosshair:$('crosshair'), vignette:$('vignette'), damage:$('damage'),
  locationCard:$('location-card'), locationName:$('location-name')
};

// -----------------------------------------------------------------------------
// Renderer / first-person camera
// -----------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0c);
scene.fog = new THREE.FogExp2(0x0a0c0d, 0.026);
const camera = new THREE.PerspectiveCamera(66, 16/9, 0.05, 90);
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .68;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('render').appendChild(renderer.domElement);
function resize(){
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  const targetH = innerWidth < 800 ? 300 : 430;
  const targetW = Math.max(320, Math.round(targetH * innerWidth/innerHeight));
  renderer.setSize(targetW,targetH,false);
}
resize(); addEventListener('resize',resize);

const texLoader = new THREE.TextureLoader();
function texture(path, rx=1, rz=1){
  const t=texLoader.load(path); t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,rz); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const TX={
  wall:texture('assets/textures/wall_plaster.png',4,2), wallDark:texture('assets/textures/wall_damp.png',4,2), floor:texture('assets/textures/floor_boards.png',5,5),
  wood:texture('assets/textures/wood_planks.png',2,2), grass:texture('assets/textures/grass_dense.png',24,20), path:texture('assets/textures/dirt_path.png',2,8),
  stone:texture('assets/textures/stone_moss.png',2,2), cloth:texture('assets/textures/cloth_woven.png',2,2), rug:texture('assets/textures/rug.png',2,2), water:texture('assets/textures/water_ripples.png',5,5),
  bark:texture('assets/textures/bark.png',2,4), leaves:texture('assets/textures/leaves.png',2,2), roof:texture('assets/textures/roof_shingles.png',4,3),
  metal:texture('assets/textures/metal_rust.png',2,2), fence:texture('assets/textures/fence_old.png',3,2), curtain:texture('assets/textures/curtain.png',2,2)
};
const MAT={
  wall:new THREE.MeshStandardMaterial({map:TX.wall,roughness:1}), wallDark:new THREE.MeshStandardMaterial({map:TX.wallDark,roughness:1}),
  floor:new THREE.MeshStandardMaterial({map:TX.floor,roughness:.96}), wood:new THREE.MeshStandardMaterial({map:TX.wood,roughness:.92}),
  grass:new THREE.MeshStandardMaterial({map:TX.grass,roughness:1}), path:new THREE.MeshStandardMaterial({map:TX.path,roughness:1}),
  stone:new THREE.MeshStandardMaterial({map:TX.stone,roughness:1}), cloth:new THREE.MeshStandardMaterial({map:TX.cloth,roughness:1}),
  rug:new THREE.MeshStandardMaterial({map:TX.rug,roughness:1}), bark:new THREE.MeshStandardMaterial({map:TX.bark,roughness:1}),
  leaves:new THREE.MeshStandardMaterial({map:TX.leaves,roughness:1}), roof:new THREE.MeshStandardMaterial({map:TX.roof,roughness:1}),
  fence:new THREE.MeshStandardMaterial({map:TX.fence,roughness:1}), curtain:new THREE.MeshStandardMaterial({map:TX.curtain,roughness:1,side:THREE.DoubleSide}),
  dark:new THREE.MeshStandardMaterial({color:0x262726,roughness:1}), metal:new THREE.MeshStandardMaterial({map:TX.metal,roughness:.7,metalness:.18}),
  skin:new THREE.MeshStandardMaterial({color:0xb98e74,roughness:1}), skinPale:new THREE.MeshStandardMaterial({color:0xa98473,roughness:1}),
  red:new THREE.MeshBasicMaterial({color:0x6e1f1f}), pale:new THREE.MeshBasicMaterial({color:0xd7ddc8})
};

const world=new THREE.Group(); scene.add(world);
const blockers=[]; const interactables=[]; const anim=[];
function box(name,x,y,z,sx,sy,sz,mat=MAT.wood,parent=world,collide=false){
  const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat); m.name=name; m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m);
  if(collide){const wx=x+(parent!==world&&parent.position?parent.position.x:0),wz=z+(parent!==world&&parent.position?parent.position.z:0);blockers.push({x:wx,z:wz,hx:sx/2+.32,hz:sz/2+.32});} return m;
}
function floor(name,x,z,sx,sz,mat=MAT.floor,y=0){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(sx,sz),mat); m.name=name; m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.receiveShadow=true; world.add(m); return m;
}
function sprite(path,x,y,z,sx=1,sy=1,parent=world){
  const map=texture(path); map.repeat.set(1,1); map.magFilter=THREE.NearestFilter; map.minFilter=THREE.NearestFilter; const material=new THREE.SpriteMaterial({map,transparent:true,alphaTest:.05});
  const s=new THREE.Sprite(material); s.position.set(x,y,z); s.scale.set(sx,sy,1); parent.add(s); return s;
}
function point(x,z){return new THREE.Vector3(x,1,z)}
function setVisible(o,v){o.visible=v;}

// Lights / story-driven color script
const hemi=new THREE.HemisphereLight(0x74818a,0x151617,.38);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xa7b0b8,.58);sun.position.set(-12,18,-8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.camera.near=.5;sun.shadow.camera.far=70;sun.shadow.bias=-.00035;scene.add(sun);
const kitchenLight=new THREE.PointLight(0xd8a978,1.15,10,2); kitchenLight.position.set(-.5,2.3,3.5); scene.add(kitchenLight);
const bedroomLight=new THREE.PointLight(0xb89b78,.6,7,2); bedroomLight.position.set(-4.5,2.1,5.2); scene.add(bedroomLight);
const hallLight=new THREE.PointLight(0x9d9279,.42,6,2); hallLight.position.set(2.5,2.1,4.4); scene.add(hallLight);
const lakeLight=new THREE.PointLight(0x67818d,.52,14,2); lakeLight.position.set(6,.8,-20); scene.add(lakeLight);
const porchGlow=new THREE.PointLight(0xd9b27e,.24,9,2);porchGlow.position.set(0,2.0,-1.7);scene.add(porchGlow);

// Player flashlight. Keep it in world space and explicitly aim it from the camera each frame.
// This avoids browser/Three.js edge cases with SpotLight targets parented to the FPS camera.
const flashlight=new THREE.SpotLight(0xffedc7,28,38,Math.PI/5.4,.48,1.35);
flashlight.castShadow=false;scene.add(flashlight);
const flashlightTarget=new THREE.Object3D();scene.add(flashlightTarget);flashlight.target=flashlightTarget;
const flashlightFill=new THREE.PointLight(0xffd6a2,1.05,5.2,1.55);scene.add(flashlightFill);
let flashlightOn=true,flashlightDesired=28;
function updateFlashlightButton(){const b=document.getElementById('flashlight-toggle');if(b)b.textContent=flashlightOn?'◉ СВЕТ':'○ СВЕТ';}
function toggleFlashlight(){flashlightOn=!flashlightOn;updateFlashlightButton();audioInit();playSfx('flashlight_click.wav',.82,flashlightOn?1.05:.92);}
function updateFlashlight(dt){
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  flashlight.position.copy(camera.position).addScaledVector(dir,.10);
  flashlight.position.y-=.04;
  flashlightTarget.position.copy(camera.position).addScaledVector(dir,12);
  flashlightFill.position.copy(camera.position).addScaledVector(dir,.45);
  flashlightFill.position.y-=.12;
  const a=1-Math.exp(-dt*16),target=flashlightOn?flashlightDesired:0;
  flashlight.intensity=THREE.MathUtils.lerp(flashlight.intensity,target,a);
  flashlightFill.intensity=THREE.MathUtils.lerp(flashlightFill.intensity,flashlightOn?(moodName==='ozri'?.52:1.15):0,a);
  flashlight.visible=flashlightOn||flashlight.intensity>.02;flashlightFill.visible=flashlight.visible;
}

const MOODS={
  bleak:{bg:0x0a0c0e,fog:0x0b0d0f,fogDensity:.029,hemiSky:0x68737b,hemiGround:0x121416,hemi:.42,sunColor:0x9ca7af,sun:.58,exposure:.72,kitchen:1.12,bedroom:.62,hall:.43,lake:.48,porch:.23,flash:28,filter:'saturate(.60) brightness(.90) contrast(1.08)'},
  ozri:{bg:0x7897aa,fog:0xa8b9b7,fogDensity:.016,hemiSky:0xb9d7e5,hemiGround:0x4d4939,hemi:1.05,sunColor:0xffddb0,sun:1.82,exposure:1.08,kitchen:1.95,bedroom:1.0,hall:.72,lake:.82,porch:.34,flash:14,filter:'saturate(1.18) brightness(1.04) contrast(1.02)'},
  loss:{bg:0x05090c,fog:0x081116,fogDensity:.036,hemiSky:0x40505a,hemiGround:0x080a0c,hemi:.20,sunColor:0x718491,sun:.28,exposure:.60,kitchen:.50,bedroom:.24,hall:.18,lake:.34,porch:.11,flash:34,filter:'saturate(.40) brightness(.78) contrast(1.17)'},
  maze:{bg:0x100103,fog:0x2d0307,fogDensity:.050,hemiSky:0x4a080d,hemiGround:0x090102,hemi:.16,sunColor:0x5d080d,sun:.08,exposure:.67,kitchen:0,bedroom:0,hall:0,lake:0,porch:0,flash:30,filter:'saturate(.62) brightness(.76) contrast(1.28)'},
};
let moodName='bleak', moodTarget=MOODS.bleak;
renderer.domElement.style.transition='filter 2.6s ease';
renderer.domElement.style.filter=MOODS.bleak.filter;
function setMood(name){
  if(!MOODS[name])return;moodName=name;moodTarget=MOODS[name];renderer.domElement.style.filter=moodTarget.filter;setAudioMood(name);
}
function lerpColor(color,target,a){const c=new THREE.Color(target);color.lerp(c,a)}
function updateMood(dt){
  const a=1-Math.exp(-dt*1.7),m=moodTarget;
  lerpColor(scene.background,m.bg,a);lerpColor(scene.fog.color,m.fog,a);scene.fog.density=THREE.MathUtils.lerp(scene.fog.density,m.fogDensity,a);
  lerpColor(hemi.color,m.hemiSky,a);lerpColor(hemi.groundColor,m.hemiGround,a);hemi.intensity=THREE.MathUtils.lerp(hemi.intensity,m.hemi,a);
  lerpColor(sun.color,m.sunColor,a);sun.intensity=THREE.MathUtils.lerp(sun.intensity,m.sun,a);renderer.toneMappingExposure=THREE.MathUtils.lerp(renderer.toneMappingExposure,m.exposure,a);
  kitchenLight.intensity=THREE.MathUtils.lerp(kitchenLight.intensity,m.kitchen,a);bedroomLight.intensity=THREE.MathUtils.lerp(bedroomLight.intensity,m.bedroom,a);hallLight.intensity=THREE.MathUtils.lerp(hallLight.intensity,m.hall,a);lakeLight.intensity=THREE.MathUtils.lerp(lakeLight.intensity,m.lake,a);porchGlow.intensity=THREE.MathUtils.lerp(porchGlow.intensity,m.porch,a);kitchenCeilingLamp.intensity=THREE.MathUtils.lerp(kitchenCeilingLamp.intensity,m.kitchen*.58,a);bedroomCeilingLamp.intensity=THREE.MathUtils.lerp(bedroomCeilingLamp.intensity,m.bedroom*.70,a);fatherCeilingLamp.intensity=THREE.MathUtils.lerp(fatherCeilingLamp.intensity,m.hall*.82,a);
  flashlightDesired=THREE.MathUtils.lerp(flashlightDesired,m.flash,a);
}

// -----------------------------------------------------------------------------
// World: expanded house, lived-in yard, forest trail and lake
// -----------------------------------------------------------------------------
function cyl(name,x,y,z,rTop,rBottom,h,mat=MAT.wood,parent=world,segments=8,collide=false){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,h,segments),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);
  if(collide)blockers.push({x:(parent===world?x:parent.position.x+x),z:(parent===world?z:parent.position.z+z),hx:Math.max(rTop,rBottom)+.28,hz:Math.max(rTop,rBottom)+.28});return m;
}
function sphere(name,x,y,z,r,mat=MAT.wood,parent=world,segments=10){const m=new THREE.Mesh(new THREE.SphereGeometry(r,segments,Math.max(6,segments-2)),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function plane(name,x,y,z,sx,sy,mat,rx=0,ry=0,rz=0,parent=world){const m=new THREE.Mesh(new THREE.PlaneGeometry(sx,sy),mat);m.name=name;m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.receiveShadow=true;m.castShadow=false;parent.add(m);return m;}
function makeChair(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);box('chair seat',0,.52,0,.72,.12,.72,MAT.wood,g);box('chair back',0,1.03,.3,.72,.95,.11,MAT.wood,g);for(const sx of [-1,1])for(const sz of [-1,1])box('chair leg',sx*.27,.25,sz*.27,.10,.5,.10,MAT.wood,g);blockers.push({x,z,hx:.48,hz:.48});return g;}
function makeShelf(x,z,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);for(let i=0;i<3;i++)box('shelf board',0,.45+i*.62,0,1.8,.08,.42,MAT.wood,g);for(const sx of [-1,1])box('shelf side',sx*.86,1.08,0,.08,1.9,.42,MAT.wood,g);for(let i=0;i<8;i++){const px=-.68+(i%4)*.45,py=.63+Math.floor(i/4)*.62;box('jar',px,py,-.02,.18,.28,.18,i%3?MAT.metal:MAT.stone,g)}blockers.push({x,z,hx:1.1,hz:.5});return g;}
function makeFenceSegment(x,z,len,rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);for(let i=-Math.floor(len/1.15)/2;i<=Math.floor(len/1.15)/2;i++)box('fence slat',i*1.15,.72,0,.12,1.45,.12,MAT.fence,g);box('fence rail',0,.47,0,len,.10,.14,MAT.fence,g);box('fence rail',0,1.0,0,len,.10,.14,MAT.fence,g);}
function makeTree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);world.add(g);cyl('trunk',0,1.55,0,.24*scale,.35*scale,3.1*scale,MAT.bark,g,7,true);sphere('crown',0,3.45*scale,0,1.35*scale,MAT.leaves,g,8);sphere('crown',-.75*scale,3.15*scale,.25*scale,.85*scale,MAT.leaves,g,8);sphere('crown',.65*scale,3.3*scale,-.2*scale,.95*scale,MAT.leaves,g,8);g.userData.tree=true;return g;}
function makeRock(x,z,s=.6){const m=sphere('rock',x,s*.35,z,s,MAT.stone,world,7);m.scale.y=.55;m.rotation.y=(x*z)%2;blockers.push({x,z,hx:s*.8,hz:s*.8});return m;}

// large terrain and paths
floor('ground',0,-10,76,68,MAT.grass,-.035);
floor('main path',0,-8,3.2,20,MAT.path,.001);
const sidePath=plane('forest path',4.3,.003,-16.8,3.0,22,MAT.path,-Math.PI/2,0,-.24); 
const lakesidePath=plane('lakeside path',6.5,.004,-23.2,2.1,14,MAT.path,-Math.PI/2,0,.10);

// house shell
floor('house-floor',0,4.2,14,10,MAT.floor,.01);floor('bedroom-rug',-4.4,5.4,3.2,2.8,MAT.rug,.025);
box('west wall',-7,1.35,4.2,.35,2.7,10,MAT.wall,world,true);box('east wall',7,1.35,4.2,.35,2.7,10,MAT.wall,world,true);box('south wall',0,1.35,9.2,14,.35,.35,MAT.wall,world,true);
box('north-left',-4.35,1.35,-.8,5.3,2.7,.35,MAT.wall,world,true);box('north-right',4.35,1.35,-.8,5.3,2.7,.35,MAT.wall,world,true);
box('bed partition A',-2.3,1.35,6.7,.25,2.7,5,MAT.wallDark,world,true);box('bed partition B',-2.3,1.35,1.35,.25,2.7,2.2,MAT.wallDark,world,true);
box('father partition A',2.5,1.35,6.8,.25,2.7,4.8,MAT.wallDark,world,true);box('father partition B',2.5,1.35,1.2,.25,2.7,2.0,MAT.wallDark,world,true);
// ceiling, beams and porch. V7: actual interior ceiling instead of an open box.
const ceilingMat=new THREE.MeshStandardMaterial({map:TX.wall,color:0xb7b0a2,roughness:1,side:THREE.DoubleSide});
box('kitchen ceiling',0,2.76,4.2,4.65,.16,9.55,ceilingMat);
box('bedroom ceiling',-4.68,2.76,4.2,4.55,.16,9.55,ceilingMat);
box('father ceiling',4.78,2.76,4.2,4.35,.16,9.55,ceilingMat);
for(let x=-6;x<=6;x+=2)box('ceiling beam',x,2.62,4.2,.14,.16,9.5,MAT.wood);
function ceilingLamp(name,x,z,color=0xffd7a0,intensity=.9){
  const g=new THREE.Group();g.position.set(x,2.55,z);world.add(g);
  cyl(name+' cord',0,.09,0,.018,.018,.20,MAT.dark,g,6);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.10,.28,.18,10,1,true),new THREE.MeshStandardMaterial({color:0x6c675e,roughness:.9,side:THREE.DoubleSide}));shade.position.y=-.08;g.add(shade);
  const bulb=sphere(name+' bulb',0,-.18,0,.075,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.7,roughness:.45}),g,8);
  const l=new THREE.PointLight(color,intensity,7.5,1.8);l.position.set(0,-.25,0);l.castShadow=false;g.add(l);return l;
}
const kitchenCeilingLamp=ceilingLamp('kitchen lamp',0,4.4,0xffd49a,1.05);
const bedroomCeilingLamp=ceilingLamp('bedroom lamp',-4.65,5.0,0xffc889,.62);
const fatherCeilingLamp=ceilingLamp('father lamp',4.65,5.6,0xe2c095,.50);

// Exterior gable roof. Interior ceiling stays separate so the house reads correctly from both sides.
const roofRise=1.95,roofHalf=7.25,roofAngle=Math.atan2(roofRise,roofHalf),roofSlope=Math.hypot(roofRise,roofHalf);
const roofLeft=box('house roof left',-roofHalf/2,2.78+roofRise/2,4.2,roofSlope+.35,.18,10.7,MAT.roof);roofLeft.rotation.z=roofAngle;
const roofRight=box('house roof right',roofHalf/2,2.78+roofRise/2,4.2,roofSlope+.35,.18,10.7,MAT.roof);roofRight.rotation.z=-roofAngle;
function makeGable(z,flip=false){
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-7.15,2.76,z, 7.15,2.76,z, 0,4.71,z],3));geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:TX.wall,roughness:1,side:THREE.DoubleSide}));m.name='house gable';m.castShadow=true;m.receiveShadow=true;world.add(m);return m;
}
makeGable(-.99);makeGable(9.39,true);
const atticFrame=box('attic window frame',0,3.55,-1.025,1.12,.98,.08,MAT.wood);
const atticGlass=new THREE.MeshStandardMaterial({color:0x252d2b,emissive:0x453a25,emissiveIntensity:.45,roughness:.4});
box('attic window glass',0,3.55,-1.075,.82,.68,.035,atticGlass);box('attic mullion v',0,3.55,-1.105,.055,.70,.035,MAT.wood);box('attic mullion h',0,3.55,-1.11,.84,.055,.035,MAT.wood);

for(let x=-5.5;x<=5.5;x+=1.1)box('porch plank',x,.08,-1.55,.98,.12,1.5,MAT.wood);
box('porch beam L',-5.9,1.35,-1.78,.18,2.7,.18,MAT.wood);box('porch beam R',5.9,1.35,-1.78,.18,2.7,.18,MAT.wood);
// furnishings
const bed=box('bed',-4.7,.38,6.7,3.0,.72,1.45,MAT.wood,world,true);box('mattress',-4.7,.81,6.7,2.8,.18,1.25,MAT.cloth);box('pillow',-5.55,.95,6.7,.7,.18,.85,MAT.cloth);
const cabinet=box('medicine cabinet',-5.7,1.05,2.15,1.1,2.1,.62,MAT.wood,world,true);box('cabinet-face',-5.7,1.05,1.82,.9,1.82,.06,MAT.wallDark);
const stove=box('stove',-.9,.58,2.0,1.4,1.16,1.1,MAT.metal,world,true);box('stove-top',-.9,1.18,2.0,1.45,.08,1.15,MAT.dark);cyl('pot',-.9,1.42,2.0,.35,.38,.38,MAT.metal,world,12);
const sink=box('sink',.9,.67,2.0,1.55,1.0,.95,MAT.stone,world,true);box('basin',.9,1.2,2.0,1.45,.12,.86,MAT.metal);cyl('faucet',.9,1.57,2.2,.05,.05,.55,MAT.metal);
const kitchenTable=box('table',0,.74,5.15,2.7,.14,1.45,MAT.wood,world,true);for(const sx of [-1,1])for(const sz of [-1,1])box('tableleg',sx*.98,.38,5.15+sz*.5,.13,.75,.13,MAT.wood);
makeChair(-1.75,5.3,Math.PI/2);makeChair(1.75,5.15,-Math.PI/2);makeShelf(5.9,3.25,Math.PI/2);
const basket=box('laundry basket',-3.55,.38,8.05,.95,.76,.8,MAT.wood,world,true);box('laundry cloth A',-3.73,.78,8.03,.52,.10,.55,new THREE.MeshStandardMaterial({map:TX.cloth,color:0xa9a394,roughness:1}));box('laundry cloth B',-3.36,.82,8.07,.44,.09,.48,new THREE.MeshStandardMaterial({map:TX.cloth,color:0x7b817d,roughness:1}));
const fatherBed=box('father bed',4.65,.36,6.65,3,.7,1.45,MAT.wood,world,true);box('father mattress',4.65,.78,6.65,2.82,.17,1.25,MAT.cloth);const sideTable=box('side table',5.65,.55,3.05,.9,1.1,.9,MAT.wood,world,true);
// curtains, photos, clutter
plane('curtainL',-6.79,1.65,3.7,1.25,1.55,MAT.curtain,0,Math.PI/2,0);plane('curtainR',6.79,1.65,3.7,1.25,1.55,MAT.curtain,0,-Math.PI/2,0);
for(let i=0;i<3;i++){box('photo frame',-2.12,1.55+i*.34,7.6,.06,.26,.34,MAT.wood);box('photo',-2.08,1.55+i*.34,7.6,.03,.18,.24,new THREE.MeshStandardMaterial({color:[0x6b655c,0x766b5f,0x5b625d][i],roughness:1}));}
const dirtyDishes=new THREE.Group();dirtyDishes.name='dirty dishes';world.add(dirtyDishes);
function makeDirtyPlaceSetting(x,z,rot=0){
 const plate=cyl('dirty plate',x,.86,z,.31,.34,.055,new THREE.MeshStandardMaterial({color:0xaaa18e,roughness:.86}),dirtyDishes,16);plate.rotation.y=rot;
 const smear=new THREE.Mesh(new THREE.CircleGeometry(.17,10),new THREE.MeshBasicMaterial({color:0x5b3c27,transparent:true,opacity:.82,side:THREE.DoubleSide}));smear.rotation.x=-Math.PI/2;smear.position.set(x,.892,z);dirtyDishes.add(smear);
 const cup=cyl('cup',x+.28,.98,z-.16,.12,.14,.27,new THREE.MeshStandardMaterial({color:0x81796d,roughness:.9}),dirtyDishes,12);
}
makeDirtyPlaceSetting(-.62,5.04,-.2);makeDirtyPlaceSetting(.28,5.30,.25);makeDirtyPlaceSetting(.72,4.92,.1);dirtyDishes.visible=false;
const dryingCounter=box('drying counter',2.02,.67,2.0,.70,1.0,.95,MAT.wood,world,true);box('drying counter top',2.02,1.205,2.0,.76,.075,1.0,MAT.stone);
const dishRackGroup=new THREE.Group();dishRackGroup.name='clean dish rack';dishRackGroup.position.set(2.02,1.265,2.0);world.add(dishRackGroup);
box('dish rack base',0,0,0,.62,.055,.54,MAT.wood,dishRackGroup);for(let i=0;i<4;i++){const p=cyl('clean plate',-.23+i*.155,.205,0,.18,.20,.032,new THREE.MeshStandardMaterial({color:0xbab4a3,roughness:.82}),dishRackGroup,14);p.rotation.z=Math.PI/2;}dishRackGroup.visible=false;
const perch=box('perch',-5.8,1.05,1.25,1.45,.08,.24,MAT.wood);

// yard landmarks
const woodpile=new THREE.Group();woodpile.position.set(-7.1,0,-5.2);world.add(woodpile);for(let i=0;i<14;i++){const log=cyl('log',(i%5)*.33,.17+Math.floor(i/5)*.30,0,.12,.14,.95,MAT.bark,woodpile,8);log.rotation.z=Math.PI/2;}
const clothesline=new THREE.Group();clothesline.position.set(-4.2,0,-10.8);world.add(clothesline);box('post',-2.3,1.2,0,.14,2.4,.14,MAT.wood,clothesline,true);box('post',2.3,1.2,0,.14,2.4,.14,MAT.wood,clothesline,true);const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.3,2.0,0),new THREE.Vector3(2.3,2.0,0)]);clothesline.add(new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xc4bda9})));const hangingLaundry=new THREE.Group();clothesline.add(hangingLaundry);
const garden=box('garden bed',5,.10,-5.6,5.3,.20,3.4,new THREE.MeshStandardMaterial({color:0x453427,roughness:1}),world,true);for(let i=0;i<24;i++){const x=3.0+(i%6)*.8,z=-6.7+Math.floor(i/6)*.72;const leaf=cyl('plant',x,.28,z,.06,.09,.48,new THREE.MeshStandardMaterial({color:i%2?0x4d673e:0x617443,roughness:1}),world,6);leaf.rotation.z=(i%3-1)*.18;}
// Hands-on garden chores. The trowel and separate soil patches turn this into a short activity rather than one button press.
const trowel=new THREE.Group();trowel.position.set(-10.9,.62,-4.15);world.add(trowel);box('trowel handle',0,.18,0,.10,.58,.10,MAT.wood,trowel);const trowelBlade=box('trowel blade',0,-.18,0,.28,.28,.06,MAT.metal,trowel);trowelBlade.rotation.z=.18;
const gardenPatches=[new THREE.Vector3(3.55,.22,-6.35),new THREE.Vector3(5.05,.22,-5.55),new THREE.Vector3(6.45,.22,-4.9)];
const dugMarks=gardenPatches.map((v,i)=>{const m=floor('fresh soil '+i,v.x,v.z,.72,.54,new THREE.MeshStandardMaterial({color:0x2d2119,roughness:1}),.115);m.visible=false;return m;});
const worms=gardenPatches.map((v,i)=>{const w=cyl('worm '+i,v.x,.18,v.z,.035,.035,.34,new THREE.MeshStandardMaterial({color:0x8d5d56,roughness:1}),world,7);w.rotation.z=Math.PI/2;w.visible=false;return w;});
// old fence and gate
makeFenceSegment(-10,-6,15,Math.PI/2);makeFenceSegment(10,-6,15,Math.PI/2);makeFenceSegment(-6.8,-13.2,6.4,0);makeFenceSegment(6.8,-13.2,6.4,0);
// shed
const shed=new THREE.Group();shed.position.set(-12.7,0,-5.2);world.add(shed);box('shed floor',0,.08,0,5.3,.16,4.2,MAT.wood,shed,true);box('shed back',0,1.3,-2.0,5.3,2.6,.18,MAT.wallDark,shed,true);box('shed sideL',-2.55,1.3,0,.18,2.6,4.0,MAT.wallDark,shed,true);box('shed sideR',2.55,1.3,0,.18,2.6,4.0,MAT.wallDark,shed,true);box('shed roof',0,2.72,0,5.8,.18,4.8,MAT.roof,shed);makeShelf(-12.7,-6.2,0);
// well
const well=new THREE.Group();well.position.set(9.5,0,-8.4);world.add(well);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;cyl('well stone',Math.cos(a)*1.0,.28,Math.sin(a)*1.0,.18,.22,.55,MAT.stone,well,7);}box('well postL',-1.15,1.15,0,.16,2.3,.16,MAT.wood,well);box('well postR',1.15,1.15,0,.16,2.3,.16,MAT.wood,well);box('well beam',0,2.2,0,2.6,.16,.16,MAT.wood,well);cyl('bucket',0,.85,0,.35,.28,.55,MAT.metal,well,10);blockers.push({x:9.5,z:-8.4,hx:1.4,hz:1.4});
// scattered props
for(const [x,z,s] of [[-9,-12,.7],[12,-13,.85],[-13,-15,.55],[15,-5,.65],[0,-17,.5],[14,-22,.9],[-8,-20,.65]])makeRock(x,z,s);
for(const [x,z] of [[-8,-3],[-9,-8],[8,-3],[12,-10],[-6,-14]]){cyl('stump',x,.34,z,.35,.48,.68,MAT.bark,world,9,true);}
// creek and bridge
const creekMat=new THREE.MeshStandardMaterial({map:TX.water,roughness:.25,transparent:true,opacity:.8});const creek=plane('creek',12,.012,-16,2.2,17,creekMat,-Math.PI/2,0,-.18);for(let i=0;i<7;i++){const p=box('bridge plank',10.1+i*.58,.13,-16.4+i*.1,.52,.14,2.7,MAT.wood);p.rotation.y=-.18;}
// lake and dock
const lake=new THREE.Mesh(new THREE.CircleGeometry(9.5,64),new THREE.MeshStandardMaterial({map:TX.water,roughness:.22,metalness:.04,transparent:true,opacity:.93}));lake.rotation.x=-Math.PI/2;lake.position.set(8,.008,-28);world.add(lake);const shore=new THREE.Mesh(new THREE.RingGeometry(9.45,10.25,64),new THREE.MeshStandardMaterial({map:TX.path,roughness:1}));shore.rotation.x=-Math.PI/2;shore.position.copy(lake.position);world.add(shore);
const dock=new THREE.Group();dock.position.set(6.2,0,-18.4);dock.rotation.y=-.10;world.add(dock);for(let i=0;i<7;i++)box('dock plank',0,.16,-i*.55,2.0,.12,.48,MAT.wood,dock);for(const sx of [-.85,.85])for(const zz of [-.1,-3.2])box('dock post',sx,.52,zz,.14,1.05,.14,MAT.wood,dock);
// reeds and flowers
for(let i=0;i<70;i++){const a=i/70*Math.PI*2,r=9.8+((i*13)%7)*.09,x=8+Math.cos(a)*r,z=-28+Math.sin(a)*r;const reed=cyl('reed',x,.42,z,.025,.04,.84,new THREE.MeshStandardMaterial({color:i%2?0x53684a:0x6b784e,roughness:1}),world,5);reed.rotation.z=((i%5)-2)*.04;}
for(let i=0;i<45;i++){const x=-9+(i*37%180)/10,z=-13-(i*53%150)/10;if(Math.hypot(x-8,z+28)<11)continue;cyl('flower stem',x,.22,z,.018,.025,.44,new THREE.MeshStandardMaterial({color:0x42613e,roughness:1}),world,5);sphere('flower',x,.48,z,.07,new THREE.MeshStandardMaterial({color:i%3===0?0xb7a9a4:i%3===1?0xc3b56e:0x9da7b3,roughness:1}),world,6);}
// forest: irregular instead of a circular wall
for(let i=0;i<105;i++){const rx=((i*47)%690)/10-34,rz=((i*83)%610)/10-37;if(rx>-15&&rx<16&&rz>-14&&rz<11)continue;if(Math.hypot(rx-8,rz+28)<12)continue;if(Math.abs(rx)<3&&rz>-22&&rz<2)continue;if(rx>-2&&rx<9&&rz<-10&&rz>-23)continue;makeTree(rx,rz,.72+((i*19)%45)/100);}
// distant silhouettes
for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=34+((i*7)%5);makeTree(Math.cos(a)*r,-10+Math.sin(a)*r,1.2);}

// subtle dust/fireflies
const dustGeo=new THREE.BufferGeometry();const dust=[];for(let i=0;i<120;i++)dust.push((Math.random()-.5)*44,Math.random()*3.1,-2-Math.random()*31);dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dust,3));const dustPoints=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xbab495,size:.035,transparent:true,opacity:.32}));world.add(dustPoints);
// -----------------------------------------------------------------------------
// Characters and visual props: articulated humanoids with idle/gesture animation
// -----------------------------------------------------------------------------
const characterRigs=[];
function makeHumanoid(name,x,z,opt={}){
  const g=new THREE.Group();g.name=name;g.position.set(x,0,z);g.rotation.y=opt.rotation||0;world.add(g);
  const skin=opt.skin||MAT.skin, shirt=new THREE.MeshStandardMaterial({color:opt.shirt||0x685b55,roughness:1}), pants=new THREE.MeshStandardMaterial({color:opt.pants||0x303132,roughness:1}), hair=new THREE.MeshStandardMaterial({color:opt.hair||0x44362e,roughness:1});
  const hips=new THREE.Group();hips.position.y=.92;g.add(hips);box('hips',0,0,0,.62,.28,.38,pants,hips);
  const torso=new THREE.Group();torso.position.y=.36;hips.add(torso);box('torso',0,.42,0,.78,.88,.42,shirt,torso);box('neck',0,.93,0,.18,.18,.18,skin,torso);
  const head=new THREE.Group();head.position.set(0,1.18,0);torso.add(head);sphere('head',0,0,0,.31,skin,head,10);box('hair',0,.24,-.01,.55,.18,.52,hair,head);box('nose',0,-.01,-.30,.08,.10,.08,skin,head);box('eyeL',-.11,.07,-.294,.045,.035,.025,MAT.dark,head);box('eyeR',.11,.07,-.294,.045,.035,.025,MAT.dark,head);
  if(opt.beard)box('beard',0,-.16,-.295,.40,.22,.035,new THREE.MeshStandardMaterial({color:opt.beardColor||0x746a60,roughness:1}),head);
  function limb(side,isArm){const root=new THREE.Group();const sx=side*(isArm?.52:.22);root.position.set(sx,isArm?.78:-.05,0);torso.add(root);const mat=isArm?shirt:pants;const upper=cyl('upper',0,isArm?-.30:-.36,0,.12,.14,isArm?.60:.72,mat,root,7);const joint=sphere('joint',0,isArm?-.62:-.74,0,.13,skin,root,7);const lower=new THREE.Group();lower.position.set(0,isArm?-.65:-.78,0);root.add(lower);cyl('lower',0,-.28,0,.09,.12,isArm?.56:.68,isArm?skin:pants,lower,7);if(isArm)sphere('hand',0,-.60,0,.13,skin,lower,7);else{box('shoe',0,-.66,-.08,.24,.15,.42,MAT.dark,lower);}return {root,lower};}
  const leftArm=limb(-1,true),rightArm=limb(1,true),leftLeg=limb(-1,false),rightLeg=limb(1,false);
  const rig={group:g,hips,torso,head,leftArm,rightArm,leftLeg,rightLeg,phase:Math.random()*6.28,gesture:0,mode:'idle',baseY:0};g.userData.rig=rig;characterRigs.push(rig);return g;
}
function animateRig(rig,dt,t){
  const p=t*0.001+rig.phase,breathe=Math.sin(p*1.45);
  rig.torso.position.y=.36+breathe*.014;rig.torso.rotation.z=Math.sin(p*.42)*.012;rig.head.rotation.z=Math.sin(p*.72)*.020;rig.head.rotation.y=Math.sin(p*.31)*.035;
  rig.leftArm.root.rotation.x=Math.sin(p*1.18)*.035;rig.rightArm.root.rotation.x=-Math.sin(p*1.18)*.035;rig.leftLeg.root.rotation.x=Math.sin(p*.62)*.012;rig.rightLeg.root.rotation.x=-Math.sin(p*.62)*.012;
  if(rig.gesture>0){
    rig.gesture=Math.max(0,rig.gesture-dt);const wave=Math.sin(p*7)*.09;
    if(rig.gestureType==='point'){rig.rightArm.root.rotation.x=-1.08+wave;rig.rightArm.root.rotation.z=-.22;rig.rightArm.lower.rotation.x=-.32;}
    else if(rig.gestureType==='hips'){rig.leftArm.root.rotation.z=.82;rig.rightArm.root.rotation.z=-.82;rig.leftArm.root.rotation.x=-.35;rig.rightArm.root.rotation.x=-.35;}
    else if(rig.gestureType==='shrug'){rig.leftArm.root.rotation.z=.50;rig.rightArm.root.rotation.z=-.50;rig.leftArm.root.rotation.x=-.68;rig.rightArm.root.rotation.x=-.68;rig.head.rotation.z=.06;}
    else {rig.rightArm.root.rotation.x=-.75+wave;rig.rightArm.root.rotation.z=-.18;}
  } else {rig.gestureType='idle';rig.leftArm.root.rotation.z=THREE.MathUtils.lerp(rig.leftArm.root.rotation.z,0,.09);rig.rightArm.root.rotation.z=THREE.MathUtils.lerp(rig.rightArm.root.rotation.z,0,.09);rig.leftArm.lower.rotation.x=THREE.MathUtils.lerp(rig.leftArm.lower.rotation.x,0,.08);rig.rightArm.lower.rotation.x=THREE.MathUtils.lerp(rig.rightArm.lower.rotation.x,0,.08);}
}
function gestureCharacter(ch,d=1.4,type='talk'){if(ch&&ch.userData.rig){ch.userData.rig.gesture=d;ch.userData.rig.gestureType=type;}}
const mother=makeHumanoid('Mother',-.15,6.35,{shirt:0x775d54,pants:0x403b39,hair:0x4b372d,rotation:0});mother.scale.setScalar(.78);
function createFather(){
  // Restore the older, simpler father silhouette, but actually align his body with the long axis of the bed.
  // Local +Y becomes world +X (along the mattress), and local -Z (the face) points upward.
  const g=new THREE.Group();g.name='Father';g.position.set(4.30,1.02,6.65);g.scale.setScalar(.80);world.add(g);
  const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,-1,0));g.setRotationFromMatrix(basis);
  const shirt=new THREE.MeshStandardMaterial({color:0x4b5652,roughness:1}),skin=MAT.skinPale,hair=new THREE.MeshStandardMaterial({color:0x5b5752,roughness:1});
  const torso=new THREE.Group();torso.position.set(0,.46,0);g.add(torso);box('father torso',0,0,0,.86,.92,.42,shirt,torso);
  const head=new THREE.Group();head.position.set(0,1.18,-.02);g.add(head);sphere('father head',0,0,0,.31,skin,head,10);box('father hair',0,.23,.01,.55,.14,.52,hair,head);box('father beard',0,-.14,-.295,.38,.20,.035,new THREE.MeshStandardMaterial({color:0x777067,roughness:1}),head);box('eyeL',-.11,.06,-.295,.045,.03,.02,MAT.dark,head);box('eyeR',.11,.02,-.295,.045,.024,.02,MAT.dark,head);
  const jaw=new THREE.Group();jaw.position.set(.05,-.10,-.304);head.add(jaw);const mouth=box('father mouth',0,0,0,.16,.03,.022,new THREE.MeshBasicMaterial({color:0x684741}),jaw);
  function arm(side){const shoulder=new THREE.Group();shoulder.position.set(side*.52,.72,0);g.add(shoulder);cyl('father upper arm',0,-.29,0,.10,.13,.60,skin,shoulder,8);const fore=new THREE.Group();fore.position.set(0,-.60,0);shoulder.add(fore);cyl('father forearm',0,-.23,0,.085,.105,.46,skin,fore,8);const hand=sphere('father hand',0,-.48,0,.12,skin,fore,8);return {shoulder,fore,hand};}
  const armL=arm(-1),armR=arm(1);armL.shoulder.rotation.z=-.20;armR.shoulder.rotation.z=.26;
  const blanket=box('father blanket',0,-.32,.05,1.12,.82,.55,new THREE.MeshStandardMaterial({color:0x66645e,roughness:1}),g);
  g.userData={head,torso,armL:armL.shoulder,armR:armR.shoulder,foreL:armL.fore,foreR:armR.fore,handL:armL.hand,handR:armR.hand,jaw,mouth,blanket,baseHeadX:0};return g;
}
const father=createFather();
function placeMotherForStep(step){
  let x=.35,z=5.95,r=0;
  if(['gardenGetTool','gardenDig1','gardenDig2','gardenDig3','day2Water'].includes(step)){x=7.25;z=-4.15;r=Math.PI/2;}
  else if(['day3Sweep','day3Sweep1','day3Sweep2','day3Sweep3','day3Blanket','day3Feather'].includes(step)){x=-1.35;z=7.55;r=0;}
  else if(['day4Soup','day4Wood','day4Stoke','day4GetWater','day4OzriWater'].includes(step)){x=.65;z=5.85;r=0;}
  else if(['searchKitchen','searchFather','searchYard','searchLake','final'].includes(step)){x=-.65;z=5.75;r=0;}
  mother.position.set(x,0,z);mother.rotation.y=r;
}

const ozriFrameNames=['idle1','idle2','chirp','hop1','hop2','peck1','peck2','fly1','fly2','fly3','scared','silent','injured'];
const ozriMaps={};for(const n of ozriFrameNames){const m=texture('assets/sprites/ozri_anim/'+n+'.png');m.repeat.set(1,1);m.magFilter=THREE.NearestFilter;m.minFilter=THREE.NearestFilter;ozriMaps[n]=m;}
const ozriInjured=sprite('assets/sprites/ozri_anim/injured.png',4.5,.42,-18.6,1.15,1.15);ozriInjured.visible=false;
const ozriHealthy=sprite('assets/sprites/ozri_anim/idle1.png',-5.8,1.78,1.12,.92,.92);ozriHealthy.visible=false;
const finalOzri=sprite('assets/sprites/ozri_anim/injured.png',4.5,.25,-18.6,1.18,1.18);finalOzri.material.rotation=-1.05;finalOzri.visible=false;
const bloodTex=texture('assets/ui/blood_pool.png');bloodTex.repeat.set(1,1);bloodTex.magFilter=THREE.NearestFilter;bloodTex.minFilter=THREE.NearestFilter;
const finalBlood=plane('blood pool',4.5,.018,-18.55,3.1,1.9,new THREE.MeshBasicMaterial({map:bloodTex,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide}),-Math.PI/2);finalBlood.visible=false;
const featherSprite=sprite('assets/ui/feather.png',-5.8,1.18,1.15,.38,.38);featherSprite.visible=false;
const lastFeatherSprite=sprite('assets/ui/feather.png',-5.80,1.30,1.10,.46,.46);lastFeatherSprite.material.rotation=-.22;lastFeatherSprite.visible=false;
// Red corridor maze: a real playable space, kept far away from the normal map.
const mazeGroup=new THREE.Group();mazeGroup.position.set(100,0,100);mazeGroup.visible=false;world.add(mazeGroup);
const mazeWallMat=new THREE.MeshStandardMaterial({color:0x3c0a0d,roughness:.92,emissive:0x210003,emissiveIntensity:.42});
const mazeFloorMat=new THREE.MeshStandardMaterial({color:0x160607,roughness:1,emissive:0x120001,emissiveIntensity:.18});
const mazeCeilMat=new THREE.MeshStandardMaterial({color:0x120305,roughness:1});
function mzBox(name,x,y,z,sx,sy,sz,mat=mazeWallMat,collide=true){return box(name,x,y,z,sx,sy,sz,mat,mazeGroup,collide);}
mzBox('maze floor',0,-.08,0,24,.16,24,mazeFloorMat,false);mzBox('maze ceiling',0,2.86,0,24,.18,24,mazeCeilMat,false);
mzBox('maze north',0,1.38,12,24,.25,.34,mazeWallMat,true);mzBox('maze west',-12,1.38,0,.34,2.76,24,mazeWallMat,true);mzBox('maze east',12,1.38,0,.34,2.76,24,mazeWallMat,true);
// south wall has a visible exit gap near x=-8
mzBox('maze south L',-10.75,1.38,-12,2.5,2.76,.34,mazeWallMat,true);mzBox('maze south R',2.75,1.38,-12,18.5,2.76,.34,mazeWallMat,true);
// alternating barriers form a long zig-zag path and several blind-looking turns
mzBox('maze barrier 1',-4,1.38,6,16,2.76,.34,mazeWallMat,true);mzBox('maze barrier 2',4,1.38,2,16,2.76,.34,mazeWallMat,true);mzBox('maze barrier 3',-3.5,1.38,-2,17,2.76,.34,mazeWallMat,true);mzBox('maze barrier 4',3.5,1.38,-6,17,2.76,.34,mazeWallMat,true);

const mazeLights=[];for(const [x,z,i] of [[-8,10,1],[7.5,7,2],[-7.5,3.5,3],[7.5,-.5,4],[-7.5,-4.5,5],[-8,-10,6]]){const l=new THREE.PointLight(i===6?0xf2a0a0:0x8f1018,i===6?2.8:1.8,7,2);l.position.set(x,2.28,z);mazeGroup.add(l);mazeLights.push(l);}const mazeExitGlow=plane('maze exit glow',-8,1.35,-11.78,2.6,2.5,new THREE.MeshBasicMaterial({color:0xd9c5be,transparent:true,opacity:.72,side:THREE.DoubleSide}),0,0,0,mazeGroup);
let mazeReturnPos=new THREE.Vector3(-4.25,1.65,4.15),mazeActive=false;
function safeReturnPosition(preferred){
  const offsets=[[0,0],[.55,0],[-.55,0],[0,.55],[0,-.55],[.8,.8],[-.8,.8],[.8,-.8],[-.8,-.8],[1.25,0],[-1.25,0],[0,1.25],[0,-1.25]];
  for(const [ox,oz] of offsets){const x=preferred.x+ox,z=preferred.z+oz;if(!collide(x,z))return new THREE.Vector3(x,preferred.y,z);}
  // Last-resort known-clear point in the middle of the boy's room.
  return new THREE.Vector3(-4.15,preferred.y,4.35);
}
function clearMovementInput(){for(const k of Object.keys(keys))keys[k]=false;joy.x=0;joy.y=0;player.stepTimer=0;player.bob=0;}
const birdCarrySprite=sprite('assets/sprites/ozri_anim/idle1.png',.42,-.34,-.86,.34,.34,camera);birdCarrySprite.visible=false;
let carriedBirdInjured=false,birdFlight=null,ozriFollowPlayer=false,ozriAnimMode='idle',ozriAnimUntil=0,ozriAnimFrame=0,ozriAnimClock=0;
function setSpriteMap(sp,map){if(sp.material.map!==map){sp.material.map=map;sp.material.needsUpdate=true;}}
function setCarriedBird(injured){carriedBirdInjured=!!injured;setSpriteMap(birdCarrySprite,ozriMaps[injured?'injured':'idle1']);}
function setOzriAnim(mode,seconds=0){ozriAnimMode=mode;ozriAnimFrame=0;ozriAnimClock=0;ozriAnimUntil=seconds?performance.now()+seconds*1000:0;}
function updateOzriFrames(dt,now){
  ozriAnimClock+=dt;let seq=['idle1','idle2'],speed=.42;
  if(birdFlight||ozriAnimMode==='fly'){seq=['fly1','fly2','fly3','fly2'];speed=.095;}
  else if(ozriAnimMode==='peck'){seq=['peck1','peck2','peck1','idle1'];speed=.12;}
  else if(ozriAnimMode==='chirp'){seq=['idle1','chirp','chirp','idle1'];speed=.12;}
  else if(ozriAnimMode==='scared'){seq=['scared','fly2','scared','fly1'];speed=.11;}
  else if(ozriAnimMode==='silent'){seq=['silent'];speed=1;}
  else if(ozriAnimMode==='hop'){seq=['hop1','hop2','hop1','idle1'];speed=.14;}
  if(ozriAnimUntil&&now>ozriAnimUntil){ozriAnimMode='idle';ozriAnimUntil=0;seq=['idle1','idle2'];speed=.42;}
  if(ozriAnimClock>=speed){ozriAnimClock=0;ozriAnimFrame=(ozriAnimFrame+1)%seq.length;}
  setSpriteMap(ozriHealthy,ozriMaps[seq[ozriAnimFrame%seq.length]]);
  if(carriedBirdInjured)setSpriteMap(birdCarrySprite,ozriMaps.injured);else if(birdCarrySprite.visible)setSpriteMap(birdCarrySprite,ozriMaps[seq[ozriAnimFrame%seq.length]]);
}
function flyOzriTo(target,duration=1.15,done){
  const from=ozriHealthy.position.clone();ozriHealthy.visible=true;ozriFollowPlayer=false;birdFlight={from,to:target.clone(),duration,time:0,done};setOzriAnim('fly');
  playSfx('wing_flap.wav',.82,.94+Math.random()*.1);
}
function updateOzriMotion(dt,now){
  updateOzriFrames(dt,now);
  if(birdFlight){birdFlight.time+=dt;const t=Math.min(1,birdFlight.time/birdFlight.duration),e=t*t*(3-2*t);ozriHealthy.position.lerpVectors(birdFlight.from,birdFlight.to,e);ozriHealthy.position.y+=Math.sin(Math.PI*t)*.75;if(t>=1){const cb=birdFlight.done;birdFlight=null;setOzriAnim('hop',.55);cb&&cb();}}
  else if(ozriFollowPlayer&&ozriHealthy.visible&&!dialogueOpen&&!cutscene){
    const side=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));const back=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
    const target=player.pos.clone().addScaledVector(side,.85).addScaledVector(back,.45);target.y=1.75+Math.sin(now*.004)*.11;ozriHealthy.position.lerp(target,1-Math.exp(-dt*3.2));
    if(Math.hypot(ozriHealthy.position.x-target.x,ozriHealthy.position.z-target.z)>.5)setOzriAnim('fly');
  }
}
function ozriPeckAt(target){flyOzriTo(new THREE.Vector3(target.x,.48,target.z+.28),.72,()=>{setOzriAnim('peck',1.0);playSfx('peck.wav',.82,1.03+Math.random()*.12);setTimeout(()=>{playSfx('peck.wav',.67,1.12);},260);chirp(false);});}

// -----------------------------------------------------------------------------
// Audio: generated soundtrack, ambience and foley
// -----------------------------------------------------------------------------
let ac=null, master=null;
const AUDIO_PATH='assets/audio/';
const audioState={ready:false,enabled:true,musicMood:'bleak',ambience:'house',music:{},amb:{},musicTargets:{bleak:0,ozri:0,loss:0},ambTargets:{house:0,forest:0,lake:0},dialogPool:[],dialogPoolIndex:0,duck:1,duckTarget:1,duckUntil:0};
let fearHeartbeat=null,mazeChirpLoop=null,fearHeartbeatTarget=0,mazeChirpTarget=0;
function ensureFearLoops(){
  if(!fearHeartbeat){fearHeartbeat=new Audio(AUDIO_PATH+'dread_heartbeat.wav');fearHeartbeat.loop=true;fearHeartbeat.preload='auto';fearHeartbeat.volume=0;}
  if(!mazeChirpLoop){mazeChirpLoop=new Audio(AUDIO_PATH+'maze_chirps.wav');mazeChirpLoop.loop=true;mazeChirpLoop.preload='auto';mazeChirpLoop.volume=0;}
}
function setFearHeartbeat(level=0,rate=.94){audioInit();ensureFearLoops();fearHeartbeatTarget=THREE.MathUtils.clamp(level,0,1);fearHeartbeat.playbackRate=rate;if(level>0&&audioState.enabled)fearHeartbeat.play().catch(()=>{});}
function setMazeChirps(level=0){audioInit();ensureFearLoops();mazeChirpTarget=THREE.MathUtils.clamp(level,0,1);if(level>0&&audioState.enabled)mazeChirpLoop.play().catch(()=>{});}
function mkLoop(file){const a=new Audio(AUDIO_PATH+file);a.loop=true;a.preload='auto';a.volume=0;return a;}
function audioInit(){
  if(audioState.ready)return;
  ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.88;master.connect(ac.destination);if(ac.state==='suspended')ac.resume();
  audioState.music={bleak:mkLoop('music_bleak.wav'),ozri:mkLoop('music_ozri.wav'),loss:mkLoop('music_loss.wav')};
  audioState.amb={house:mkLoop('amb_house.wav'),forest:mkLoop('amb_forest.wav'),lake:mkLoop('amb_lake.wav')};
  for(let i=0;i<7;i++){const b=new Audio(AUDIO_PATH+'dialogue_blip.wav');b.preload='auto';b.volume=.72;audioState.dialogPool.push(b);}
  for(const a of [...Object.values(audioState.music),...Object.values(audioState.amb)])a.play().catch(()=>{});
  audioState.ready=true;setAudioMood(moodName);setAmbient('house');
}
function setAudioMood(name){audioState.musicMood=name;for(const k of Object.keys(audioState.musicTargets))audioState.musicTargets[k]=k===name?(name==='loss'?.48:name==='ozri'?.46:.42):0;}
function setAmbient(name){if(!audioState.ambTargets[name]){}audioState.ambience=name;for(const k of Object.keys(audioState.ambTargets))audioState.ambTargets[k]=k===name?.36:0;}
function updateAudio(dt){if(!audioState.ready)return;if(audioState.duckUntil&&performance.now()>audioState.duckUntil){audioState.duckUntil=0;audioState.duckTarget=1;}const a=1-Math.exp(-dt*2.2);audioState.duck=THREE.MathUtils.lerp(audioState.duck,audioState.duckTarget,1-Math.exp(-dt*5));for(const [k,p] of Object.entries(audioState.music)){const target=audioState.enabled?audioState.musicTargets[k]*audioState.duck:0;p.volume=THREE.MathUtils.lerp(p.volume,target,a);}for(const [k,p] of Object.entries(audioState.amb)){const target=audioState.enabled?audioState.ambTargets[k]*Math.max(.38,audioState.duck):0;p.volume=THREE.MathUtils.lerp(p.volume,target,a);}if(fearHeartbeat){const t=audioState.enabled?fearHeartbeatTarget:0;fearHeartbeat.volume=THREE.MathUtils.lerp(fearHeartbeat.volume,t,1-Math.exp(-dt*5));if(t<=.005&&fearHeartbeat.volume<.01)fearHeartbeat.pause();}if(mazeChirpLoop){const t=audioState.enabled?mazeChirpTarget:0;mazeChirpLoop.volume=THREE.MathUtils.lerp(mazeChirpLoop.volume,t,1-Math.exp(-dt*3));if(t<=.005&&mazeChirpLoop.volume<.01)mazeChirpLoop.pause();}}
function duckAudio(level=.16,ms=5000){audioState.duckTarget=Math.min(audioState.duckTarget,level);audioState.duckUntil=Math.max(audioState.duckUntil||0,performance.now()+ms);}
function playSfx(file,vol=.78,rate=1){if(!audioState.ready||!audioState.enabled)return;const a=new Audio(AUDIO_PATH+file);a.volume=Math.min(1,vol*1.55);a.playbackRate=rate;a.play().catch(()=>{});}
function playDialogBlip(who,index,ch){
  if(!audioState.ready||!audioState.enabled||!audioState.dialogPool.length||!ch||/\s|[.,!?…—:;\"'«»()]/.test(ch)||index%2===1)return;
  const a=audioState.dialogPool[audioState.dialogPoolIndex++%audioState.dialogPool.length];
  const base=who==='Озри'?1.36:who==='Мама'?.90:who==='Отец'?.68:1.06;
  a.pause();a.currentTime=0;a.playbackRate=base*(.94+Math.random()*.12);a.volume=who==='Отец'?.55:.68;a.play().catch(()=>{});
}
function tone(freq,d=.08,type='square',vol=.035,delay=0){if(!ac||!audioState.enabled)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.02)}
function chirp(sad=false){audioInit();setOzriAnim(sad?'scared':'chirp',sad?.9:.55);playSfx(sad?'bird_sad.wav':'bird_chirp.wav',sad?.92:.96,sad?.96:1)}
function glitch(){audioInit();playSfx('glitch.wav',.92,.92+Math.random()*.15)}
function knock(){audioInit();tone(95,.06,'square',.025);tone(70,.08,'square',.02,.08)}
function toggleAudio(){audioState.enabled=!audioState.enabled;const b=document.getElementById('audio-toggle');if(b)b.textContent=audioState.enabled?'♫ ЗВУК':'× ЗВУК';if(!audioState.enabled){fearHeartbeat&&fearHeartbeat.pause();mazeChirpLoop&&mazeChirpLoop.pause();}else{if(fearHeartbeatTarget>0){ensureFearLoops();fearHeartbeat.play().catch(()=>{});}if(mazeChirpTarget>0){ensureFearLoops();mazeChirpLoop.play().catch(()=>{});}}}
// -----------------------------------------------------------------------------
// Player/input/collision
// -----------------------------------------------------------------------------
const player={pos:new THREE.Vector3(-4.6,1.65,5.5),yaw:Math.PI,pitch:0,targetYaw:Math.PI,targetPitch:0,speed:2.65,run:4.0,radius:.32,walkT:0,bob:0,stepTimer:0};
camera.position.copy(player.pos); scene.add(camera);
const keys={}; let started=false, locked=false, inputLocked=true, inventoryOpen=false, dialogueOpen=false, qteOpen=false, touchLookId=null, lastTouchX=0,lastTouchY=0;
const isTouch=matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if(isTouch) ui.mobile.classList.remove('hidden');
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyE'){e.preventDefault(); action();}
  if(e.code==='KeyI'){e.preventDefault(); toggleInventory();}
  if((e.code==='KeyF'||String(e.key).toLowerCase()==='f')&&!e.repeat){e.preventDefault();e.stopPropagation();toggleFlashlight();}
  if(e.code==='Escape'&&inventoryOpen)toggleInventory(false);
});
addEventListener('keyup',e=>keys[e.code]=false);
let ignoreMouseUntil=0;
function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a));}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;if(locked){player.targetYaw=player.yaw;player.targetPitch=player.pitch;ignoreMouseUntil=performance.now()+120;}});
document.addEventListener('mousemove',e=>{
  if(!locked||inputLocked||performance.now()<ignoreMouseUntil)return;
  const dx=THREE.MathUtils.clamp(e.movementX,-65,65),dy=THREE.MathUtils.clamp(e.movementY,-55,55);
  player.targetYaw=wrapAngle(player.targetYaw-dx*.00215);player.targetPitch=THREE.MathUtils.clamp(player.targetPitch-dy*.00185,-1.20,1.20);
});
renderer.domElement.addEventListener('click',()=>{if(started&&!isTouch&&!inputLocked&&!locked)renderer.domElement.requestPointerLock();});
// mobile look on right side
renderer.domElement.addEventListener('pointerdown',e=>{if(!isTouch||e.clientX<innerWidth*.35||inputLocked)return;touchLookId=e.pointerId;lastTouchX=e.clientX;lastTouchY=e.clientY;player.targetYaw=player.yaw;player.targetPitch=player.pitch;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerId!==touchLookId||inputLocked)return;const dx=THREE.MathUtils.clamp(e.clientX-lastTouchX,-42,42),dy=THREE.MathUtils.clamp(e.clientY-lastTouchY,-42,42);player.targetYaw=wrapAngle(player.targetYaw-dx*.0052);player.targetPitch=THREE.MathUtils.clamp(player.targetPitch-dy*.0045,-1.20,1.20);lastTouchX=e.clientX;lastTouchY=e.clientY;});
renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===touchLookId)touchLookId=null;});
let joy={x:0,y:0,id:null};
ui.stick.addEventListener('pointerdown',e=>{joy.id=e.pointerId;ui.stick.setPointerCapture(e.pointerId);updateStick(e)});
ui.stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)updateStick(e)});ui.stick.addEventListener('pointerup',e=>{if(e.pointerId===joy.id){joy={x:0,y:0,id:null};ui.stickKnob.style.transform='translate(0,0)'}});
function updateStick(e){const r=ui.stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=35,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);dx*=k;dy*=k;joy.x=dx/max;joy.y=dy/max;ui.stickKnob.style.transform=`translate(${dx}px,${dy}px)`;}
$('mobile-action').addEventListener('click',action);$('mobile-inventory').addEventListener('click',()=>toggleInventory());$('mobile-flashlight').addEventListener('click',e=>{e.stopPropagation();toggleFlashlight();});
function collide(x,z){for(const b of blockers)if(Math.abs(x-b.x)<b.hx&&Math.abs(z-b.z)<b.hz)return true;return false;}
function surfaceAtPlayer(){return player.pos.z>-.9&&Math.abs(player.pos.x)<7.2?'wood':'dirt';}
let footAlt=false;
function move(dt){
  if(inputLocked)return; let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y; let s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
  const l=Math.hypot(f,s);if(l>1){f/=l;s/=l;}if(!l){player.bob=THREE.MathUtils.lerp(player.bob,0,Math.min(1,dt*8));player.stepTimer=0;return;}
  const running=keys.ShiftLeft||keys.ShiftRight,sp=running?player.run:player.speed,sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),dx=(-sy*f+cy*s)*sp*dt,dz=(-cy*f-sy*s)*sp*dt;
  if(!collide(player.pos.x+dx,player.pos.z))player.pos.x+=dx;if(!collide(player.pos.x,player.pos.z+dz))player.pos.z+=dz;player.walkT+=dt*(running?9.2:6.8);player.bob=Math.sin(player.walkT)*.018;
  player.stepTimer-=dt;if(player.stepTimer<=0){footAlt=!footAlt;const surf=surfaceAtPlayer();playSfx(`step_${surf}_${footAlt?1:2}.wav`,running?.62:.48,.92+Math.random()*.13);player.stepTimer=running?.31:.43;}
}
function updateCamera(dt){
  const follow=1-Math.exp(-dt*20);player.yaw=wrapAngle(player.yaw+angleDelta(player.yaw,player.targetYaw)*follow);player.pitch=THREE.MathUtils.lerp(player.pitch,player.targetPitch,follow);
  camera.position.copy(player.pos);camera.position.y+=player.bob;camera.position.x+=Math.cos(player.walkT*.5)*Math.abs(player.bob)*.10;
  // Rebuild the Euler every frame: never inherit roll from a cut-scene lookAt().
  camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0,'YXZ');camera.up.set(0,1,0);
}

// -----------------------------------------------------------------------------
// Cinematic camera system
// -----------------------------------------------------------------------------
let cutscene=null,locationTimer=0,lastLocation='';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function cinematic(shots,done){
  if(!Array.isArray(shots)||!shots.length){done&&done();return;}
  if(locked)document.exitPointerLock();inputLocked=true;document.getElementById('game').classList.add('cinematic');
  cutscene={shots,index:0,time:0,done,started:false};
}
function syncPlayerLookFromCamera(target){
  if(!target)return;const dx=target.x-camera.position.x,dy=target.y-camera.position.y,dz=target.z-camera.position.z,h=Math.max(.001,Math.hypot(dx,dz));
  player.yaw=player.targetYaw=wrapAngle(Math.atan2(-dx,-dz));player.pitch=player.targetPitch=THREE.MathUtils.clamp(Math.atan2(dy,h),-1.18,1.18);
}
function easeCine(t){return t*t*(3-2*t);}
function updateCutscene(dt){
  if(!cutscene)return;const sh=cutscene.shots[cutscene.index];
  if(!cutscene.started){cutscene.started=true;cutscene.time=0;sh.onStart&&sh.onStart();}
  cutscene.time+=dt;const duration=Math.max(.05,sh.duration||1.5),a=easeCine(Math.min(1,cutscene.time/duration));
  const from=sh.from||camera.position.clone(),to=sh.to||from;camera.position.lerpVectors(from,to,a);
  const lf=sh.lookFrom||sh.look||V(0,1,0),lt=sh.lookTo||sh.look||lf,target=new THREE.Vector3().lerpVectors(lf,lt,a);
  camera.lookAt(target);if(sh.fov){camera.fov=THREE.MathUtils.lerp(camera.fov,sh.fov,a);camera.updateProjectionMatrix();}
  if(cutscene.time>=duration){sh.onEnd&&sh.onEnd();cutscene.index++;cutscene.started=false;if(cutscene.index>=cutscene.shots.length){const done=cutscene.done,last=cutscene.shots[cutscene.shots.length-1],finalTarget=last.lookTo||last.look||null;syncPlayerLookFromCamera(finalTarget);cutscene=null;camera.fov=66;camera.updateProjectionMatrix();camera.up.set(0,1,0);camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0,'YXZ');document.getElementById('game').classList.remove('cinematic');inputLocked=inventoryOpen||dialogueOpen||qteOpen;done&&done();}}
}
function showLocation(name){if(name===lastLocation)return;lastLocation=name;ui.locationName.textContent=name;ui.locationCard.classList.remove('hidden');locationTimer=2.2;}
function updateLocation(dt){if(!started)return;if(state.step==='maze'){ui.locationCard.classList.add('hidden');for(const k of Object.keys(audioState.ambTargets))audioState.ambTargets[k]=0;return;}let n='ЛЕС';if(player.pos.z>-.9&&Math.abs(player.pos.x)<7.2)n='ДОМ';else if(player.pos.z>-13.5&&Math.abs(player.pos.x)<10.5)n='ДВОР';else if(player.pos.x<-9&&player.pos.z>-10)n='САРАЙ';else if(Math.hypot(player.pos.x-8,player.pos.z+28)<11.2)n='ОЗЕРО';else if(player.pos.z<-12)n='ЛЕСНАЯ ТРОПА';showLocation(n);setAmbient(n==='ДОМ'?'house':n==='ОЗЕРО'?'lake':'forest');if(locationTimer>0){locationTimer-=dt;if(locationTimer<=0)ui.locationCard.classList.add('hidden');}}


// -----------------------------------------------------------------------------
// Inventory and UI
// -----------------------------------------------------------------------------
const ITEMS={
 medicine:['Таблетки','Мамины таблетки для отца.','assets/ui/medicine.png'], water:['Вода','Кружка холодной воды.','assets/ui/water.png'], soup:['Суп','Ещё тёплый.','assets/ui/soup.png'],
 wood:['Дрова','Сырые с краёв, но сгодятся.','assets/ui/wood.png'], laundry:['Бельё','Нужно развесить у озера.','assets/ui/laundry.png'], crumbs:['Крошки','Озри любит их больше хлеба.','assets/ui/crumbs.png'],
 bandage:['Бинт','Небольшой чистый кусок ткани.','assets/ui/bandage.png'], feather:['Перо Озри','Ты уже видел такое перо.','assets/ui/feather.png'], ozri:['Озри','Она очень лёгкая.','assets/sprites/ozri_injured.png'], blanket:['Одеяло отца','Тяжёлое шерстяное одеяло.','assets/ui/laundry.png'], trowel:['Совковая лопатка','Старая, с землёй на лезвии.','assets/ui/trowel.png'], broom:['Метла','Прутья уже лезут во все стороны.','assets/ui/broom.png'], dishes:['Грязная посуда','Несколько тарелок после завтрака.','assets/ui/dishes.png'], cleanDishes:['Чистая посуда','Нужно поставить сушиться.','assets/ui/dishes.png']
};
const state={day:1,step:'makeBed',inventory:[],flags:{outsideWarning:false,day2Morning:false,day3Morning:false,day4Morning:false,day5Morning:false},time:430,ending:false};
function addItem(id){if(!state.inventory.includes(id)){state.inventory.push(id);renderInventory();updateHeld();}}
function removeItem(id){state.inventory=state.inventory.filter(x=>x!==id);renderInventory();updateHeld();}
function hasItem(id){return state.inventory.includes(id)}
function renderInventory(){
  ui.inventoryGrid.innerHTML='';const ids=[...state.inventory];for(let i=0;i<Math.max(8,ids.length);i++){const el=document.createElement('div');el.className='slot'+(i>=ids.length?' empty':'');if(i<ids.length){const [n,d,img]=ITEMS[ids[i]];el.innerHTML=`<img src="${img}"><b>${n}</b><span>${d}</span>`}ui.inventoryGrid.appendChild(el);}
}
function updateHeld(){const id=state.inventory[state.inventory.length-1];if(!id){ui.held.classList.add('hidden');birdCarrySprite.visible=false;return;}const[n,,img]=ITEMS[id];ui.held.classList.remove('hidden');ui.heldIcon.src=img;ui.heldName.textContent=n;birdCarrySprite.visible=id==='ozri';if(id==='ozri')setCarriedBird(carriedBirdInjured);}
function toggleInventory(force){if(!started||dialogueOpen||qteOpen)return;inventoryOpen=force===undefined?!inventoryOpen:force;ui.inventory.classList.toggle('hidden',!inventoryOpen);inputLocked=inventoryOpen;if(inventoryOpen&&locked)document.exitPointerLock();}
$('inventory-close').addEventListener('click',()=>toggleInventory(false));

const QUEST={
 makeBed:['Привести комнату в порядок',''], talkMother:['Зайти на кухню',''], getMedicine:['Взять таблетки',''], getWater:['Набрать воды',''], giveMedicine:['Зайти к отцу',''], getSoup:['Взять суп',''], feedFather:['Помочь отцу',''],
 fetchWood:['Принести дрова',''], stokeFire:['Растопить печь',''], collectDishes:['Собрать посуду',''], washDishes:['Вымыть посуду',''], dryDishes:['Поставить посуду сушиться',''], takeLaundry:['Забрать бельё',''], hangLaundry:['Развесить бельё',''], findBird:['',''], carryBird:['Вернуться домой',''], healBird:['Осмотреть крыло',''], takeOzriOut:['',''], releaseOzri:['',''], sleep1:['',''],
 day2Feed:['Покормить Озри',''], gardenGetTool:['Найти совковую лопатку',''], gardenDig1:['Огород',''], gardenDig2:['Огород',''], gardenDig3:['Огород',''], day2Water:['Набрать воды для отца',''], day2Father:['Зайти к отцу',''], sleep2:['',''],
 day3Sweep:['Взять метлу',''], day3Sweep1:['Убраться в доме',''], day3Sweep2:['Убраться в доме',''], day3Sweep3:['Убраться в доме',''], day3Blanket:['Проветрить одеяло',''], day3Feather:['',''], sleep3:['',''],
 day4Soup:['Помочь отцу',''], day4Wood:['Принести дрова',''], day4Stoke:['Растопить печь',''], day4GetWater:['Набрать воды',''], day4OzriWater:['Проверить миску Озри',''], day4Lake:['',''], sleep4:['',''],
 searchPerch:['',''], maze:['',''], searchKitchen:['',''], searchFather:['',''], searchYard:['',''], searchLake:['',''], final:['','']
};
function setStep(step){state.step=step;if(step==='carryBird')setMood('ozri');if(step==='searchPerch')setMood('loss');const q=QUEST[step]||['',''];ui.questTitle.textContent=q[0];ui.questDetail.textContent='';document.getElementById('quest').classList.toggle('hidden',!q[0]);placeMotherForStep(step);refreshVisibility();}
function updateClock(dt){if(!started||inputLocked||state.ending)return;state.time+=dt*.7;const h=Math.floor(state.time/60)%24,m=Math.floor(state.time)%60;ui.time.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
function setDay(n){state.day=n;state.time=n===5?421:430;}

// -----------------------------------------------------------------------------
// Dialogue, chapters, memories
// -----------------------------------------------------------------------------
const portraitBase='assets/sprites/emotions/';
const portraitSets={
 'Мальчик':{neutral:'Мальчик_neutral.png',happy:'Мальчик_happy.png',worried:'Мальчик_worried.png',shocked:'Мальчик_shocked.png',sad:'Мальчик_sad.png',annoyed:'Мальчик_annoyed.png',tired:'Мальчик_tired.png'},
 'Мама':{neutral:'Мама_neutral.png',smirk:'Мама_smirk.png',annoyed:'Мама_annoyed.png',worried:'Мама_worried.png',angry:'Мама_angry.png'},
 'Отец':{neutral:'Отец_neutral.png',tired:'Отец_tired.png',pained:'Отец_pained.png',ominous:'Отец_ominous.png'},
 'Озри':{neutral:'Озри_neutral.png',happy:'Озри_happy.png',worried:'Озри_worried.png',scared:'Озри_scared.png',silent:'Озри_silent.png'}
};
function autoEmotion(who,text){if(who==='Озри')return text==='...'?'silent':text.includes('!')?'happy':text.includes('...?')?'worried':'neutral';if(who==='Мама')return /иди|сначала|не |опять|гряд/.test(text.toLowerCase())?'annoyed':text.includes('?')?'worried':'neutral';if(who==='Отец')return text==='...'?'tired':/перья|воды|вернут/.test(text.toLowerCase())?'ominous':'pained';if(/нет|пожалуйста|озри\.\.\./i.test(text))return 'sad';if(text.includes('!'))return 'happy';if(text.includes('?'))return 'worried';return 'neutral';}
function portraitFor(who,emotion){const set=portraitSets[who]||portraitSets['Мальчик'];const file=set[emotion]||set.neutral;return portraitBase+file;}
function faceGroupToward(group,target){if(!group||!target)return;const dx=target.x-group.position.x,dz=target.z-group.position.z;group.rotation.y=Math.atan2(-dx,-dz);}
function performDialogue(who,emotion,text){
  if(who==='Мама'){faceGroupToward(mother,camera.position);const type=emotion==='annoyed'||emotion==='angry'?'hips':emotion==='smirk'?'shrug':'talk';gestureCharacter(mother,1.15,type);}
  if(who==='Отец'){father.userData.armR.rotation.z=emotion==='ominous'?-.08:.26;father.userData.head.rotation.z=emotion==='pained'?.08:0;}
  if(who==='Озри'){if(emotion==='scared')setOzriAnim('scared',.8);else if(emotion==='happy')setOzriAnim('chirp',.55);else if(emotion==='silent')setOzriAnim('silent',.8);else setOzriAnim('hop',.45);}
}
function speakerWorldTarget(who){
  if(who==='Мама'){const p=mother.position.clone();p.y=1.34;return p;}
  if(who==='Отец'){return new THREE.Vector3(5.16,1.27,6.62);}
  if(who==='Озри'){if(hasItem('ozri'))return null;if(finalOzri.visible)return finalOzri.position.clone();if(ozriInjured.visible)return ozriInjured.position.clone();if(ozriHealthy.visible)return ozriHealthy.position.clone();}
  return null;
}
function focusDialogueSpeaker(who){const p=speakerWorldTarget(who);if(!p)return;const dx=p.x-camera.position.x,dy=p.y-camera.position.y,dz=p.z-camera.position.z,h=Math.max(.001,Math.hypot(dx,dz));player.targetYaw=wrapAngle(Math.atan2(-dx,-dz));player.targetPitch=THREE.MathUtils.clamp(Math.atan2(dy,h),-1.05,1.05);}

let dialogQueue=[],dialogDone=null,dialogTyping=false,dialogTimer=null,currentDialogText='',currentDialogWho='',currentDialogIndex=0;
function finishDialogTyping(){if(dialogTimer){clearTimeout(dialogTimer);dialogTimer=null;}ui.dialogueText.textContent=currentDialogText;dialogTyping=false;currentDialogIndex=currentDialogText.length;}
function typeDialogLine(who,text){
  if(dialogTimer)clearTimeout(dialogTimer);currentDialogWho=who;currentDialogText=text;currentDialogIndex=0;dialogTyping=true;ui.dialogueText.textContent='';
  const baseDelay=who==='Отец'?44:who==='Озри'?34:25;
  const tick=()=>{if(!dialogTyping)return;if(currentDialogIndex>=currentDialogText.length){dialogTyping=false;dialogTimer=null;return;}const ch=currentDialogText[currentDialogIndex];ui.dialogueText.textContent+=ch;playDialogBlip(who,currentDialogIndex,ch);currentDialogIndex++;let delay=baseDelay;if(/[.,!?…]/.test(ch))delay+=70;else if(ch===' ')delay=9;dialogTimer=setTimeout(tick,delay);};tick();
}
function say(lines,done){dialogQueue=lines.slice();dialogDone=done||null;dialogueOpen=true;inputLocked=true;if(locked)document.exitPointerLock();ui.dialogue.classList.remove('hidden');audioInit();nextLine();}
function nextLine(){if(dialogTyping){finishDialogTyping();return;}if(!dialogQueue.length){if(dialogTimer)clearTimeout(dialogTimer);ui.dialogue.classList.add('hidden');dialogueOpen=false;inputLocked=inventoryOpen||qteOpen;const cb=dialogDone;dialogDone=null;if(cb)cb();return;}const line=dialogQueue.shift(),who=line[0],text=line[1],emotion=line[2]||autoEmotion(who,text);ui.speaker.textContent=who;ui.portrait.src=portraitFor(who,emotion);performDialogue(who,emotion,text);focusDialogueSpeaker(who);typeDialogLine(who,text);}
ui.dialogue.addEventListener('click',()=>{if(dialogueOpen)nextLine();});
function action(){if(dialogueOpen){nextLine();return;}if(qteOpen){qteHit();return;}if(inventoryOpen){toggleInventory(false);return;}if(inputLocked)return;const it=currentInteraction;if(it&&it.enabled())it.use();}
function chapter(day,title,subtitle,cb){inputLocked=true;setDay(day);ui.chapterSmall.textContent='';ui.chapterTitle.textContent='';ui.chapterSubtitle.textContent='';ui.chapter.classList.remove('hidden');setTimeout(()=>{ui.chapter.classList.add('hidden');inputLocked=false;cb&&cb();},1350)}
function memory(text,kicker='ВОСПОМИНАНИЕ',ms=2200,cb){inputLocked=true;ui.memoryKicker.textContent=kicker;ui.memoryText.textContent=text;ui.memory.classList.remove('hidden');glitch();ui.vignette.style.background='radial-gradient(circle at center,transparent 18%,rgba(38,0,0,.24) 52%,rgba(0,0,0,.9) 100%)';setTimeout(()=>{ui.memory.classList.add('hidden');ui.vignette.style.background='';inputLocked=false;cb&&cb();},ms)}
function flashRed(){ui.damage.style.opacity='.6';setTimeout(()=>ui.damage.style.opacity='0',120);}

// -----------------------------------------------------------------------------
// Interaction system
// -----------------------------------------------------------------------------
function addInteraction(id,pos,label,use,enabled=()=>true,range=2.25,object=null){interactables.push({id,pos,label,use,enabled,range,object});}
let currentInteraction=null;
function interactionUpdate(){
  currentInteraction=null;if(inputLocked){ui.prompt.classList.add('hidden');return;}const forward=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ')); forward.y=0;forward.normalize();let best=-1;
  for(const it of interactables){if(!it.enabled())continue;const p=typeof it.pos==='function'?it.pos():it.pos;const v=new THREE.Vector3(p.x-player.pos.x,0,p.z-player.pos.z),d=v.length();if(d>it.range)continue;v.normalize();const dot=forward.dot(v);if(dot>.48&&dot>best){best=dot;currentInteraction=it;}}
  if(currentInteraction){ui.prompt.classList.remove('hidden');ui.promptText.textContent=typeof currentInteraction.label==='function'?currentInteraction.label():currentInteraction.label;}else ui.prompt.classList.add('hidden');
}

// bed
addInteraction('bed',()=>bed.position,'Заправить кровать',()=>{say([['Мальчик','Так хотя бы мама не скажет, что я опять всё бросил.']],()=>setStep('talkMother'))},()=>state.step==='makeBed',2.5);
addInteraction('bed-sleep',()=>bed.position,'Лечь спать',()=>sleepTransition(),()=>['sleep1','sleep2','sleep3','sleep4'].includes(state.step),2.5);
// mother
addInteraction('mother',()=>mother.position,'Поговорить с мамой',()=>{
 if(state.step==='talkMother'){gestureCharacter(mother,2);cinematic([{from:camera.position.clone(),to:V(-.9,1.7,5.4),look:V(.35,1.34,5.95),duration:.8},{from:V(-.9,1.7,5.4),to:V(.55,1.72,5.75),look:V(.35,1.34,5.95),duration:1.05}],()=>say([['Мама','Проснулся? Я уже два раза прошла мимо твоей двери. На третий принесла бы ведро.','smirk'],['Мальчик','Ты всегда так говоришь.','neutral'],['Мама','И однажды перестану только говорить.','annoyed'],['Мальчик','Я слышал тебя. Просто глаза открыть не мог.','tired'],['Мама','Глаза у него не открываются. А рот ночью за добавкой открывался прекрасно.','smirk'],['Мальчик','Это был один кусок хлеба.','annoyed'],['Мама','Один кусок размером с половину буханки. Ладно, иди сюда.','neutral'],['Мама','Отец опять почти не спал. Кашлял и пытался что-то сказать.','worried'],['Мальчик','Ему хуже?','worried'],['Мама','Не накручивай себя раньше времени. Сначала таблетка. Она в твоём шкафчике — я переложила, потому что кто-то опять устроил там археологические раскопки.','annoyed'],['Мальчик','Там был порядок.','neutral'],['Мама','Там носок лежал в кружке.','smirk'],['Мальчик','...Это была система.','neutral'],['Мама','Конечно. Гениальная. Таблетка, вода, потом суп. И не торопи его, когда кормишь.','neutral'],['Мальчик','Знаю.','neutral'],['Мама','Вот и хорошо. А потом дом. Он, к сожалению, сам себя не убирает. Я проверяла.','smirk']],()=>setStep('getMedicine')));}
 else if(state.day===2&&['gardenGetTool','gardenDig1','gardenDig2','gardenDig3'].includes(state.step)) say([['Мама','Если закончишь с Озри, помоги мне с грядкой. Земля после дождя тяжёлая.']]);
 else if(state.day===5) say([['Мальчик','Ты не видела Озри?'],['Мама','Нет. Может, улетела.'],['Мальчик','Она бы не ушла молча.'],['Мама','Ты слишком уверен в животных.']]);
 else say([['Мама','Сделай сначала то, что нужно. Потом поговорим.']]);
},()=>['talkMother','gardenGetTool','gardenDig1','gardenDig2','gardenDig3','searchPerch','searchKitchen'].includes(state.step),2.5);
// cabinet medicine
addInteraction('cabinet',()=>cabinet.position,'Открыть шкафчик',()=>{playSfx('item.wav',.32);addItem('medicine');setStep('getWater');say([['Мальчик','Одна таблетка утром. Мама всегда кладёт блистер сюда.']])},()=>state.step==='getMedicine'&&!hasItem('medicine'),2.2);
// sink
addInteraction('sink',()=>sink.position,'Набрать воды',()=>{playSfx('water_fill.wav',.38);addItem('water');setStep('giveMedicine')},()=>state.step==='getWater',2.2);
addInteraction('collect-dishes',()=>kitchenTable.position,'Собрать грязную посуду',()=>{playSfx('dishes.wav',.56,.92);dirtyDishes.visible=false;addItem('dishes');setStep('washDishes')},()=>state.step==='collectDishes'&&!hasItem('dishes'),2.2);
addInteraction('sink-wash',()=>sink.position,'Вымыть посуду',()=>{playSfx('dishes.wav',.74);removeItem('dishes');addItem('cleanDishes');setStep('dryDishes')},()=>state.step==='washDishes'&&hasItem('dishes'),2.3);
addInteraction('dish-rack',()=>V(2.02,1.30,2.0),'Поставить посуду сушиться',()=>{playSfx('dishes.wav',.46,1.1);removeItem('cleanDishes');state.flags.dishesDone=true;dishRackGroup.visible=true;say([['Мама','Спасибо. И, смотри-ка, ни одной тарелки не разбил. Запишу дату.','smirk'],['Мальчик','Ты слишком мало в меня веришь.','annoyed'],['Мама','Я верю. Просто посуда — нет. Бельё тоже уже можно выносить.','smirk'],['Мальчик','Оно опять мокрое насквозь.','neutral'],['Мама','Так дождь всю ночь шёл. Повесь подальше от деревьев, там хоть ветер есть.','neutral']],()=>setStep('takeLaundry'))},()=>state.step==='dryDishes'&&hasItem('cleanDishes'),2.2);
addInteraction('sink-ozri-water',()=>sink.position,'Набрать воды для Озри',()=>{playSfx('water_fill.wav',.62);addItem('water');setStep('day4OzriWater')},()=>state.step==='day4GetWater'&&!hasItem('water'),2.2);
function animateFatherCare(kind='medicine',duration=1.6){
 let t=0;const a={tick(dt){t+=dt;const k=Math.min(1,t/duration),pulse=Math.sin(k*Math.PI);father.userData.torso.rotation.x=-.05*pulse;father.userData.head.rotation.x=father.userData.baseHeadX+.10*pulse;father.userData.armR.rotation.x=-.60*pulse;father.userData.foreR.rotation.x=-.75*pulse;father.userData.jaw.rotation.x=(kind==='feed'?Math.sin(t*8)*.10:0);if(t>=duration){father.userData.torso.rotation.x=0;father.userData.head.rotation.x=father.userData.baseHeadX;father.userData.armR.rotation.x=0;father.userData.foreR.rotation.x=0;father.userData.jaw.rotation.x=0;const i=anim.indexOf(a);if(i>=0)anim.splice(i,1);}}};anim.push(a);
}
// father
addInteraction('father',()=>father.position,'Подойти к отцу',()=>{
 if(state.step==='giveMedicine'){removeItem('medicine');removeItem('water');animateFatherCare('medicine',2.1);cinematic([{from:camera.position.clone(),to:V(4.15,1.55,5.55),look:V(5.20,1.18,6.62),duration:.8,fov:58},{from:V(4.15,1.55,5.55),to:V(4.55,1.34,5.80),look:V(5.22,1.18,6.64),duration:1.0,fov:52}],()=>say([['Отец','...'],['Мальчик','Пап, таблетка. Я подниму тебе голову.'],['Отец','С-с...'],['Мальчик','Не говори. Всё нормально.']],()=>setStep('getSoup')));} 
 else if(state.step==='feedFather'){removeItem('soup');animateFatherCare('feed',2.3);say([['Мальчик','Осторожно. Она горячая.'],['Отец','...ещё.'],['Мальчик','Сейчас. Не торопись.']],()=>setStep('fetchWood'));}
 else if(state.step==='day2Father'){removeItem('water');say([['Отец','Пти...ца.'],['Мальчик','Озри. Я назвал её Озри.'],['Отец','Шум...ная.'],['Мальчик','Тебе мешает? Я могу унести её в мою комнату.'],['Отец','Нет.'],['Мальчик','Она сегодня весь огород перекопала вместе со мной. Ну... в основном ела червей.'],['Отец','У...летит.'],['Мальчик','Может быть. Но пока она каждый раз возвращается.'],['Отец','Все... возвращаются.'],['Мальчик','Что?'],['Отец','...воду.']],()=>setStep('sleep2'));}
 else if(state.step==='day4Soup'){removeItem('soup');animateFatherCare('feed',2.3);cinematic([{from:camera.position.clone(),to:V(4.15,1.50,5.55),look:V(5.20,1.18,6.62),duration:.8},{from:V(4.15,1.50,5.55),to:V(4.55,1.30,5.82),look:V(5.22,1.18,6.64),duration:.9,fov:50}],()=>say([['Отец','Пе...рья.'],['Мальчик','Что?'],['Отец','На... полу.'],['Мальчик','Это Озри линяет. У неё иногда выпадают маленькие.'],['Отец','Не... здесь.'],['Мальчик','Где тогда?'],['Отец','У... воды.'],['Мальчик','Пап, мы вчера вообще к воде не ходили.'],['Отец','...'],['Мальчик','Ладно. Поешь. Я потом уберу.']],()=>setStep('day4Wood')));} 
},()=>['giveMedicine','feedFather','day2Father','day4Soup'].includes(state.step),2.4);
// stove soup/fire
addInteraction('stove',()=>stove.position,()=>['stokeFire','day4Stoke'].includes(state.step)?'Подбросить дров':'Взять миску супа',()=>{
 if(state.step==='getSoup'){playSfx('item.wav',.28,.9);addItem('soup');setStep('feedFather')}
 else if(state.step==='stokeFire'){playSfx('fire.wav',.66);removeItem('wood');kitchenLight.intensity=Math.max(kitchenLight.intensity,2.2);setStep('collectDishes');}
 else if(state.step==='day4Stoke'){playSfx('fire.wav',.74);removeItem('wood');kitchenLight.intensity=Math.max(kitchenLight.intensity,2.3);setStep('day4GetWater');}
 else if(state.step==='day4Soup'){addItem('soup');setStep('day4Soup');}
},()=>state.step==='getSoup'||state.step==='stokeFire'||state.step==='day4Stoke'||(state.step==='day4Soup'&&!hasItem('soup')),2.3);
// woodpile
addInteraction('woodpile',()=>new THREE.Vector3(-6.45,.5,-5.2),'Взять дрова',()=>{playSfx('wood.wav',.62);addItem('wood');if(state.step==='fetchWood')setStep('stokeFire');else if(state.step==='day4Wood')setStep('day4Stoke')},()=>state.step==='fetchWood'||state.step==='day4Wood',2.3);
// laundry
addInteraction('basket',()=>basket.position,'Взять корзину с бельём',()=>{playSfx('cloth.wav',.45);state.flags.laundryHung=0;addItem('laundry');setStep('hangLaundry')},()=>state.step==='takeLaundry',2.1);
addInteraction('clothesline',()=>new THREE.Vector3(-4.2,1,-10.8),()=>`Повесить вещь ${Math.min((state.flags.laundryHung||0)+1,4)} / 4`,()=>{
  playSfx('cloth.wav',.56,.94+Math.random()*.08);const i=state.flags.laundryHung||0;const clothM=new THREE.MeshStandardMaterial({map:TX.cloth,roughness:1,side:THREE.DoubleSide});const c=plane('cloth',-1.05+i*.72,1.58,.16,.56,.78,clothM,0,0,0,hangingLaundry);c.castShadow=false;const phase=i*.7;anim.push({tick(){c.rotation.z=Math.sin(performance.now()*.0018+phase)*.035;c.rotation.y=Math.sin(performance.now()*.0013+phase)*.055;}});state.flags.laundryHung=i+1;
  if(state.flags.laundryHung>=4){removeItem('laundry');ozriInjured.visible=true;setStep('findBird');setTimeout(()=>chirp(true),300);setTimeout(()=>chirp(true),1450);}
},()=>state.step==='hangLaundry'&&hasItem('laundry'),2.8);
// bird first encounter
addInteraction('injured-bird',()=>ozriInjured.position,'Осмотреть птицу',()=>{chirp(true);cinematic([{from:camera.position.clone(),to:V(5.55,.9,-17.55),look:V(4.5,.38,-18.6),duration:.85,fov:58},{from:V(5.55,.9,-17.55),to:V(3.9,.62,-17.8),look:V(4.5,.34,-18.6),duration:1.2,fov:52}],()=>say([['Мальчик','Эй... Ты живая?'],['Озри','...'],['Мальчик','Тихо. Не дёргайся. Крыло за что-то зацепилось.'],['Мальчик','Я отнесу тебя домой.']],()=>{ozriInjured.visible=false;setCarriedBird(true);addItem('ozri');setStep('carryBird')}));},()=>state.step==='findBird',2.0);
addInteraction('bird-bed',()=>bed.position,'Уложить птицу на кровать',()=>{removeItem('ozri');setCarriedBird(false);ozriInjured.position.set(-4.25,1.08,6.67);ozriInjured.visible=true;addItem('bandage');cinematic([{from:camera.position.clone(),to:V(-3.25,1.62,6.05),look:V(-4.25,1.08,6.67),duration:.9,fov:58},{from:V(-3.25,1.62,6.05),to:V(-3.65,1.28,6.18),look:V(-4.25,1.05,6.67),duration:1.05,fov:50}],()=>say([['Мальчик','Вот. Здесь мягче, чем на столе. Только не испачкай мамину простыню кровью... пожалуйста.','worried'],['Озри','...','worried'],['Мальчик','Сейчас посмотрим крыло. Тихо.','neutral']],()=>setStep('healBird')));},()=>state.step==='carryBird',2.5);
addInteraction('heal-bird',()=>ozriInjured.position,'Осмотреть крыло',()=>cinematic([{from:camera.position.clone(),to:V(-3.62,1.30,6.10),look:V(-4.25,1.05,6.67),duration:.75,fov:48}],()=>startBirdQTE()),()=>state.step==='healBird',2.0);
addInteraction('take-bird-release',()=>ozriHealthy.position,'Взять Озри',()=>{ozriHealthy.visible=false;setCarriedBird(false);addItem('ozri');say([['Мальчик','Тихо. Я тебя держу. Пойдём туда, где я тебя нашёл.'],['Озри','Чик...']],()=>setStep('releaseOzri'))},()=>state.step==='takeOzriOut',2.0);
const releasePos=new THREE.Vector3(4.6,.5,-18.4);
addInteraction('release',()=>releasePos,'Опустить Озри на траву',()=>{removeItem('ozri');ozriHealthy.position.set(4.6,.85,-18.4);ozriHealthy.visible=true;chirp(false);cinematic([{from:camera.position.clone(),to:V(6.0,1.25,-17.15),look:V(4.6,.85,-18.4),duration:.85},{from:V(6.0,1.25,-17.15),to:V(3.6,1.0,-17.4),lookFrom:V(4.6,.85,-18.4),lookTo:V(4.6,1.35,-18.4),duration:1.25,fov:56}],()=>say([['Мальчик','Ну... всё. Я отпускаю.'],['Озри','Чик?'],['Мальчик','Давай. Попробуй. Я не буду держать.'],['Озри','Чик... чик.'],['Мальчик','Крыло держит. Видишь? Ещё раз.'],['Озри','Чик!'],['Мальчик','Почему ты на меня смотришь? Лес там. Озеро там. Можешь лететь куда хочешь.'],['Озри','Чик-чик!'],['Мальчик','Ладно... Тогда тебе нужно имя.'],['Мальчик','Озри. Не знаю почему. Просто Озри.'],['Озри','Чик!']],()=>{flyOzriTo(new THREE.Vector3(player.pos.x+.7,1.65,player.pos.z-.3),1.0,()=>{chirp();ozriFollowPlayer=true;setStep('sleep1')})}));},()=>state.step==='releaseOzri',2.3);
// A slower morning with Ozri: feed her, fetch a real tool, work three patches, then get water for father.
addInteraction('crumbs',()=>kitchenTable.position,'Взять крошки',()=>{playSfx('item.wav',.35,1.2);addItem('crumbs')},()=>state.step==='day2Feed'&&!hasItem('crumbs'),2.2);
addInteraction('feed-ozri',()=>ozriHealthy.position,'Покормить Озри',()=>{removeItem('crumbs');chirp();say([['Мальчик','Ты опять проснулась раньше меня. У тебя вообще есть чувство жалости к спящим людям?','neutral'],['Озри','Чик-чик!','happy'],['Мальчик','Понятно. Нет. Держи крошки.','happy'],['Озри','Чик!','happy'],['Мальчик','И сегодня не лезь в мамину грядку. Она тебя любит примерно до первого выкопанного ростка.','worried'],['Озри','Чик?','neutral'],['Мальчик','Да. Это угроза. Очень страшная.','happy']],()=>{setStep('gardenGetTool');setTimeout(()=>flyOzriTo(new THREE.Vector3(4.0,.7,-5.0),1.6),300)})},()=>state.step==='day2Feed'&&hasItem('crumbs'),2.0);
addInteraction('trowel',()=>trowel.position,'Взять совковую лопатку',()=>{playSfx('shovel_pick.wav',.76);trowel.visible=false;addItem('trowel');setStep('gardenDig1')},()=>state.step==='gardenGetTool'&&!hasItem('trowel'),2.1);
function digGardenPatch(i,nextStep){playSfx('dig_soil.wav',.86,.92+Math.random()*.08);dugMarks[i].visible=true;worms[i].visible=true;ozriPeckAt(gardenPatches[i]);setTimeout(()=>{worms[i].visible=false;},1050);setStep(nextStep);}
addInteraction('garden-patch-1',()=>gardenPatches[0],'Вскопать землю',()=>digGardenPatch(0,'gardenDig2'),()=>state.step==='gardenDig1'&&hasItem('trowel'),2.5);
addInteraction('garden-patch-2',()=>gardenPatches[1],'Разрыхлить грядку',()=>{digGardenPatch(1,'gardenDig3');say([['Мама','Эй, землекоп. Смотри под ноги — твоя начальница прямо под лопаткой.','annoyed'],['Мальчик','Озри, отойди чуть-чуть. Я не хочу выкопать тебя вместе с картошкой.','worried'],['Озри','Чик-чик-чик!','happy'],['Мама','Нашла одного червя и уже приватизировала весь огород. Быстро учится.','smirk'],['Мальчик','С тебя пример берёт.','happy'],['Мама','Очень смешно. Копай.','annoyed']],()=>{})},()=>state.step==='gardenDig2'&&hasItem('trowel'),2.5);
addInteraction('garden-patch-3',()=>gardenPatches[2],'Закончить грядку',()=>{digGardenPatch(2,'day2Water');removeItem('trowel');trowel.position.set(-10.9,.62,-4.15);trowel.visible=true;say([['Мальчик','Всё. Три ряда. Спина официально подала заявление на увольнение.','neutral'],['Мама','Не приму. Работников и так двое с половиной.','smirk'],['Мальчик','Почему я половина?','annoyed'],['Мама','Половина — это твоя птица. Она хотя бы вредителей ест.','smirk'],['Озри','Чик!','happy'],['Мальчик','Предательница.','happy'],['Мама','Значит, обед ей можешь не готовить. Премию уже получила червями.','neutral']],()=>{})},()=>state.step==='gardenDig3'&&hasItem('trowel'),2.5);
addInteraction('well-water-father',()=>V(9.5,.8,-8.4),'Набрать воды',()=>{playSfx('water_fill.wav',.68);addItem('water');setStep('day2Father');flyOzriTo(new THREE.Vector3(-5.8,1.78,1.12),1.7)},()=>state.step==='day2Water'&&!hasItem('water'),2.5);
// Day 3 cleaning is now several physical sweeps, with Ozri chasing the broom.
const broom=new THREE.Group();broom.position.set(1.9,.82,-.1);broom.rotation.z=.18;world.add(broom);
box('broom handle',0,.16,0,.075,1.58,.075,MAT.wood,broom);
const broomBinding=cyl('broom binding',0,-.62,0,.10,.11,.16,MAT.metal,broom,8);
for(let i=0;i<11;i++){
  const a=(i-5)*.055;const br=box('broom bristle '+i,a*3.2,-.91,0,.035,.56,.045,new THREE.MeshStandardMaterial({color:i%2?0x92764f:0x80633f,roughness:1}),broom);
  br.rotation.z=-a;
}
box('broom bristle cap',0,-.70,0,.52,.10,.12,new THREE.MeshStandardMaterial({color:0x6f5739,roughness:1}),broom);
const dirt1=floor('dirt',0,5.7,.72,.52,new THREE.MeshStandardMaterial({color:0x392f27,roughness:1}),.031);
const dirt2=floor('dirt2',2.3,3.5,.62,.46,new THREE.MeshStandardMaterial({color:0x342c25,roughness:1}),.031);
const dirt3=floor('dirt3',-2.4,3.9,.68,.48,new THREE.MeshStandardMaterial({color:0x3c3028,roughness:1}),.031);dirt2.visible=false;dirt3.visible=false;
addInteraction('broom',()=>broom.position,'Взять метлу',()=>{playSfx('broom.wav',.58);broom.visible=false;addItem('broom');dirt1.visible=true;dirt2.visible=true;dirt3.visible=true;setStep('day3Sweep1')},()=>state.step==='day3Sweep',2.0);
function sweepSpot(dirt,next,ozriPos){playSfx('broom.wav',.72,.94+Math.random()*.1);dirt.visible=false;if(ozriPos)flyOzriTo(ozriPos,.65);setStep(next);}
addInteraction('sweep1',()=>V(0,.1,5.7),'Подмести',()=>{sweepSpot(dirt1,'day3Sweep2',V(.7,.5,5.45));chirp()},()=>state.step==='day3Sweep1'&&hasItem('broom'),1.8);
addInteraction('sweep2',()=>V(2.3,.1,3.5),'Подмести',()=>{sweepSpot(dirt2,'day3Sweep3',V(2.8,.5,3.2));say([['Мальчик','Не нападай на метлу.','annoyed'],['Озри','Чик!','happy'],['Мальчик','Она тебе ничего не сделала. В отличие от тебя — полу.','neutral'],['Озри','Чик-чик!','happy'],['Мальчик','Ладно. Победила. Метла официально твой враг.','happy']],()=>{})},()=>state.step==='day3Sweep2'&&hasItem('broom'),1.8);
addInteraction('sweep3',()=>V(-2.4,.1,3.9),'Закончить уборку',()=>{sweepSpot(dirt3,'day3Blanket',V(-1.6,.65,3.7));removeItem('broom');broom.visible=true},()=>state.step==='day3Sweep3'&&hasItem('broom'),1.8);
addInteraction('blanket',()=>fatherBed.position,'Взять одеяло',()=>{addItem('blanket');setStep('day3Blanket')},()=>state.step==='day3Blanket'&&!hasItem('blanket'),2.4);
addInteraction('hang-blanket',()=>new THREE.Vector3(-4.2,1,-10.8),'Вывесить одеяло',()=>{removeItem('blanket');const c=box('blanket',0,1.53,.04,1.5,1.0,.05,new THREE.MeshStandardMaterial({map:TX.cloth,color:0x8d887c,roughness:1}),hangingLaundry);c.castShadow=false;anim.push({tick(){c.rotation.y=Math.sin(performance.now()*.0012)*.045;}});featherSprite.position.set(-.1,.14,-1.35);featherSprite.visible=true;setStep('day3Feather')},()=>state.step==='day3Blanket'&&hasItem('blanket'),2.8);
addInteraction('feather-day3',()=>featherSprite.position,'Поднять перо',()=>{playSfx('item.wav',.2,1.35);featherSprite.visible=false;addItem('feather');say([['Мальчик','Оставлю себе.'],['Озри','Чик-чик.']],()=>setStep('sleep3'))},()=>state.step==='day3Feather',2.0);
// Before the lake walk, the player looks after Ozri directly.
const ozriBowl=cyl('ozri bowl',-5.1,.13,1.3,.26,.34,.12,new THREE.MeshStandardMaterial({color:0x706858,roughness:.8}),world,12);
addInteraction('ozri-water-bowl',()=>ozriBowl.position,'Наполнить миску Озри',()=>{removeItem('water');playSfx('water_fill.wav',.54);chirp();say([['Мальчик','Стой, сначала вода. Ты весь день носишься по дому.'],['Озри','Чик.'],['Мальчик','Вот теперь можно гулять. Только не улетай далеко, ладно?'],['Озри','Чик-чик!']],()=>{setStep('day4Lake');ozriFollowPlayer=true})},()=>state.step==='day4OzriWater'&&hasItem('water'),2.0);
// day4 lake moment
addInteraction('lake-day4',()=>releasePos,'Сесть у воды',()=>{chirp();ozriFollowPlayer=false;flyOzriTo(new THREE.Vector3(5.2,1.0,-18.5),.85,()=>{});cinematic([{from:camera.position.clone(),to:V(3.8,.92,-17.25),look:V(7.2,.35,-22.5),duration:1.1},{from:V(3.8,.92,-17.25),to:V(5.0,.8,-17.6),look:V(5.2,1.0,-18.5),duration:1.15}],()=>say([['Мальчик','Опять сюда потянуло?'],['Озри','Чик.'],['Мальчик','Тебе здесь нравится больше, чем мне.'],['Озри','Чик-чик.'],['Мальчик','Смотри, вода сегодня почти спокойная.'],['Озри','...'],['Мальчик','Эй. Чего притихла?'],['Озри','Чик.'],['Мальчик','Пойдём домой. Мама скоро закроет дверь.']],()=>{ozriFollowPlayer=true;setStep('sleep4')}));},()=>state.step==='day4Lake',2.3);
// day5 search
function enterMaze(){
  if(mazeActive)return;mazeActive=true;inputLocked=true;if(locked)document.exitPointerLock();lastFeatherSprite.visible=false;setStep('maze');setMood('maze');audioInit();setFearHeartbeat(.68,.90);setMazeChirps(.72);duckAudio(.08,30000);glitch();ui.sleepFade.classList.add('active');
  for(const k of Object.keys(audioState.ambTargets))audioState.ambTargets[k]=0;
  setTimeout(()=>{mazeGroup.visible=true;player.pos.set(92,1.65,110);player.yaw=0;player.pitch=0;player.targetYaw=0;player.targetPitch=0;camera.position.copy(player.pos);camera.rotation.set(0,0,0,'YXZ');ui.sleepFade.classList.remove('active');inputLocked=false;setTimeout(()=>playSfx('maze_chirps.wav',.34,.94),650);},560);
}
function exitMaze(){
  if(!mazeActive)return;mazeActive=false;inputLocked=true;if(locked)document.exitPointerLock();ui.sleepFade.classList.add('active');playSfx('glitch.wav',.70,.78);setMazeChirps(0);setFearHeartbeat(.28,.86);
  setTimeout(()=>{mazeGroup.visible=false;clearMovementInput();const safePos=safeReturnPosition(mazeReturnPos);player.pos.copy(safePos);player.yaw=Math.PI;player.pitch=0;player.targetYaw=Math.PI;player.targetPitch=0;camera.position.copy(player.pos);camera.rotation.set(0,Math.PI,0,'YXZ');audioState.duckTarget=1;audioState.duckUntil=0;setStep('searchKitchen');setMood('loss');setAmbient('house');ui.sleepFade.classList.remove('active');inputLocked=false;},620);
}
addInteraction('perch-search',()=>perch.position,'Взять перо с жердочки',()=>{playSfx('item.wav',.34,1.28);lastFeatherSprite.visible=false;enterMaze();},()=>state.step==='searchPerch',2.1);
addInteraction('kitchen-search',()=>sink.position,'Осмотреть мойку',()=>{hallucinationMother();},()=>state.step==='searchKitchen',2.2);
addInteraction('father-search',()=>father.position,'Открыть дверь / подойти',()=>{hallucinationFather();},()=>state.step==='searchFather',2.4);
addInteraction('yard-search',()=>new THREE.Vector3(-4.2,1,-10.8),'Осмотреть бельевую верёвку',()=>{playSfx('heartbeat.wav',.82,.86);glitch();chirp(true);setTimeout(()=>setStep('searchLake'),650)},()=>state.step==='searchYard',2.8);
addInteraction('final-bird',()=>finalOzri.position,'Подойти к Озри',()=>playFinale(),()=>state.step==='final'&&!state.ending,2.0);

// Optional environmental interactions: small pieces of family history
addInteraction('well-flavor',()=>V(9.5,.8,-8.4),'Заглянуть в колодец',()=>{say(state.day<5?[['Мальчик','Вода почти чёрная. Мама говорит, зимой она пахнет железом.']]:[['Мальчик','На поверхности что-то дрогнуло. Просто моё отражение.']]);},()=>true,2.5);
addInteraction('shed-flavor',()=>V(-10.4,1,-5.2),'Заглянуть в сарай',()=>{say([['Мальчик','Раньше папа чинил здесь сети и инструменты. После войны мама почти не открывает сарай.']]);},()=>state.day<=4,2.6);
addInteraction('dock-flavor',()=>V(6.2,.6,-19.1),'Осмотреть старый пирс',()=>{say(state.day<5?[['Мальчик','Доски скрипят даже без ветра. Дальше мама ходить не разрешает.']]:[['Мальчик','Здесь слишком тихо. Даже вода звучит неправильно.']]);},()=>state.step!=='final',2.5);
addInteraction('photo-flavor',()=>V(-2.05,1.6,7.6),'Рассмотреть фотографии',()=>{say([['Мальчик','На этой фотографии папа ещё стоит. Мама спрятала остальные в ящик.']]);},()=>state.day<=4,2.1);
addInteraction('gate-flavor',()=>V(0,1,-13.2),'Осмотреть старые ворота',()=>{say([['Мальчик','За воротами тропа к озеру. Ночью туда лучше не ходить.']]);},()=>state.day<=4,2.5);

function refreshVisibility(){
  dirtyDishes.visible=state.step==='collectDishes'&&!hasItem('dishes');
  if(state.day===5&&state.step==='searchPerch')lastFeatherSprite.visible=true;else if(state.step!=='searchPerch')lastFeatherSprite.visible=false;
  dishRackGroup.visible=!!state.flags.dishesDone;
  if(state.day<5){finalOzri.visible=false;finalBlood.visible=false;}
  if(state.step==='takeOzriOut'){ozriInjured.visible=false;ozriHealthy.position.set(-4.25,1.26,6.67);ozriHealthy.visible=true;}
  if(state.day>=2&&state.day<=4&&!hasItem('ozri')){if(!ozriHealthy.visible&&!birdFlight){ozriHealthy.position.set(-5.8,1.78,1.12);ozriHealthy.visible=true;}}
  if(state.day===5){ozriHealthy.visible=false;ozriInjured.visible=false;if(state.step==='final'){finalOzri.visible=true;finalBlood.visible=true;}else{finalOzri.visible=false;finalBlood.visible=false;}}
}

// -----------------------------------------------------------------------------
// QTE treatment: clean -> splinter -> bandage -> water
// -----------------------------------------------------------------------------
let qteStage=0,qtePos=0,qteDir=1,qteLast=0;
const QTES=[
 ['Промой крыло','Нажми, когда маркер попадёт в светлую область. Не дёргай птицу.'],
 ['Вытащи занозу','Делай медленно. Если сорвёшься — придётся попробовать ещё раз.'],
 ['Перевяжи крыло','Не затягивай бинт слишком сильно.'],
 ['Успокой птицу','Дай ей воды и дождись, пока дыхание станет ровнее.']
];
function startBirdQTE(){qteOpen=true;inputLocked=true;if(locked)document.exitPointerLock();qteStage=0;qtePos=0;qteDir=1;ui.qte.classList.remove('hidden');setupQteStage();}
function setupQteStage(){ui.qteTitle.textContent=QTES[qteStage][0];ui.qteDescription.textContent=QTES[qteStage][1];ui.qteCount.textContent=`${qteStage+1} / ${QTES.length}`;const left=26+Math.random()*45,width=13+Math.random()*9;ui.qteZone.style.left=left+'%';ui.qteZone.style.width=width+'%';ui.qteZone.dataset.left=left;ui.qteZone.dataset.width=width;}
function qteHit(){const left=+ui.qteZone.dataset.left,width=+ui.qteZone.dataset.width;if(qtePos>=left&&qtePos<=left+width){playSfx('qte_good.wav',.82);tone(680,.07,'sine',.025);qteStage++;if(qteStage>=QTES.length){qteOpen=false;ui.qte.classList.add('hidden');inputLocked=false;removeItem('bandage');ozriInjured.visible=false;ozriHealthy.position.set(-4.25,1.26,6.67);ozriHealthy.visible=true;chirp();say([['Мальчик','Всё. Заноза вышла. И я, между прочим, почти не дрожал.','happy'],['Озри','Чик...','worried'],['Мальчик','Не смотри так. Это была очень убедительная работа врача.','neutral'],['Озри','Чик.','neutral'],['Мальчик','И бинт клювом не трогай. Я серьёзно.','annoyed'],['Озри','Чик!','happy'],['Мальчик','Вот именно поэтому я тебе не доверяю. Посидим немного, потом вынесу тебя к воде.','happy']],()=>setStep('takeOzriOut'));}else setupQteStage();}else{flashRed();playSfx('qte_bad.wav',.88);tone(90,.12,'sawtooth',.02);qtePos=0;qteDir=1;}}
$('qte-button').addEventListener('click',qteHit);
const audioToggleButton=document.getElementById('audio-toggle');if(audioToggleButton)audioToggleButton.addEventListener('click',e=>{e.stopPropagation();toggleAudio();});
const flashlightToggleButton=document.getElementById('flashlight-toggle');if(flashlightToggleButton)flashlightToggleButton.addEventListener('click',e=>{e.stopPropagation();toggleFlashlight();});updateFlashlightButton();


// -----------------------------------------------------------------------------
// Day transitions
// -----------------------------------------------------------------------------
function resetPlayer(){player.pos.set(-4.55,1.65,5.45);player.yaw=Math.PI;player.pitch=0;player.targetYaw=Math.PI;player.targetPitch=0;camera.rotation.set(0,Math.PI,0,'YXZ');}
function prepareMorning(day,step,withOzri=true){
 setDay(day);resetPlayer();ozriFollowPlayer=false;birdFlight=null;placeMotherForStep(step);
 if(withOzri){ozriHealthy.position.set(-5.8,1.78,1.12);ozriHealthy.visible=true;setOzriAnim('idle');}else ozriHealthy.visible=false;
 if(day===2)state.flags.day2Morning=true;if(day===3){state.flags.day3Morning=true;broom.visible=true;dirt1.visible=false;dirt2.visible=false;dirt3.visible=false;}if(day===4){state.flags.day4Morning=true;addItem('soup');}if(day===5){state.flags.day5Morning=true;lastFeatherSprite.position.set(-5.80,1.30,1.10);lastFeatherSprite.visible=true;}
 setStep(step);if(day===5)setMood('loss');
}
function sleepTransition(){
 const map={sleep1:[2,'day2Feed',true],sleep2:[3,'day3Sweep',true],sleep3:[4,'day4Soup',true],sleep4:[5,'searchPerch',false]};const cfg=map[state.step];if(!cfg)return;
 inputLocked=true;if(locked)document.exitPointerLock();audioInit();playSfx('sleep_hush.wav',.72,.96);duckAudio(.015,4400);ui.sleepFade.classList.add('active');
 setTimeout(()=>{prepareMorning(cfg[0],cfg[1],cfg[2]);camera.position.copy(player.pos);camera.rotation.set(0,Math.PI,0,'YXZ');
   setTimeout(()=>{ui.sleepFade.classList.remove('active');
     if(cfg[2]){setTimeout(()=>{playSfx('morning_chirp_swell.wav',.74,1);chirp();},520);cinematic([{from:V(-5.05,1.10,6.62),to:V(-4.72,1.40,5.90),lookFrom:V(-4.45,1.02,6.58),lookTo:V(-5.8,1.78,1.12),duration:1.45,fov:61},{from:V(-4.72,1.40,5.90),to:V(-4.10,1.62,4.90),look:V(-5.8,1.78,1.12),duration:1.65,fov:56}],()=>{inputLocked=false;});}
     else{cinematic([{from:V(-5.05,1.10,6.62),to:V(-4.72,1.42,5.85),look:V(-5.8,1.72,1.12),duration:1.55,fov:61},{from:V(-4.72,1.42,5.85),to:V(-5.15,1.62,3.25),look:V(-5.8,1.65,1.12),duration:1.75,fov:56}],()=>{tone(54,.6,'triangle',.025);inputLocked=false;});}
   },260);
 },1500);
}

// -----------------------------------------------------------------------------
// Hallucinations
// -----------------------------------------------------------------------------
function makeSplash(x,y,z){
 const drops=[];for(let i=0;i<13;i++){const m=sphere('water drop',x+(Math.random()-.5)*.45,y+Math.random()*.22,z+(Math.random()-.5)*.38,.025+Math.random()*.022,new THREE.MeshBasicMaterial({color:0x9cb7c4,transparent:true,opacity:.72}),world,5);m.userData.v=new THREE.Vector3((Math.random()-.5)*.7,.45+Math.random()*.7,(Math.random()-.5)*.7);drops.push(m);}let life=1.2;const a={tick(dt){life-=dt;for(const m of drops){m.position.addScaledVector(m.userData.v,dt);m.userData.v.y-=1.5*dt;m.material.opacity=Math.max(0,life/.9);}if(life<=0){for(const m of drops)world.remove(m);anim.splice(anim.indexOf(a),1);}}};anim.push(a);
}
function hallucinationMother(){
 const returnPos=player.pos.clone();returnPos.y=player.pos.y;
 duckAudio(.025,8200);setFearHeartbeat(.72,.96);playSfx('tension_rise.wav',1.08,.92);setTimeout(()=>playSfx('mother_horror.wav',1.05),500);setTimeout(()=>playSfx('ozri_horror_chirps.wav',1.18,1.08),760);setTimeout(()=>playSfx('bird_alarm.wav',1.0,1.12),2350);glitch();flashRed();
 const ghost=makeHumanoid('MotherMemory',.90,3.02,{shirt:0x402d30,pants:0x1f1c1d,hair:0x171515,rotation:0});ghost.scale.setScalar(.78);
 const bird=sprite('assets/sprites/ozri_anim/scared.png',.90,1.30,2.02,.72,.72);const waterMat=new THREE.MeshPhysicalMaterial({color:0x365e70,transparent:true,opacity:.52,roughness:.08,metalness:0,depthWrite:false,side:THREE.DoubleSide});const water=plane('memory sink water',.90,1.245,2.02,1.12,.72,waterMat,-Math.PI/2);
 ghost.userData.rig.leftArm.root.rotation.x=1.28;ghost.userData.rig.rightArm.root.rotation.x=1.28;ghost.userData.rig.leftArm.root.rotation.z=.13;ghost.userData.rig.rightArm.root.rotation.z=-.13;
 let sceneTime=0,splashA=false,splashB=false;const sceneAnim={tick(dt){sceneTime+=dt;const press=.5+.5*Math.sin(sceneTime*4.2);bird.position.y=1.31-press*.32;bird.material.rotation=Math.sin(sceneTime*17)*.08;ghost.userData.rig.torso.rotation.x=-.12-.08*press;ghost.userData.rig.head.rotation.x=.10+.08*press;ghost.userData.rig.leftArm.root.rotation.x=1.22+press*.22;ghost.userData.rig.rightArm.root.rotation.x=1.22+press*.22;if(sceneTime>1.45&&!splashA){splashA=true;makeSplash(.90,1.27,2.02);}if(sceneTime>3.0&&!splashB){splashB=true;makeSplash(.90,1.27,2.02);}}};anim.push(sceneAnim);
 cinematic([
  {from:camera.position.clone(),to:V(2.55,1.58,.78),look:V(.90,1.40,2.58),duration:1.0,fov:61,onStart:()=>playSfx('horror_sting.wav',.96)},
  {from:V(2.55,1.58,.78),to:V(2.02,1.42,1.02),lookFrom:V(.90,1.40,2.52),lookTo:V(.90,1.16,2.10),duration:1.55,fov:49},
  {from:V(2.02,1.42,1.02),to:V(1.52,1.22,1.12),look:V(.90,1.11,2.02),duration:2.45,fov:40},
  {from:V(1.18,1.28,2.76),to:returnPos,look:V(.90,1.18,2.02),duration:1.45,fov:56,onStart:()=>flashRed()}
 ],()=>{const ai=anim.indexOf(sceneAnim);if(ai>=0)anim.splice(ai,1);const ri=characterRigs.indexOf(ghost.userData.rig);if(ri>=0)characterRigs.splice(ri,1);world.remove(ghost);world.remove(bird);world.remove(water);setFearHeartbeat(.46,.90);playSfx('heartbeat.wav',1,.80);setStep('searchFather');});
}
function hallucinationFather(){
 const returnPos=player.pos.clone();returnPos.y=player.pos.y;
 duckAudio(.02,9300);setFearHeartbeat(.86,1.02);playSfx('tension_rise.wav',1.12,.84);setTimeout(()=>playSfx('father_horror.wav',1.08),380);setTimeout(()=>playSfx('ozri_horror_chirps.wav',1.22,.94),640);setTimeout(()=>playSfx('bird_alarm.wav',1.05,.86),2500);glitch();flashRed();
 father.updateWorldMatrix(true,true);const mouthPos=new THREE.Vector3();father.userData.mouth.getWorldPosition(mouthPos);mouthPos.z-=.10;
 const chestPos=new THREE.Vector3();father.userData.torso.getWorldPosition(chestPos);chestPos.y+=.28;chestPos.z-=.14;
 const bird=sprite('assets/sprites/ozri_anim/scared.png',chestPos.x,chestPos.y,chestPos.z,.78,.78);const feather1=sprite('assets/ui/feather.png',4.20,1.00,5.94,.20,.20),feather2=sprite('assets/ui/feather.png',4.74,.92,6.05,.16,.16),feather3=sprite('assets/ui/feather.png',4.40,.86,5.75,.14,.14);feather1.visible=feather2.visible=feather3.visible=false;
 const bloodMat=new THREE.MeshBasicMaterial({color:0x661013,transparent:true,opacity:.0,side:THREE.DoubleSide});const bloodMark=plane('father memory blood',4.52,.90,6.02,.9,.55,bloodMat,-Math.PI/2);
 let sceneTime=0;const sceneAnim={tick(dt){sceneTime+=dt;const cycle=(sceneTime%1.25)/1.25;const grab=cycle<.48?easeCine(cycle/.48):easeCine((1-cycle)/.52);const bite=Math.pow(Math.max(0,Math.sin(sceneTime*Math.PI*1.6)),10);bird.position.lerpVectors(chestPos,mouthPos,.26+.66*grab);bird.position.y+=Math.sin(sceneTime*22)*.035;bird.material.rotation=Math.sin(sceneTime*18)*.07;const shrink=sceneTime>5.2?.48:sceneTime>3.7?.58:sceneTime>2.1?.68:.78;bird.scale.set(shrink,shrink,1);
 father.userData.torso.rotation.x=-.18*grab;father.userData.torso.rotation.y=Math.sin(sceneTime*2.1)*.055*grab;father.userData.torso.rotation.z=Math.sin(sceneTime*2.5)*.045;father.userData.head.rotation.x=father.userData.baseHeadX+.27*grab+.09*bite;father.userData.head.rotation.z=Math.sin(sceneTime*2.2)*.025;father.userData.armR.rotation.x=1.05*grab;father.userData.armL.rotation.x=.92*grab;father.userData.armR.rotation.z=-.28-.18*grab;father.userData.armL.rotation.z=.24+.16*grab;father.userData.foreR.rotation.x=1.18*grab;father.userData.foreL.rotation.x=1.10*grab;father.userData.jaw.rotation.x=-.10-.22*bite;bloodMark.material.opacity=Math.min(.65,Math.max(0,(sceneTime-2.4)*.12));
 if(sceneTime>2.15)feather1.visible=true;if(sceneTime>3.55)feather2.visible=true;if(sceneTime>4.85)feather3.visible=true;}};anim.push(sceneAnim);
 cinematic([
  {from:camera.position.clone(),to:V(4.08,1.60,5.28),look:chestPos.clone(),duration:.96,fov:60,onStart:()=>playSfx('horror_sting.wav',1)},
  {from:V(4.08,1.60,5.28),to:V(4.45,1.42,5.52),look:chestPos.clone(),duration:1.35,fov:49},
  {from:V(4.45,1.42,5.52),to:V(4.78,1.23,5.72),lookFrom:chestPos.clone(),lookTo:mouthPos.clone(),duration:3.45,fov:39},
  {from:V(4.78,1.23,5.72),to:V(4.12,1.50,5.30),look:mouthPos.clone(),duration:1.55,fov:55,onStart:()=>flashRed()}
 ],()=>{const ai=anim.indexOf(sceneAnim);if(ai>=0)anim.splice(ai,1);father.userData.torso.rotation.set(0,0,0);father.userData.head.rotation.set(father.userData.baseHeadX,0,0);father.userData.armR.rotation.set(0,0,.26);father.userData.armL.rotation.set(0,0,-.20);father.userData.foreR.rotation.set(0,0,0);father.userData.foreL.rotation.set(0,0,0);father.userData.jaw.rotation.set(0,0,0);world.remove(bird);world.remove(feather1);world.remove(feather2);world.remove(feather3);world.remove(bloodMark);setFearHeartbeat(.34,.86);playSfx('heartbeat.wav',1,.76);setStep('searchYard');});
}

// -----------------------------------------------------------------------------
// Story triggers tied to physically crossing places
// -----------------------------------------------------------------------------
let lastBirdCue=0;
function storyTriggers(){
 if(state.step==='maze'){const lx=player.pos.x-100,lz=player.pos.z-100;if(lz<-10.55&&lx>-9.8&&lx<-6.2)exitMaze();return;}
 if(state.step==='searchKitchen'&&!state.flags.motherTension&&Math.hypot(player.pos.x-.9,player.pos.z-2.0)<6.2){state.flags.motherTension=true;playSfx('tension_rise.wav',.68,.92);setFearHeartbeat(.42,.88);duckAudio(.45,5200);}
 if(state.step==='searchFather'&&!state.flags.fatherTension&&Math.hypot(player.pos.x-4.8,player.pos.z-6.5)<6.0){state.flags.fatherTension=true;playSfx('tension_rise.wav',.76,.84);setFearHeartbeat(.58,.93);duckAudio(.38,5400);}
 if(state.step==='hangLaundry'&&!state.flags.outsideWarning&&player.pos.z<-.95){state.flags.outsideWarning=true;say([['Мама','И далеко не уходи!','annoyed'],['Мама','И давай только без животных. В прошлый раз ты притащил ежа, а лечила его почему-то я.','smirk'],['Мальчик','Он был маленький.','neutral'],['Мама','Он был злой и весь в блохах. Денег и так нету — больше никого домой не неси.','annoyed'],['Мальчик','Да понял я.','annoyed']]);}
 if(state.step==='findBird'&&performance.now()-lastBirdCue>4200&&player.pos.z<-8){lastBirdCue=performance.now();chirp(true);}
 if(state.step==='searchLake'&&Math.hypot(player.pos.x-4.5,player.pos.z+18.6)<7.2){setStep('final');finalOzri.visible=true;finalBlood.visible=true;setMood('loss');setFearHeartbeat(.76,1.02);playSfx('heartbeat.wav',.82,.72);}
}


// -----------------------------------------------------------------------------
// Ending
// -----------------------------------------------------------------------------
let finalBoy=null,finalSobAnim=null;
function makeFinalBoy(){
 const b=makeHumanoid('FinalBoy',5.28,-17.72,{shirt:0x4d5556,pants:0x34383b,hair:0x3f322b,rotation:0});b.scale.setScalar(.72);const r=b.userData.rig;r.hips.position.y=.50;r.torso.rotation.x=-.38;r.head.rotation.x=.34;r.leftLeg.root.rotation.x=-1.18;r.rightLeg.root.rotation.x=-1.18;r.leftLeg.lower.rotation.x=1.62;r.rightLeg.lower.rotation.x=1.62;r.leftArm.root.rotation.x=-.72;r.rightArm.root.rotation.x=-.72;r.leftArm.root.rotation.z=.18;r.rightArm.root.rotation.z=-.18;
 const dx=finalOzri.position.x-b.position.x,dz=finalOzri.position.z-b.position.z;b.rotation.y=wrapAngle(Math.atan2(-dx,-dz));return b;
}
function playFinale(){
 state.ending=true;inputLocked=true;if(locked)document.exitPointerLock();ui.hud.classList.add('hidden');ui.crosshair.classList.add('hidden');finalOzri.visible=true;finalBlood.visible=true;audioInit();setFearHeartbeat(.92,1.04);duckAudio(.055,17500);setTimeout(()=>playSfx('final_scream.wav',1.18,.96),420);setTimeout(()=>setFearHeartbeat(.30,.82),1550);setTimeout(()=>playSfx('boy_sob_dark.wav',.94,.92),2050);
 finalBoy=makeFinalBoy();let t=0;finalSobAnim={tick(dt){t+=dt;const r=finalBoy.userData.rig;r.hips.position.y=.50;r.torso.rotation.x=-.43+Math.sin(t*1.55)*.022;r.torso.position.y=.36-Math.abs(Math.sin(t*.72))*.018;r.head.rotation.x=.42+.035*Math.sin(t*1.7+.8);r.head.rotation.z=.018*Math.sin(t*2.3);r.leftLeg.root.rotation.x=-1.18;r.rightLeg.root.rotation.x=-1.18;r.leftLeg.lower.rotation.x=1.62;r.rightLeg.lower.rotation.x=1.62;r.leftArm.root.rotation.x=-.80-.025*Math.sin(t*1.9);r.rightArm.root.rotation.x=-.80-.025*Math.sin(t*1.9+.5);r.leftArm.root.rotation.z=.18;r.rightArm.root.rotation.z=-.18;}};anim.push(finalSobAnim);
 cinematic([
  {from:camera.position.clone(),to:V(6.15,1.28,-17.05),look:V(4.52,.30,-18.55),duration:1.75,fov:55},
  {from:V(6.15,1.28,-17.05),to:V(6.85,1.78,-16.15),look:V(5.05,.68,-18.15),duration:2.7,fov:51},
  {from:V(6.85,1.78,-16.15),to:V(9.8,4.25,-13.4),look:V(5.0,.62,-18.15),duration:4.6,fov:46}
 ],()=>{setTimeout(()=>{ui.sleepFade.classList.add('active');audioState.duckTarget=.015;audioState.duckUntil=Number.POSITIVE_INFINITY;setFearHeartbeat(0);setTimeout(()=>{ui.ending.classList.remove('hidden');setTimeout(()=>location.reload(),5200);},1750);},900);});
}
$('restart').addEventListener('click',()=>location.reload());

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------
$('start').addEventListener('click',()=>{
 audioInit();setMood('bleak');started=true;ui.title.classList.add('hidden');ui.sleepFade.classList.remove('active');ui.hud.classList.remove('hidden');setStep('makeBed');renderInventory();updateHeld();resetPlayer();
 cinematic([{from:V(-5.6,.98,6.72),to:V(-5.15,1.35,6.55),lookFrom:V(-4.3,1.05,6.7),lookTo:V(-3.2,1.2,5.5),duration:1.5,fov:62},{from:V(-5.15,1.35,6.55),to:V(-4.7,1.62,5.9),look:V(-2.2,1.5,3.9),duration:1.25,fov:66}],()=>{resetPlayer();say([['Мама','Ты проснулся?'],['Мальчик','М-м... да.'],['Мама','Тогда вставай. Я на кухне.']]);});
});

// -----------------------------------------------------------------------------
// Animation loop
// -----------------------------------------------------------------------------
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-last)/1000);last=now;
 if(started){updateMood(dt);updateAudio(dt);if(cutscene){updateCutscene(dt);}else{move(dt);updateCamera(dt);interactionUpdate();storyTriggers();}updateOzriMotion(dt,now);updateFlashlight(dt);updateClock(dt);updateLocation(dt);for(const rig of characterRigs)animateRig(rig,dt,now);if(!cutscene&&!dialogueOpen&&!state.ending&&mother.visible&&Math.hypot(player.pos.x-mother.position.x,player.pos.z-mother.position.z)<6.5){const target=Math.atan2(-(player.pos.x-mother.position.x),-(player.pos.z-mother.position.z));mother.rotation.y+=wrapAngle(target-mother.rotation.y)*(1-Math.exp(-dt*5.5));}for(const a of [...anim])a.tick(dt);if(father.userData.head&&!(cutscene&&state.step==='searchFather')){father.userData.head.rotation.z=Math.sin(now*.0011)*.014;father.userData.torso.position.z=Math.sin(now*.00125)*.012;father.userData.armR.rotation.z=.26+Math.sin(now*.0014)*.018;}}
 // subtle bird idle and environment motion
 if(ozriHealthy.visible&&!birdFlight&&!ozriFollowPlayer){ozriHealthy.material.rotation=Math.sin(now*.0027)*.018;ozriHealthy.position.y+=Math.sin(now*.0031)*.00035;}
 dustPoints.rotation.y=now*.000015;
 // water scroll
 TX.water.offset.x=(now*.00001)%1;
 // QTE marker
 if(qteOpen){qtePos+=qteDir*dt*67;if(qtePos>99){qtePos=99;qteDir=-1}if(qtePos<0){qtePos=0;qteDir=1}ui.qteMarker.style.left=qtePos+'%';}
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
})();
