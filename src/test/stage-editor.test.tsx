import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  addStageSceneItem,
  createStageDocument,
  parseStageDocument,
  removeStageSceneItem,
  renameStageSceneItem,
  renderStageFile,
  stageSceneItems,
  validateStageDocument,
} from '../stage/document';
import { StageSceneViewer } from '../app/StageSceneViewer';
import { StageInspector } from '../app/StageInspector';
import { StageTimeline } from '../app/StageTimeline';

describe('stage document operations', () => {
  it('creates and parses a schema-v2 stage', () => {
    const stage = createStageDocument('Fixture');
    expect(validateStageDocument(stage)).toEqual([]);

    const parsed = parseStageDocument(`// stage comment\n${JSON.stringify(stage)}`);
    expect(parsed.issues).toEqual([]);
    expect(parsed.document?.name).toBe('Fixture');
    expect(parsed.document?.scene.schemaVersion).toBe(2);
  });

  it('adds, renames, and removes scene objects while preserving references', () => {
    const stage = createStageDocument('Fixture');
    const modelSelection = addStageSceneItem(stage, 'model');
    const modelId = modelSelection.id!;
    stage.scene.collision![0].model = modelId;
    const emitterSelection = addStageSceneItem(stage, 'particleEmitter');
    stage.scene.effects!.particleEmitters![0].target = modelId;
    const animationSelection = addStageSceneItem(stage, 'animation');
    stage.scene.animations![0].tracks.push({
      target: { kind: 'model', id: modelId },
      keyframes: [{ time: 0, position: [0, 0, 0] }],
    });

    const renamed = renameStageSceneItem(stage, modelSelection, 'moving-platform');
    expect(renamed.id).toBe('moving-platform');
    expect(stage.scene.collision![0].model).toBe('moving-platform');
    expect(stage.scene.effects!.particleEmitters![0].target).toBe('moving-platform');
    expect(stage.scene.animations![0].tracks[0].target.id).toBe('moving-platform');
    expect(validateStageDocument(stage)).toEqual([]);

    expect(removeStageSceneItem(stage, emitterSelection)).toBe(true);
    expect(removeStageSceneItem(stage, animationSelection)).toBe(true);
    expect(stageSceneItems(stage).some((item) => item.selection.id === emitterSelection.id)).toBe(
      false
    );
  });

  it('preserves untouched JSONC comments when saving', () => {
    const stage = createStageDocument('Before');
    const original = `{
  // keep this stage note
  "name": "Before",
  "order": 0,
  "anchors": [{"x": 0, "y": 0, "weight": 1}],
  "entrances": [],
  "spawns": [],
  "scene": {"schemaVersion": 2, "collision": []}
}\n`;
    stage.name = 'After';
    const output = renderStageFile(original, stage);
    expect(output).toContain('// keep this stage note');
    expect(parseStageDocument(output).document?.name).toBe('After');
  });

  it('reports broken stable-id references', () => {
    const stage = createStageDocument('Broken');
    stage.scene.collision![0].model = 'missing-model';
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('unknown model'))
    ).toBe(true);
  });
});

describe('stage editor rendering', () => {
  it('renders the scene canvas, inspector, and animation timeline', () => {
    const stage = createStageDocument('Fixture');
    addStageSceneItem(stage, 'model');
    addStageSceneItem(stage, 'pointLight');
    addStageSceneItem(stage, 'fogVolume');
    addStageSceneItem(stage, 'particleEmitter');
    const animation = addStageSceneItem(stage, 'animation');
    stage.scene.animations![0].tracks.push({
      target: { kind: 'collision', id: 'main-platform' },
      keyframes: [{ time: 0, position: [-200, 0] }],
    });
    const noop = vi.fn();

    const canvas = renderToStaticMarkup(
      <StageSceneViewer
        stage={stage}
        selection={{ kind: 'collision', id: 'main-platform' }}
        camera={{ x: 0, y: 0, scale: 1 }}
        onSelect={noop}
        onCameraChange={noop}
        onChange={noop}
        showGrid
      />
    );
    expect(canvas).toContain('<svg');
    expect(canvas).toContain('stage-grid');

    const inspector = renderToStaticMarkup(
      <StageInspector
        stage={stage}
        selection={{ kind: 'collision', id: 'main-platform' }}
        issues={[]}
        onSelectionChange={noop}
        onChange={noop}
      />
    );
    expect(inspector).toContain('blastZone');
    expect(inspector).toContain('leftGrabbable');

    const timeline = renderToStaticMarkup(
      <StageTimeline stage={stage} selection={animation} onChange={noop} />
    );
    expect(timeline).toContain('main-platform');
    expect(timeline).toContain('keyframe');
  });
});
