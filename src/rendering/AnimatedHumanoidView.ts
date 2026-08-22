import * as THREE from 'three';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

const ANIMATIONS = 'animations/UAL1_Standard.glb';

export type HumanoidMotion = 'idle' | 'walk' | 'jog' | 'hit' | 'death';

const CLIPS: Record<HumanoidMotion, readonly string[]> = {
  idle: ['Idle_Loop'],
  walk: ['Walk_Loop'],
  jog: ['Jog_Fwd_Loop'],
  hit: ['Hit_Chest', 'Hit_Head'],
  death: ['Death01']
};

function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; }
  });
}

export abstract class AnimatedHumanoidView {
  readonly root = new THREE.Group();
  protected model: THREE.Object3D | null = null;
  protected mixer: THREE.AnimationMixer | null = null;
  protected readonly hands: Record<'left' | 'right', THREE.Object3D | null> = { left: null, right: null };
  private clips = new Map<string, THREE.AnimationClip>();
  private action: THREE.AnimationAction | null = null;
  private motion: HumanoidMotion = 'idle';
  private oneShotRemaining = 0;

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
      enableShadows(model);
      this.model = model;
      this.hands.left = model.getObjectByName('hand_l') ?? null;
      this.hands.right = model.getObjectByName('hand_r') ?? null;
      this.clips = new Map(animationAsset.animations.map((clip) => [clip.name, clip]));
      this.mixer = new THREE.AnimationMixer(model);
      this.root.clear();
      this.root.add(model);
      this.play('idle', 0);
      await this.onModelReady();
    } catch (error) {
      console.warn('Quaternius humanoid unavailable; keeping procedural fallback.', error);
    }
  }

  protected async onModelReady(): Promise<void> {}

  protected attach(hand: 'left' | 'right', object: THREE.Object3D): boolean {
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
  playDeath(): void { this.playOneShot('death'); }
  get animationReady(): boolean { return this.mixer !== null; }

  updateAnimation(dt: number, active = true): void {
    if (!active || !this.mixer) return;
    this.mixer.update(dt);
    if (this.oneShotRemaining > 0) {
      this.oneShotRemaining -= dt;
      if (this.oneShotRemaining <= 0 && this.motion !== 'death') this.play('idle');
    }
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
