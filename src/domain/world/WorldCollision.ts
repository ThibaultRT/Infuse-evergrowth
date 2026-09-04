import type { WorldVec2 } from './WorldPlacement';

export type CollisionActivation = {
  readonly kind: 'connection-locked';
  readonly connectionId: string;
};

export type RectangleCollisionProxy = {
  readonly kind: 'rectangle';
  readonly center: WorldVec2;
  readonly width: number;
  readonly depth: number;
  readonly rotation?: number;
};

export type CircleCollisionProxy = {
  readonly kind: 'circle';
  readonly center: WorldVec2;
  readonly radius: number;
};

export type CollisionProxy = RectangleCollisionProxy | CircleCollisionProxy;

type WorldCollisionShapeBase = {
  readonly id: string;
  readonly sourceChunkId: string;
  readonly sourcePlacementName?: string;
  readonly activation?: CollisionActivation;
};

export type WorldRectangleCollision = WorldCollisionShapeBase & {
  readonly kind: 'rectangle';
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
};

export type WorldCircleCollision = WorldCollisionShapeBase & {
  readonly kind: 'circle';
  readonly x: number;
  readonly z: number;
  readonly radius: number;
};

export type WorldCollisionShape = WorldRectangleCollision | WorldCircleCollision;
