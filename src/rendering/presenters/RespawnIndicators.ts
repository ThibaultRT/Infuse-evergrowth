import * as THREE from 'three';
import { browserClock } from '../../game/PlatformAdapters';
import type { SaveData } from '../../types';
import type { WorldUiManager } from '../WorldUiManager';
import type { SpawnPresentation } from './SpawnPresentation';
type RespawnIndicator = {
  members: SpawnPresentation[];
  center: THREE.Vector3;
  element: HTMLDivElement;
  progress: SVGCircleElement;
  timer: HTMLSpanElement;
};

const GROUP_CIRCUMFERENCE = 2 * Math.PI * 14;
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class RespawnIndicators {
  private readonly indicators: RespawnIndicator[];
  constructor(entities: SpawnPresentation[], host: HTMLElement, private readonly state: SaveData, private readonly worldUi: WorldUiManager) {
    const groupMembers = new Map<string, SpawnPresentation[]>();
    for (const entity of entities) {
      if (!entity.def.group) continue;
      const members = groupMembers.get(entity.def.group) ?? [];
      members.push(entity);
      groupMembers.set(entity.def.group, members);
    }
    const respawnSpawnerMembers: SpawnPresentation[][] = [
      ...Array.from(groupMembers.values()),
      ...entities.filter((entity) => entity.def.tier === 'crystal').map((entity) => [entity])
    ];
    this.indicators = respawnSpawnerMembers.map((members) => {
      const center = members.reduce((sum, entity) => sum.add(entity.spawnPosition), new THREE.Vector3()).multiplyScalar(1 / members.length);
      const element = document.createElement('div');
      element.className = 'group-respawn hidden';
      element.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="respawn-track" cx="18" cy="18" r="14"/><circle class="respawn-progress" cx="18" cy="18" r="14"/></svg><span></span>`;
      const progress = element.querySelector<SVGCircleElement>('.respawn-progress')!;
      progress.style.strokeDasharray = `${GROUP_CIRCUMFERENCE}`;
      progress.style.strokeDashoffset = '0';
      const timer = element.querySelector<HTMLSpanElement>('span')!;
      host.append(element);
      return { members, center, element, progress, timer };
    });

  }
  dispose(): void { this.indicators.forEach(({ element }) => element.remove()); }
  update(currentAreaId: number): void {
    const now = browserClock.now();
    for (const indicator of this.indicators) {
      if (indicator.members[0].def.areaId !== currentAreaId || !indicator.members.some((member) => member.presentationActive) || !indicator.members.every((member) => !member.alive && member.deathPresentationRemaining === 0)) {
        indicator.element.classList.add('hidden');
        continue;
      }
      const states = indicator.members.map((member) => this.state.spawns[member.def.id]);
      const ends = states.map((state) => state.respawnAt).filter((value): value is number => value !== null);
      const starts = states.map((state) => state.defeatedAt).filter((value): value is number => value !== null);
      if (!ends.length || !starts.length) { indicator.element.classList.add('hidden'); continue; }
      const end = Math.min(...ends);
      const start = Math.max(...starts);
      if (end <= now || end <= start) { indicator.element.classList.add('hidden'); continue; }
      indicator.element.classList.remove('hidden');
      const progress = THREE.MathUtils.clamp((end - now) / (end - start), 0, 1);
      indicator.progress.style.strokeDashoffset = `${GROUP_CIRCUMFERENCE * (1 - progress)}`;
      indicator.timer.textContent = formatCountdown(end - now);
      this.worldUi.project(indicator.center, indicator.element, indicator.members[0].def.tier === 'crystal' ? .9 : 1.1);
    }
  }

}
