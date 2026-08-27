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
  return root;
}

/** Enemy rarity is now communicated by the enemy asset itself; ground rings are intentionally disabled. */
export function makeTierRing(_color: number): THREE.Group {
  return new THREE.Group();
}

export function makePortal(): { root: THREE.Group; barrier: THREE.Mesh; glow: THREE.MeshStandardMaterial } {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x505866, roughness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x6ad8ff, emissive: 0x6ad8ff, emissiveIntensity: 0.18, roughness: 0.35 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x222b38, emissive: 0x101722, emissiveIntensity: 0.15, transparent: true, opacity: 0.92, roughness: 0.55 });

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.48, 3.5, 0.58), stone); left.position.set(-1.18, 1.75, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.48, 3.5, 0.58), stone); right.position.set(1.18, 1.75, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.48, 0.58), stone); top.position.set(0, 3.28, 0);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 8, 32, Math.PI), glow); inner.rotation.z = Math.PI; inner.position.y = 2.02;
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 2.75), barrierMaterial); barrier.position.set(0, 1.63, 0.08);

  root.add(left, right, top, inner, barrier);
  return { root, barrier, glow };
}

export function addRock(scene: THREE.Scene, x: number, z: number, scale: number): void {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), new THREE.MeshStandardMaterial({ color: 0x68706e, roughness: 1 }));
  rock.position.set(x, scale * 0.55, z); rock.scale.y = 0.72; rock.rotation.set(x * 0.17, z * 0.11, x * z * 0.01); scene.add(rock);
}
