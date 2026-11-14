
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {calculatePlanetStates, heliocentricPosition, orbitalElementsAt, orbitalPath, observerEphemeris, EPHEMERIS_VALIDITY} from '../astronomy/index.js';
import {createPlanetarium} from '../planetarium/planetarium.js';
const $=id=>document.getElementById(id);
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
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
$('space').appendChild(renderer.domElement);
// Cinematic HDR-style glow: emissive worlds and the solar corona bloom naturally.
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.62,.78,.74);
composer.addPass(bloomPass);composer.addPass(new OutputPass());
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.045;controls.minDistance=8;controls.maxDistance=95;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,0,0);controls.autoRotate=false;controls.enablePan=true;
scene.add(new THREE.AmbientLight(0x8092b7,.38));const sunLight=new THREE.PointLight(0xffe1b0,160,180,1.45);sunLight.position.set(0,0,0);scene.add(sunLight);
const loader=new THREE.TextureLoader();loader.crossOrigin='anonymous';const textures={};const planetObjects={};let selected='Earth',paused=false,showOrbits=true,showLabels=true,timeScale=1,elapsed=0;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let hovered=null;
// Deep star field: a large spherical distribution, plus a sparse near-field dust layer.
function starField(count,radius,size,opacity){const g=new THREE.BufferGeometry(),p=new Float32Array(count*3),c=new Float32Array(count*3);for(let i=0;i<count;i++){const u=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-u*u),r=radius*(.88+Math.random()*.12);p[i*3]=r*s*Math.cos(a);p[i*3+1]=r*u;p[i*3+2]=r*s*Math.sin(a);const tint=new THREE.Color().setHSL(.53+Math.random()*.16,.18,.65+Math.random()*.35);c[i*3]=tint.r;c[i*3+1]=tint.g;c[i*3+2]=tint.b;}g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));const m=new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity,sizeAttenuation:true,depthWrite:false});const pts=new THREE.Points(g,m);scene.add(pts);return pts;}
const stars=starField(7200,155,.105,.9),dust=starField(1800,85,.045,.42);
// Soft luminous nebula clouds made from layered transparent sprites.
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),g=x.createRadialGradient(128,128,4,128,128,128);g.addColorStop(0,'rgba(98,139,220,.16)');g.addColorStop(.28,'rgba(58,85,160,.09)');g.addColorStop(1,'rgba(15,30,75,0)');x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)}
const nebulaMat=new THREE.SpriteMaterial({map:glowTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});for(let i=0;i<8;i++){const s=new THREE.Sprite(nebulaMat.clone());s.position.set((Math.random()-.5)*90,(Math.random()-.5)*35,-38-Math.random()*25);s.scale.set(35+Math.random()*30,18+Math.random()*18,1);s.material.rotation=Math.random()*Math.PI;scene.add(s)}
// Sun: emissive mapped photosphere and multiple restrained corona layers.
const sunGeo=new THREE.SphereGeometry(data.Sun.radius,72,72);const sunMat=new THREE.MeshBasicMaterial({color:0xffc06b});const sun=new THREE.Mesh(sunGeo,sunMat);scene.add(sun);const sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:0xffb55d,transparent:true,opacity:1.8,blending:THREE.AdditiveBlending,depthWrite:false}));sunHalo.scale.set(15,15,1);sun.add(sunHalo);
const sunCorona=new THREE.Mesh(new THREE.SphereGeometry(2.25,48,48),new THREE.MeshBasicMaterial({color:0xffa84c,transparent:true,opacity:.075,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false}));sun.add(sunCorona);
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
 return true;
}
const sphereGeo=new THREE.SphereGeometry(1,64,64);
function makePlanet(name,d){const group=new THREE.Group();scene.add(group);const material=new THREE.MeshStandardMaterial({color:d.color,roughness:name==='Venus'?.94:.82,metalness:0});const mesh=new THREE.Mesh(sphereGeo,material);mesh.scale.setScalar(d.radius);mesh.rotation.z=d.tilt||0;mesh.userData.body=name;group.add(mesh);
// Atmospheric Fresnel rim for Earth, Venus and the ice giants.
if(['Earth','Venus','Uranus','Neptune'].includes(name)){const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.045,48,48),new THREE.ShaderMaterial({vertexShader:'varying vec3 vNormal; varying vec3 vView; void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',fragmentShader:`varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.0);gl_FragColor=vec4(${name==='Earth'?'0.20,0.58,1.0':name==='Venus'?'0.88,0.58,0.28':'0.28,0.72,0.95'},rim*${name==='Earth'?'0.48':'0.25'});}`,transparent:true,side:THREE.BackSide,depthWrite:false}));atmo.scale.setScalar(d.radius*1.07);group.add(atmo)}
if(name==='Saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(d.radius*1.35,d.radius*2.35,128),ringMaterial.clone());ring.rotation.x=Math.PI/2.35;ring.rotation.y=.12;ring.material.opacity=.78;group.add(ring);const inner=new THREE.Mesh(new THREE.RingGeometry(d.radius*1.18,d.radius*1.34,128),new THREE.MeshBasicMaterial({color:0x79664c,side:THREE.DoubleSide,transparent:true,opacity:.36,depthWrite:false}));inner.rotation.copy(ring.rotation);group.add(inner)}
if(name==='Uranus'){const ring=new THREE.Mesh(new THREE.RingGeometry(d.radius*1.45,d.radius*1.95,96),new THREE.MeshBasicMaterial({color:0x8abfc3,side:THREE.DoubleSide,transparent:true,opacity:.2,depthWrite:false}));ring.rotation.x=Math.PI/2.1;group.add(ring)}
const orbit=makeOrbit(name,d.dist||0);orbitLines[name]=orbit;const angle=Math.random()*Math.PI*2;planetObjects[name]={group,mesh,material,angle,orbit,d};
loader.load(textureBase+d.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(name==='Sun'){sun.material=new THREE.MeshBasicMaterial({map:t,color:0xffffff});}else{material.map=t;material.color.set(0xffffff);material.needsUpdate=true;}textures[name]=t;},undefined,()=>{console.warn('Texture unavailable:',name)});
return group;}
for(const name of names){if(name==='Sun')continue;makePlanet(name,data[name]);}
updatePlanetPositions(simulationDate);
loader.load(textureBase+data.Sun.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;sun.material.map=t;sun.material.needsUpdate=true});
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
renderer.domElement.addEventListener('click',pick);renderer.domElement.addEventListener('pointermove',e=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(Object.values(planetObjects).map(o=>o.mesh).concat(sun),false);const hit=hits[0]?.object;renderer.domElement.style.cursor=hit?'pointer':'grab';if(hit){const n=hit.userData.body||'Sun';if(hovered!==n){hovered=n;}}else hovered=null;});
$('playBtn').addEventListener('click',()=>{paused=!paused;$('playBtn').innerHTML=paused?'▶&nbsp; PLAY':'Ⅱ&nbsp; PAUSE';toast(paused?'MOTION PAUSED':'MOTION RESUMED')});$('speed').addEventListener('input',e=>{timeScale=Number(e.target.value)===0?.01:Math.pow(10,(Number(e.target.value)-1)*.45);$('speedValue').textContent=timeScale.toFixed(2)+' d/s'});$('orbitsBtn').addEventListener('click',()=>{showOrbits=!showOrbits;orbitGroup.visible=showOrbits;$('orbitsBtn').classList.toggle('active',showOrbits)});$('labelsBtn').addEventListener('click',()=>{showLabels=!showLabels;Object.values(labels).forEach(el=>el.style.display=showLabels?'block':'none');$('labelsBtn').classList.toggle('active',showLabels)});$('resetBtn').addEventListener('click',resetView);$('helpBtn').addEventListener('click',()=>$('help').classList.add('open'));$('closeHelp').addEventListener('click',()=>$('help').classList.remove('open'));$('help').addEventListener('click',e=>{if(e.target===$('help'))$('help').classList.remove('open')});window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){$('playBtn').click();e.preventDefault()}if(e.key==='Escape')$('help').classList.remove('open');if(e.key.toLowerCase()==='r')resetView()});
buildNav();selectBody('Earth');
setSimulationDate(simulationDate,false);
const clock=new THREE.Clock();function updateLabels(){for(const [name,el] of Object.entries(labels)){const p=planetObjects[name].group.position.clone();p.y+=planetObjects[name].d.radius*1.6;p.project(camera);const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;el.style.left=x+'px';el.style.top=y+'px';el.style.opacity=(p.z<1&&x>0&&x<innerWidth&&y>0&&y<innerHeight&&showLabels)?'.85':'0';}}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused){elapsed+=dt*timeScale;simulationDate=new Date(simulationDate.getTime()+dt*timeScale*86400000);updatePlanetPositions(simulationDate);for(const [name,o] of Object.entries(planetObjects)){const rotationDays={Mercury:58.646,Venus:-243.025,Earth:.99727,Mars:1.02596,Jupiter:.41354,Saturn:.444,Uranus:-.718,Neptune:.671};o.mesh.rotation.y+=dt*timeScale*2*Math.PI/rotationDays[name];}for(const m of moonObjects){const period=m.spec.periodDays||27.3217;m.angle+=dt*timeScale*2*Math.PI/period;m.mesh.position.set(Math.cos(m.angle)*m.spec.distance,Math.sin(m.angle*.7)*.025,Math.sin(m.angle)*m.spec.distance);}earthClouds.rotation.y+=dt*timeScale*.018;sun.rotation.y+=dt*timeScale*.025;stars.rotation.y+=dt*.000025;dust.rotation.y-=dt*.00005;belt.rotation.y+=dt*.0003;if(performance.now()-lastDateDisplayUpdate>500){lastDateDisplayUpdate=performance.now();updateSelectedEphemerisStats();$('simulationDateLabel').textContent=simulationDate.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}).toUpperCase();$('telemetryDate').textContent=simulationDate.getFullYear()+'-'+String(simulationDate.getMonth()+1).padStart(2,'0')+'-'+String(simulationDate.getDate()).padStart(2,'0');if(document.activeElement!==$('simulationDate'))$('simulationDate').value=localDateValue(simulationDate);}}
if(cameraTween){const t=Math.min(1,(performance.now()-cameraTween.start)/cameraTween.duration),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(cameraTween.from,cameraTween.to,e);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,e);if(t>=1)cameraTween=null;}controls.update();updateLabels();composer.render();}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));composer.setSize(innerWidth,innerHeight);}window.addEventListener('resize',resize);

// ORBIT 2.0 — expanded instruments, moons, history archive and sky chart.
const navButtons=[...document.querySelectorAll('[data-page]')];
function openPage(which){const active=!!which&&which!=='explore';document.querySelectorAll('.page-overlay').forEach(p=>p.classList.toggle('open',active&&p.id===which+'Page'));document.querySelector('.ui').classList.toggle('page-mode',active);navButtons.forEach(b=>b.classList.toggle('active',b.dataset.page===(which||'explore')));if(which==='sky')drawSkyChart();if(which==='history'||which==='research')soundEffect('history');}
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
{era:'ERA 10 · PRESENT DAY',title:'A world that observes',label:'HUMANS STUDY THE COSMOS FROM ONE SMALL PLANET',date:'TODAY · 13.8 BILLION YEARS OF COSMIC HISTORY',age:'0',temp:'~288 K GLOBAL MEAN',text:'On Earth, life has evolved into organisms capable of studying the universe that made them. Telescopes, spacecraft and laboratories let us reconstruct cosmic history from light, rocks and particles.',color:'#83caff',scale:1.3}
];
let epochIndex=0,historyTimer=null;
function renderEpoch(i){epochIndex=Math.max(0,Math.min(epochs.length-1,i));const e=epochs[epochIndex];$('historyStage').dataset.epoch=String(epochIndex);$('historyRange').value=epochIndex;$('timelineProgress').textContent=String(epochIndex+1).padStart(2,'0')+' / 10';$('historyEra').textContent=e.era;$('historyTitle').textContent=e.title;$('historyText').textContent=e.text;$('historyStageLabel').textContent=e.label;$('historyStageDate').textContent=e.date;$('historyAge').textContent=e.age;$('historyTemp').textContent=e.temp;$('historyEraTiny').textContent=e.era.replace(/^ERA \d+ · /,'');$('epochCore').style.transform='translate(-50%,-50%) scale('+e.scale+')';$('epochCore').style.background='radial-gradient(circle at 35% 32%,#fff8df,'+e.color+' 28%,#6b4d82 75%,transparent 100%)';$('historyMarkers').querySelectorAll('button').forEach((b,j)=>b.classList.toggle('active',j===epochIndex));}
$('historyMarkers').innerHTML=epochs.map((e,i)=>'<button class="timeline-marker" data-epoch="'+i+'">'+String(i+1).padStart(2,'0')+' · '+e.title.toUpperCase()+'</button>').join('');
$('historyMarkers').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{stopHistory();renderEpoch(Number(b.dataset.epoch))}));
$('historyRange').addEventListener('input',e=>{stopHistory();renderEpoch(Number(e.target.value))});
$('historyPrev').addEventListener('click',()=>{stopHistory();renderEpoch(epochIndex-1)});
$('historyNext').addEventListener('click',()=>{stopHistory();renderEpoch(epochIndex+1)});
function stopHistory(){if(historyTimer){clearInterval(historyTimer);historyTimer=null}$('historyPlay').innerHTML='▶ &nbsp; PLAY TIMELINE'}
function playHistory(){if(historyTimer){stopHistory();return}$('historyPlay').innerHTML='Ⅱ &nbsp; PAUSE TIMELINE';if(epochIndex>=epochs.length-1)renderEpoch(0);historyTimer=setInterval(()=>{if(epochIndex>=epochs.length-1){stopHistory();return}renderEpoch(epochIndex+1)},2600)}
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
 $('skyLat').value='28.61';$('skyLon').value='77.21';drawSkyChart();
});
document.querySelectorAll('[data-sky-constellation]').forEach(button=>button.addEventListener('click',()=>{
 ensurePlanetarium().then(view=>{view.selectConstellation(button.dataset.skyConstellation);soundEffect('chart')}).catch(()=>{});
}));

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
const soundtracks={
 horizon:{
  title:'EVENT HORIZON',bpm:56,interval:2142,
  chords:[[55,82.41,110],[49,73.42,98],[43.65,65.41,87.31],[65.41,98,130.81]],
  melody:[220,261.63,293.66,261.63,196,220,164.81,196],shape:'sine',level:.0047
 },
 solar:{
  title:'SOLAR WIND',bpm:82,interval:1463,
  chords:[[65.41,98,130.81],[73.42,110,146.83],[55,82.41,110],[61.74,92.5,123.47]],
  melody:[261.63,329.63,392,329.63,293.66,349.23,440,392],shape:'triangle',level:.0038
 },
 deep:{
  title:'DEEP FIELD',bpm:64,interval:1875,
  chords:[[49,73.42,110],[55,82.41,123.47],[65.41,98,146.83],[43.65,65.41,98]],
  melody:[392,523.25,659.25,587.33,440,523.25,783.99,659.25],shape:'sine',level:.0035
 }
};
function musicNote(frequency,duration,level,pan=0,wave='sine',cutoff=1800){
 if(!soundEnabled||!ensureAudio()||!musicBus)return;
 const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain(),send=audioCtx.createGain();
 const panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null;
 osc.type=wave;osc.frequency.setValueAtTime(Math.max(24,frequency),now);
 filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,now);filter.Q.value=.55;
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+.2);
 gain.gain.setTargetAtTime(.0001,now+duration*.58,Math.max(.16,duration*.2));
 osc.connect(filter);filter.connect(gain);
 if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner);panner.connect(musicBus);gain.connect(send)}
 else{gain.connect(musicBus);gain.connect(send)}
 send.gain.value=.18;send.connect(spaceReverb);
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
 if(activeTrack==='solar'||musicStep%2===0){
  musicNote(melody,track.interval/1000*(activeTrack==='solar'?1.8:2.3),track.level*.85,
    musicStep%2===0?.34:-.34,track.shape,activeTrack==='deep'?2600:1900);
 }
 if(activeTrack==='deep'&&musicStep%4===2){
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
 updateTrackUI();
}
function startMusicTrack(){
 if(musicTimer){stopMusicTrack();return;}
 if(!soundEnabled){
  soundEnabled=true;ensureAudio();if(ambienceEnabled)startAmbient();updateSoundUI();
 }
 if(!ensureAudio())return;
 musicStep=0;soundtrackPulse();
 musicTimer=setInterval(soundtrackPulse,soundtracks[activeTrack].interval);
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
 const open=!$('soundMixer').classList.contains('open');$('soundMixer').classList.toggle('open',open);$('soundMixer').setAttribute('aria-hidden',String(!open));
 $('soundMixerToggle').setAttribute('aria-expanded',String(open));$('soundMixerToggle').textContent=open?'MIXER  −':'MIXER  +';
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

