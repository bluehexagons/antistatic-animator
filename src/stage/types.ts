/**
 * Stage scene authoring types copied from Antistatic's game-side schema.
 * Licensed for this repository under MIT with the maintainer's permission.
 */

export const STAGE_SCENE_SCHEMA_VERSION = 2 as const;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type NumberRange = [number, number];

export interface StageSpawn {
  x: number;
  y: number;
  face: boolean;
}

export interface CameraAnchor {
  x: number;
  y: number;
  weight: number;
}

export interface StageMaterial {
  file: string;
  name: string;
  metallic?: number;
  roughness?: number;
  ambientOcclusion?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  specularIor?: number;
  emissive?: Vec3;
  emissiveStrength?: number;
  recolor?: { name: string; rgba: Vec4 };
}

export interface StageModel {
  id: string;
  name?: string;
  primitive?: {
    type: 'box' | 'sphere' | 'torus';
    segments?: number;
    rings?: number;
    tubeRadius?: number;
  };
  castsShadows?: boolean;
  scale?: Vec3;
  size?: Vec3;
  position?: Vec3;
  rotation?: Vec4 | { pitch?: number; yaw?: number; roll?: number };
  angularVelocity?: Vec3;
  material?: StageMaterial;
}

export type StageCollisionFlag =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'solid'
  | 'blastZone'
  | 'leftGrabbable'
  | 'rightGrabbable'
  | 'symmetric'
  | 'asymmetric'
  | 'grounded'
  | 'skip';

export interface StageCollision {
  id: string;
  from: Vec2;
  to: Vec2;
  flags: StageCollisionFlag[];
  model?: string;
  properties?: Record<string, unknown>;
}

export interface StagePointLight {
  id: string;
  position?: Vec3;
  color?: Vec3;
  intensity?: number;
  range?: number;
  sourceRadius?: number;
  castsShadows?: boolean;
}

export interface StageFogVolume {
  id: string;
  position?: Vec3;
  radius?: number;
  density?: number;
  color?: Vec3;
}

export interface StageParticleEmitter {
  id: string;
  shape?: 'box' | 'ellipsoid';
  target?: string;
  position?: Vec3;
  size?: Vec3;
  color?: Vec4;
  colorEnd?: Vec4;
  rate?: number;
  velocity?: Vec3;
  velocityJitter?: Vec3;
  radius?: NumberRange;
  lifetime?: NumberRange;
  gravity?: number | NumberRange;
  geometry?: boolean;
  lightProbability?: number;
  glowStrength?: number;
  shading?: 'lit' | 'emissive';
  flicker?: number;
  opacityFadeIn?: number;
  opacityFadeOut?: number;
  scaleStart?: number;
  scaleEnd?: number;
  windInfluence?: number;
  inheritWind?: boolean;
  nearFade?: number;
}

export interface StageAnimationKeyframe {
  time: number;
  position: Vec2 | Vec3;
}

export interface StageAnimationTrack {
  target: { kind: 'collision' | 'model'; id: string };
  keyframes: StageAnimationKeyframe[];
}

export interface StageAnimation {
  id: string;
  autoplay?: boolean;
  loop?: boolean;
  pingPong?: boolean;
  randomStart?: boolean;
  speed?: number;
  duration?: number;
  tracks: StageAnimationTrack[];
}

export interface StageScene {
  schemaVersion: typeof STAGE_SCENE_SCHEMA_VERSION;
  models?: StageModel[];
  collision?: StageCollision[];
  collisionModel?: {
    depth?: number;
    thickness?: number;
    z?: number;
    castsShadows?: boolean;
    material?: StageMaterial;
  };
  animations?: StageAnimation[];
  effects?: {
    pointLights?: StagePointLight[];
    fogVolumes?: StageFogVolume[];
    particleEmitters?: StageParticleEmitter[];
  };
}

export interface StageLighting {
  sunDirection?: Vec3;
  sunColor?: Vec3;
  sunIntensity?: number;
  ambientColor?: Vec3;
  backgroundColor?: Vec3;
  reflectionProbe?: Partial<
    Record<'positiveX' | 'negativeX' | 'positiveY' | 'negativeY' | 'positiveZ' | 'negativeZ', Vec3>
  >;
  environmentMap?: string;
  environmentRotation?: number;
  fogNear?: number;
  fogFar?: number;
  atmosphere?: {
    color?: Vec3;
    density?: number;
    height?: number;
    heightFalloff?: number;
    smokeDensity?: number;
    smokeScale?: number;
    smokeSpeed?: number;
    smokeDirection?: Vec3;
    wind?: Vec3;
    sunScattering?: number;
    pointLightScattering?: number;
    anisotropy?: number;
  };
  colorGrading?: {
    tint?: Vec3;
    saturation?: number;
    contrast?: number;
    exposure?: number;
    vignette?: number;
  };
}

export interface StageDocument {
  name: string;
  order: number;
  kind?: '' | 'neutral' | 'counterpick' | 'misc';
  blastLeft?: number;
  blastTop?: number;
  blastBottom?: number;
  blastRight?: number;
  anchors: CameraAnchor[];
  entrances: StageSpawn[];
  spawns: StageSpawn[];
  scaleX?: number;
  scaleY?: number;
  symmetric?: boolean;
  pivot?: number;
  reverbPreset?: 'none' | 'largeRoom' | 'hangar' | 'cave' | 'generic' | 'plain' | 'outdoor';
  lighting?: StageLighting;
  scene: StageScene;
}

export type StageSelectionKind =
  | 'stage'
  | 'model'
  | 'collision'
  | 'pointLight'
  | 'fogVolume'
  | 'particleEmitter'
  | 'animation';

export interface StageSelection {
  kind: StageSelectionKind;
  id?: string;
}
