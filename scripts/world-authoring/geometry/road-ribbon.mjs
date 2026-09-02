import * as THREE from 'three';
import { MAX_SEGMENTS, MIN_SEGMENTS, ROAD_OFFSET, SAMPLE_SPACING } from '../constants.mjs';

export function cloneTilingMaterial(source) {
  const material = source.clone();
  for (const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap']) {
    if (!material[key]) continue;
    material[key] = material[key].clone(); material[key].wrapS = THREE.RepeatWrapping; material[key].wrapT = THREE.RepeatWrapping; material[key].needsUpdate = true;
  }
  return material;
}

export function makeRibbonGeometry(points, width, referenceLength, offset = ROAD_OFFSET) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.ceil(length / SAMPLE_SPACING)));
  const positions = []; const normals = []; const uvs = []; const indices = []; let distance = 0;
  let previous = null; let lastSide = new THREE.Vector3(1,0,0);
  for (let i=0;i<=segments;i++) {
    const t=i/segments; const center=curve.getPoint(t); const tangent=curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z,0,tangent.x);
    if (side.lengthSq()<1e-10) side.copy(lastSide); else { side.normalize(); lastSide=side.clone(); }
    if (previous) distance += center.distanceTo(previous); previous=center.clone();
    const left=center.clone().addScaledVector(side,width/2); const right=center.clone().addScaledVector(side,-width/2); left.y+=offset; right.y+=offset;
    positions.push(left.x,left.y,left.z,right.x,right.y,right.z); normals.push(0,1,0,0,1,0); uvs.push(0,distance/referenceLength,1,distance/referenceLength);
    if(i<segments){const n=i*2;indices.push(n,n+2,n+1,n+2,n+3,n+1);}
  }
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

export function buildRibbon(guide, localPoints, name, offset) {
  const geometry=makeRibbonGeometry(localPoints,guide.style.width,guide.style.referenceLength,offset);
  return new THREE.Mesh(geometry,cloneTilingMaterial(guide.style.style.material));
}
