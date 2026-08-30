import * as THREE from 'three';
import { AREAS, SPAWNS, WORLD_CONNECTIONS } from '../config';
import { lakeBarrierBounds, lakeBarrierSegments } from '../domain/world/LakeBoundary';
import type { AreaDefinition } from '../types';
import { fitModelToFootprint, gameModelAssets, kaykitAssets, quaterniusAssets, type AssetLoader } from './AssetLoader';
import { AREA_ONE_KAYKIT_PLACEMENTS, AREA_THREE_WALL_PLACEMENTS, areaOneVegetation, type KaykitPlacement, WEST_BORDER_KAYKIT_PLACEMENTS } from './KaykitEnvironmentPlacements';

/** Warms only the asset package belonging to one area; shared loader caches deduplicate requests. */
export async function prefetchEnvironmentDetails(area: AreaDefinition): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  if (area.id === 1) {
    jobs.push(gameModelAssets.load('props/fountain.glb'));
    const spawnPoints = SPAWNS.filter((spawn) => spawn.areaId === 1).map((spawn) => ({ x: spawn.x - area.originX, z: spawn.z - area.originZ }));
    for (const placement of [...AREA_ONE_KAYKIT_PLACEMENTS, ...WEST_BORDER_KAYKIT_PLACEMENTS, ...areaOneVegetation(spawnPoints)]) jobs.push(kaykitAssets.load(placement.path));
  } else if (area.id === 2) {
    for (const path of ['nature/models/CommonTree_3.gltf', 'nature/models/Rock_Medium_2.gltf', 'village/models/Prop_WoodenFence_Extension1.gltf']) jobs.push(quaterniusAssets.load(path));
  } else {
    for (const placement of AREA_THREE_WALL_PLACEMENTS) jobs.push(kaykitAssets.load(placement.path));
    for (const path of ['village/models/Prop_Brick1.gltf', 'village/models/Floor_UnevenBrick.gltf', 'nature/models/Rock_Medium_2.gltf']) jobs.push(quaterniusAssets.load(path));
  }
  const results = await Promise.allSettled(jobs);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}

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
  private groundPatch(x:number,z:number,sx:number,sz:number,color:number,rotation=0): void {
    const patch=mesh(new THREE.CircleGeometry(1,16),new THREE.MeshStandardMaterial({color,roughness:1}),x,.025,z);
    patch.rotation.x=-Math.PI/2; patch.rotation.z=rotation; patch.scale.set(sx,sz,1); this.macroRoot.add(patch);
  }
  private lowWall(name:string,x:number,z:number,width:number,depth:number,height:number): void {
    const group=new THREE.Group(); group.name=name; group.userData.cameraOccluder=height>2.2;
    const material=new THREE.MeshStandardMaterial({color:0x686960,roughness:1});
    const horizontal=width>depth, length=Math.max(width,depth), pieces=Math.max(1,Math.floor(length/2));
    for(let i=0;i<pieces;i++){ if((i+name.length)%5===2)continue; const offset=-length/2+(i+.5)*length/pieces; const h=height*(.68+.3*Math.abs(Math.sin(i*2.17)));
      const block=mesh(new THREE.BoxGeometry(horizontal?length/pieces+.12:width,h,horizontal?depth:length/pieces+.12),material,x+(horizontal?offset:0),h/2,z+(horizontal?0:offset)); block.rotation.y=Math.sin(i*1.7)*.035; group.add(block); }
    this.macroRoot.add(group);
  }

  private buildMeadow(): void {
    this.ground(0x79a957); this.road([[0,4],[3,-10],[8,-28]]); this.road([[0,4],[10,3],[18,0]]); this.road([[0,4],[-10,7],[-18,7]]); this.road([[0,4],[-1,16],[0,28]]);
    // Two distinct lakes leave a dry opening around the gate and causeway. Their
    // outer edges extend beyond the chunks while irregular stones soften the banks.
    const lakeConnection=WORLD_CONNECTIONS.find((connection)=>connection.visualStyle==='lake-gate');
    if(lakeConnection){
      const waterMaterial=new THREE.MeshStandardMaterial({color:0x277e9e,roughness:.24,metalness:.08,transparent:true,opacity:.93});
      const lakeBounds=lakeBarrierBounds(lakeConnection,AREAS);
      for(const lake of lakeBarrierSegments(lakeConnection,lakeBounds.minX,lakeBounds.maxX)){
        const water=mesh(new THREE.PlaneGeometry(lake.maxX-lake.minX,lake.maxZ-lake.minZ),waterMaterial,(lake.minX+lake.maxX)/2-this.area.originX,.04,(lake.minZ+lake.maxZ)/2-this.area.originZ);
        water.rotation.x=-Math.PI/2; this.macroRoot.add(water);
      }
    }
    for(let x=-18;x<=18;x+=2.6){ if(x>5&&x<11)continue; const z=-25.4+Math.sin(x*.72)*.55+Math.sin(x*1.8)*.2; this.macroRoot.add(this.irregularRock(x,.2,z,1.25,.45,.9)); }
    for(let x=-18;x<=18;x+=2.6){ if(x>5&&x<11)continue; const z=-30.6+Math.sin(x*.61)*.4+Math.sin(x*1.55)*.16; this.macroRoot.add(this.irregularRock(x,.18,z,1.15,.4,.82)); }
    // Gameplay authority still treats this as the same crossing; its presentation is KayKit.
    for(const x of [5.85,10.15]) for(let z=-31.5;z<=-24.5;z+=2.25) this.macroRoot.add(this.irregularRock(x,.35,z,.45,.55,.65,0x626556));
    for(const [x,z,s] of [[-10,-28.4,1.35],[1,-29,1.05],[16,-28.2,.9]] as const) this.macroRoot.add(this.irregularRock(x,.15,z,s,.45,s*.75));
    // Layered west ridge: human-scale foreground rocks, larger masses pushed outside play.
    const ridge=new THREE.Group(); ridge.name='west layered ridge'; ridge.userData.cameraOccluder=true;
    for(let z=-31;z<=32;z+=4.1){ if(z>-10&&z<10)continue; const wave=Math.sin(z*.5); ridge.add(this.irregularRock(-19.1,.55,z,1.5,1.1,1.7),this.irregularRock(-22.3,1.5,z+1.5,2.5,2.8+wave*.4,2.3),this.irregularRock(-26,2.8,z-.8,4,4.7,3.5)); } this.macroRoot.add(ridge);
    // A real depression: vertical cliff faces and a bottom 2.2m below the grass, with a reserved sealed crossing.
    const bottom=mesh(new THREE.PlaneGeometry(54,16),new THREE.MeshStandardMaterial({color:0x292821,roughness:1}),0,-2.2,34); bottom.rotation.x=-Math.PI/2; this.macroRoot.add(bottom);
    const cliffMat=new THREE.MeshStandardMaterial({color:0x50483c,roughness:1});
    for(let x=-22;x<=22;x+=2.5){ const z=27.2+Math.sin(x*.8)*.65; const face=mesh(new THREE.BoxGeometry(2.7,2.2,1.2),cliffMat,x,-.95,z); face.rotation.z=Math.sin(x)*.08; this.macroRoot.add(face); if(Math.abs(x)>3)this.macroRoot.add(this.irregularRock(x,.18,z-.3,1.25,.55,1)); }
    const bridge=mesh(new THREE.BoxGeometry(4.2,.35,7),new THREE.MeshStandardMaterial({color:0x65452d,roughness:1}),0,.1,30); this.macroRoot.add(bridge,mesh(new THREE.BoxGeometry(5,1,.55),cliffMat,0,.5,27.2));
    // Broad, softly overlapping soil/grass shapes anchor the village and encounter clearings.
    this.groundPatch(0,5,7,5,0x83ad5a,.2); this.groundPatch(-10,17,5,4,0x70964d,-.35); this.groundPatch(10,-13,5.5,4.5,0x719c50,.25);
  }

  private buildBorderlands(): void { this.ground(0x465b42); this.road([[-12,28],[-10,8],[0,-4]],3.5); this.road([[0,-4],[15,5],[18,28]],3.5);
    for(const [x,z,s] of [[-34,-18,2],[32,-20,2.4],[27,4,1.6],[-30,12,1.8],[12,-22,1.4]] as const)this.macroRoot.add(this.irregularRock(x,s*.5,z,s,s*.7,s));
    this.groundPatch(-13,13,8,6,0x3d503b,.2); this.groundPatch(19,11,10,7,0x515744,-.15); this.groundPatch(12,-17,9,6,0x3f493b,.4);
    // Sparse border watches make the wide eastern extension feel deliberately occupied.
    for(const [x,z] of [[-26,8],[25,-7],[29,17]] as const){ const post=new THREE.Group(); post.name='border watch'; post.userData.cameraOccluder=true;
      post.add(mesh(new THREE.CylinderGeometry(.45,.65,4.2,7),new THREE.MeshStandardMaterial({color:0x554937,roughness:1}),x,2.1,z),mesh(new THREE.ConeGeometry(2,1.5,5),new THREE.MeshStandardMaterial({color:0x343a31,roughness:1}),x,4.65,z)); this.macroRoot.add(post); }
  }

  private ruinSegment(name:string,x:number,z:number,width:number,depth:number,height:number): void {
    const group=new THREE.Group(); group.name=name; group.userData.cameraOccluder=height>2; const horizontal=width>depth, length=Math.max(width,depth), stone=new THREE.MeshStandardMaterial({color:0x666a62,roughness:1});
    for(let p=-length/2;p<length/2;p+=2.1){ const broken=height*(.58+.4*Math.abs(Math.sin(p*1.37))); const block=mesh(new THREE.BoxGeometry(horizontal?1.95:width,broken,horizontal?depth:1.95),stone,x+(horizontal?p:0),broken/2,z+(horizontal?0:p)); block.rotation.y=Math.sin(p)*.035; group.add(block); }
    this.macroRoot.add(group);
  }
  private buildRuinedFortress(): void {
    this.ground(0x686b61); this.road([[-20,0],[-8,0],[0,-5],[0,-28]],4.2);
    // Broken set-back masses replace uniform stacked rows. The south foreground is a 0.5–1.2m cutaway.
    this.ruinSegment('west south ruin',-20,17,2.2,19,2.5);
    this.ruinSegment('north back ruin west',-11,-28,16,2.2,5.5); this.ruinSegment('north back ruin east',11,-28,16,2.2,4.7);
    this.ruinSegment('east fortress wall',20.2,0,1.35,52,5.7);
    const south=new THREE.Group(); south.name='south cutaway foundations';
    for(let x=-19;x<=19;x+=2.4){ const h=.5+(Math.sin(x*1.2)+1)*.3; south.add(mesh(new THREE.BoxGeometry(2.25,h,2),new THREE.MeshStandardMaterial({color:0x666a62,roughness:1}),x,h/2,28)); } this.macroRoot.add(south);
    const tower=new THREE.Group(); tower.name='north-east ruined tower'; tower.userData.cameraOccluder=true;
    for(let y=.6;y<7;y+=1.2) tower.add(this.irregularRock(14,y,-21,3.7,.72,3.5,0x5c6059)); this.macroRoot.add(tower);
    for(const [x,z,s] of [[-16,9,1.3],[-13,-8,1],[14,15,1.5],[8,20,1.2],[15,-18,1.4],[-5,-19,1]] as const)this.macroRoot.add(this.irregularRock(x,.45,z,s,.65,s));
    // Camera-aware interior sets: open/cut-away on the south, taller backdrops to the north.
    // Three connected courtyards retain generous combat floors and obvious broken entrances.
    this.groundPatch(-10,14,7.2,6.2,0x77766b,.1); this.groundPatch(9,12,7.3,6.5,0x74746a,-.18); this.groundPatch(0,-15,9,7,0x747268,.06);
    this.lowWall('west guard court back',-10,8,14,1.1,2.8); this.lowWall('west guard court side',-17,14,1.1,12,1.8);
    this.lowWall('east crystal court back',9,5.5,14,1.1,3.4); this.lowWall('east crystal court side',16,12,1.1,13,2.1);
    this.lowWall('boss court back',0,-22,18,1.25,4.2); this.lowWall('boss court west',-9,-15,1.15,13,2.5); this.lowWall('boss court east',9,-15,1.15,13,2.5);
    // Smaller alcoves and broken corridor shoulders guide the route without enclosing it.
    this.lowWall('west alcove back',-13,-3,7,1,2.4); this.lowWall('east alcove back',13,-4,7,1,3.1);
    this.lowWall('central corridor west',-4,-5,1,8,1.35); this.lowWall('central corridor east',4,-5,1,8,1.35);
    for(const [x,z,s] of [[-6,7,.8],[-2,7,.65],[6,5,.8],[12,5,.65],[-9,-8,.85],[8,-9,.9],[-7,-22,.75],[7,-22,.75]] as const)this.macroRoot.add(this.irregularRock(x,.25,z,s,.45,s,0x5d5e58));
    // A distant broken arch/tower is readable from every courtyard and safe behind combat.
    const landmark=new THREE.Group(); landmark.name='boss court broken keep'; landmark.userData.cameraOccluder=true;
    landmark.add(mesh(new THREE.BoxGeometry(3.2,7,3.2),new THREE.MeshStandardMaterial({color:0x595d58,roughness:1}),-7,3.5,-25),mesh(new THREE.BoxGeometry(3.2,5.3,3.2),new THREE.MeshStandardMaterial({color:0x595d58,roughness:1}),7,2.65,-25)); this.macroRoot.add(landmark);
  }

  private async addAsset(path:string,x:number,z:number,scale:number,rotation=0): Promise<void> { const object=await this.assets.cloneScene(path); object.position.set(x,0,z); object.scale.setScalar(scale); object.rotation.y=rotation; this.assetDetailsRoot.add(object); }
  private async addKaykitAsset(placement: KaykitPlacement): Promise<void> {
    const object=await kaykitAssets.cloneScene(placement.path);
    object.position.set(placement.x,0,placement.z); object.scale.setScalar(placement.scale); object.rotation.y=placement.rotation ?? 0;
    object.traverse((child)=>{ if(child instanceof THREE.Mesh){ child.castShadow=true; child.receiveShadow=true; } });
    this.assetDetailsRoot.add(object);
  }
  private async addFountain(): Promise<void> {
    const object=await gameModelAssets.cloneScene('props/fountain.glb');
    fitModelToFootprint(object,6.2); object.position.z=5;
    object.traverse((child)=>{ if(child instanceof THREE.Mesh){ child.castShadow=true; child.receiveShadow=true; } });
    this.assetDetailsRoot.add(object);
  }
  private async loadDetails(): Promise<void> {
    const jobs: Promise<void>[]=[];
    if(this.area.id===1){
      jobs.push(this.addFountain());
      const spawnPoints=SPAWNS.filter((spawn)=>spawn.areaId===1).map((spawn)=>({ x:spawn.x-this.area.originX,z:spawn.z-this.area.originZ }));
      for(const placement of [...AREA_ONE_KAYKIT_PLACEMENTS,...WEST_BORDER_KAYKIT_PLACEMENTS,...areaOneVegetation(spawnPoints)]) jobs.push(this.addKaykitAsset(placement));
    } else if(this.area.id===2){
      for(const [x,z,s] of [[-31,-18,.85],[-27,13,.9],[-17,-20,.75],[-5,20,.8],[10,-20,.7],[24,-16,.85],[30,8,.8],[18,17,.75]] as const) jobs.push(this.addAsset('nature/models/CommonTree_3.gltf',x,z,s,x));
      for(const [x,z,s] of [[-22,7,.7],[-12,-18,.65],[5,18,.7],[17,-8,.8],[28,19,.75],[31,-19,.7]] as const) jobs.push(this.addAsset('nature/models/Rock_Medium_2.gltf',x,z,s,x));
      for(const [x,z,r] of [[-17,7,.3],[-14,9,.3],[19,-2,-.4],[22,0,-.4],[26,14,.8]] as const) jobs.push(this.addAsset('village/models/Prop_WoodenFence_Extension1.gltf',x,z,.85,r));
    } else {
      for(const placement of AREA_THREE_WALL_PLACEMENTS) jobs.push(this.addKaykitAsset(placement));
      for(const [x,z,s] of [[-16,7,.8],[-7,7,.65],[16,5,.75],[9,5,.7],[-9,-8,.75],[9,-9,.8],[-7,-22,.7],[7,-22,.72]] as const) jobs.push(this.addAsset('village/models/Prop_Brick1.gltf',x,z,s,x));
      for(const [x,z,s,r] of [[-10,14,1.35,0],[9,12,1.3,.3],[0,-15,1.45,-.2],[-13,-3,.9,.2],[13,-4,.9,-.2]] as const) jobs.push(this.addAsset('village/models/Floor_UnevenBrick.gltf',x,z,s,r));
      for(const [x,z,s] of [[-15,19,.6],[15,18,.65],[-15,-10,.6],[14,-12,.65]] as const) jobs.push(this.addAsset('nature/models/Rock_Medium_2.gltf',x,z,s,x));
    }
    const results=await Promise.allSettled(jobs);
    if(results.every((result)=>result.status==='fulfilled')) this.fallbackDetailsRoot.visible=false;
    else console.warn(`Area ${this.area.id} cosmetic details partially unavailable; macro terrain remains playable.`,results.filter((result)=>result.status==='rejected'));
  }

  /** Releases only resources created by this procedural owner; cached GLTF data remains shared. */
  dispose(): void {
    for (const root of [this.terrainRoot, this.macroRoot, this.fallbackDetailsRoot]) root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) material.dispose();
    });
  }
}
