import * as THREE from 'three';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

const ANIMATIONS = 'animations/UAL1_Standard.glb';

export type HumanoidMotion = 'idle' | 'walk' | 'jog' | 'hit' | 'death';
export type HumanoidHand = 'left' | 'right';

const CLIPS: Record<HumanoidMotion, readonly string[]> = {
  idle: ['Idle_Loop'],
  walk: ['Walk_Loop'],
  jog: ['Jog_Fwd_Loop'],
  hit: ['Hit_Chest', 'Hit_Head'],
  death: ['Death01']
};

export abstract class AnimatedHumanoidView {
  readonly root = new THREE.Group();
  protected model: THREE.Object3D | null = null;
  protected mixer: THREE.AnimationMixer | null = null;
  protected readonly hands: Record<HumanoidHand, THREE.Object3D | null> = { left: null, right: null };
  private clips = new Map<string, THREE.AnimationClip>();
  private readonly limbMixers: Record<HumanoidHand, THREE.AnimationMixer | null> = { left: null, right: null };
  private readonly limbActions: Record<HumanoidHand, Map<string, THREE.AnimationAction>> = { left: new Map(), right: new Map() };
  private readonly limbRemaining: Record<HumanoidHand, number> = { left: 0, right: 0 };
  private action: THREE.AnimationAction | null = null;
  private motion: HumanoidMotion = 'idle';
  private oneShotRemaining = 0;
  private deathRequested = false;

  protected constructor(fallback: THREE.Object3D, protected readonly assets: AssetLoader = quaterniusAssets) {
    fallback.name = 'procedural-fallback';
    this.root.add(fallback);
  }

  protected async loadModel(path: string): Promise<void> {
    try {
      const [model, animationAsset] = await Promise.all([
        this.assets.cloneSkinnedScene(path),
        this.assets.load(ANIMATIONS)
      ]);
      this.model = model;
      this.hands.left = model.getObjectByName('hand_l') ?? null;
      this.hands.right = model.getObjectByName('hand_r') ?? null;
      this.clips = new Map(animationAsset.animations.map((clip) => [clip.name, clip]));
      this.mixer = new THREE.AnimationMixer(model);
      this.buildLimbLayers(model);
      this.root.clear();
      this.root.add(model);
      this.play('idle', 0);
      await this.onModelReady();
    } catch (error) {
      console.warn('Quaternius humanoid unavailable; keeping procedural fallback.', error);
    }
  }

  protected async onModelReady(): Promise<void> {}

  protected attach(hand: HumanoidHand, object: THREE.Object3D): boolean {
    const bone = this.hands[hand];
    if (!bone) return false;
    bone.add(object);
    return true;
  }

  setMotion(motion: 'idle' | 'walk' | 'jog'): void {
    if (this.oneShotRemaining > 0 || motion === this.motion) return;
    this.play(motion);
  }

  playHit(): void { this.playOneShot('hit'); }
  playDeath(): void { this.stopLimbLayers(); this.deathRequested = true; this.playOneShot('death'); }
  get animationReady(): boolean { return this.mixer !== null; }
  get deathAnimationFinished(): boolean { return this.deathRequested && this.oneShotRemaining <= 0; }

  updateAnimation(dt: number, active = true): void {
    if (!active || !this.mixer) return;
    this.mixer.update(dt);
    for (const side of ['left', 'right'] as const) {
      if (this.limbRemaining[side] <= 0) continue;
      this.limbMixers[side]?.update(dt);
      this.limbRemaining[side] = Math.max(0, this.limbRemaining[side] - dt);
      if (this.limbRemaining[side] === 0) this.stopLimbLayer(side);
    }
    if (this.oneShotRemaining > 0) {
      this.oneShotRemaining -= dt;
      if (this.oneShotRemaining <= 0 && this.motion !== 'death') this.play('idle');
    }
  }

  /** Plays a cached arm-only clip after locomotion, leaving the other arm and legs independent. */
  protected playLimbClip(side: HumanoidHand, clipName: string, duration: number): boolean {
    const action = this.limbActions[side].get(clipName);
    const clip = action?.getClip();
    if (!action || !clip) return false;
    this.stopLimbLayer(side);
    const presentationDuration = Math.max(duration, Number.EPSILON);
    action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(clip.duration / presentationDuration).play();
    action.clampWhenFinished = false;
    this.limbRemaining[side] = presentationDuration;
    return true;
  }

  protected getRigBone(name: string): THREE.Object3D | null { return this.model?.getObjectByName(name) ?? null; }

  private buildLimbLayers(model: THREE.Object3D): void {
    for (const side of ['left', 'right'] as const) {
      const suffix = `_${side === 'left' ? 'l' : 'r'}`;
      const mixer = new THREE.AnimationMixer(model);
      this.limbMixers[side] = mixer;
      for (const clipName of ['Punch_Jab', 'Punch_Cross', 'Sword_Attack']) {
        const source = this.clips.get(clipName);
        if (!source) continue;
        const tracks = source.tracks.filter((track) => track.name.slice(0, track.name.lastIndexOf('.')).endsWith(suffix));
        if (!tracks.length) continue;
        const clip = new THREE.AnimationClip(`${clipName}:${side}`, source.duration, tracks);
        this.limbActions[side].set(clipName, mixer.clipAction(clip));
      }
    }
  }

  private stopLimbLayer(side: HumanoidHand): void {
    this.limbActions[side].forEach((action) => action.stop());
    this.limbRemaining[side] = 0;
  }

  private stopLimbLayers(): void {
    this.stopLimbLayer('left');
    this.stopLimbLayer('right');
  }

  private playOneShot(motion: 'hit' | 'death'): void {
    const names = CLIPS[motion];
    const clip = this.clips.get(names[Math.floor(Math.random() * names.length)]);
    if (!clip || !this.mixer) return;
    this.motion = motion;
    this.oneShotRemaining = clip.duration;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    this.crossFade(next, .08);
  }

  private play(motion: 'idle' | 'walk' | 'jog', fade = .16): void {
    const clip = CLIPS[motion].map((name) => this.clips.get(name)).find(Boolean);
    if (!clip || !this.mixer) return;
    this.motion = motion;
    this.oneShotRemaining = 0;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    this.crossFade(next, fade);
  }

  private crossFade(next: THREE.AnimationAction, duration: number): void {
    if (this.action && this.action !== next) this.action.fadeOut(duration);
    next.fadeIn(duration).play();
    this.action = next;
  }
}
