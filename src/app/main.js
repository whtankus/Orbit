
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {calculatePlanetStates, heliocentricPosition, orbitalElementsAt, orbitalPath, observerEphemeris, EPHEMERIS_VALIDITY} from '../astronomy/index.js';
import {createPlanetarium} from '../planetarium/planetarium.js';
const $=id=>document.getElementById(id);
function applyOrbitTheme(theme,persist=false){
 const light=theme!=='dark';
 document.body.classList.toggle('orbit-light',light);
 const button=$('themeToggle');
 if(button){
  const action=light?'dark':'light';
  $('themeToggleLabel').textContent=action.toUpperCase()+' THEME';
  button.setAttribute('aria-label','Switch to '+action+' theme');
  button.setAttribute('aria-pressed',String(!light));
  button.title='Switch to '+action+' theme';
 }
 if(persist){try{localStorage.setItem('orbit-theme',light?'light':'dark')}catch(error){console.warn('Theme preference could not be saved.',error)}}
}
try{applyOrbitTheme(localStorage.getItem('orbit-theme')||'light')}catch(error){applyOrbitTheme('light')}
let simulationDate=new Date();
let lastDateDisplayUpdate=0;
const data={
Sun:{type:'G2V MAIN-SEQUENCE STAR',diameter:'1.39 million km',year:'—',day:'~25 Earth days',moons:'0',desc:'A magnetically active sphere of hot plasma. Its gravity dominates the Solar System, while nuclear fusion in its core releases the energy that warms our worlds.',fact:'More than 99.8% of the Solar System’s total mass is concentrated in the Sun.',texture:'2k_sun.jpg',radius:2.05,dist:0,color:0xffb45a,emissive:true,rotation:.08},
Mercury:{type:'TERRESTRIAL PLANET',diameter:'4,879 km',year:'88 Earth days',day:'58.6 Earth days',moons:'0',desc:'A small, ancient world with a heavily cratered surface. With almost no atmosphere to retain heat, Mercury experiences extreme temperature swings.',fact:'A solar day on Mercury lasts 176 Earth days — twice as long as its year.',texture:'2k_mercury.jpg',radius:.34,dist:5.1,color:0xa6a09a,rotation:.012,speed:4.15},
Venus:{type:'TERRESTRIAL PLANET',diameter:'12,104 km',year:'225 Earth days',day:'243 Earth days',moons:'0',desc:'A volcanic world hidden beneath thick clouds of sulphuric acid. Its dense carbon-dioxide atmosphere creates an intense greenhouse effect.',fact:'Venus rotates in the opposite direction to most planets, and its day is longer than its year.',texture:'2k_venus_surface.jpg',radius:.57,dist:7.2,color:0xd9a66f,rotation:-.004,speed:1.62},
Earth:{type:'TERRESTRIAL PLANET',diameter:'12,742 km',year:'365.25 days',day:'23h 56m',moons:'1',desc:'A water-rich rocky planet with a protective atmosphere and a global magnetic field. It is the only world known to host life.',fact:'Liquid water covers about 71% of Earth’s surface. Its atmosphere makes the sky blue and helps regulate the climate.',texture:'2k_earth_daymap.jpg',radius:.61,dist:9.6,color:0x4a9bce,rotation:.12,speed:1},
Mars:{type:'TERRESTRIAL PLANET',diameter:'6,779 km',year:'687 Earth days',day:'24h 37m',moons:'2',desc:'A cold desert world marked by ancient river valleys, enormous volcanoes and polar ice. Robotic explorers search its rocks for signs of past habitability.',fact:'Olympus Mons rises about 22 km above the surrounding plains — nearly three times Everest’s height.',texture:'2k_mars.jpg',radius:.43,dist:12.2,color:0xc66c4b,rotation:.1,speed:.53},
Jupiter:{type:'GAS GIANT',diameter:'139,820 km',year:'11.86 Earth years',day:'9h 56m',moons:'115 known',desc:'A vast hydrogen-and-helium world with turbulent cloud bands, powerful auroras and a deep system of faint rings. Its moon system is a miniature planetary laboratory.',fact:'The Great Red Spot is a giant anticyclonic storm that has persisted for at least centuries.',texture:'2k_jupiter.jpg',radius:1.28,dist:16.2,color:0xc69a75,rotation:.22,speed:.084},
Saturn:{type:'GAS GIANT',diameter:'116,460 km',year:'29.4 Earth years',day:'~10.7 hours',moons:'293 known',desc:'A low-density gas giant surrounded by an immense ring system made mostly of countless pieces of water ice, with rocky material mixed in.',fact:'Saturn’s main rings span up to about 282,000 km across, yet are remarkably thin in vertical depth.',texture:'2k_saturn.jpg',radius:1.06,dist:21.1,color:0xd6bd8a,rotation:.2,speed:.034,ring:true},
Uranus:{type:'ICE GIANT',diameter:'50,724 km',year:'84 Earth years',day:'17h 14m',moons:'29 known',desc:'A cold ice giant with a hydrogen, helium and methane atmosphere. Its extreme axial tilt gives it unusual seasons that last for decades.',fact:'Uranus rotates on its side, with an axial tilt of about 98 degrees.',texture:'2k_uranus.jpg',radius:.78,dist:25.7,color:0x9bd8dc,rotation:-.13,speed:.012,tilt:Math.PI/2.05},
Neptune:{type:'ICE GIANT',diameter:'49,244 km',year:'165 Earth years',day:'16h 6m',moons:'16 known',desc:'A distant, dark and frigid ice giant. Methane contributes to its blue colour, while supersonic winds sweep through its dynamic atmosphere.',fact:'Neptune’s existence was predicted mathematically before it was directly observed in 1846.',texture:'2k_neptune.jpg',radius:.76,dist:30.3,color:0x426bca,rotation:.14,speed:.006}
};
const names=Object.keys(data),textureBase='https://www.solarsystemscope.com/textures/download/';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x03050b);scene.fog=new THREE.FogExp2(0x03050b,.0019);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,500);camera.position.set(0,25,43);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.matchMedia('(max-width: 700px)').matches?1.2:1.55));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
$('space').appendChild(renderer.domElement);
// Cinematic HDR-style glow: emissive worlds and the solar corona bloom naturally.
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.62,.78,.74);
composer.addPass(bloomPass);composer.addPass(new OutputPass());
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.045;controls.minDistance=8;controls.maxDistance=95;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,0,0);controls.autoRotate=false;controls.enablePan=true;
scene.add(new THREE.AmbientLight(0x8092b7,.38));const sunLight=new THREE.PointLight(0xffe1b0,160,180,1.45);sunLight.position.set(0,0,0);scene.add(sunLight);
const loader=new THREE.TextureLoader();loader.crossOrigin='anonymous';const textures={};const planetObjects={};let selected='Earth',paused=false,showOrbits=true,showLabels=true,timeScale=1,elapsed=0;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let hovered=null;
// Deep star field: soft, antialiased stellar discs with a restrained near-field dust layer.
function starSpriteTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');const glow=ctx.createRadialGradient(32,32,0,32,32,31);glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.12,'rgba(225,240,255,.96)');glow.addColorStop(.34,'rgba(180,211,255,.34)');glow.addColorStop(1,'rgba(130,175,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas)}
const stellarDisc=starSpriteTexture();
function starField(count,radius,size,opacity){const g=new THREE.BufferGeometry(),p=new Float32Array(count*3),c=new Float32Array(count*3);for(let i=0;i<count;i++){const u=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u),r=radius*(.88+Math.random()*.12);p[i*3]=r*s*Math.cos(a);p[i*3+1]=r*u;p[i*3+2]=r*s*Math.sin(a);const tint=new THREE.Color().setHSL(.53+Math.random()*.16,.18,.65+Math.random()*.35);c[i*3]=tint.r;c[i*3+1]=tint.g;c[i*3+2]=tint.b;}g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));const m=new THREE.PointsMaterial({map:stellarDisc,size,vertexColors:true,transparent:true,opacity,sizeAttenuation:true,depthWrite:false,alphaTest:.025,blending:THREE.AdditiveBlending});const pts=new THREE.Points(g,m);scene.add(pts);return pts;}
const stars=starField(14500,190,.13,.94),dust=starField(4200,105,.065,.48);
// Soft luminous nebula clouds made from layered transparent sprites.
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),g=x.createRadialGradient(128,128,4,128,128,128);g.addColorStop(0,'rgba(98,139,220,.16)');g.addColorStop(.28,'rgba(58,85,160,.09)');g.addColorStop(1,'rgba(15,30,75,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)}
const nebulaMat=new THREE.SpriteMaterial({map:glowTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});for(let i=0;i<8;i++){const s=new THREE.Sprite(nebulaMat.clone());s.position.set((Math.random()-.5)*90,(Math.random()-.5)*35,-38-Math.random()*25);s.scale.set(35+Math.random()*30,18+Math.random()*18,1);s.material.rotation=Math.random()*Math.PI;scene.add(s)}
// Sun: emissive mapped photosphere and multiple restrained corona layers.
const sunGeo=new THREE.SphereGeometry(data.Sun.radius,96,96);const sunCanvas=document.createElement('canvas');sunCanvas.width=1024;sunCanvas.height=512;const sunCtx=sunCanvas.getContext('2d');const sunGradient=sunCtx.createLinearGradient(0,0,0,512);sunGradient.addColorStop(0,'#ffb34f');sunGradient.addColorStop(.5,'#fff0b0');sunGradient.addColorStop(1,'#e85a22');sunCtx.fillStyle=sunGradient;sunCtx.fillRect(0,0,1024,512);for(let i=0;i<850;i++){const x=Math.random()*1024,y=Math.random()*512,r=1+Math.random()*9;sunCtx.fillStyle='rgba(255,90,25,'+(Math.random()*.13)+')';sunCtx.beginPath();sunCtx.arc(x,y,r,0,Math.PI*2);sunCtx.fill()}const sunFallback=new THREE.CanvasTexture(sunCanvas);sunFallback.colorSpace=THREE.SRGBColorSpace;const sunMat=new THREE.MeshBasicMaterial({map:sunFallback,color:0xffffff});const sun=new THREE.Mesh(sunGeo,sunMat);scene.add(sun);function solarGlowTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),g=x.createRadialGradient(128,128,2,128,128,128);g.addColorStop(0,'rgba(255,248,218,.95)');g.addColorStop(.12,'rgba(255,207,126,.68)');g.addColorStop(.38,'rgba(255,143,62,.24)');g.addColorStop(1,'rgba(255,91,35,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)}
const sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:solarGlowTexture(),transparent:true,opacity:1.55,blending:THREE.AdditiveBlending,depthWrite:false}));sunHalo.scale.set(22,22,1);sun.add(sunHalo);
const sunCorona=new THREE.Mesh(new THREE.SphereGeometry(2.3,64,64),new THREE.MeshBasicMaterial({color:0xffa84c,transparent:true,opacity:.09,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));sun.add(sunCorona);
const sunOuterCorona=new THREE.Mesh(new THREE.SphereGeometry(2.58,64,64),new THREE.MeshBasicMaterial({color:0xff7b36,transparent:true,opacity:.035,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));sun.add(sunOuterCorona);
const ringMaterial=new THREE.MeshBasicMaterial({color:0xc7b38d,side:THREE.DoubleSide,transparent:true,opacity:.68,depthWrite:false});
const orbitLines={};const orbitGroup=new THREE.Group();scene.add(orbitGroup);
function sceneVectorFromEcliptic(v,scale=1){return new THREE.Vector3(v.x*scale,v.z*scale,-v.y*scale)}
function makeOrbit(name,sceneRadius){
 const elements=orbitalElementsAt(name,simulationDate),scale=sceneRadius/elements.a;
 const points=orbitalPath(name,simulationDate,240).map(p=>sceneVectorFromEcliptic(p,scale));
 const geo=new THREE.BufferGeometry().setFromPoints(points);
 const line=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:0x91a7c8,transparent:true,opacity:.2}));
 orbitGroup.add(line);return line;
}
function updatePlanetPositions(date=simulationDate){
 for(const [name,o] of Object.entries(planetObjects)){
  const state=heliocentricPosition(name,date),scale=o.d.dist/state.a;
  o.group.position.copy(sceneVectorFromEcliptic(state.positionAU,scale));
 }
}
function updateOrbitPaths(date=simulationDate){
 for(const [name,o] of Object.entries(planetObjects)){
  const elements=orbitalElementsAt(name,date),scale=o.d.dist/elements.a;
  const points=orbitalPath(name,date,240).map(p=>sceneVectorFromEcliptic(p,scale));
  o.orbit.geometry.dispose();o.orbit.geometry=new THREE.BufferGeometry().setFromPoints(points);
 }
}
function updateSelectedEphemerisStats(){
 if(!$('distanceFromSun')||!$('orbitalSpeed'))return;
 if(selected==='Sun'){$('distanceFromSun').textContent='CENTER';$('orbitalSpeed').textContent='—';return;}
 const state=calculatePlanetStates(simulationDate)[selected];
 if(!state)return;
 $('distanceFromSun').textContent=state.distanceAU.toFixed(3)+' AU';
 $('orbitalSpeed').textContent=state.speedKmSec.toFixed(2)+' km/s';
}
function setSimulationDate(value,updateSky=true){
 const next=value instanceof Date?new Date(value.getTime()):new Date(value);
 if(!Number.isFinite(next.getTime())){toast('INVALID SIMULATION DATE');return false}
 const year=next.getFullYear();
 if(year<EPHEMERIS_VALIDITY.startYear||year>EPHEMERIS_VALIDITY.endYear){
  toast('JPL APPROXIMATE MODEL IS VALID FOR 1800–2050');return false;
 }
 simulationDate=next;updatePlanetPositions(simulationDate);updateOrbitPaths(simulationDate);updateSelectedEphemerisStats();
 if($('simulationDate'))$('simulationDate').value=localDateValue(simulationDate);
 if($('simulationDateLabel'))$('simulationDateLabel').textContent=simulationDate.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}).toUpperCase();
 if($('telemetryDate'))$('telemetryDate').textContent=simulationDate.getFullYear()+'-'+String(simulationDate.getMonth()+1).padStart(2,'0')+'-'+String(simulationDate.getDate()).padStart(2,'0');
 if(updateSky&&$('skyDateTime')){$('skyDateTime').value=localDateValue(simulationDate);if(document.getElementById('skyPage')?.classList.contains('open'))drawSkyChart();}
 if($('comparePage')?.classList.contains('open'))renderPlanetComparison();
 return true;
}
// Immediate procedural albedo maps keep every world visibly textured while high-resolution maps load,
// and provide a graceful offline/CORS fallback instead of leaving featureless coloured spheres.
function makeFallbackPlanetTexture(name){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d');
 const palettes={
  Mercury:['#746f68','#aaa197','#4b4948'],Venus:['#b9824c','#e8c18a','#8e5c38'],
  Earth:['#073b68','#1676a0','#4b8d58'],Mars:['#713b2c','#c16d49','#e0a078'],
  Jupiter:['#9b7052','#e0c19a','#b78361'],Saturn:['#a48a61','#e3d0a5','#8b7657'],
  Uranus:['#4b9fae','#a5e0e5','#70c4ce'],Neptune:['#123c8b','#286bd0','#64a3e8']
 };
 const [base,light,dark]=palettes[name]||['#777','#aaa','#444'];
 ctx.fillStyle=base;ctx.fillRect(0,0,canvas.width,canvas.height);
 if(['Jupiter','Saturn','Uranus','Neptune'].includes(name)){
  for(let y=0;y<canvas.height;y++){
   const wave=Math.sin(y*.075)+Math.sin(y*.19)*.35+Math.sin(y*.013)*.8;
   const t=THREE.MathUtils.clamp(.5+wave*.19,0,1);
   ctx.fillStyle=t>.58?light:t<.37?dark:base;ctx.globalAlpha=.55;
   ctx.fillRect(0,y,canvas.width,1);
  }
  ctx.globalAlpha=1;
  if(name==='Jupiter'){
   const g=ctx.createRadialGradient(710,310,8,710,310,74);g.addColorStop(0,'#d89a70');g.addColorStop(.7,'#a9553e');g.addColorStop(1,'#7c493d');
   ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(710,310,78,38,-.12,0,Math.PI*2);ctx.fill();
  }
 }else if(name==='Earth'){
  // Stylized continent silhouettes on a deep ocean base.
  for(let i=0;i<34;i++){
   const x=Math.random()*canvas.width,y=35+Math.random()*(canvas.height-70);
   const rx=18+Math.random()*72,ry=8+Math.random()*34;
   ctx.beginPath();ctx.moveTo(x-rx,y);
   for(let j=0;j<=12;j++){const a=j/12*Math.PI*2,r=.68+Math.random()*.48;ctx.lineTo(x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r)}
   ctx.closePath();ctx.fillStyle=i%4===0?'#b3a56d':light;ctx.fill();
  }
 }else{
  // Rocky worlds: cratered terrain with subtle regional albedo variation.
  for(let i=0;i<260;i++){
   const x=Math.random()*canvas.width,y=Math.random()*canvas.height,r=2+Math.random()*19;
   const g=ctx.createRadialGradient(x-r*.25,y-r*.25,1,x,y,r);
   g.addColorStop(0,light);g.addColorStop(.72,base);g.addColorStop(1,dark);
   ctx.globalAlpha=.18+Math.random()*.34;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
 }
 ctx.globalAlpha=.08;
 for(let i=0;i<18000;i++){const x=Math.random()*canvas.width,y=Math.random()*canvas.height;ctx.fillStyle=Math.random()>.5?'#fff':'#050505';ctx.fillRect(x,y,1,1)}
 ctx.globalAlpha=1;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
const sphereSegments=window.matchMedia('(max-width:700px)').matches?80:128;
const sphereGeo=new THREE.SphereGeometry(1,sphereSegments,Math.round(sphereSegments*.75));
function makeSaturnRingTexture(){
 const size=768,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),pixels=image.data,centre=(size-1)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const radius=Math.hypot(x-centre,y-centre)/(size*.5),i=(y*size+x)*4;
  if(radius<.475||radius>1){pixels[i+3]=0;continue;}
  const band=Math.sin(radius*410)+.42*Math.sin(radius*1130)+.2*Math.sin(radius*2370);
  const gap=(radius>.755&&radius<.785)||(radius>.91&&radius<.922);
  const density=gap?.06:THREE.MathUtils.clamp(.55+band*.17,0,1);
  const warm=radius>.82?1:radius>.66?.88:.72;
  pixels[i]=Math.round((174+34*density)*warm);
  pixels[i+1]=Math.round((151+31*density)*warm);
  pixels[i+2]=Math.round((116+27*density)*warm);
  pixels[i+3]=Math.round(255*density*(.76+.2*Math.sin(radius*81)));
 }
 ctx.putImageData(image,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=renderer.capabilities.getMaxAnisotropy();texture.needsUpdate=true;return texture;
}
function makePlanet(name,d){const group=new THREE.Group();scene.add(group);
const surfaceFinish={Mercury:[.96,0],Venus:[.98,.04],Earth:[.68,.28],Mars:[.92,.02],Jupiter:[.9,.03],Saturn:[.86,.08],Uranus:[.72,.16],Neptune:[.68,.18]}[name]||[.82,0];
const material=new THREE.MeshPhysicalMaterial({map:makeFallbackPlanetTexture(name),color:0xffffff,roughness:surfaceFinish[0],metalness:0,clearcoat:surfaceFinish[1],clearcoatRoughness:.48});
const mesh=new THREE.Mesh(sphereGeo,material);mesh.scale.setScalar(d.radius);mesh.rotation.z=d.tilt||0;mesh.userData.body=name;group.add(mesh);
// Thin, planet-specific atmospheric scattering shells. These sit above the mapped surface.
if(['Earth','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'].includes(name)){
 const rimColour=name==='Earth'?'0.20,0.58,1.0':name==='Venus'?'0.98,0.66,0.34':name==='Mars'?'0.92,0.36,0.20':name==='Jupiter'?'0.92,0.66,0.42':name==='Saturn'?'0.90,0.76,0.54':'0.28,0.72,0.95';
 const rimStrength=name==='Earth'?.58:name==='Venus'?.38:name==='Mars'?.15:name==='Jupiter'?.25:name==='Saturn'?.2:.3;
 const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.045,64,64),new THREE.ShaderMaterial({vertexShader:'varying vec3 vNormal; varying vec3 vView; void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`varying vec3 vNormal;varying vec3 vView;void main(){float facing=max(dot(normalize(vNormal),normalize(vView)),0.0);float rim=pow(1.0-facing,2.6);float daySide=.35+.65*max(dot(normalize(vNormal),normalize(vec3(.4,.5,1.0))),0.0);gl_FragColor=vec4(${rimColour},rim*daySide*${rimStrength});}`,transparent:true,side:THREE.BackSide,depthWrite:false}));atmo.scale.setScalar(d.radius*1.065);group.add(atmo);
}
if(name==='Venus'){
 const haze=new THREE.Mesh(new THREE.SphereGeometry(1.018,64,64),new THREE.MeshBasicMaterial({map:makeCloudMap(),color:0xf2d2a0,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}));
 haze.scale.setScalar(d.radius*1.025);group.add(haze);
}
if(name==='Saturn'){
 const ring=new THREE.Mesh(
  new THREE.RingGeometry(d.radius*1.12,d.radius*2.35,384),
  new THREE.MeshStandardMaterial({map:makeSaturnRingTexture(),side:THREE.DoubleSide,transparent:true,roughness:.94,metalness:0,depthWrite:false})
 );
 ring.rotation.copy(new THREE.Euler(Math.PI/2.35,.12,0));ring.renderOrder=2;group.add(ring);
}
if(name==='Uranus'){const ring=new THREE.Mesh(new THREE.RingGeometry(d.radius*1.45,d.radius*1.95,128),new THREE.MeshBasicMaterial({color:0x8abfc3,side:THREE.DoubleSide,transparent:true,opacity:.24,depthWrite:false}));ring.rotation.x=Math.PI/2.1;group.add(ring)}
const orbit=makeOrbit(name,d.dist||0);orbitLines[name]=orbit;const angle=Math.random()*Math.PI*2;planetObjects[name]={group,mesh,material,angle,orbit,d};
loader.load(textureBase+d.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();material.map=t;material.color.set(0xffffff);material.needsUpdate=true;textures[name]=t;},undefined,()=>{console.warn('High-resolution texture unavailable; procedural surface remains active:',name)});
return group;}
for(const name of names){if(name==='Sun')continue;makePlanet(name,data[name]);}
updatePlanetPositions(simulationDate);
loader.load(textureBase+data.Sun.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();sun.material.map=t;sun.material.needsUpdate=true;},undefined,()=>console.warn('Sun texture unavailable; using procedural photosphere'));
// A small asteroid belt between Mars and Jupiter, deliberately sparse to preserve readability.
const beltGeo=new THREE.BufferGeometry(),beltPos=new Float32Array(2600*3);for(let i=0;i<2600;i++){const a=Math.random()*Math.PI*2,r=13.7+Math.random()*1.7,y=(Math.random()-.5)*.23;beltPos[i*3]=Math.cos(a)*r;beltPos[i*3+1]=y;beltPos[i*3+2]=Math.sin(a)*r;}beltGeo.setAttribute('position',new THREE.BufferAttribute(beltPos,3));const belt=new THREE.Points(beltGeo,new THREE.PointsMaterial({color:0xb9a88f,size:.045,transparent:true,opacity:.5,sizeAttenuation:true}));scene.add(belt);
// Minimal HUD labels are projected from 3D positions into screen space.
const labels={};for(const name of names.filter(n=>n!=='Sun')){const el=document.createElement('div');el.textContent=name.toUpperCase();el.style.cssText='position:fixed;z-index:2;pointer-events:none;font:8px DM Mono,monospace;letter-spacing:.14em;color:rgba(201,219,241,.78);text-shadow:0 2px 8px #000;white-space:nowrap;transform:translate(-50%,-50%);';document.body.appendChild(el);labels[name]=el;}
function buildNav(){ $('bodyStrip').innerHTML=names.map((n,i)=>`<button class="body-btn ${n===selected?'active':''}" data-name="${n}">${n.toUpperCase()}</button>`).join('');$('bodyStrip').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectBody(b.dataset.name,true)));}
function selectBody(name,focus=false){if(!data[name])return;selected=name;const d=data[name];$('index').textContent=String(names.indexOf(name)+1).padStart(2,'0')+' / 09';$('planetName').textContent=name;$('planetType').textContent=d.type;$('planetDesc').textContent=d.desc;$('diameter').textContent=d.diameter;$('year').textContent=d.year;$('day').textContent=d.day;$('moons').textContent=d.moons;$('fact').textContent=d.fact;
const preview=$('planetPreview');preview.style.background=d.emissive?'radial-gradient(circle at 40% 38%,#fff2c6,#ffae4b 45%,#9f3e19 100%)':`radial-gradient(circle at 34% 30%,${new THREE.Color(d.color).offsetHSL(0,0,.28).getStyle()},${new THREE.Color(d.color).getStyle()} 58%,#080b12 100%)`;preview.style.boxShadow=d.emissive?'0 0 34px #ffb75c88':'inset -15px -9px 20px #000b,0 0 28px #91cfff20';preview.style.borderRadius='50%';preview.style.outline=d.ring?'2px solid #c8b38a':'none';preview.style.outlineOffset=d.ring?'8px':'0';$('bodyStrip').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.name===name));
updateSelectedEphemerisStats();
if(focus){const obj=name==='Sun'?sun:planetObjects[name].group;const target=obj.getWorldPosition(new THREE.Vector3());const dir=new THREE.Vector3().subVectors(camera.position,controls.target).normalize();const distance=name==='Sun'?15:Math.max(7,d.radius*7.2);const destination=target.clone().add(dir.multiplyScalar(distance));animateCamera(destination,target);}}
let cameraTween=null;function animateCamera(position,target){soundEffect('travel');cameraTween={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),toTarget:target.clone(),start:performance.now(),duration:1050};}
function resetView(){cameraTween=null;camera.position.set(0,25,43);controls.target.set(0,0,0);controls.update();selectBody('Earth');toast('FULL SYSTEM VIEW RESTORED')}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),1900)}
function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const targets=Object.entries(planetObjects).map(([name,o])=>{o.mesh.userData.body=name;return o.mesh}).concat(sun);const hits=raycaster.intersectObjects(targets,false);if(hits.length){const name=hits[0].object.userData.body||'Sun';selectBody(name,true)} }
const celestialHover=document.createElement('div');celestialHover.className='celestial-hover';celestialHover.id='celestialHover';celestialHover.setAttribute('role','status');celestialHover.setAttribute('aria-live','polite');celestialHover.setAttribute('aria-hidden','true');document.body.append(celestialHover);
function hideCelestialHover(){celestialHover.classList.remove('visible');celestialHover.setAttribute('aria-hidden','true');hovered=null;document.body.classList.remove('is-hovering-celestial');}
renderer.domElement.addEventListener('click',pick);
renderer.domElement.addEventListener('dblclick',event=>{
 const rect=renderer.domElement.getBoundingClientRect();pointer.set(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);
 const targets=Object.entries(planetObjects).map(([name,o])=>{o.mesh.userData.body=name;return o.mesh}).concat(sun);
 const hit=raycaster.intersectObjects(targets,false)[0]?.object;if(!hit)return;
 const name=hit.userData.body||'Sun';selectBody(name,false);
 const object=name==='Sun'?sun:planetObjects[name].group;const target=object.getWorldPosition(new THREE.Vector3());
 const direction=new THREE.Vector3().subVectors(camera.position,target).normalize();const radius=name==='Sun'?data.Sun.radius:planetObjects[name].d.radius;
 animateCamera(target.clone().add(direction.multiplyScalar(Math.max(2.8,radius*3.4))),target);
 toast('CLOSE APPROACH · '+name.toUpperCase());
});
renderer.domElement.addEventListener('pointermove',e=>{
 const rect=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);
 const hits=raycaster.intersectObjects(Object.values(planetObjects).map(o=>o.mesh).concat(sun),false),hit=hits[0]?.object;
 renderer.domElement.style.cursor=hit?'pointer':'grab';
 if(!hit){hideCelestialHover();return;}
 const name=hit.userData.body||'Sun',profile=data[name];hovered=name;document.body.classList.add('is-hovering-celestial');
 celestialHover.innerHTML='<strong></strong><span></span>';celestialHover.querySelector('strong').textContent=name.toUpperCase();celestialHover.querySelector('span').textContent=profile.type+' · '+(name==='Sun'?'CENTRAL STAR':profile.diameter+' · '+profile.year);
 celestialHover.style.left=Math.min(e.clientX+16,innerWidth-210)+'px';celestialHover.style.top=Math.min(e.clientY+16,innerHeight-74)+'px';
 celestialHover.classList.add('visible');celestialHover.setAttribute('aria-hidden','false');
});
renderer.domElement.addEventListener('pointerleave',hideCelestialHover);
$('playBtn').addEventListener('click',()=>{paused=!paused;$('playBtn').innerHTML=paused?'▶&nbsp; PLAY':'Ⅱ&nbsp; PAUSE';toast(paused?'MOTION PAUSED':'MOTION RESUMED')});$('speed').addEventListener('input',e=>{timeScale=Number(e.target.value)===0?.01:Math.pow(10,(Number(e.target.value)-1)*.45);$('speedValue').textContent=timeScale.toFixed(2)+' d/s'});$('orbitsBtn').addEventListener('click',()=>{showOrbits=!showOrbits;orbitGroup.visible=showOrbits;$('orbitsBtn').classList.toggle('active',showOrbits)});$('labelsBtn').addEventListener('click',()=>{showLabels=!showLabels;Object.values(labels).forEach(el=>el.style.display=showLabels?'block':'none');$('labelsBtn').classList.toggle('active',showLabels)});$('resetBtn').addEventListener('click',resetView);$('helpBtn').addEventListener('click',()=>$('help').classList.add('open'));$('closeHelp').addEventListener('click',()=>$('help').classList.remove('open'));$('help').addEventListener('click',e=>{if(e.target===$('help'))$('help').classList.remove('open')});window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){$('playBtn').click();e.preventDefault()}if(e.key==='Escape')$('help').classList.remove('open');if(e.key.toLowerCase()==='r')resetView()});
buildNav();selectBody('Earth');
setSimulationDate(simulationDate,false);
const clock=new THREE.Clock();function updateLabels(){for(const [name,el] of Object.entries(labels)){const p=planetObjects[name].group.position.clone();p.y+=planetObjects[name].d.radius*1.6;p.project(camera);const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;el.style.left=x+'px';el.style.top=y+'px';el.style.opacity=(p.z<1&&x>0&&x<innerWidth&&y>0&&y<innerHeight&&showLabels)?'.85':'0';}}
function animate(){requestAnimationFrame(animate);if(document.hidden)return;const dt=Math.min(clock.getDelta(),.05);if(!paused){elapsed+=dt*timeScale;simulationDate=new Date(simulationDate.getTime()+dt*timeScale*86400000);updatePlanetPositions(simulationDate);for(const [name,o] of Object.entries(planetObjects)){const rotationDays={Mercury:58.646,Venus:-243.025,Earth:.99727,Mars:1.02596,Jupiter:.41354,Saturn:.444,Uranus:-.718,Neptune:.671};o.mesh.rotation.y+=dt*timeScale*2*Math.PI/rotationDays[name];}for(const m of moonObjects){const period=m.spec.periodDays||27.3217;m.angle+=dt*timeScale*2*Math.PI/period;m.mesh.position.set(Math.cos(m.angle)*m.spec.distance,Math.sin(m.angle*.7)*.025,Math.sin(m.angle)*m.spec.distance);}earthClouds.rotation.y+=dt*timeScale*.022;earthNightLights.rotation.y=planetObjects.Earth.mesh.rotation.y;sunHalo.material.rotation+=dt*.006;sunHalo.scale.setScalar(22+Math.sin(elapsed*.42)*.42);sun.rotation.y+=dt*timeScale*.025;sunCorona.rotation.y+=dt*.012;sunOuterCorona.rotation.y-=dt*.008;stars.rotation.y+=dt*.000025;dust.rotation.y-=dt*.00005;belt.rotation.y+=dt*.0003;if(performance.now()-lastDateDisplayUpdate>500){lastDateDisplayUpdate=performance.now();updateSelectedEphemerisStats();if($('comparePage')?.classList.contains('open'))renderPlanetComparison();$('simulationDateLabel').textContent=simulationDate.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}).toUpperCase();$('telemetryDate').textContent=simulationDate.getFullYear()+'-'+String(simulationDate.getMonth()+1).padStart(2,'0')+'-'+String(simulationDate.getDate()).padStart(2,'0');if(document.activeElement!==$('simulationDate'))$('simulationDate').value=localDateValue(simulationDate);}}
for(const [name,o] of Object.entries(planetObjects)){const active=hovered===name;const targetScale=active?1.105:1;o.group.scale.lerp(new THREE.Vector3(targetScale,targetScale,targetScale),1-Math.exp(-dt*(active?13:9)));o.material.emissive.setHex(active?0x173b5c:0x000000);o.material.emissiveIntensity=active?0.42:0;o.orbit.material.opacity=active?0.58:0.2;o.orbit.material.color.setHex(active?0x9edcff:0x91a7c8);}const sunActive=hovered==='Sun';sun.scale.lerp(new THREE.Vector3(sunActive?1.075:1,sunActive?1.075:1,sunActive?1.075:1),1-Math.exp(-dt*10));if(cameraTween){const t=Math.min(1,(performance.now()-cameraTween.start)/cameraTween.duration),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(cameraTween.from,cameraTween.to,e);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,e);if(t>=1)cameraTween=null;}controls.update();updateLabels();composer.render();}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.matchMedia('(max-width: 700px)').matches?1.2:1.55));composer.setSize(innerWidth,innerHeight);bloomPass.strength=window.matchMedia('(max-width: 700px)').matches ? 0.42 : 0.62;}window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){clock.stop();}else{clock.start();resize();}});

// ORBIT 2.0 — expanded instruments, moons, history archive and sky chart.
const compareA=$('comparePlanetA'),compareB=$('comparePlanetB');
function periodInDays(value){
 const match=String(value).match(/[~]?([\d.]+)\s*(?:Earth\s*)?(years?|days?)/i);
 if(!match)return 0;const amount=Number(match[1]);return /year/i.test(match[2])?amount*365.25:amount;
}
function rotationInHours(value){
 const s=String(value);
 const days=s.match(/[~]?([\d.]+)\s*(?:Earth\s*)?days?/i);if(days)return Number(days[1])*24;
 const clock=s.match(/([\d.]+)\s*h(?:ours?)?\s*(?:(\d+)\s*m)?/i);if(clock)return Number(clock[1])+Number(clock[2]||0)/60;
 const hours=s.match(/[~]?([\d.]+)\s*(?:Earth\s*)?hours?/i);return hours?Number(hours[1]):0;
}
function diameterInKm(value){const match=String(value).match(/[\d,]+(?:\.\d+)?/);return match?Number(match[0].replace(/,/g,'')):0}
function renderPlanetComparison(){
 if(!compareA||!compareB)return;
 const nameA=compareA.value,nameB=compareB.value;
 if(!data[nameA]||!data[nameB]||nameA===nameB)return;
 const a=data[nameA],b=data[nameB],states=calculatePlanetStates(simulationDate);
 const stateA=states[nameA],stateB=states[nameB];
 const diameterA=diameterInKm(a.diameter),diameterB=diameterInKm(b.diameter),maxDiameter=Math.max(diameterA,diameterB);
 const orbSize=value=>Math.round(62+38*Math.sqrt(value/maxDiameter));
 const colour=value=>'#'+value.toString(16).padStart(6,'0');
 const card=(name,spec,side,size)=>'<article class="compare-world-card"><div class="compare-world-top"><span>'+side+'</span><span>'+spec.type+'</span></div><div class="compare-world-identity"><div class="compare-planet-orb" style="--planet-tone:'+colour(spec.color)+';--planet-size:'+size+'px"></div><div><h3>'+name+'</h3><p>'+spec.desc+'</p></div></div><div class="compare-world-meta"><span>MOONS LISTED IN PROFILE</span><strong>'+spec.moons+'</strong></div></article>';
 $('compareWorlds').innerHTML=card(nameA,a,'WORLD A',orbSize(diameterA))+card(nameB,b,'WORLD B',orbSize(diameterB));
 const metrics=[
  {label:'Diameter',valueA:a.diameter,valueB:b.diameter,nA:diameterA,nB:diameterB},
  {label:'Orbital period',valueA:a.year,valueB:b.year,nA:periodInDays(a.year),nB:periodInDays(b.year)},
  {label:'Rotation period',valueA:a.day,valueB:b.day,nA:rotationInHours(a.day),nB:rotationInHours(b.day)},
  {label:'Current distance from Sun',valueA:stateA.distanceAU.toFixed(3)+' AU',valueB:stateB.distanceAU.toFixed(3)+' AU',nA:stateA.distanceAU,nB:stateB.distanceAU},
  {label:'Current orbital speed',valueA:stateA.speedKmSec.toFixed(2)+' km/s',valueB:stateB.speedKmSec.toFixed(2)+' km/s',nA:stateA.speedKmSec,nB:stateB.speedKmSec}
 ];
 $('compareMetrics').innerHTML=metrics.map(metric=>{
  const max=Math.max(metric.nA,metric.nB,0.000001);
  const widthA=Math.max(2,metric.nA/max*100),widthB=Math.max(2,metric.nB/max*100);
  return '<div class="compare-metric-row"><div class="compare-metric-label">'+metric.label+'</div><div class="compare-metric-value"><strong>'+metric.valueA+'</strong><div class="compare-track"><i style="width:'+widthA.toFixed(1)+'%"></i></div></div><div class="compare-metric-value"><strong>'+metric.valueB+'</strong><div class="compare-track compare-track-b"><i style="width:'+widthB.toFixed(1)+'%"></i></div></div></div>';
 }).join('');
 $('compareDate').textContent=simulationDate.toLocaleDateString([], {year:'numeric',month:'short',day:'numeric'});
 const wider=diameterA>=diameterB?nameA:nameB,smaller=diameterA>=diameterB?nameB:nameA;
 const ratio=Math.max(diameterA,diameterB)/Math.max(1,Math.min(diameterA,diameterB));
 const longer=periodInDays(a.year)>=periodInDays(b.year)?nameA:nameB;
 $('compareInsight').innerHTML='<span class="compare-insight-label">QUICK DISCOVERY</span><p><strong>'+wider+'</strong> is about <strong>'+ratio.toFixed(1)+'× wider</strong> than '+smaller+'. '+longer+' takes longer to complete one orbit around the Sun. Distance and orbital speed above use the current simulation date.</p>';
}
function handleCompareChange(changed){
 const other=changed===compareA?compareB:compareA;
 if(changed.value===other.value){const replacement=[...other.options].find(option=>option.value!==changed.value);if(replacement)other.value=replacement.value;}
 renderPlanetComparison();
}
compareA?.addEventListener('change',()=>handleCompareChange(compareA));
compareB?.addEventListener('change',()=>handleCompareChange(compareB));
$('themeToggle')?.addEventListener('click',()=>applyOrbitTheme(document.body.classList.contains('orbit-light')?'dark':'light',true));
const navButtons=[...document.querySelectorAll('[data-page]')];
function openPage(which){const active=!!which&&which!=='explore';document.querySelectorAll('.page-overlay').forEach(p=>{const visible=active&&p.id===which+'Page';p.classList.toggle('open',visible);p.setAttribute('aria-hidden',String(!visible));});document.querySelector('.ui').classList.toggle('page-mode',active);navButtons.forEach(b=>{const selected=b.dataset.page===(which||'explore');b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});if(which==='sky')drawSkyChart();if(which==='compare')renderPlanetComparison();if(which==='history'||which==='research'||which==='compare'||which==='discover'||which==='missions')soundEffect('history');const pageTrack={explore:'solar',compare:'solar',history:'chronicle',sky:'planetarium',research:'galaxy'}[which||'explore'];const activePageTrack=which==='discover'?'galaxy':pageTrack;if(activePageTrack&&soundtracks[activePageTrack]&&musicTimer&&activeTrack!==activePageTrack){stopMusicTrack();activeTrack=activePageTrack;musicTimer=setInterval(soundtrackPulse,soundtracks[activeTrack].interval);soundtrackPulse();updateTrackUI();}}

const missionProfiles={
 voyager1:{name:'Voyager 1',destination:'INTERSTELLAR SPACE',status:'ACTIVE SPACECRAFT',summary:'Launched in 1977, Voyager 1 used gravity assists at Jupiter and Saturn before continuing outward. In 2012 it crossed the heliopause, entering interstellar space while still returning scientific data.',launch:'05 SEP 1977',agency:'NASA',distance:'Interstellar mission',link:'https://science.nasa.gov/mission/voyager/',objectives:['Study the giant planets and their moons during close flybys.','Measure magnetic fields, energetic particles and plasma beyond the heliosphere.','Carry the Golden Record as a message from Earth.'],milestones:[['05 SEP 1977','Launch from Cape Canaveral'],['05 MAR 1979','Jupiter closest approach'],['12 NOV 1980','Saturn closest approach'],['25 AUG 2012','Crossed the heliopause into interstellar space']],note:'Interstellar space here means the region beyond the heliosphere; Voyager 1 has not left the Milky Way.'},
 cassini:{name:'Cassini–Huygens',destination:'SATURN & TITAN',status:'COMPLETED · 1997–2017',summary:'An international mission that transformed our understanding of Saturn, its rings and moons. The Huygens probe descended through Titan’s atmosphere and reached its surface in 2005. Cassini ended with a deliberate dive into Saturn in 2017.',launch:'15 OCT 1997',agency:'NASA / ESA / ASI',distance:'Saturn system',link:'https://science.nasa.gov/mission/cassini/',objectives:['Study Saturn’s atmosphere, magnetosphere and dynamic rings.','Investigate icy moons, including Enceladus and Titan.','Deliver the Huygens probe to Titan’s surface.'],milestones:[['15 OCT 1997','Launch from Cape Canaveral'],['01 JUL 2004','Entered orbit around Saturn'],['14 JAN 2005','Huygens landed on Titan'],['15 SEP 2017','Grand Finale: spacecraft entered Saturn’s atmosphere']],note:'Cassini’s mission ended as planned to avoid any possibility of contaminating potentially habitable moons.'},
 perseverance:{name:'Mars 2020 · Perseverance',destination:'JEZERO CRATER, MARS',status:'ACTIVE ROVER MISSION',summary:'Perseverance explores Jezero crater, an ancient environment that once hosted a lake and river delta. It studies rocks and climate, searches for signs of ancient microbial life, and collects carefully selected samples for possible future return.',launch:'30 JUL 2020',agency:'NASA',distance:'Mars surface',link:'https://science.nasa.gov/mission/mars-2020-perseverance/',objectives:['Search for evidence of ancient microbial life in Jezero crater.','Characterize geology and past environmental conditions.','Collect and cache rock and regolith samples for a potential future return campaign.'],milestones:[['30 JUL 2020','Launch from Cape Canaveral'],['18 FEB 2021','Touchdown in Jezero crater'],['19 APR 2021','Ingenuity completed its first powered flight on another planet'],['2021 ONWARD','Rover science, sample collection and surface exploration']],note:'The sample-return concept is a separate future campaign; Perseverance itself is the rover collecting and caching samples.'},
 artemis:{name:'Artemis II',destination:'EARTH–MOON SYSTEM',status:'PLANNED CREWED LUNAR TEST FLIGHT',summary:'Artemis II is designed as the first crewed flight of NASA’s Space Launch System and Orion spacecraft. The mission plan sends four astronauts around the Moon and back to Earth, testing crewed deep-space systems before later lunar surface missions.',launch:'MISSION DATE SUBJECT TO NASA UPDATES',agency:'NASA / CSA',distance:'Lunar flyby trajectory',link:'https://www.nasa.gov/mission/artemis-ii/',objectives:['Test Orion life-support and crew systems with astronauts aboard.','Validate navigation, communications and operations in deep space.','Conduct a crewed lunar flyby and return to Earth.'],milestones:[['MISSION PREPARATION','Integrated launch vehicle and spacecraft checks'],['EARTH ORBIT','Crewed systems checkout after launch'],['LUNAR FLYBY','Planned trajectory around the Moon'],['EARTH RETURN','High-speed atmospheric re-entry and splashdown']],note:'This is a mission profile, not a live countdown. NASA’s official page is the source for the latest schedule and readiness updates.'}
};
function renderMission(key='voyager1'){
 const mission=missionProfiles[key];if(!mission||!$('missionDetail'))return;
 document.querySelectorAll('[data-mission]').forEach(button=>{const active=button.dataset.mission===key;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 $('missionDetail').innerHTML='<div class="mission-detail-top"><div><span class="mission-destination">'+mission.destination+'</span><h3>'+mission.name+'</h3><p>'+mission.summary+'</p></div><span class="mission-status">'+mission.status+'</span></div><div class="mission-facts"><div><small>LAUNCH</small><strong>'+mission.launch+'</strong></div><div><small>AGENCY</small><strong>'+mission.agency+'</strong></div><div><small>DESTINATION</small><strong>'+mission.distance+'</strong></div></div><div class="mission-content-grid"><section><h4>MISSION OBJECTIVES</h4><ul>'+mission.objectives.map(item=>'<li>'+item+'</li>').join('')+'</ul></section><section><h4>KEY MILESTONES</h4><ol class="mission-timeline">'+mission.milestones.map(item=>'<li><time>'+item[0]+'</time><span>'+item[1]+'</span></li>').join('')+'</ol></section></div><p class="mission-caveat">'+mission.note+'</p>';
 $('missionSourceLink').href=mission.link;
}
document.querySelectorAll('[data-mission]').forEach(button=>button.addEventListener('click',()=>renderMission(button.dataset.mission)));
renderMission();

function closePages(){openPage(null)}
navButtons.forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
document.querySelectorAll('[data-close-page]').forEach(b=>b.addEventListener('click',closePages));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePages()});
// Add subtle instrument HUD effects without obstructing 3D selection.
const hudReticle=document.createElement('div');hudReticle.id='hudReticle';hudReticle.innerHTML='<span></span><i></i>';hudReticle.style.cssText='position:fixed;left:50%;top:50%;width:28px;height:28px;transform:translate(-50%,-50%);z-index:2;pointer-events:none;opacity:.26;border:1px solid #9edcff55;border-radius:50%;box-shadow:0 0 20px #73cfff16';hudReticle.firstElementChild.style.cssText='position:absolute;width:3px;height:3px;background:#bceaff;border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)';hudReticle.lastElementChild.style.cssText='position:absolute;inset:-7px;border:1px dashed #9edcff30;border-radius:50%';document.body.append(hudReticle);
// Procedural cloud deck over Earth.
function makeCloudMap(){const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);for(let i=0;i<1750;i++){const px=Math.random()*c.width,py=Math.random()*c.height,rx=3+Math.random()*25,ry=1+Math.random()*8,g=x.createRadialGradient(px,py,0,px,py,rx);g.addColorStop(0,'rgba(255,255,255,'+(0.025+Math.random()*.11)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.ellipse(px,py,rx,ry,Math.random()*.6,0,Math.PI*2);x.fill()}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const earthClouds=new THREE.Mesh(new THREE.SphereGeometry(data.Earth.radius*1.012,64,64),new THREE.MeshStandardMaterial({map:makeCloudMap(),transparent:true,opacity:.48,roughness:1,depthWrite:false}));planetObjects.Earth.group.add(earthClouds);
const cloudLight=new THREE.PointLight(0x9dcfff,.5,4);cloudLight.position.set(1,1,1);earthClouds.add(cloudLight);
const earthCloudMaterial=earthClouds.material;
loader.load(textureBase+'2k_earth_clouds.jpg',texture=>{
 texture.colorSpace=THREE.NoColorSpace;
 earthCloudMaterial.alphaMap=texture;earthCloudMaterial.opacity=.62;earthCloudMaterial.needsUpdate=true;
},undefined,()=>console.warn('Earth cloud texture unavailable; using procedural cloud deck'));
const earthNightMaterial=new THREE.ShaderMaterial({
 uniforms:{uNightMap:{value:null}},
 vertexShader:`varying vec2 vUv;varying vec3 vNormalView;varying vec3 vWorldPosition;
 void main(){vUv=uv;vec4 worldPosition=modelMatrix*vec4(position,1.0);vWorldPosition=worldPosition.xyz;vNormalView=normalize(normalMatrix*normal);gl_Position=projectionMatrix*viewMatrix*worldPosition;}`,
 fragmentShader:`uniform sampler2D uNightMap;varying vec2 vUv;varying vec3 vNormalView;varying vec3 vWorldPosition;
 void main(){vec3 sunDirection=normalize((viewMatrix*vec4(-vWorldPosition,0.0)).xyz);float sunFacing=dot(normalize(vNormalView),sunDirection);float nightSide=1.0-smoothstep(-0.12,0.08,sunFacing);vec3 lights=texture2D(uNightMap,vUv).rgb;float signal=max(max(lights.r,lights.g),lights.b);float alpha=nightSide*smoothstep(0.025,0.22,signal)*0.92;gl_FragColor=vec4(lights*vec3(1.0,0.72,0.38)*1.65,alpha);}`,
 transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
});
const earthNightLights=new THREE.Mesh(new THREE.SphereGeometry(data.Earth.radius*1.004,96,72),earthNightMaterial);
earthNightLights.renderOrder=3;planetObjects.Earth.group.add(earthNightLights);
loader.load(textureBase+'2k_earth_nightmap.jpg',texture=>{
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
 earthNightMaterial.uniforms.uNightMap.value=texture;earthNightMaterial.needsUpdate=true;
},undefined,()=>console.warn('Earth night map unavailable'));

// Add scaled natural satellites with individual orbital paths.
const moonSpecs=[
{name:'Moon',host:'Earth',radius:.105,distance:1.18,speed:.62,periodDays:27.3217,color:0xb8b9bb},
{name:'Io',host:'Jupiter',radius:.105,distance:1.72,speed:1.35,periodDays:1.7691378,color:0xd6b66d},
{name:'Europa',host:'Jupiter',radius:.087,distance:2.05,speed:1.02,periodDays:3.551181,color:0xc6bba2},
{name:'Ganymede',host:'Jupiter',radius:.14,distance:2.43,speed:.72,periodDays:7.154553,color:0x9b8c7d},
{name:'Callisto',host:'Jupiter',radius:.125,distance:2.85,speed:.49,periodDays:16.689018,color:0x6d6761},
{name:'Titan',host:'Saturn',radius:.13,distance:2.1,speed:.56,periodDays:15.945,color:0xc58d4d},
{name:'Phobos',host:'Mars',radius:.045,distance:.68,speed:1.8,periodDays:.31891,color:0x8c8174},
{name:'Deimos',host:'Mars',radius:.035,distance:.82,speed:1.2,periodDays:1.263,color:0xb0a08e},
{name:'Titania',host:'Uranus',radius:.07,distance:1.38,speed:.66,periodDays:8.706,color:0x9ca9ad},
{name:'Triton',host:'Neptune',radius:.075,distance:1.42,speed:-.54,periodDays:5.877,color:0xb3c6d4}
];
const moonObjects=[];
for(const spec of moonSpecs){const host=planetObjects[spec.host];if(!host)continue;const orbitGeo=new THREE.BufferGeometry(),pts=[];for(let k=0;k<100;k++){const a=k/100*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*spec.distance,0,Math.sin(a)*spec.distance))}orbitGeo.setFromPoints(pts);const orbitLine=new THREE.LineLoop(orbitGeo,new THREE.LineBasicMaterial({color:0x9ecfff,transparent:true,opacity:.16}));host.group.add(orbitLine);const moon=new THREE.Mesh(new THREE.SphereGeometry(spec.radius,24,24),new THREE.MeshStandardMaterial({color:spec.color,roughness:.95,metalness:0}));host.group.add(moon);moonObjects.push({mesh:moon,spec,angle:Math.random()*Math.PI*2,orbitLine});}
let moonsVisible=true,cloudsVisible=true;
function setMoonVisibility(){moonObjects.forEach(m=>{m.mesh.visible=moonsVisible;m.orbitLine.visible=moonsVisible});toast(moonsVisible?'SATELLITE SYSTEMS ONLINE':'SATELLITES HIDDEN')}
function setCloudVisibility(){earthClouds.visible=cloudsVisible;toast(cloudsVisible?'ATMOSPHERIC CLOUD LAYER ON':'CLOUD LAYER OFF')}
function toggleCinema(){document.body.classList.toggle('cinematic-mode');$('cinemaExit').textContent='EXIT CINEMATIC MODE'}
$('moonsBtn').addEventListener('click',()=>{moonsVisible=!moonsVisible;$('moonsBtn').classList.toggle('active',moonsVisible);setMoonVisibility()});
$('cloudsBtn').addEventListener('click',()=>{cloudsVisible=!cloudsVisible;$('cloudsBtn').classList.toggle('active',cloudsVisible);setCloudVisibility()});
$('cinemaBtn').addEventListener('click',toggleCinema);$('cinemaExit').addEventListener('click',toggleCinema);
// Cosmic history: ten evidence-based milestones with a playable timeline.
const epochs=[
{era:'ERA 01 · THE EARLY UNIVERSE',title:'The first light',label:'COSMIC MICROWAVE BACKGROUND · AFTERGLOW OF THE EARLY UNIVERSE',date:'380,000 YEARS AFTER THE BIG BANG',age:'13.8B',temp:'~3,000 K',text:'About 380,000 years after the Big Bang, the universe cooled enough for electrons and nuclei to combine into neutral atoms. Light could finally travel freely. We observe this ancient afterglow today as the cosmic microwave background.',color:'#ffb968',scale:1},
{era:'ERA 02 · FIRST STRUCTURES',title:'The cosmic dark ages',label:'GRAVITY AMPLIFIES TINY DENSITY DIFFERENCES',date:'100–200 MILLION YEARS AFTER THE BIG BANG',age:'13.6B',temp:'FIRST STARS',text:'Gravity drew hydrogen and helium into denser regions. The first stars ignited, ending the cosmic dark ages and beginning the production of heavier elements inside stellar interiors.',color:'#9d91ff',scale:.75},
{era:'ERA 03 · GALAXY FORMATION',title:'Galaxies take shape',label:'STARS GATHER INTO THE FIRST GALACTIC SYSTEMS',date:'~1 BILLION YEARS AFTER THE BIG BANG',age:'12.8B',temp:'STAR FORMATION',text:'Small structures merged into larger galaxies. Star formation, supernovae and galaxy interactions gradually enriched the universe with elements heavier than helium.',color:'#8cbbff',scale:.8},
{era:'ERA 04 · MILKY WAY',title:'Our galaxy evolves',label:'A SPIRAL GALAXY GROWS THROUGH BILLIONS OF YEARS',date:'BILLIONS OF YEARS AGO',age:'~10B',temp:'GALACTIC EVOLUTION',text:'The Milky Way assembled over time through mergers and continuing star formation. Older stellar populations preserve clues to its early history; the Sun formed much later in a disk of enriched gas.',color:'#b4a0ff',scale:1.05},
{era:'ERA 05 · SOLAR NEBULA',title:'A star is born',label:'A COLLAPSING CLOUD FORMS THE SUN AND PLANETARY DISK',date:'~4.6 BILLION YEARS AGO',age:'4.6B',temp:'PROTO-SUN',text:'A region of a molecular cloud collapsed under gravity. The young Sun formed at the centre, while a rotating disk of gas and dust surrounded it — the raw material from which planets, moons and small bodies assembled.',color:'#ffd28a',scale:1.15},
{era:'ERA 06 · PLANET FORMATION',title:'Worlds assemble',label:'DUST GRAINS COLLIDE · PLANETESIMALS GROW',date:'4.56–4.5 BILLION YEARS AGO',age:'4.5B',temp:'HOT, COLLIDING ROCK',text:'Dust stuck together, building pebbles, planetesimals and planetary embryos. Repeated collisions and gravitational interactions shaped the architecture of the Solar System.',color:'#f2b47c',scale:1.25},
{era:'ERA 07 · EARLY EARTH',title:'A restless young Earth',label:'GIANT IMPACTS · CORE FORMATION · MOON ORIGIN',date:'~4.5 BILLION YEARS AGO',age:'4.5B',temp:'MOLTEN SURFACE',text:'Earth differentiated into layers as dense material sank toward its core. A giant impact with a Mars-sized body likely produced debris that later accreted into the Moon.',color:'#e8a26c',scale:1.1},
{era:'ERA 08 · FIRST LIFE',title:'Life leaves a trace',label:'ANCIENT ROCKS PRESERVE EVIDENCE OF EARLY LIFE',date:'AT LEAST 3.5 BILLION YEARS AGO',age:'3.5B+',temp:'MICROBIAL LIFE',text:'The oldest widely discussed evidence points to microbial life by at least 3.5 billion years ago, with some older claims still debated. Life transformed Earth’s chemistry over immense spans of time.',color:'#85d5c4',scale:.9},
{era:'ERA 09 · OXYGENATION',title:'An atmosphere transforms',label:'PHOTOSYNTHESIS CHANGES THE PLANET',date:'~2.4 BILLION YEARS AGO',age:'2.4B',temp:'OXYGEN RISE',text:'Oxygen produced by photosynthetic microbes accumulated in the atmosphere during the Great Oxidation Event. This reshaped ocean and atmospheric chemistry and opened new evolutionary possibilities.',color:'#7bc9d5',scale:.95},
{era:'ERA 10 · COMPLEX LIFE',title:'Complex life diversifies',label:'MULTICELLULAR ORGANISMS TRANSFORM EARTH’S BIOSPHERE',date:'HUNDREDS OF MILLIONS OF YEARS AGO',age:'<1B',temp:'OXYGEN-RICH OCEANS',text:'Over long spans of evolutionary time, multicellular organisms diversified in the oceans. Later, plants and animals colonised land, reshaping ecosystems and the chemistry of the atmosphere.',color:'#8ed6b5',scale:1.08},
{era:'ERA 11 · TECHNOLOGICAL CIVILISATION',title:'A planet learns to look outward',label:'RADIO TELESCOPES · SPACECRAFT · SPACE OBSERVATORIES',date:'THE LAST CENTURY',age:'RECENT',temp:'SCIENTIFIC INSTRUMENTS',text:'Humans developed instruments that observe beyond visible light, measure cosmic backgrounds and send robotic spacecraft to other worlds. These measurements let us test models of planetary and cosmic evolution.',color:'#9cc8ff',scale:1.22},
{era:'ERA 12 · PRESENT DAY',title:'A world that observes',label:'HUMANS STUDY THE COSMOS FROM ONE SMALL PLANET',date:'TODAY · 13.8 BILLION YEARS OF COSMIC HISTORY',age:'0',temp:'~288 K GLOBAL MEAN',text:'On Earth, life has evolved into organisms capable of studying the universe that made them. Telescopes, spacecraft and laboratories let us reconstruct cosmic history from light, rocks and particles.',color:'#83caff',scale:1.3}
];
let epochIndex=0,historyTimer=null;
function renderEpoch(i){epochIndex=Math.max(0,Math.min(epochs.length-1,i));const e=epochs[epochIndex];$('historyStage').dataset.epoch=String(epochIndex);$('historyRange').value=epochIndex;$('timelineProgress').textContent=String(epochIndex+1).padStart(2,'0')+' / 10';$('historyEra').textContent=e.era;$('historyTitle').textContent=e.title;$('historyText').textContent=e.text;$('historyStageLabel').textContent=e.label;$('historyStageDate').textContent=e.date;$('historyAge').textContent=e.age;$('historyTemp').textContent=e.temp;$('historyEraTiny').textContent=e.era.replace(/^ERA \d+ · /,'');$('epochCore').style.transform='translate(-50%,-50%) scale('+e.scale+')';$('historyStage').style.setProperty('--epoch-accent',e.color);}
$('historyRange').addEventListener('input',e=>{stopHistory();renderEpoch(Number(e.target.value))});
$('historyPrev').addEventListener('click',()=>{stopHistory();renderEpoch(epochIndex-1)});
$('historyNext').addEventListener('click',()=>{stopHistory();renderEpoch(epochIndex+1)});
function stopHistory(){if(historyTimer){clearInterval(historyTimer);historyTimer=null}$('historyPlay').innerHTML='▶ &nbsp; PLAY TIMELINE';$('historyPlay').setAttribute('aria-pressed','false')}
function playHistory(){if(historyTimer){stopHistory();return}$('historyPlay').innerHTML='Ⅱ &nbsp; PAUSE TIMELINE';$('historyPlay').setAttribute('aria-pressed','true');if(epochIndex>=epochs.length-1)renderEpoch(0);historyTimer=setInterval(()=>{if(epochIndex>=epochs.length-1){stopHistory();return}renderEpoch(epochIndex+1)},4200)}
$('historyPlay').addEventListener('click',playHistory);renderEpoch(0);
// Night sky: measured catalogue, official constellation figures and observer projection.
function localDateValue(d){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes())}
$('skyDateTime').value=localDateValue(new Date());
$('skyDateTime').min='1800-01-01T00:00';$('skyDateTime').max='2050-12-31T23:59';
let planetarium=null,planetariumPromise=null;
function drawPlanetObserverReadout(date,latitude,longitude){
 const host=$('skyPlanetReadout');if(!host)return;
 const year=date.getFullYear();
 if(year<EPHEMERIS_VALIDITY.startYear||year>EPHEMERIS_VALIDITY.endYear){
  host.innerHTML='<div class="sky-planet-empty">JPL APPROXIMATE POSITIONS AVAILABLE FOR 1800–2050 ONLY.</div>';return;
 }
 const bodies=['Sun','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'];
 const rows=bodies.map(body=>{
  const p=observerEphemeris(body,date,latitude,longitude);
  const altitude=(p.altitudeDeg>=0?'+':'')+p.altitudeDeg.toFixed(1)+'°';
  const azimuth=p.azimuthDeg.toFixed(0).padStart(3,'0')+'°';
  return '<div class="sky-planet-row"><strong>'+body+'</strong><span>'+altitude+'</span><span class="'+(p.aboveHorizon?'planet-state-up':'planet-state-down')+'">'+azimuth+'</span></div>';
 }).join('');
 host.innerHTML='<div class="sky-planet-head"><span>BODY</span><span>ALTITUDE</span><span>AZIMUTH</span></div>'+rows;
}
async function ensurePlanetarium(){
 if(planetarium)return planetarium;
 if(planetariumPromise)return planetariumPromise;
 planetariumPromise=createPlanetarium({
  canvas:$('skyCanvas'),
  constellationSelect:$('constellationSelect'),
  constellationTitle:$('constellationTitle'),
  constellationText:$('constellationText'),
  dateInput:$('skyDateTime'),
  latitudeInput:$('skyLat'),
  longitudeInput:$('skyLon'),
  showBoundariesInput:$('skyShowBoundaries'),
  showLinesInput:$('skyShowLines'),
  showLabelsInput:$('skyShowLabels'),
  magnitudeInput:$('skyMagnitude'),
  magnitudeValue:$('skyMagnitudeValue'),
  starSearchInput:$('skyStarSearch'),
  starSearchResults:$('skyStarResults'),
  selectedStarOutput:$('skySelectedStar'),
  chartStats:$('skyCatalogStats'),
  chartStatus:$('skyChartStatus'),
  onObserverChange:({date,latitude,longitude})=>drawPlanetObserverReadout(date,latitude,longitude)
 }).then(value=>{planetarium=value;return value;}).catch(error=>{
  planetariumPromise=null;
  $('skyChartStatus').textContent='PLANETARIUM LOAD FAILED · '+error.message;
  console.error('ORBIT planetarium failed to load:',error);
  throw error;
 });
 return planetariumPromise;
}
function drawSkyChart(){
 ensurePlanetarium().then(p=>p.render()).catch(()=>{});
}
$('skyNow').addEventListener('click',()=>{
 $('skyDateTime').value=localDateValue(new Date());drawSkyChart();soundEffect('chart');
});
$('skyReset').addEventListener('click',()=>{
 $('skyLat').value='28.61';$('skyLon').value='77.21';$('skyLocationStatus').textContent='Default observer coordinates restored.';drawSkyChart();
});
function shiftSkyTime(hours=0,days=0){
 const date=new Date($('skyDateTime').value);
 if(!Number.isFinite(date.getTime()))return;
 date.setHours(date.getHours()+hours);date.setDate(date.getDate()+days);
 $('skyDateTime').value=localDateValue(date);drawSkyChart();soundEffect('chart');
}
$('skyBackHour').addEventListener('click',()=>shiftSkyTime(-1));
$('skyNextHour').addEventListener('click',()=>shiftSkyTime(1));
$('skyNextDay').addEventListener('click',()=>shiftSkyTime(0,1));
$('skyTonight').addEventListener('click',()=>{
 const date=new Date();date.setHours(21,0,0,0);if(new Date().getHours()>=21)date.setDate(date.getDate()+1);
 $('skyDateTime').value=localDateValue(date);drawSkyChart();soundEffect('chart');
});
$('skyLocate').addEventListener('click',()=>{
 const status=$('skyLocationStatus');
 if(!navigator.geolocation){status.textContent='Location is not supported by this browser.';return;}
 status.textContent='Requesting location permission…';
 navigator.geolocation.getCurrentPosition(position=>{
  $('skyLat').value=position.coords.latitude.toFixed(4);
  $('skyLon').value=position.coords.longitude.toFixed(4);
  status.textContent='Observer location updated · '+position.coords.latitude.toFixed(2)+'°, '+position.coords.longitude.toFixed(2)+'°';
  drawSkyChart();soundEffect('chart');
 },error=>{
  status.textContent=error.code===1?'Location permission denied. Enter coordinates manually.':'Could not determine location. Check browser permissions.';
 },{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
});
function updateSkyZoomLabel(value){$('skyZoomReset').textContent=Math.round(value*100)+'%'}
$('skyZoomIn').addEventListener('click',()=>ensurePlanetarium().then(view=>updateSkyZoomLabel(view.zoom(.1))).catch(()=>{}));
$('skyZoomOut').addEventListener('click',()=>ensurePlanetarium().then(view=>updateSkyZoomLabel(view.zoom(-.1))).catch(()=>{}));
$('skyZoomReset').addEventListener('click',()=>ensurePlanetarium().then(view=>updateSkyZoomLabel(view.resetZoom())).catch(()=>{}));
document.querySelectorAll('[data-sky-constellation]').forEach(button=>button.addEventListener('click',()=>{
 ensurePlanetarium().then(view=>{view.selectConstellation(button.dataset.skyConstellation);soundEffect('chart')}).catch(()=>{});
}));
document.querySelectorAll('[data-sky-star]').forEach(button=>button.addEventListener('click',()=>{
 const input=$('skyStarSearch');input.value=button.dataset.skyStar;input.dispatchEvent(new Event('input',{bubbles:true}));soundEffect('chart');
}));

// Deep-sky atlas: NASA telescope imagery linked to the constellation sky map.
// New entries use original procedural illustrations, not telescope photographs.
function galaxyArtwork(kind){const canvas=document.createElement('canvas');canvas.width=720;canvas.height=480;const ctx=canvas.getContext('2d');const bg=ctx.createRadialGradient(360,240,8,360,240,420);bg.addColorStop(0,'#17233d');bg.addColorStop(.55,'#090f20');bg.addColorStop(1,'#02050c');ctx.fillStyle=bg;ctx.fillRect(0,0,720,480);let seed=kind.split('').reduce((a,ch)=>a+ch.charCodeAt(0),0);const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<1050;i++){const x=rand()*720,y=rand()*480,r=.35+rand()*1.35;ctx.fillStyle='rgba(220,235,255,'+(.18+rand()*.7)+')';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.save();ctx.translate(360,240);ctx.rotate(kind==='barred' ? -.18 : kind==='edgeon' ? .12 : 0);ctx.scale(1,kind==='edgeon'?.22:kind==='barred'?.55:.64);const arms=kind==='barred'?2:kind==='edgeon'?3:4;for(let arm=0;arm<arms;arm++){for(let i=0;i<520;i++){const t=i/520,r=12+t*205,a=arm*Math.PI*2/arms+t*5.7,x=Math.cos(a)*r,y=Math.sin(a)*r,alpha=(1-t)*(.28+rand()*.5);ctx.fillStyle=kind==='edgeon'?'rgba(255,195,135,'+alpha+')':rand()>.52?'rgba(111,177,255,'+alpha+')':'rgba(255,174,132,'+alpha+')';ctx.beginPath();ctx.arc(x,y,.7+rand()*2.1*(1-t),0,Math.PI*2);ctx.fill()}}if(kind==='barred'){ctx.fillStyle='rgba(255,208,156,.48)';ctx.fillRect(-125,-9,250,18)}const core=ctx.createRadialGradient(0,0,2,0,0,80);core.addColorStop(0,'rgba(255,247,222,.98)');core.addColorStop(.16,'rgba(255,207,151,.65)');core.addColorStop(1,'rgba(255,166,120,0)');ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,80,0,Math.PI*2);ctx.fill();ctx.restore();return canvas.toDataURL('image/jpeg',.88)}
const deepSkyCatalog=[
 {id:'andromeda',name:'Andromeda Galaxy',catalog:'M31 · NGC 224',type:'SPIRAL GALAXY',distance:'~2.5 MILLION LIGHT-YEARS',constellation:'And',image:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/hubble/releases/2012/01/STScI-01EVVHBN057NF9YF8SZ6K3Q2PQ.tif?w=1200',credit:'NASA / NOAO',description:'A vast spiral galaxy and the nearest major galactic neighbour to the Milky Way. It is a member of our Local Group.'},
 {id:'whirlpool',name:'Whirlpool Galaxy',catalog:'M51 · NGC 5194',type:'INTERACTING SPIRAL',distance:'~23 MILLION LIGHT-YEARS',constellation:'CVn',image:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/hubble/releases/1996/04/STScI-01EVTAPW3CHJF1XCHXVW16CB1F.tif?w=1200',credit:'NASA / ESA / STScI',description:'A face-on spiral galaxy whose graceful arms and companion galaxy reveal how gravity shapes galactic structure.'},
 {id:'sombrero',name:'Sombrero Galaxy',catalog:'M104 · NGC 4594',type:'EDGE-ON LENTICULAR',distance:'~29 MILLION LIGHT-YEARS',constellation:'Vir',image:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/11/STScI-01JCGZ1J3640GDB30E1CTHN4YD.png?fit=clip&h=1200&w=1800',credit:'NASA / ESA / CSA / STScI',description:'A nearly edge-on galaxy with a bright central bulge and a prominent dusty disk, observed here in infrared light by Webb.'},
 {id:'triangulum',name:'Triangulum Galaxy',catalog:'M33 · NGC 598',type:'SPIRAL GALAXY · HUBBLE',distance:'~3 MILLION LIGHT-YEARS',constellation:'Tri',image:'https://cdn.esahubble.org/archives/images/screen/heic1901a.jpg',credit:'ESA / Hubble · NASA',description:'A nearby spiral galaxy in the Local Group. Hubble resolved millions of stars and star-forming regions across its broad disk.'},
 {id:'ngc1365',name:'Great Barred Spiral',catalog:'NGC 1365',type:'BARRED SPIRAL · WEBB + HUBBLE',distance:'~56 MILLION LIGHT-YEARS',constellation:'For',image:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2024/01/STScI-01HM9XB51VSDZS2T5T4C088V4S.png?crop=faces%2Cfocalpoint&fit=clip&h=2085&w=2617',credit:'NASA / ESA / CSA / STScI · PHANGS',description:'A grand-design barred spiral observed by Webb and Hubble, revealing glowing dust lanes and star-forming regions.'},
 {id:'m83',name:'Southern Pinwheel',catalog:'M83 · NGC 5236',type:'SPIRAL GALAXY · NASA GALEX',distance:'~15 MILLION LIGHT-YEARS',constellation:'Hya',image:'https://images-assets.nasa.gov/image/PIA04629/PIA04629~medium.jpg',credit:'NASA / JPL-Caltech · GALEX',description:'A luminous southern spiral galaxy with extensive ultraviolet emission tracing young stars and star-forming regions.'},
 {id:'pinwheel',name:'Pinwheel Galaxy',catalog:'M101 · NGC 5457',type:'FACE-ON SPIRAL · ORIGINAL ILLUSTRATION',distance:'~25 MILLION LIGHT-YEARS',constellation:'UMa',image:galaxyArtwork('spiral'),credit:'ORBIT procedural illustration · not telescope data',description:'A face-on spiral with broad arms, bright star-forming regions and a disk nearly twice the diameter of the Milky Way.'},
 {id:'ngc1300',name:'Barred Spiral Galaxy',catalog:'NGC 1300',type:'BARRED SPIRAL · ORIGINAL ILLUSTRATION',distance:'~61 MILLION LIGHT-YEARS',constellation:'Eri',image:galaxyArtwork('barred'),credit:'ORBIT procedural illustration · not telescope data',description:'A classic barred spiral: its central bar connects to two major arms, while dust lanes and young star clusters trace the disk.'},
 {id:'m82',name:'Cigar Galaxy',catalog:'M82 · NGC 3034',type:'EDGE-ON STARBURST · ORIGINAL ILLUSTRATION',distance:'~12 MILLION LIGHT-YEARS',constellation:'UMa',image:galaxyArtwork('edgeon'),credit:'ORBIT procedural illustration · not telescope data',description:'A nearby starburst galaxy viewed nearly edge-on, with intense star formation and powerful outflows from its central regions.'}
];
let selectedDeepSky=deepSkyCatalog[0];
const deepSkyGrid=$('deepSkyGrid');
if(deepSkyGrid){
 deepSkyGrid.innerHTML=deepSkyCatalog.map((object,index)=>'<button class="deep-sky-card" type="button" data-deep-sky="'+object.id+'" aria-pressed="'+(index===0)+'"><span class="deep-sky-image"><img src="'+object.image+'" alt="'+object.name+(object.credit.includes('ORBIT')?' original ORBIT illustration':' telescope image')+'" loading="lazy" decoding="async"><span class="deep-sky-type">'+object.type+'</span></span><span class="deep-sky-card-copy"><strong>'+object.name+'</strong><small>'+object.catalog+' · '+object.distance+'</small><span>'+object.description+'</span></span></button>').join('');
 const showDeepSky=object=>{
  selectedDeepSky=object;
  $('deepSkyDetailTitle').textContent=object.name+' · '+object.catalog;
  $('deepSkyDetailCopy').textContent=object.description+' Image credit: '+object.credit+'.';
  $('deepSkyDetailMeta').textContent=object.distance;
  deepSkyGrid.querySelectorAll('[data-deep-sky]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.deepSky===object.id)));
  ensurePlanetarium().then(view=>view.selectConstellation(object.constellation)).catch(()=>{});
 };
 deepSkyGrid.querySelectorAll('[data-deep-sky]').forEach(card=>card.addEventListener('click',()=>{
  const object=deepSkyCatalog.find(item=>item.id===card.dataset.deepSky);if(object)showDeepSky(object);
 }));
}
const skyWorldNames=['Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'];
const skyWorldGrid=$('skyWorldGrid');
let selectedSkyWorld='Earth';
function renderSkyWorlds(){
 if(!skyWorldGrid)return;
 skyWorldGrid.innerHTML=skyWorldNames.map(name=>{
  const spec=data[name];
  return '<button class="sky-world-card" type="button" data-world-name="'+name+'" aria-pressed="'+(name===selectedSkyWorld)+'"><span class="sky-world-sphere '+name.toLowerCase()+'" style="--world-map:url(\''+textureBase+spec.texture+'\')" aria-hidden="true"></span><strong>'+name+'</strong><small>'+spec.type+'</small><em>'+spec.diameter+'</em></button>';
 }).join('');
}
function selectSkyWorld(name){
 const spec=data[name];if(!spec)return;selectedSkyWorld=name;
 $('skyWorldDetailTitle').textContent=name;
 $('skyWorldDetailCopy').textContent=spec.desc;
 $('skyWorldDetailStats').textContent=spec.diameter+' · '+spec.year+' orbital period · '+spec.moons+' moons';
 skyWorldGrid?.querySelectorAll('[data-world-name]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.worldName===name)));
}
renderSkyWorlds();
selectSkyWorld('Earth');
skyWorldGrid?.querySelectorAll('[data-world-name]').forEach(card=>card.addEventListener('click',()=>selectSkyWorld(card.dataset.worldName)));
$('skyWorldFocus')?.addEventListener('click',()=>{const name=selectedSkyWorld;openPage(null);selectBody(name,true);});
/* Cosmic Discovery Observatory: curated facts, exoplanets, nebulae, events and local field notes. */
const discoveryFacts=[
 {title:'A day on Venus is longer than its year.',copy:'Venus rotates so slowly that one rotation takes about 243 Earth days, while one orbit around the Sun takes about 225 Earth days.',art:'venus'},
 {title:'A teaspoon of neutron-star matter would be unimaginably heavy.',copy:'Neutron stars pack roughly stellar mass into a sphere only about 20 kilometres across. Their matter is supported by extreme quantum and nuclear physics.',art:'neutron'},
 {title:'The Milky Way and Andromeda are approaching each other.',copy:'The two large galaxies are moving toward a future interaction over billions of years. Their stars are so far apart that direct stellar collisions are expected to be rare.',art:'galaxy'},
 {title:'Some exoplanets orbit two stars.',copy:'Circumbinary planets travel around both members of a binary star system, much like the fictional world Tatooine — but these are real discoveries.',art:'binary'},
 {title:'Black holes do not act like cosmic vacuum cleaners.',copy:'At a sufficient distance, their gravity behaves like that of any other object with the same mass. The extreme effects occur close to the event horizon.',art:'blackhole'},
 {title:'The Sun contains almost all the mass in our Solar System.',copy:'More than 99.8% of the Solar System’s mass is concentrated in the Sun, which dominates the system’s gravitational architecture.',art:'sun'},
 {title:'Nebulae can be stellar birthplaces and stellar remains.',copy:'Some nebulae are clouds where new stars form; others are expanding shells of gas expelled by dying stars or supernova explosions.',art:'nebula'},
 {title:'A galaxy can contain billions of stars.',copy:'Galaxies are gravitationally bound systems of stars, gas, dust and dark matter. Their structures range from compact dwarfs to enormous spirals and ellipticals.',art:'galaxy'}
];
let discoveryIndex=0;
function renderDiscoveryFact(){const fact=discoveryFacts[discoveryIndex];if(!fact||!$('discoveryTitle'))return;$('discoveryNumber').textContent='DISCOVERY '+String(discoveryIndex+1).padStart(2,'0')+' / '+String(discoveryFacts.length).padStart(2,'0');$('discoveryTitle').textContent=fact.title;$('discoveryCopy').textContent=fact.copy;$('discoveryArt').dataset.art=fact.art;}
$('nextDiscovery')?.addEventListener('click',()=>{discoveryIndex=(discoveryIndex+1)%discoveryFacts.length;renderDiscoveryFact();});
renderDiscoveryFact();
const exoplanets=[
 {id:'trappist-1e',name:'TRAPPIST-1e',type:'ROCKY · HABITABLE-ZONE CANDIDATE',distance:'~40 light-years',year:'~6.1 Earth days',fact:'A terrestrial planet in the compact TRAPPIST-1 system. Its potential habitability depends on its atmosphere and stellar environment.',source:'https://science.nasa.gov/exoplanet-catalog/trappist-1-e/',tone:'coral'},
 {id:'proxima-b',name:'Proxima Centauri b',type:'TERRESTRIAL · NEAREST KNOWN EXOPLANET',distance:'~4.2 light-years',year:'~11.2 Earth days',fact:'Orbits the nearest star to the Sun. Its red-dwarf host can produce powerful flares that may affect the planet’s atmosphere.',source:'https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/',tone:'blue'},
 {id:'51-pegasi-b',name:'51 Pegasi b',type:'HOT JUPITER · GAS GIANT',distance:'~50 light-years',year:'~4.2 Earth days',fact:'The first exoplanet discovered orbiting a Sun-like star, announced in 1995. Its discovery transformed modern exoplanet science.',source:'https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/',tone:'gold'},
 {id:'psr-j2322',name:'PSR J2322−2650b',type:'PULSAR-ORBITING · EXTREME WORLD',distance:'~750 light-years',year:'~7.8 hours',fact:'Webb observations revealed an unusual helium- and carbon-rich atmosphere. Strong tides distort this Jupiter-mass planet into a lemon-like shape in the artist concept.',source:'https://science.nasa.gov/asset/webb/exoplanet-psr-j2322-2650b-artists-concept/',tone:'violet'}
];
const nebulae=[
 {id:'pillars-creation',name:'Pillars of Creation',catalog:'M16 · EAGLE NEBULA',kind:'WEBB NIRCAM IMAGE',distance:'~6,500 light-years',copy:'A star-forming region of gas and dust inside the Eagle Nebula. Webb’s infrared view reveals young stars emerging from dense pillars.',image:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/10/STScI-01GGF8H15VZ09MET9HFBRQX4S3.png?fit=clip&h=1200&w=700',credit:'NASA, ESA, CSA, STScI',source:'https://science.nasa.gov/asset/webb/pillars-of-creation-nircam-image/',real:true},
 {id:'crab-nebula',name:'Crab Nebula',catalog:'M1 · SUPERNOVA REMNANT',kind:'ORBIT CONCEPT ART',distance:'~6,500 light-years',copy:'The expanding remnant of a supernova recorded by observers in 1054. A rapidly spinning neutron star powers the central nebula.',image:'',credit:'ORBIT original visualization',source:'https://science.nasa.gov/asset/hubble/crab-nebula/',art:'crab'},
 {id:'carina-nebula',name:'Carina Nebula',catalog:'NGC 3372 · STAR-FORMING REGION',kind:'ORBIT CONCEPT ART',distance:'~7,500 light-years',copy:'A vast, active stellar nursery sculpted by intense radiation and stellar winds from massive young stars.',image:'',credit:'ORBIT original visualization',source:'https://science.nasa.gov/universe/nebulae/',art:'carina'}
];
const cosmicEvents=[
 {id:'supernova',name:'Supernova',kind:'STELLAR EXPLOSION',copy:'A star’s catastrophic end can forge and disperse heavy elements into space, enriching the material from which future stars and planets form.',art:'event-supernova'},
 {id:'neutron-star',name:'Neutron stars & pulsars',kind:'ULTRA-DENSE REMNANTS',copy:'The collapsed cores of some massive stars. Pulsars sweep beams of radiation through space as they rotate.',art:'event-pulsar'},
 {id:'gamma-ray',name:'Gamma-ray bursts',kind:'EXTREME HIGH-ENERGY FLASHES',copy:'Brief, extraordinarily energetic flashes associated with events such as some massive-star collapses and neutron-star mergers.',art:'event-grb'},
 {id:'gravitational-waves',name:'Gravitational waves',kind:'RIPPLES IN SPACETIME',copy:'Accelerating massive objects, including merging black holes and neutron stars, produce ripples in spacetime that detectors can measure.',art:'event-waves'}
];
const discoveryEscape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const exoplanetGrid=$('exoplanetGrid');
if(exoplanetGrid)exoplanetGrid.innerHTML=exoplanets.map(p=>'<article class="discover-card exoplanet-card"><div class="discover-card-art exo-art '+p.tone+'"><span></span><i></i><b></b></div><div class="discover-card-body"><small>'+p.type+'</small><h4>'+p.name+'</h4><div class="discover-card-meta">'+p.distance+' <span>·</span> '+p.year+'</div><p>'+p.fact+'</p><div class="discover-card-actions"><a href="'+p.source+'" target="_blank" rel="noopener">NASA PROFILE ↗</a><button type="button" data-save-discovery="'+p.id+'" data-save-title="'+p.name+'" data-save-kind="EXOPLANET">＋ SAVE</button></div></div></article>').join('');
const nebulaGrid=$('nebulaGrid');
if(nebulaGrid)nebulaGrid.innerHTML=nebulae.map(n=>'<article class="discover-card nebula-card"><a class="nebula-card-image '+(n.art||'')+'" href="'+n.source+'" target="_blank" rel="noopener" aria-label="Open source for '+n.name+'">'+(n.image?'<img src="'+n.image+'" alt="'+n.name+' — '+n.kind+'; '+n.credit+'" loading="lazy" decoding="async">':'<span class="nebula-art-label">ORBIT ORIGINAL VISUALIZATION</span>')+'<span class="nebula-type">'+n.kind+'</span></a><div class="discover-card-body"><small>'+n.catalog+'</small><h4>'+n.name+'</h4><div class="discover-card-meta">'+n.distance+'</div><p>'+n.copy+'</p><div class="discover-card-actions"><a href="'+n.source+'" target="_blank" rel="noopener">SOURCE & IMAGE CREDIT ↗</a><button type="button" data-save-discovery="'+n.id+'" data-save-title="'+n.name+'" data-save-kind="NEBULA">＋ SAVE</button></div></div></article>').join('');
const cosmicEventGrid=$('cosmicEventGrid');
if(cosmicEventGrid)cosmicEventGrid.innerHTML=cosmicEvents.map(e=>'<article class="event-card"><div class="event-art '+e.art+'"><i></i><b></b></div><div><small>'+e.kind+'</small><h4>'+e.name+'</h4><p>'+e.copy+'</p><button type="button" data-save-discovery="'+e.id+'" data-save-title="'+e.name+'" data-save-kind="COSMIC EVENT">＋ SAVE</button></div></article>').join('');
const favoriteKey='orbit-discoveries-v1';
let savedDiscoveries=[];try{savedDiscoveries=JSON.parse(localStorage.getItem(favoriteKey)||'[]');if(!Array.isArray(savedDiscoveries))savedDiscoveries=[];}catch(error){savedDiscoveries=[];}
function renderFavorites(){const list=$('favoritesList');if(!list)return;if(!savedDiscoveries.length){list.innerHTML='<p class="favorites-empty">No saved discoveries yet. Use the save controls on any card to add one here.</p>';return;}list.innerHTML=savedDiscoveries.map(item=>'<div class="favorite-item"><span><small>'+discoveryEscape(item.kind)+'</small><strong>'+discoveryEscape(item.title)+'</strong></span><button type="button" data-remove-discovery="'+discoveryEscape(item.id)+'" aria-label="Remove '+discoveryEscape(item.title)+'">REMOVE</button></div>').join('');}
function persistFavorites(){try{localStorage.setItem(favoriteKey,JSON.stringify(savedDiscoveries));}catch(error){console.warn('Could not save ORBIT field notes in this browser.',error);}renderFavorites();}
document.addEventListener('click',event=>{const save=event.target.closest('[data-save-discovery]');if(save){const id=save.dataset.saveDiscovery;if(savedDiscoveries.some(item=>item.id===id)){toast('ALREADY IN YOUR FIELD LOG');return;}savedDiscoveries.push({id,title:save.dataset.saveTitle,kind:save.dataset.saveKind});persistFavorites();save.textContent='✓ SAVED';save.disabled=true;toast('ADDED TO FIELD LOG');return;}const remove=event.target.closest('[data-remove-discovery]');if(remove){savedDiscoveries=savedDiscoveries.filter(item=>item.id!==remove.dataset.removeDiscovery);persistFavorites();document.querySelectorAll('[data-save-discovery="'+remove.dataset.removeDiscovery+'"]').forEach(button=>{button.disabled=false;button.textContent='＋ SAVE';});}});
$('clearDiscoveries')?.addEventListener('click',()=>{savedDiscoveries=[];persistFavorites();document.querySelectorAll('[data-save-discovery]').forEach(button=>{button.disabled=false;button.textContent='＋ SAVE';});toast('FIELD LOG CLEARED');});
renderFavorites();
document.querySelectorAll('[data-save-discovery]').forEach(button=>{if(savedDiscoveries.some(item=>item.id===button.dataset.saveDiscovery)){button.textContent='✓ SAVED';button.disabled=true;}});
function saveFieldNote(id,title,kind){if(savedDiscoveries.some(item=>item.id===id)){toast('ALREADY IN YOUR FIELD LOG');return;}savedDiscoveries.push({id,title,kind});persistFavorites();toast('ADDED TO FIELD LOG');}
$('saveDeepSky')?.addEventListener('click',()=>saveFieldNote('galaxy-'+selectedDeepSky.id,selectedDeepSky.name,'GALAXY'));
$('saveSkyWorld')?.addEventListener('click',()=>saveFieldNote('planet-'+selectedSkyWorld,selectedSkyWorld,'PLANET'));
const bhMass=$('blackHoleMassRange'),bhSpin=$('blackHoleSpinRange');
function updateBlackHole(){if(!bhMass||!bhSpin)return;const mass=Number(bhMass.value),spin=Number(bhSpin.value),label=spin<.25?'SLOW':spin<.7?'MODERATE':'RAPID';$('blackHoleMass').textContent=(mass>=1000?'1 billion':mass+' million')+' solar masses';$('blackHoleMassValue').textContent=mass.toLocaleString()+' million M☉';$('blackHoleSpin').textContent=spin.toFixed(2)+' · '+label;$('blackHoleSpinValue').textContent=spin.toFixed(2);$('blackHoleVisual').style.setProperty('--bh-spin',String(spin));$('blackHoleVisual').style.setProperty('--bh-disk-tilt',(spin*24-12)+'deg');$('blackHoleExplainer').textContent='This conceptual system represents a '+label.toLowerCase()+'-spinning black hole with a mass of about '+(mass*1000000).toLocaleString()+' solar masses. Spin affects the spacetime geometry close to the horizon; this artwork does not calculate a physical horizon image.';}
bhMass?.addEventListener('input',updateBlackHole);bhSpin?.addEventListener('input',updateBlackHole);updateBlackHole();
const scaleProfiles=[
 {name:'Earth',category:'TERRESTRIAL PLANET',diameter:'12,742 km diameter',description:'Our home world — a useful starting point for cosmic scale.',size:10},
 {name:'Jupiter',category:'GAS GIANT',diameter:'139,820 km diameter',description:'The largest planet in the Solar System, more than eleven Earths wide.',size:24},
 {name:'The Sun',category:'G-TYPE MAIN-SEQUENCE STAR',diameter:'~1.39 million km diameter',description:'A star so large that about 1.3 million Earths could fit inside it by volume.',size:48},
 {name:'Betelgeuse',category:'RED SUPERGIANT',diameter:'~1 billion km across (approximate)',description:'A variable red supergiant whose size changes; its scale is shown as an order-of-magnitude illustration.',size:82},
 {name:'Outer Solar System',category:'PLANETARY SYSTEM',diameter:'Tens of billions of kilometres',description:'The planetary region stretches far beyond Neptune into the distant Kuiper Belt.',size:110},
 {name:'Milky Way',category:'BARRED SPIRAL GALAXY',diameter:'~100,000 light-years across',description:'Our galaxy contains hundreds of billions of stars and is vastly larger than any individual star system.',size:138}
];
const scaleRange=$('scaleRange');
function updateScale(){if(!scaleRange)return;const profile=scaleProfiles[Number(scaleRange.value)];$('scaleName').textContent=profile.name;$('scaleCategory').textContent=profile.category;$('scaleDiameter').textContent=profile.diameter;$('scaleDescription').textContent=profile.description;$('scaleOrb').style.setProperty('--scale-size',profile.size+'px');$('scaleOrb').dataset.scale=String(scaleRange.value);}
scaleRange?.addEventListener('input',updateScale);updateScale();
$('discoverPage')?.querySelector('[data-open-sky]')?.addEventListener('click',event=>{event.preventDefault();openPage('sky');});
/* Mission Control: searchable destinations, camera presets and live telemetry. */
const commandDeck=$('commandDeck'),commandSearch=$('commandSearch'),commandResults=$('commandResults');
const missionCommands=[
...names.map(n=>({name:n,detail:data[n].type+' · inspect celestial profile',run:()=>selectBody(n,true)})),
{name:'RESEARCH LIBRARY',detail:'Open curated NASA and IAU astronomy references',run:()=>openPage('research')},
...moonObjects.map(m=>({name:m.spec.name,detail:'NATURAL SATELLITE · '+m.spec.host,run:()=>{const p=m.mesh.getWorldPosition(new THREE.Vector3()),dir=new THREE.Vector3().subVectors(camera.position,controls.target).normalize();animateCamera(p.clone().add(dir.multiplyScalar(3.2)),p);selectBody(m.spec.host);toast('TRACKING '+m.spec.name.toUpperCase())}})),
{name:'SYSTEM OVERVIEW',detail:'Return to a wide view of the complete Solar System',run:resetView},
{name:'TOP-DOWN VIEW',detail:'Align the camera above the orbital plane',run:()=>{const t=controls.target.clone();animateCamera(t.clone().add(new THREE.Vector3(0,48,.01)),t);toast('TOP-DOWN OBSERVATION')}},
{name:'EDGE-ON VIEW',detail:'Observe the orbital plane from the side',run:()=>{const t=controls.target.clone();animateCamera(t.clone().add(new THREE.Vector3(0,2,52)),t);toast('EDGE-ON OBSERVATION')}},
{name:'TOGGLE ORBIT PATHS',detail:'Show or hide planetary orbit guides',run:()=>$('orbitsBtn').click()},
{name:'TOGGLE SATELLITES',detail:'Show or hide natural satellite systems',run:()=>$('moonsBtn').click()},
{name:'TOGGLE CLOUD LAYER',detail:'Show or hide Earth’s procedural clouds',run:()=>$('cloudsBtn').click()},
{name:'CAPTURE OBSERVATORY',detail:'Save the current 3D view as a PNG image',run:()=>{try{const a=document.createElement('a');a.download='orbit-observatory.png';a.href=renderer.domElement.toDataURL('image/png');a.click();toast('OBSERVATORY FRAME CAPTURED')}catch(e){toast('CAPTURE UNAVAILABLE IN THIS BROWSER')}}}
];
function renderCommands(query=''){const q=query.trim().toLowerCase();const filtered=missionCommands.filter(c=>(c.name+' '+c.detail).toLowerCase().includes(q));commandResults.replaceChildren();filtered.forEach(c=>{const b=document.createElement('button');b.className='command-item';const strong=document.createElement('b');strong.textContent=c.name;const small=document.createElement('small');small.textContent=c.detail;b.append(strong,small);b.addEventListener('click',()=>{c.run();commandDeck.classList.remove('open');commandSearch.value='';renderCommands()});commandResults.append(b)});if(!filtered.length){const empty=document.createElement('div');empty.className='command-foot';empty.textContent='NO MATCHING DESTINATIONS OR COMMANDS';commandResults.append(empty)}}
function openCommandDeck(){commandDeck.classList.add('open');renderCommands();commandSearch.value='';setTimeout(()=>commandSearch.focus(),30)}
$('commandOpen').addEventListener('click',openCommandDeck);$('commandClose').addEventListener('click',()=>commandDeck.classList.remove('open'));commandDeck.addEventListener('click',e=>{if(e.target===commandDeck)commandDeck.classList.remove('open')});commandSearch.addEventListener('input',e=>renderCommands(e.target.value));
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandDeck()}if(e.key==='Escape')commandDeck.classList.remove('open')});
let telemetryTick=0;function updateTelemetry(){const range=camera.position.distanceTo(controls.target);$('telemetryFocus').textContent=selected.toUpperCase();$('telemetryRange').textContent=range.toFixed(1)+' SCENE UNITS';$('telemetryTime').textContent=(Math.floor(elapsed/60)%60).toString().padStart(2,'0')+':'+Math.floor(elapsed%60).toString().padStart(2,'0');}
const telemetryTimer=setInterval(updateTelemetry,500);

/* ORBIT 3.0 — layered cinematic sound design. Starts only after an explicit visitor gesture. */
let soundEnabled=false,audioCtx=null,masterGain=null,spaceReverb=null,reverbReturn=null,noiseBuffer=null,musicBus=null;
let ambientNodes=[],ambienceEnabled=true,effectsEnabled=true;
function makeImpulse(ctx,seconds=4.2,decay=2.8){
 const length=Math.floor(ctx.sampleRate*seconds),buffer=ctx.createBuffer(2,length,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<length;i++){const t=i/length;data[i]=(Math.random()*2-1)*Math.pow(1-t,decay)*(1-.12*Math.sin(t*90));}}
 return buffer;
}
function ensureAudio(){
 if(!audioCtx){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  audioCtx=new AC({latencyHint:'interactive'});masterGain=audioCtx.createGain();masterGain.gain.value=.62;
  const compressor=audioCtx.createDynamicsCompressor();compressor.threshold.value=-22;compressor.knee.value=24;compressor.ratio.value=3.4;compressor.attack.value=.012;compressor.release.value=.28;
  masterGain.connect(compressor);compressor.connect(audioCtx.destination);
  musicBus=audioCtx.createGain();musicBus.gain.value=musicVolume;musicBus.connect(masterGain);
  spaceReverb=audioCtx.createConvolver();spaceReverb.buffer=makeImpulse(audioCtx);
  reverbReturn=audioCtx.createGain();reverbReturn.gain.value=.24;spaceReverb.connect(reverbReturn);reverbReturn.connect(masterGain);
  noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate);
  const noise=noiseBuffer.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
 }
 if(audioCtx.state==='suspended')audioCtx.resume();return true;
}
function setParam(param,value,time=.18){if(!audioCtx||!param)return;param.cancelScheduledValues(audioCtx.currentTime);param.setTargetAtTime(value,audioCtx.currentTime,time)}
function synthVoice(freq,duration=1,wave='sine',volume=.025,endFreq=null,pan=0,filterFreq=1800,send=.35,attack=.06){
 if(!soundEnabled||!effectsEnabled||!ensureAudio())return;
 const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),amp=audioCtx.createGain(),panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null,sendGain=audioCtx.createGain();
 osc.type=wave;osc.frequency.setValueAtTime(Math.max(20,freq),now);if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+duration);
 filter.type='lowpass';filter.frequency.setValueAtTime(filterFreq,now);filter.Q.value=.45;
 amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+Math.max(.025,attack));amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
 sendGain.gain.value=send;osc.connect(filter);filter.connect(amp);
 if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));amp.connect(panner);panner.connect(masterGain);amp.connect(sendGain)}else{amp.connect(masterGain);amp.connect(sendGain)}
 sendGain.connect(spaceReverb);osc.start(now);osc.stop(now+duration+.06);
}
function noiseSweep(duration=1.05,pan=0,low=90,high=2600,level=.045){
 if(!soundEnabled||!effectsEnabled||!ensureAudio()||!noiseBuffer)return;
 const now=audioCtx.currentTime,source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),amp=audioCtx.createGain(),panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null,send=audioCtx.createGain();
 source.buffer=noiseBuffer;source.loop=true;filter.type='bandpass';filter.Q.value=.62;filter.frequency.setValueAtTime(low,now);filter.frequency.exponentialRampToValueAtTime(high,now+duration*.54);filter.frequency.exponentialRampToValueAtTime(low*.9,now+duration);
 amp.gain.setValueAtTime(.0001,now);amp.gain.linearRampToValueAtTime(level,now+duration*.28);amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
 send.gain.value=.3;source.connect(filter);filter.connect(amp);
 if(panner){panner.pan.value=pan;amp.connect(panner);panner.connect(masterGain);amp.connect(send)}else{amp.connect(masterGain);amp.connect(send)}
 send.connect(spaceReverb);source.start(now);source.stop(now+duration+.04);
}
function soundEffect(kind='ui'){
 if(!soundEnabled||!effectsEnabled||!ensureAudio())return;
 const now=audioCtx.currentTime;
 const reverbBus=audioCtx.createGain();reverbBus.gain.value=.2;reverbBus.connect(spaceReverb);
 const tone=(frequency,duration,level,pan=0,wave='sine',endFrequency=null,cutoff=2400,delay=0)=>{
  const start=now+delay,osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),amp=audioCtx.createGain();
  const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null,send=audioCtx.createGain();
  osc.type=wave;osc.frequency.setValueAtTime(Math.max(22,frequency),start);
  if(endFrequency)osc.frequency.exponentialRampToValueAtTime(Math.max(22,endFrequency),start+duration);
  filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,start);filter.frequency.exponentialRampToValueAtTime(Math.max(180,cutoff*.54),start+duration);filter.Q.value=.65;
  amp.gain.setValueAtTime(.0001,start);amp.gain.linearRampToValueAtTime(level,start+.045);
  amp.gain.setTargetAtTime(.0001,start+duration*.48,Math.max(.06,duration*.24));
  send.gain.value=.24;osc.connect(filter);filter.connect(amp);
  if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));amp.connect(panner);panner.connect(masterGain);amp.connect(send)}
  else{amp.connect(masterGain);amp.connect(send)}
  send.connect(reverbBus);osc.start(start);osc.stop(start+duration+.12);
 };
 const filteredSweep=(duration,pan=0,from=260,to=1800,level=.012)=>{
  if(!noiseBuffer)return;
  const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null;
  source.buffer=noiseBuffer;source.loop=true;filter.type='bandpass';filter.Q.value=.72;
  filter.frequency.setValueAtTime(from,now);filter.frequency.exponentialRampToValueAtTime(to,now+duration*.48);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80,from*.82),now+duration);
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+duration*.24);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter);filter.connect(gain);
  if(panner){panner.pan.value=pan;gain.connect(panner);panner.connect(masterGain)}else gain.connect(masterGain);
  source.start(now);source.stop(now+duration+.05);
 };
 if(kind==='focus'){
  tone(174.61,.76,.014,-.24,'sine',196,900);
  tone(261.63,.72,.011,.12,'triangle',293.66,1500,.04);
  tone(523.25,.62,.004,.34,'sine',587.33,2700,.09);
  filteredSweep(.45,-.2,320,1450,.006);
 }else if(kind==='travel'){
  tone(43.65,1.5,.026,-.12,'sine',32.7,240);
  tone(87.31,1.05,.011,.18,'triangle',130.81,520,.05);
  tone(220,.9,.005,.35,'sine',329.63,1250,.12);
  filteredSweep(1.25,-.22,100,1250,.019);
 }else if(kind==='history'){
  tone(98,.95,.012,-.2,'sine',73.42,420);
  tone(146.83,1.1,.009,.06,'triangle',196,950,.08);
  tone(293.66,.9,.005,.3,'sine',349.23,1800,.16);
  filteredSweep(.85,.2,180,900,.008);
 }else if(kind==='chart'){
  tone(659.25,.34,.008,-.16,'sine',783.99,3000);
  tone(987.77,.52,.005,.18,'sine',1174.66,3600,.07);
 }else if(kind==='page'){
  tone(196,.54,.009,-.18,'sine',220,1100);
  tone(293.66,.62,.007,.12,'triangle',349.23,1900,.055);
  tone(440,.68,.003,.3,'sine',523.25,2800,.11);
 }else if(kind==='toggle'){
  tone(349.23,.2,.007,-.08,'sine',392,1500);
  tone(523.25,.28,.004,.12,'triangle',587.33,2300,.035);
 }else{
  tone(440,.13,.003,0,'sine',466.16,1700);
 }
 setTimeout(()=>{try{reverbBus.disconnect()}catch(e){}},2600);
}
function startAmbient(){
 if(!soundEnabled||!ambienceEnabled||!ensureAudio()||ambientNodes.length)return;
 const now=audioCtx.currentTime;
 const addPad=(freq,detune,level,wave='sine',pan=0,cutoff=430)=>{
  const osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null;
  const lfo=audioCtx.createOscillator(),depth=audioCtx.createGain();
  osc.type=wave;osc.frequency.value=freq;osc.detune.value=detune;
  filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.55;
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+4.8);
  lfo.type='sine';lfo.frequency.value=.025+Math.random()*.025;
  depth.gain.value=cutoff*.16;lfo.connect(depth);depth.connect(filter.frequency);
  osc.connect(filter);filter.connect(gain);
  if(panner){panner.pan.value=pan;gain.connect(panner);panner.connect(masterGain);gain.connect(spaceReverb)}
  else{gain.connect(masterGain);gain.connect(spaceReverb)}
  osc.start();lfo.start();ambientNodes.push({source:osc,gain,lfo,filter});
 };
 // Soft, widely spaced harmonic layers create a slow, non-melodic celestial bed.
 addPad(55, -4,.0065,'sine',-.38,190);
 addPad(82.41, 3,.0048,'sine',.28,260);
 addPad(110, -2,.0034,'triangle',-.12,390);
 addPad(164.81, 2,.0022,'sine',.36,620);
 addPad(220, -3,.0011,'triangle',-.3,900);
 const addTexture=(type,frequency,q,level,pan,rate)=>{
  const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
  const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null,lfo=audioCtx.createOscillator(),depth=audioCtx.createGain();
  source.buffer=noiseBuffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+5.5);
  lfo.type='sine';lfo.frequency.value=rate;depth.gain.value=frequency*.14;lfo.connect(depth);depth.connect(filter.frequency);
  source.connect(filter);filter.connect(gain);
  if(panner){panner.pan.value=pan;gain.connect(panner);panner.connect(masterGain);gain.connect(spaceReverb)}
  else{gain.connect(masterGain);gain.connect(spaceReverb)}
  source.start();lfo.start();ambientNodes.push({source,gain,lfo,filter});
 };
 addTexture('lowpass',155,.5,.0032,-.32,.014);
 addTexture('bandpass',480,.65,.0011,.28,.019);
 addTexture('bandpass',1450,.5,.00035,.42,.009);
}
let musicTimer=null,musicStep=0,activeTrack='horizon',musicVolume=.42;
const musicVoices=new Set();
const soundtracks={
 horizon:{
  title:'EVENT HORIZON',bpm:56,interval:2142,
  chords:[[55,82.41,110],[49,73.42,98],[43.65,65.41,87.31],[65.41,98,130.81]],
  melody:[220,261.63,293.66,261.63,196,220,164.81,196],shape:'sine',level:.018
 },
 solar:{
  title:'SOLAR WIND',bpm:82,interval:1463,
  chords:[[65.41,98,130.81],[73.42,110,146.83],[55,82.41,110],[61.74,92.5,123.47]],
  melody:[261.63,329.63,392,329.63,293.66,349.23,440,392],shape:'triangle',level:.015
 },
 deep:{title:'DEEP FIELD',bpm:64,interval:1875,chords:[[49,73.42,110],[55,82.41,123.47],[65.41,98,146.83],[43.65,65.41,98]],melody:[392,523.25,659.25,587.33,440,523.25,783.99,659.25],shape:'sine',level:.0135},
 galaxy:{title:'GALACTIC TIDES',bpm:58,interval:2069,chords:[[41.2,61.74,82.41,123.47],[46.25,69.3,92.5,138.59],[36.71,55,73.42,110],[49,73.42,98,146.83]],melody:[164.81,196,246.94,220,174.61,207.65,261.63,220],shape:'sine',level:.014},
 chronicle:{title:'DEEP TIME',bpm:48,interval:2500,chords:[[43.65,65.41,87.31],[38.89,58.27,77.78],[49,73.42,98],[41.2,61.74,82.41]],melody:[130.81,164.81,196,174.61,146.83,174.61,220,196],shape:'triangle',level:.016},
 planetarium:{title:'STELLAR NIGHT',bpm:72,interval:1667,chords:[[73.42,110,146.83],[65.41,98,130.81],[82.41,123.47,164.81],[61.74,92.5,123.47]],melody:[523.25,659.25,783.99,659.25,587.33,698.46,880,783.99],shape:'sine',level:.0115}
};
function musicNote(frequency,duration,level,pan=0,wave='sine',cutoff=1800){
 if(!soundEnabled||!ensureAudio()||!musicBus)return;
 const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain(),send=audioCtx.createGain();
 const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null;
 osc.type=wave;osc.frequency.setValueAtTime(Math.max(24,frequency),now);
 filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,now);filter.Q.value=.55;
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+.2);
 gain.gain.setTargetAtTime(.0001,now+duration*.42,Math.max(.14,duration*.12));
 osc.connect(filter);filter.connect(gain);
 if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner);panner.connect(musicBus);gain.connect(send)}
 else{gain.connect(musicBus);gain.connect(send)}
 send.gain.value=.2;send.connect(spaceReverb);
 const voice={osc,gain};musicVoices.add(voice);
 osc.onended=()=>musicVoices.delete(voice);
 osc.start(now);osc.stop(now+duration+.2);
}
function soundtrackPulse(){
 if(!musicTimer||!soundEnabled)return;
 const track=soundtracks[activeTrack];if(!track)return;
 const chord=track.chords[Math.floor(musicStep/4)%track.chords.length];
 const duration=track.interval/1000*3.4;
 chord.forEach((frequency,index)=>{
  musicNote(frequency,duration,track.level*(index===0?1.15:.72),-.28+index*.27,'sine',index===0?380:720);
 });
 const melody=track.melody[musicStep%track.melody.length];
 if(['solar','planetarium'].includes(activeTrack)||musicStep%2===0){
  musicNote(melody,track.interval/1000*(activeTrack==='solar'?1.8:2.3),track.level*.85,
    musicStep%2===0?.34:-.34,track.shape,activeTrack==='deep'?2600:1900);
 }
 if(['deep','galaxy','planetarium'].includes(activeTrack)&&musicStep%4===2){
  musicNote(melody*2,1.2,track.level*.32,.44,'triangle',3400);
 }
 musicStep++;
}
function updateTrackUI(){
 const track=soundtracks[activeTrack];
 document.querySelectorAll('[data-track]').forEach(button=>{
  const active=button.dataset.track===activeTrack;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 $('musicTrackName').textContent=track.title;
 $('musicTrackState').textContent=musicTimer?'PLAYING · '+track.bpm+' BPM':'READY TO PLAY';
 $('musicPlayBtn').textContent=musicTimer?'Ⅱ  PAUSE SOUNDTRACK':'▶  PLAY SOUNDTRACK';
 $('musicPlayBtn').classList.toggle('active',!!musicTimer);
 $('soundMixer').classList.toggle('music-playing',!!musicTimer);
}
function stopMusicTrack(){
 if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
 if(audioCtx){
  const now=audioCtx.currentTime;
  musicVoices.forEach(voice=>{
   try{
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(.0001,now,.11);
    voice.osc.stop(now+.7);
   }catch(error){}
  });
 }
 updateTrackUI();
}
function startMusicTrack(){
 if(musicTimer){stopMusicTrack();return;}
 if(!soundEnabled){
  soundEnabled=true;ensureAudio();if(ambienceEnabled)startAmbient();updateSoundUI();
 }
 if(!ensureAudio())return;
 musicStep=0;
 musicTimer=setInterval(soundtrackPulse,soundtracks[activeTrack].interval);
 soundtrackPulse();
 updateTrackUI();
}
document.querySelectorAll('[data-track]').forEach(button=>button.addEventListener('click',()=>{
 const wasPlaying=!!musicTimer;stopMusicTrack();activeTrack=button.dataset.track;
 updateTrackUI();if(wasPlaying)startMusicTrack();else soundEffect('toggle');
}));
$('musicPlayBtn').addEventListener('click',()=>{if(musicTimer)stopMusicTrack();else startMusicTrack()});
$('musicStopBtn').addEventListener('click',stopMusicTrack);
$('musicVolume').addEventListener('input',event=>{
 musicVolume=Number(event.target.value)/100;$('musicVolumeValue').textContent=event.target.value+'%';
 if(ensureAudio()&&musicBus)setParam(musicBus.gain,musicVolume,.1);
});
updateTrackUI();

function stopAmbient(){
 if(!audioCtx){ambientNodes=[];return}
 const now=audioCtx.currentTime;ambientNodes.forEach(n=>{try{n.gain.gain.cancelScheduledValues(now);n.gain.gain.setTargetAtTime(.0001,now,.16);n.source.stop(now+.75);n.lfo.stop(now+.75)}catch(e){}});
 ambientNodes=[];
}
function updateSoundUI(){
 $('soundToggle').textContent=soundEnabled?'♫  SOUND ON':'♫  SOUND OFF';$('soundToggle').classList.toggle('sound-on',soundEnabled);$('soundToggle').setAttribute('aria-pressed',String(soundEnabled));
 $('mixerState').textContent=soundEnabled?'ACTIVE':'STANDBY';$('soundMixer').classList.toggle('active',soundEnabled);
}
$('soundToggle').addEventListener('click',()=>{
 soundEnabled=!soundEnabled;if(soundEnabled){ensureAudio();if(ambienceEnabled)startAmbient();updateSoundUI();soundEffect('toggle')}else{stopMusicTrack();stopAmbient();updateSoundUI()}
});
$('soundMixerToggle').addEventListener('click',()=>{
 const open=!$('soundMixer').classList.contains('open');$('soundMixer').classList.toggle('open',open);$('soundMixer').setAttribute('aria-hidden',String(!open));if(open)$('soundMixer').removeAttribute('inert');else $('soundMixer').setAttribute('inert','');
 $('soundMixerToggle').setAttribute('aria-expanded',String(open));$('soundMixerToggle').textContent=open?'STUDIO  −':'STUDIO  +';
});
$('soundMasterVolume').addEventListener('input',e=>{
 const value=Number(e.target.value);$('soundMasterValue').textContent=value+'%';if(ensureAudio())setParam(masterGain.gain,value/100,.08);
});
$('ambienceCheck').addEventListener('change',e=>{ambienceEnabled=e.target.checked;if(soundEnabled){if(ambienceEnabled)startAmbient();else stopAmbient()}});
$('effectsCheck').addEventListener('change',e=>{effectsEnabled=e.target.checked});
// Deliberate, low-frequency interaction feedback: avoid sounding on every button.
let lastUiSoundAt=0;
document.addEventListener('click',e=>{
 const b=e.target.closest('button');
 if(!b||b.id==='soundToggle'||b.id==='soundMixerToggle')return;
 let kind=null;
 if(b.classList.contains('body-btn'))kind='focus';
 else if(b.classList.contains('nav-tab')||b.hasAttribute('data-close-page')||b.id==='commandOpen')kind='page';
 else if(b.classList.contains('sky-search-result'))kind='chart';
 else if(['historyNext','historyPrev','historyPlay'].includes(b.id)||b.dataset.epoch!==undefined)kind='history';
 else if(['skyNow','skyReset'].includes(b.id))kind='chart';
 else if(['playBtn','orbitsBtn','labelsBtn','cloudsBtn','moonsBtn','cinemaBtn','resetBtn'].includes(b.id))kind='toggle';
 if(!kind)return;
 const now=performance.now();
 if(now-lastUiSoundAt<110)return;
 lastUiSoundAt=now;soundEffect(kind);
});
let lastChartSound=0;$('skyCanvas').addEventListener('click',()=>soundEffect('chart'));
$('historyRange').addEventListener('input',()=>{const now=performance.now();if(now-lastChartSound>260){soundEffect('history');lastChartSound=now}});

// Start only after moon objects, clouds, and all page instruments are initialized.
try { animate(); setTimeout(()=>$('loading').classList.add('hide'),1300);setTimeout(()=>$('loading').classList.add('hide'),12000); }
catch(error) { console.error('ORBIT startup failed:',error); $('loading').classList.add('hide'); }

