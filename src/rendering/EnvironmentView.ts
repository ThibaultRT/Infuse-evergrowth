import * as THREE from 'three';
import type { AreaDefinition } from '../types';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const value = new THREE.Mesh(geometry, material); value.position.set(x, y, z); return value;
}

/** Permanent macro terrain for one authored world chunk. All three roots remain visible. */
export class EnvironmentView {
  readonly root = new THREE.Group();
  private readonly terrainRoot = new THREE.Group();
  private readonly macroRoot = new THREE.Group();
  private readonly assetDetailsRoot = new THREE.Group();
  private readonly fallbackDetailsRoot = new THREE.Group();

  constructor(readonly area: AreaDefinition, private readonly assets: AssetLoader = quaterniusAssets) {
    this.root.position.set(area.originX, 0, area.originZ); this.root.name = `Area ${area.id} environment`;
    this.root.add(this.terrainRoot, this.macroRoot, this.assetDetailsRoot, this.fallbackDetailsRoot);
    if (area.environmentTheme === 'sunlit-meadow') this.buildMeadow();
    else if (area.environmentTheme === 'ashwood') this.buildBorderlands();
    else this.buildRuinedFortress();
    void this.loadDetails();
  }

  private ground(color: number): void {
    const ground = mesh(new THREE.PlaneGeometry(this.area.size.width, this.area.size.depth), new THREE.MeshStandardMaterial({ color, roughness: 1 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2; this.terrainRoot.add(ground);
  }
  private road(points: readonly [number, number][], width = 3.4): void {
    const material = new THREE.MeshStandardMaterial({ color: 0xa58b5d, roughness: 1 });
    for (let i = 1; i < points.length; i++) { const [ax,az]=points[i-1], [bx,bz]=points[i]; const length=Math.hypot(bx-ax,bz-az);
      const piece=mesh(new THREE.CapsuleGeometry(width/2, Math.max(.1,length-width),4,8),material,(ax+bx)/2,.02,(az+bz)/2);
      piece.scale.y=.03; piece.rotation.y=Math.atan2(bx-ax,bz-az); this.macroRoot.add(piece); }
  }
  private irregularRock(x:number,y:number,z:number,sx:number,sy:number,sz:number,color=0x626556): THREE.Mesh {
    const rock=mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color,roughness:1}),x,y,z); rock.scale.set(sx,sy,sz); rock.rotation.set(.08*z,.17*x,.04*x); return rock;
  }

  private buildMeadow(): void {
    this.ground(0x79a957); this.road([[0,4],[3,-10],[8,-28]]); this.road([[0,4],[10,3],[18,0]]); this.road([[0,4],[-10,7],[-18,7]]); this.road([[0,4],[-1,16],[0,28]]);
    // A narrow water band separates the adjacent chunks without flooding deep
    // into Area 2. Irregular stones conceal both long edges of the water plane.
    const water=mesh(new THREE.PlaneGeometry(62,8),new THREE.MeshStandardMaterial({color:0x277e9e,roughness:.24,metalness:.08,transparent:true,opacity:.93}),0,.04,-28); water.rotation.x=-Math.PI/2; this.macroRoot.add(water);
    for(let x=-18;x<=18;x+=2.6){ if(x>5&&x<11)continue; const z=-25.4+Math.sin(x*.72)*.55+Math.sin(x*1.8)*.2; this.macroRoot.add(this.irregularRock(x,.2,z,1.25,.45,.9)); }
    for(let x=-18;x<=18;x+=2.6){ if(x>5&&x<11)continue; const z=-30.6+Math.sin(x*.61)*.4+Math.sin(x*1.55)*.16; this.macroRoot.add(this.irregularRock(x,.18,z,1.15,.4,.82)); }
    const causewayMaterial=new THREE.MeshStandardMaterial({color:0x8b846d,roughness:1});
    const causeway=mesh(new THREE.BoxGeometry(4.6,.3,9),causewayMaterial,8,.14,-28); this.macroRoot.add(causeway);
    for(const x of [5.85,10.15]) for(let z=-31.5;z<=-24.5;z+=2.25) this.macroRoot.add(this.irregularRock(x,.35,z,.45,.55,.65,0x626556));
    for(const [x,z,s] of [[-10,-28.4,1.35],[1,-29,1.05],[16,-28.2,.9]] as const) this.macroRoot.add(this.irregularRock(x,.15,z,s,.45,s*.75));
    // Layered west ridge: human-scale foreground rocks, larger masses pushed outside play.
    const ridge=new THREE.Group(); ridge.name='west layered ridge'; ridge.userData.cameraOccluder=true;
    for(let z=-31;z<=32;z+=4.1){ const wave=Math.sin(z*.5); ridge.add(this.irregularRock(-19.1,.55,z,1.5,1.1,1.7),this.irregularRock(-22.3,1.5,z+1.5,2.5,2.8+wave*.4,2.3),this.irregularRock(-26,2.8,z-.8,4,4.7,3.5)); } this.macroRoot.add(ridge);
    // A real depression: vertical cliff faces and a bottom 2.2m below the grass, with a reserved sealed crossing.
    const bottom=mesh(new THREE.PlaneGeometry(54,16),new THREE.MeshStandardMaterial({color:0x292821,roughness:1}),0,-2.2,34); bottom.rotation.x=-Math.PI/2; this.macroRoot.add(bottom);
    const cliffMat=new THREE.MeshStandardMaterial({color:0x50483c,roughness:1});
    for(let x=-22;x<=22;x+=2.5){ const z=27.2+Math.sin(x*.8)*.65; const face=mesh(new THREE.BoxGeometry(2.7,2.2,1.2),cliffMat,x,-.95,z); face.rotation.z=Math.sin(x)*.08; this.macroRoot.add(face); if(Math.abs(x)>3)this.macroRoot.add(this.irregularRock(x,.18,z-.3,1.25,.55,1)); }
    const bridge=mesh(new THREE.BoxGeometry(4.2,.35,7),new THREE.MeshStandardMaterial({color:0x65452d,roughness:1}),0,.1,30); this.macroRoot.add(bridge,mesh(new THREE.BoxGeometry(5,1,.55),cliffMat,0,.5,27.2));
  }

  private buildBorderlands(): void { this.ground(0x465b42); this.road([[-12,28],[-10,8],[0,-4]],3.5); this.road([[0,-4],[15,5],[18,28]],3.5);
    for(const [x,z,s] of [[-34,-18,2],[32,-20,2.4],[27,4,1.6],[-30,12,1.8],[12,-22,1.4]] as const)this.macroRoot.add(this.irregularRock(x,s*.5,z,s,s*.7,s)); }

  private ruinSegment(name:string,x:number,z:number,width:number,depth:number,height:number): void {
    const group=new THREE.Group(); group.name=name; group.userData.cameraOccluder=height>2; const horizontal=width>depth, length=Math.max(width,depth), stone=new THREE.MeshStandardMaterial({color:0x666a62,roughness:1});
    for(let p=-length/2;p<length/2;p+=2.1){ const broken=height*(.58+.4*Math.abs(Math.sin(p*1.37))); const block=mesh(new THREE.BoxGeometry(horizontal?1.95:width,broken,horizontal?depth:1.95),stone,x+(horizontal?p:0),broken/2,z+(horizontal?0:p)); block.rotation.y=Math.sin(p)*.035; group.add(block); }
    this.macroRoot.add(group);
  }
  private buildRuinedFortress(): void {
    this.ground(0x686b61); this.road([[-20,0],[-8,0],[0,-5],[0,-28]],4.2);
    // Broken set-back masses replace uniform stacked rows. The south foreground is a 0.5–1.2m cutaway.
    this.ruinSegment('west north ruin',-20,-16,2.2,22,4.8); this.ruinSegment('west south ruin',-20,17,2.2,19,2.5);
    this.ruinSegment('north back ruin west',-11,-28,16,2.2,5.5); this.ruinSegment('north back ruin east',11,-28,16,2.2,4.7);
    this.ruinSegment('east fortress wall',20.2,0,1.35,52,5.7);
    const south=new THREE.Group(); south.name='south cutaway foundations';
    for(let x=-19;x<=19;x+=2.4){ const h=.5+(Math.sin(x*1.2)+1)*.3; south.add(mesh(new THREE.BoxGeometry(2.25,h,2),new THREE.MeshStandardMaterial({color:0x666a62,roughness:1}),x,h/2,28)); } this.macroRoot.add(south);
    const tower=new THREE.Group(); tower.name='north-east ruined tower'; tower.userData.cameraOccluder=true;
    for(let y=.6;y<7;y+=1.2) tower.add(this.irregularRock(14,y,-21,3.7,.72,3.5,0x5c6059)); this.macroRoot.add(tower);
    for(const [x,z,s] of [[-16,9,1.3],[-13,-8,1],[14,15,1.5],[8,20,1.2],[15,-18,1.4],[-5,-19,1]] as const)this.macroRoot.add(this.irregularRock(x,.45,z,s,.65,s));
  }

  private async addAsset(path:string,x:number,z:number,scale:number,rotation=0): Promise<void> { const object=await this.assets.cloneScene(path); object.position.set(x,0,z); object.scale.setScalar(scale); object.rotation.y=rotation; this.assetDetailsRoot.add(object); }
  private async loadDetails(): Promise<void> {
    const jobs: Promise<void>[]=[];
    if(this.area.id===1){
      for(const [x,z,s] of [[-17,-24,.75],[-12,-25,.55],[-5,-25,.6],[14,-25,.65],[-16,25,.7],[-15,-5,.75]] as const) jobs.push(this.addAsset('nature/models/Rock_Medium_1.gltf',x,z,s,x));
      for(const [x,z,s] of [[-16,-21,.65],[-13,-24,.5],[13,-23,.55],[-16,17,.7],[-20,3,.75]] as const) jobs.push(this.addAsset('nature/models/Bush_Common_Flowers.gltf',x,z,s));
      for(const [x,z,s] of [[-22,-12,.8],[-23,13,.9],[-25,24,.85]] as const) jobs.push(this.addAsset('nature/models/CommonTree_1.gltf',x,z,s));
    } else { for(const [x,z,s] of [[-13,16,.75],[12,18,.8],[-12,-17,.72]] as const) jobs.push(this.addAsset(this.area.id===2?'nature/models/CommonTree_3.gltf':'nature/models/Rock_Medium_2.gltf',x,z,s)); }
    try { await Promise.all(jobs); this.fallbackDetailsRoot.visible=false; } catch(error){ console.warn(`Area ${this.area.id} Quaternius details unavailable; procedural macro terrain remains playable.`,error); }
  }
}
