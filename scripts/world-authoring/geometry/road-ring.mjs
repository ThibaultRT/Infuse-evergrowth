import * as THREE from 'three';
import { RING_OFFSET_BIAS, RING_SEGMENTS, ROAD_OFFSET } from '../constants.mjs';
import { cloneTilingMaterial } from './road-ribbon.mjs';

export function buildRing(guide, localOrigin) {
  const { innerRadius: inner, outerRadius: outer }=guide.style; const positions=[]; const normals=[]; const uvs=[]; const indices=[];
  for(let i=0;i<=RING_SEGMENTS;i++){const angle=(i/RING_SEGMENTS)*Math.PI*2; const c=Math.cos(angle),s=Math.sin(angle); for(const radius of [inner,outer]){positions.push(localOrigin.x+c*radius,localOrigin.y+ROAD_OFFSET+RING_OFFSET_BIAS,localOrigin.z+s*radius); normals.push(0,1,0);} uvs.push(0,i/RING_SEGMENTS,1,i/RING_SEGMENTS); if(i<RING_SEGMENTS){const n=i*2;indices.push(n,n+2,n+1,n+2,n+3,n+1);}}
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)); geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices); geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry,cloneTilingMaterial(guide.style.style.material));
}
