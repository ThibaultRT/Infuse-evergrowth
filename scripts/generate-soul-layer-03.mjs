import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// A fixed seed makes the varied effect layout reproducible and safe for saves.
let seed = 20260924;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x100000000; }
const templates = [
  ['Deep Vitality', 'maxHpAdditive', 2000, '+2,000 Max HP per level', 5],
  ['Renewing Weave', 'regenAdditive', 4, '+4 HP/s per level', 5],
  ['Blunt Surge', 'attackPercentAdditive', .015, '+1.5% Blunt damage per level', 5, 'damageType', 'blunt'],
  ['Slash Surge', 'attackPercentAdditive', .015, '+1.5% Slash damage per level', 5, 'damageType', 'slash'],
  ['Piercing Surge', 'attackPercentAdditive', .015, '+1.5% Piercing damage per level', 5, 'damageType', 'piercing'],
  ['Epic Harvest', 'soulDropAdditive', 1, '+1 Epic Soul per eligible Epic enemy', 1, 'soulType', 'epic'],
  ['Common Abundance', 'soulDropAdditive', 3, '+3 Common Souls per eligible Common enemy', 1, 'soulType', 'common'],
  ['Uncommon Abundance', 'soulDropAdditive', 2, '+2 Uncommon Souls per eligible Uncommon enemy', 1, 'soulType', 'uncommon'],
  ['Blunt Ward', 'damageResistancePercentAdditive', .015, '+1.5% Blunt resistance per level', 4, 'damageType', 'blunt'],
  ['Slash Ward', 'damageResistancePercentAdditive', .015, '+1.5% Slash resistance per level', 4, 'damageType', 'slash'],
  ['Piercing Ward', 'damageResistancePercentAdditive', .015, '+1.5% Piercing resistance per level', 4, 'damageType', 'piercing'],
  ['Phantom Step', 'evasionChanceAdditive', .005, '+0.5% Evasion per level', 3],
  ['Swift Current', 'speedRawAdditive', 15, '+15 Speed raw per level', 5],
  ['Critical Insight', 'criticalChanceRawAdditive', 20, '+20 Critical Chance raw per level', 5],
  ['Critical Echo', 'criticalDamageRawAdditive', 35, '+35 Critical Damage raw per level', 5],
  ['Fortified Guard', 'blockChanceRawAdditive', 7, '+7 Block Chance raw per level', 5],
  ['Fervent Vitality', 'maxHpAdditive', 3500, '+3,500 Max HP per level', 5],
  ['Fervent Mending', 'regenAdditive', 7, '+7 HP/s per level', 5],
  ['Blunt Might', 'attackAdditive', 24, '+24 Blunt attack per level', 5, 'damageType', 'blunt'],
  ['Slash Might', 'attackAdditive', 24, '+24 Slash attack per level', 5, 'damageType', 'slash'],
  ['Piercing Might', 'attackAdditive', 24, '+24 Piercing attack per level', 5, 'damageType', 'piercing'],
  ['Blunt Bastion', 'defenceAdditive', 20, '+20 Blunt defence per level', 5, 'damageType', 'blunt'],
  ['Slash Bastion', 'defenceAdditive', 20, '+20 Slash defence per level', 5, 'damageType', 'slash'],
  ['Piercing Bastion', 'defenceAdditive', 20, '+20 Piercing defence per level', 5, 'damageType', 'piercing'],
  ['Rare Bounty', 'soulDropAdditive', 2, '+2 Rare Souls per eligible Rare enemy', 1, 'soulType', 'rare'],
  ['Blunt Ascendance', 'attackPercentAdditive', .02, '+2% Blunt damage per level', 5, 'damageType', 'blunt'],
  ['Slash Ascendance', 'attackPercentAdditive', .02, '+2% Slash damage per level', 5, 'damageType', 'slash'],
  ['Piercing Ascendance', 'attackPercentAdditive', .02, '+2% Piercing damage per level', 5, 'damageType', 'piercing'],
];
for (let index = templates.length - 1; index > 0; index -= 1) {
  const chosen = Math.floor(random() * (index + 1));
  [templates[index], templates[chosen]] = [templates[chosen], templates[index]];
}
const harvest = templates.findIndex(([name]) => name === 'Epic Harvest');
[templates[harvest], templates[16]] = [templates[16], templates[harvest]];
const ordered = [
  ['Rare Resonance II', 'soulDropAdditive', 1, '+1 Rare Soul per eligible Rare enemy', 1, 'soulType', 'rare'],
  ...templates.slice(0, 3),
  ['Epic Resonance', 'unlockSoulDrop', null, 'Unlock Epic Soul drops from Epic enemies (base 1)', 1, 'soulType', 'epic'],
  ...templates.slice(3),
];

const source = JSON.parse(await readFile(new URL('../src/data/soul-catcher/layer-02.json', import.meta.url), 'utf8'));
assert.equal(source.nodes.length, 30);
assert.equal(ordered.length, 30);
const nodes = source.nodes.map((sourceNode, index) => {
  const [name, type, amount, display, maxLevel, property, value] = ordered[index];
  const number = 61 + index;
  const soulType = [10, 15, 20, 25, 29].includes(index) ? 'epic' : 'rare';
  // Layer 2's 25 Rare Soul entry price anchors a rising curve with small seeded price variation.
  const rareBase = index === 0 ? 25 : Math.max(25, Math.round(25 * 1.055 ** index * (0.94 + random() * 0.12) / 5) * 5);
  const base = soulType === 'epic' ? Math.max(4, Math.round(rareBase * 80 / 500)) : rareBase;
  const effect = { type, ...(property ? { [property]: value } : {}), ...(amount === null ? {} : { amountPerLevel: amount }) };
  const neighbors = index === 0 ? ['SC-62', 'SC-64', 'SC-65'] : sourceNode.neighbors.map((id) => `SC-${Number(id.slice(3)) + 30}`);
  return {
    number, id: `SC-${number}`, name, position: sourceNode.position, maxLevel,
    cost: { soulType, base, multiplier: 1.35, formula: 'ceil(base * multiplier ** (level - 1))' },
    reward: { effects: [effect], display }, neighbors,
  };
});
const output = new URL('../src/data/soul-catcher/layer-03.json', import.meta.url);
await writeFile(output, `${JSON.stringify({ schemaVersion: 2, layer: 3, name: 'Third Layer', nodes }, null, 2)}\n`);
console.log(`Wrote ${nodes.length} Layer 3 nodes to ${output.pathname}`);
