import * as THREE from 'three';

export function makeHumanoid(primary: number, hero = false): THREE.Group {
  const root = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: hero ? 0xf0bd96 : 0xd8ae89, roughness: 0.82 });
  const cloth = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.78 });
  const hair = new THREE.MeshStandardMaterial({ color: hero ? 0x1c2330 : 0x3a2c27, roughness: 0.9 });
  const underwear = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.88 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(hero ? 0.72 : 0.7, 1, 0.38), hero ? skin : cloth); torso.position.y = 1.65;
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.4), hero ? underwear : cloth); pelvis.position.y = 1.04;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), skin); head.position.y = 2.42; head.scale.y = 1.08;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.325, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hair); hairCap.position.set(0, 2.52, 0);
  root.add(torso, pelvis, head, hairCap);
  const arms = new THREE.CylinderGeometry(0.11, 0.095, 0.9, 8), legs = new THREE.CylinderGeometry(0.13, 0.115, 0.92, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(arms, skin); arm.position.set(side * 0.48, 1.6, 0); arm.rotation.z = side * 0.08; root.add(arm);
    const leg = new THREE.Mesh(legs, skin); leg.position.set(side * 0.2, 0.5, 0); root.add(leg);
  }
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

export function makeCrystal(color: number): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.15 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), material); core.scale.y = 1.55; core.position.y = 0.9; core.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 0.28, 7), new THREE.MeshStandardMaterial({ color: 0x53616a, roughness: 1 })); base.position.y = 0.14; base.castShadow = true;
  root.add(core, base); return root;
}

export function makeTierRing(color: number): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; return ring;
}

export function addRock(scene: THREE.Scene, x: number, z: number, scale: number): void {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), new THREE.MeshStandardMaterial({ color: 0x68706e, roughness: 1 }));
  rock.position.set(x, scale * 0.55, z); rock.scale.y = 0.72; rock.rotation.set(x * 0.17, z * 0.11, x * z * 0.01); rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
}
