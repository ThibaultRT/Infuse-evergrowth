import * as THREE from 'three';
import { MIN_STYLE_SIZE } from './constants.mjs';

const AREA_ROOT = /^Area_(A\d{2})_Root$/;
const TRANSITION_ROOT = /^Transition_(A\d{2})_(A\d{2})_([A-Za-z][A-Za-z0-9]*)$/;
const GUIDE = /^GUIDE_(ROAD_RING|ROAD|RIVER)_([A-Za-z0-9][A-Za-z0-9_-]*)$/;
const POINT = /^P_(\d{3})$/;
const PLACEMENT = /^Placement_(?:A\d{2}|Transition_A\d{2}_A\d{2})$/;

function near(a, b) { return Math.abs(a - b) < 1e-6; }
function assertIdentity(object, errors) {
  if (![object.position.x, object.position.y, object.position.z, object.rotation.x, object.rotation.y, object.rotation.z].every(v => near(v, 0)) ||
      ![object.scale.x, object.scale.y, object.scale.z].every(v => near(v, 1))) {
    errors.push(`${object.name} must have local position/rotation 0 and scale 1.`);
  }
}
function shippingInfo(object) {
  const area = AREA_ROOT.exec(object.name);
  if (area) return { id: area[1], kind: 'area', output: `areas/area-${area[1].toLowerCase()}.glb` };
  const transition = TRANSITION_ROOT.exec(object.name);
  if (!transition) return null;
  const theme = transition[3].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return { id: `${transition[1]}-${transition[2]}`, kind: 'transition', output: `transitions/transition-${transition[1].toLowerCase()}-${transition[2].toLowerCase()}-${theme}.glb` };
}
function findPlacement(object) {
  for (let current = object.parent; current; current = current.parent) if (PLACEMENT.test(current.name)) return current;
  return null;
}
function meshesNamed(root, name) {
  const found = [];
  root.traverse(o => { if (o.name === name && o.isMesh) found.push(o); });
  return found;
}
function styleForStrip(guide, errors) {
  const styles = meshesNamed(guide, 'STYLE');
  if (styles.length !== 1) { errors.push(`${guide.name} requires exactly one mesh named STYLE.`); return null; }
  const style = styles[0];
  const box = new THREE.Box3().setFromObject(style);
  const size = box.getSize(new THREE.Vector3());
  const horizontal = [size.x, size.z].sort((a, b) => a - b);
  if (!horizontal.every(Number.isFinite) || horizontal[0] <= MIN_STYLE_SIZE) { errors.push(`${guide.name} STYLE has invalid world-space XZ dimensions.`); return null; }
  return { style, width: horizontal[0], referenceLength: horizontal[1] };
}
function styleForRing(guide, errors) {
  const styles = meshesNamed(guide, 'STYLE');
  if (styles.length !== 1) { errors.push(`${guide.name} requires exactly one mesh named STYLE.`); return null; }
  const style = styles[0];
  const position = new THREE.Vector3(); const origin = new THREE.Vector3(); guide.getWorldPosition(origin);
  const radii = [];
  const attribute = style.geometry?.getAttribute('position');
  if (attribute) for (let i = 0; i < attribute.count; i++) { position.fromBufferAttribute(attribute, i).applyMatrix4(style.matrixWorld); radii.push(Math.hypot(position.x-origin.x, position.z-origin.z)); }
  const positive = radii.filter(r => Number.isFinite(r) && r > MIN_STYLE_SIZE).sort((a,b)=>a-b);
  if (positive.length < 4 || positive.at(-1) - positive[0] <= MIN_STYLE_SIZE) { errors.push(`${guide.name} STYLE cannot provide reliable inner/outer radii.`); return null; }
  return { style, innerRadius: positive[0], outerRadius: positive.at(-1), origin };
}
function pointsFor(guide, errors) {
  const seen = new Set(); const points = [];
  guide.traverse(object => {
    if (!object.name.startsWith('P_')) return;
    const match = POINT.exec(object.name);
    if (!match) { errors.push(`${guide.name} has malformed point ${object.name}; expected P_###.`); return; }
    const number = Number(match[1]);
    if (seen.has(number)) { errors.push(`${guide.name} has duplicate point number ${match[1]}.`); return; }
    seen.add(number); points.push({ number, position: object.getWorldPosition(new THREE.Vector3()) });
  });
  points.sort((a,b)=>a.number-b.number);
  if (points.length < 2) errors.push(`${guide.name} requires at least two P_### points.`);
  return points.map(p => p.position);
}

export function parseWorld(scene) {
  const errors = []; const warnings = []; const chunks = []; const guides = []; const rootNames = new Set();
  scene.traverse(object => {
    const info = shippingInfo(object); if (!info) return;
    if (rootNames.has(object.name)) errors.push(`Duplicate shipping root ${object.name}.`); rootNames.add(object.name);
    assertIdentity(object, errors);
    const placement = findPlacement(object);
    if (!placement) errors.push(`${object.name} is not inside a canonical Placement_* parent.`);
    chunks.push({ ...info, rootName: object.name, root: object, placement, worldPosition: placement?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3() });
  });
  scene.traverse(object => {
    const match = GUIDE.exec(object.name); if (!match) return;
    const placement = findPlacement(object);
    const owners = chunks.filter(chunk => chunk.placement === placement);
    if (owners.length !== 1) { errors.push(`${object.name} placement must contain exactly one shipping root; found ${owners.length}.`); return; }
    const type = match[1] === 'ROAD_RING' ? 'road-ring' : match[1].toLowerCase();
    const style = type === 'road-ring' ? styleForRing(object, errors) : styleForStrip(object, errors);
    const points = type === 'road-ring' ? [] : pointsFor(object, errors);
    guides.push({ type, id: match[2], owner: owners[0], object, style, points });
  });
  if (!chunks.length) errors.push('No canonical Area_A##_Root or Transition_A##_A##_Theme roots were found.');
  for (const chunk of chunks) {
    const roots = chunks.filter(other => other.placement === chunk.placement);
    if (roots.length > 1) errors.push(`${chunk.placement?.name ?? '<missing placement>'} contains multiple shipping roots.`);
    chunk.root.traverse(object => { if ((object.isCamera || object.isLight || object.isHelper) && !object.name.startsWith('PRODUCTION_')) warnings.push(`${chunk.rootName} contains suspicious editor object ${object.name || object.type}.`); });
  }
  return { chunks, guides, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
