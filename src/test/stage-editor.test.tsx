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
import {
  evaluateStageAnimation,
  sampleStagePosition,
  stageAnimationDuration,
} from '../stage/animation';

describe('stage animation preview', () => {
  it('interpolates tracks and preserves collision segment dimensions', () => {
    const stage = createStageDocument('Fixture');
    addStageSceneItem(stage, 'model');
    const animation = {
      id: 'moving',
      tracks: [
        {
          target: { kind: 'collision' as const, id: 'main-platform' },
          keyframes: [
            { time: 10, position: [0, 100] as [number, number] },
            { time: 0, position: [-200, 0] as [number, number] },
          ],
        },
        {
          target: { kind: 'model' as const, id: 'model-0' },
          keyframes: [
            { time: 0, position: [0, 0, 0] as [number, number, number] },
            { time: 10, position: [20, 40, 60] as [number, number, number] },
          ],
        },
      ],
    };

    expect(stageAnimationDuration(animation)).toBe(11);
    expect(sampleStagePosition(animation.tracks[1].keyframes, 5)).toEqual([10, 20, 30]);
    const preview = evaluateStageAnimation(stage, animation, 5);
    expect(preview.models.get('model-0')).toEqual([10, 20, 30]);
    expect(preview.collision.get('main-platform')).toEqual({
      from: [-100, 50],
      to: [300, 50],
    });
  });

  it('uses an explicit duration and clamps outside the keyframe range', () => {
    const animation = {
      id: 'pause',
      duration: 30,
      tracks: [
        {
          target: { kind: 'model' as const, id: 'model-0' },
          keyframes: [
            { time: 4, position: [1, 2, 3] as [number, number, number] },
            { time: 8, position: [4, 5, 6] as [number, number, number] },
          ],
        },
      ],
    };
    expect(stageAnimationDuration(animation)).toBe(30);
    expect(sampleStagePosition(animation.tracks[0].keyframes, 0)).toEqual([1, 2, 3]);
    expect(sampleStagePosition(animation.tracks[0].keyframes, 20)).toEqual([4, 5, 6]);
  });
});

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

  it('reports ambiguous bounds, ranges, and keyframe timing', () => {
    const stage = createStageDocument('Broken');
    stage.blastLeft = 100;
    stage.blastRight = -100;
    stage.blastTop = -50;
    stage.blastBottom = 50;
    const emitter = addStageSceneItem(stage, 'particleEmitter');
    stage.scene.effects!.particleEmitters![0].radius = [4, 2];
    const animation = addStageSceneItem(stage, 'animation');
    stage.scene.animations![0].tracks.push({
      target: { kind: 'collision', id: 'main-platform' },
      keyframes: [
        { time: 3, position: [0, 0] },
        { time: 3, position: [1, 1] },
      ],
    });

    const messages = validateStageDocument(stage).map((issue) => issue.message);
    expect(messages).toContain('must be less than blastRight');
    expect(messages).toContain('must be less than blastTop');
    expect(messages).toContain('minimum must not exceed maximum');
    expect(messages).toContain('duplicate keyframe time 3');
    expect(emitter.id).toBeTruthy();
    expect(animation.id).toBeTruthy();
  });

  it('rejects partial blast bounds and runtime no-op numeric values', () => {
    const stage = createStageDocument('Broken');
    stage.blastLeft = -100;
    stage.scaleX = 0;
    const animation = addStageSceneItem(stage, 'animation');
    stage.scene.animations![0].speed = 0;

    const issues = validateStageDocument(stage);
    expect(issues.some((issue) => issue.message.includes('must have properties'))).toBe(true);
    expect(issues.filter((issue) => issue.message.includes('must NOT be valid'))).toHaveLength(2);
    expect(animation.id).toBeTruthy();
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
    stage.blastLeft = -590;
    stage.blastTop = 730;
    stage.blastRight = 590;
    stage.blastBottom = -425;
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
    expect(canvas).toContain('height="1155"');
    expect(canvas).toContain('stageEntranceMarker');

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

    const stageInspector = renderToStaticMarkup(
      <StageInspector
        stage={stage}
        selection={{ kind: 'stage' }}
        issues={[]}
        onSelectionChange={noop}
        onChange={noop}
      />
    );
    expect(stageInspector).toContain('Camera anchors');
    expect(stageInspector).toContain('Use game defaults');

    const timeline = renderToStaticMarkup(
      <StageTimeline
        stage={stage}
        selection={animation}
        frame={0}
        playing={false}
        onFrameChange={noop}
        onPlayingChange={noop}
        onChange={noop}
      />
    );
    expect(timeline).toContain('main-platform');
    expect(timeline).toContain('keyframe');
  });
});
