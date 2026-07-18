import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import * as JSONC from 'jsonc-parser';
import stageSchema from './stage.schema.json';
import type {
  StageAnimation,
  StageCollision,
  StageDocument,
  StageFogVolume,
  StageModel,
  StageParticleEmitter,
  StagePointLight,
  StageSelection,
  StageSelectionKind,
} from './types';
import { STAGE_SCENE_SCHEMA_VERSION } from './types';

export interface StageIssue {
  path: string;
  message: string;
}

export interface StageParseResult {
  document: StageDocument | null;
  issues: StageIssue[];
}

export interface StageSceneItem {
  selection: StageSelection;
  label: string;
  badge: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const validateSchema = ajv.compile(stageSchema);
const formattingOptions: JSONC.FormattingOptions = { tabSize: 2, insertSpaces: true, eol: '\n' };

const schemaIssue = (error: ErrorObject): StageIssue => ({
  path: error.instancePath || '/',
  message: error.message ?? 'invalid value',
});

const semanticIssues = (stage: StageDocument): StageIssue[] => {
  const issues: StageIssue[] = [];
  const collectIds = (kind: string, values: { id: string }[] | undefined) => {
    const ids = new Set<string>();
    for (const value of values ?? []) {
      if (ids.has(value.id))
        issues.push({ path: `/scene/${kind}`, message: `duplicate id "${value.id}"` });
      ids.add(value.id);
    }
    return ids;
  };
  const modelIds = collectIds('models', stage.scene.models);
  const collisionIds = collectIds('collision', stage.scene.collision);
  collectIds('effects/pointLights', stage.scene.effects?.pointLights);
  collectIds('effects/fogVolumes', stage.scene.effects?.fogVolumes);
  collectIds('effects/particleEmitters', stage.scene.effects?.particleEmitters);
  collectIds('animations', stage.scene.animations);

  for (const collision of stage.scene.collision ?? []) {
    const directions = collision.flags.filter((flag) =>
      ['left', 'right', 'top', 'bottom'].includes(flag)
    );
    if (directions.length !== 1) {
      issues.push({
        path: `/scene/collision/${collision.id}/flags`,
        message: 'must have exactly one surface direction',
      });
    }
    if (collision.model && !modelIds.has(collision.model)) {
      issues.push({
        path: `/scene/collision/${collision.id}/model`,
        message: `unknown model "${collision.model}"`,
      });
    }
  }
  for (const emitter of stage.scene.effects?.particleEmitters ?? []) {
    if (emitter.target && !modelIds.has(emitter.target)) {
      issues.push({
        path: `/scene/effects/particleEmitters/${emitter.id}/target`,
        message: `unknown model "${emitter.target}"`,
      });
    }
  }
  for (const animation of stage.scene.animations ?? []) {
    const targets = new Set<string>();
    for (const track of animation.tracks) {
      const targetKey = `${track.target.kind}:${track.target.id}`;
      if (targets.has(targetKey)) {
        issues.push({
          path: `/scene/animations/${animation.id}/tracks`,
          message: `duplicate target "${targetKey}"`,
        });
      }
      targets.add(targetKey);
      const ids = track.target.kind === 'model' ? modelIds : collisionIds;
      if (!ids.has(track.target.id)) {
        issues.push({
          path: `/scene/animations/${animation.id}/tracks`,
          message: `unknown ${track.target.kind} "${track.target.id}"`,
        });
      }
    }
  }
  return issues;
};

export const validateStageDocument = (value: unknown): StageIssue[] => {
  if (!validateSchema(value)) return (validateSchema.errors ?? []).map(schemaIssue);
  return semanticIssues(value as StageDocument);
};

export const parseStageDocument = (source: string): StageParseResult => {
  const parseErrors: JSONC.ParseError[] = [];
  const value = JSONC.parse(source, parseErrors);
  if (parseErrors.length > 0) {
    return {
      document: null,
      issues: parseErrors.map((error) => ({
        path: '/',
        message: JSONC.printParseErrorCode(error.error),
      })),
    };
  }
  const issues = validateStageDocument(value);
  return { document: value as StageDocument, issues };
};

export const createStageDocument = (name = 'New Stage'): StageDocument => ({
  name,
  order: 0,
  anchors: [{ x: 0, y: 0, weight: 1 }],
  entrances: [
    { x: -100, y: 0, face: true },
    { x: 100, y: 0, face: false },
  ],
  spawns: [
    { x: -60, y: 0, face: true },
    { x: 60, y: 0, face: false },
  ],
  scene: {
    schemaVersion: STAGE_SCENE_SCHEMA_VERSION,
    collision: [
      {
        id: 'main-platform',
        from: [-200, 0],
        to: [200, 0],
        flags: ['top', 'solid', 'leftGrabbable', 'rightGrabbable', 'blastZone'],
      },
    ],
  },
});

const idFor = (prefix: string, existing: { id: string }[] | undefined): string => {
  const ids = new Set((existing ?? []).map((item) => item.id));
  let index = 0;
  while (ids.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
};

export const stageSceneItems = (stage: StageDocument): StageSceneItem[] => [
  { selection: { kind: 'stage' }, label: 'Stage settings', badge: 'stage' },
  ...(stage.scene.models ?? []).map((item) => ({
    selection: { kind: 'model' as const, id: item.id },
    label: item.id,
    badge: 'model',
  })),
  ...(stage.scene.collision ?? []).map((item) => ({
    selection: { kind: 'collision' as const, id: item.id },
    label: item.id,
    badge: 'collision',
  })),
  ...(stage.scene.effects?.pointLights ?? []).map((item) => ({
    selection: { kind: 'pointLight' as const, id: item.id },
    label: item.id,
    badge: 'light',
  })),
  ...(stage.scene.effects?.fogVolumes ?? []).map((item) => ({
    selection: { kind: 'fogVolume' as const, id: item.id },
    label: item.id,
    badge: 'fog',
  })),
  ...(stage.scene.effects?.particleEmitters ?? []).map((item) => ({
    selection: { kind: 'particleEmitter' as const, id: item.id },
    label: item.id,
    badge: 'particles',
  })),
  ...(stage.scene.animations ?? []).map((item) => ({
    selection: { kind: 'animation' as const, id: item.id },
    label: item.id,
    badge: 'animation',
  })),
];

const ensureEffects = (stage: StageDocument) => (stage.scene.effects ??= {});

export const addStageSceneItem = (
  stage: StageDocument,
  kind: Exclude<StageSelectionKind, 'stage'>
): StageSelection => {
  switch (kind) {
    case 'model': {
      const models = (stage.scene.models ??= []);
      const item: StageModel = {
        id: idFor('model', models),
        primitive: { type: 'box' },
        position: [0, 0, 0],
        size: [50, 50, 50],
      };
      models.push(item);
      return { kind, id: item.id };
    }
    case 'collision': {
      const collision = (stage.scene.collision ??= []);
      const item: StageCollision = {
        id: idFor('collision', collision),
        from: [-50, 0],
        to: [50, 0],
        flags: ['top', 'solid'],
      };
      collision.push(item);
      return { kind, id: item.id };
    }
    case 'pointLight': {
      const lights = (ensureEffects(stage).pointLights ??= []);
      const item: StagePointLight = {
        id: idFor('point-light', lights),
        position: [0, -100, 100],
        color: [1, 1, 1],
        intensity: 1000,
        range: 500,
      };
      lights.push(item);
      return { kind, id: item.id };
    }
    case 'fogVolume': {
      const volumes = (ensureEffects(stage).fogVolumes ??= []);
      const item: StageFogVolume = {
        id: idFor('fog-volume', volumes),
        position: [0, 0, 0],
        radius: 150,
        density: 0.001,
      };
      volumes.push(item);
      return { kind, id: item.id };
    }
    case 'particleEmitter': {
      const emitters = (ensureEffects(stage).particleEmitters ??= []);
      const item: StageParticleEmitter = {
        id: idFor('particles', emitters),
        position: [0, 0, 0],
        size: [100, 50, 50],
        rate: 4,
        color: [1, 1, 1, 0.25],
      };
      emitters.push(item);
      return { kind, id: item.id };
    }
    case 'animation': {
      const animations = (stage.scene.animations ??= []);
      const item: StageAnimation = { id: idFor('animation', animations), tracks: [] };
      animations.push(item);
      return { kind, id: item.id };
    }
  }
};

export const removeStageSceneItem = (stage: StageDocument, selection: StageSelection): boolean => {
  if (selection.kind === 'stage' || !selection.id) return false;
  const remove = <T extends { id: string }>(items: T[] | undefined) => {
    const index = items?.findIndex((item) => item.id === selection.id) ?? -1;
    if (index < 0 || !items) return false;
    items.splice(index, 1);
    return true;
  };
  switch (selection.kind) {
    case 'model':
      return remove(stage.scene.models);
    case 'collision':
      return remove(stage.scene.collision);
    case 'pointLight':
      return remove(stage.scene.effects?.pointLights);
    case 'fogVolume':
      return remove(stage.scene.effects?.fogVolumes);
    case 'particleEmitter':
      return remove(stage.scene.effects?.particleEmitters);
    case 'animation':
      return remove(stage.scene.animations);
  }
};

export const renameStageSceneItem = (
  stage: StageDocument,
  selection: StageSelection,
  requestedId: string
): StageSelection => {
  const nextId = requestedId.trim();
  if (selection.kind === 'stage' || !selection.id || !nextId || nextId === selection.id)
    return selection;
  const item = stageSceneItems(stage).find(
    (entry) => entry.selection.kind === selection.kind && entry.selection.id === selection.id
  );
  const duplicate = stageSceneItems(stage).some(
    (entry) => entry.selection.kind === selection.kind && entry.selection.id === nextId
  );
  if (!item || duplicate) return selection;

  const oldId = selection.id;
  const rename = <T extends { id: string }>(items: T[] | undefined) => {
    const target = items?.find((entry) => entry.id === oldId);
    if (target) target.id = nextId;
  };
  switch (selection.kind) {
    case 'model':
      rename(stage.scene.models);
      for (const collision of stage.scene.collision ?? [])
        if (collision.model === oldId) collision.model = nextId;
      for (const emitter of stage.scene.effects?.particleEmitters ?? []) {
        if (emitter.target === oldId) emitter.target = nextId;
      }
      for (const animation of stage.scene.animations ?? []) {
        for (const track of animation.tracks) {
          if (track.target.kind === 'model' && track.target.id === oldId) track.target.id = nextId;
        }
      }
      break;
    case 'collision':
      rename(stage.scene.collision);
      for (const animation of stage.scene.animations ?? []) {
        for (const track of animation.tracks) {
          if (track.target.kind === 'collision' && track.target.id === oldId)
            track.target.id = nextId;
        }
      }
      break;
    case 'pointLight':
      rename(stage.scene.effects?.pointLights);
      break;
    case 'fogVolume':
      rename(stage.scene.effects?.fogVolumes);
      break;
    case 'particleEmitter':
      rename(stage.scene.effects?.particleEmitters);
      break;
    case 'animation':
      rename(stage.scene.animations);
      break;
  }
  return { ...selection, id: nextId };
};

export const renderStageFile = (originalText: string | undefined, stage: StageDocument): string => {
  if (!originalText) return `${JSON.stringify(stage, null, 2)}\n`;
  const original = JSONC.parse(originalText);
  if (!original || typeof original !== 'object' || Array.isArray(original)) {
    return `${JSON.stringify(stage, null, 2)}\n`;
  }
  let output = originalText;
  const keys = new Set([...Object.keys(original), ...Object.keys(stage)]);
  for (const key of keys) {
    const before = original[key as keyof typeof original];
    const after = stage[key as keyof StageDocument];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    output = JSONC.applyEdits(output, JSONC.modify(output, [key], after, { formattingOptions }));
  }
  return output.endsWith('\n') ? output : `${output}\n`;
};
