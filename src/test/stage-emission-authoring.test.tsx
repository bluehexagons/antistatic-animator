import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React, { act, useState, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatorProvider, useAnimator } from '../animator/context/AnimatorContext';
import { StageInspector } from '../app/StageInspector';
import { StageTimeline } from '../app/StageTimeline';
import { StageSceneViewer } from '../app/StageSceneViewer';
import {
  createStageDocument,
  parseStageDocument,
  renderStageFile,
  validateStageDocument,
  renameStageSceneItem,
  removeStageSceneItem,
} from '../stage/document';
import { evaluateStageAnimation, sampleStageMaterial } from '../stage/animation';
import { BLOOM_DEFAULTS, stageAuthoredEmission, stageSourceTransform } from '../stage/emission';
import type { StageDocument, StageMaterialTrack } from '../stage/types';

const fixture = (): StageDocument => {
  const stage = createStageDocument('Emission authoring');
  stage.scene.models = [
    {
      id: 'lamp',
      primitive: { type: 'box' },
      size: [2, 3, 4],
      scale: [2, 1, 1],
      position: [10, 20, 30],
      rotation: { roll: 0.5 },
      material: {
        file: 'original.mtl',
        name: 'OriginalTexture',
        roughness: 0.4,
        emissive: [1, 0.2, 0.1],
        emissiveStrength: 2,
      },
      materialSlots: {
        PrimitiveDefault: {
          file: 'original.mtl',
          name: 'OtherTexture',
          emissive: [0.2, 0.4, 1],
          emissiveStrength: 3,
        },
      },
    },
    {
      id: 'mesh',
      name: 'Imported',
      material: { file: 'textured.mtl', name: 'Textured' },
      materialSlots: {
        'Source Panel': { file: 'panels.mtl', name: 'Replacement', roughness: 0.8 },
      },
      palette: 'untouched',
      paletteSlots: { Base: 'paint' },
    },
  ];
  stage.scene.palettes = {
    untouched: {
      colors: {
        paint: {
          rgba: [0.1, 0.2, 0.3, 1],
          material: { emissiveColor: 'palette', emissiveStrength: 0.5 },
        },
      },
    },
  };
  stage.scene.effects = {
    pointLights: [
      {
        id: 'source',
        emissionSource: {
          model: 'lamp',
          materialSlot: 'PrimitiveDefault',
          localPosition: [1, 2, 3],
        },
        intensity: 10,
        range: 100,
        sourceRadius: 2,
      },
    ],
  };
  stage.scene.animations = [
    {
      id: 'pulse',
      tracks: [
        {
          target: {
            kind: 'material',
            id: 'lamp',
            materialSlot: 'PrimitiveDefault',
            property: 'emissive',
          },
          keyframes: [
            { time: 0, value: [0, 0, 0] },
            { time: 10, value: [2, 4, 6] },
          ],
        },
        {
          target: {
            kind: 'material',
            id: 'lamp',
            materialSlot: 'PrimitiveDefault',
            property: 'emissiveStrength',
          },
          keyframes: [
            { time: 0, value: 1 },
            { time: 10, value: 9 },
          ],
        },
        { target: { kind: 'model', id: 'lamp' }, keyframes: [{ time: 0, position: [10, 20, 30] }] },
        {
          target: { kind: 'collision', id: 'main-platform' },
          keyframes: [{ time: 0, position: [-200, 0] }],
        },
      ],
    },
  ];
  return stage;
};

const track = (stage: StageDocument, index = 0) =>
  stage.scene.animations![0].tracks[index] as StageMaterialTrack;

describe('material emission scene v2 contract', () => {
  it('round-trips mixed tracks and nested comments without changing textures, palettes or other objects', () => {
    const stage = fixture();
    const source = `// keep stage notes\n${JSON.stringify(stage, null, 2)}`.replace(
      '"roughness": 0.4,',
      '"roughness": 0.4, // texture finish note'
    );
    expect(validateStageDocument(stage)).toEqual([]);
    const parsed = parseStageDocument(source).document!;
    const other = structuredClone(parsed.scene.models![1]);
    parsed.scene.models![0].material!.emissiveStrength = 7;
    track(parsed, 1).keyframes[1].value = 12;
    parsed.lighting = { bloom: { ...BLOOM_DEFAULTS } };
    const saved = renderStageFile(source, parsed);
    expect(saved).toContain('// texture finish note');
    expect(saved).toContain('// keep stage notes');
    expect(parseStageDocument(saved)).toEqual({ document: parsed, issues: [] });
    expect(parsed.scene.models![0].material).toMatchObject({
      file: 'original.mtl',
      name: 'OriginalTexture',
      roughness: 0.4,
    });
    expect(parsed.scene.models![1]).toEqual(other);
    expect(parsed.scene.palettes).toEqual(stage.scene.palettes);
  });

  it('samples RGB and strength independently and leaves authored values and key order intact', () => {
    const stage = fixture();
    const original = structuredClone(stage);
    expect(sampleStageMaterial(track(stage).keyframes, -1)).toEqual([0, 0, 0]);
    expect(sampleStageMaterial(track(stage).keyframes, 20)).toEqual([2, 4, 6]);
    const preview = evaluateStageAnimation(stage, stage.scene.animations![0], 5);
    expect(preview.materials.get('lamp')?.get('PrimitiveDefault')).toEqual({
      emissive: [1, 2, 3],
      emissiveStrength: 5,
    });
    preview.materials.get('lamp')!.get('PrimitiveDefault')!.emissive[0] = 100;
    expect(stage).toEqual(original);
    expect(preview.models.get('lamp')).toEqual([10, -20, 30]);
    expect(preview.collision.get('main-platform')?.from).toEqual([-200, 0]);
  });

  it('preserves per-color palette finishes through sparse instance color overrides', () => {
    const stage = fixture();
    const model = stage.scene.models![1];
    stage.scene.palettes!.untouched.colors.paint.material = {
      emissiveColor: 'palette',
      emissiveStrength: 2,
    };
    model.paletteOverrides = {
      material: { emissiveStrength: 4 },
      colors: { paint: { rgba: [0.5, 0.6, 0.7, 1] } },
    };
    expect(stageAuthoredEmission(stage, model, 'Base')).toEqual({
      emissive: [0.5, 0.6, 0.7],
      emissiveStrength: 2,
    });
    model.paletteOverrides.colors!.paint.material = { emissiveStrength: 3 };
    expect(stageAuthoredEmission(stage, model, 'Base').emissiveStrength).toBe(3);
  });
  it('keeps track identities distinct, rejects duplicates and maintains rename/delete references', () => {
    const stage = fixture();
    stage.scene.animations![0].tracks.push({
      target: { kind: 'material', id: 'mesh', materialSlot: 'Source Panel', property: 'emissive' },
      keyframes: [{ time: 0, value: [1, 2, 3] }],
    });
    expect(validateStageDocument(stage)).toEqual([]);
    const duplicate = structuredClone(track(stage));
    duplicate.target.id = ' lamp ';
    duplicate.target.materialSlot = ' PrimitiveDefault\t';
    stage.scene.animations![0].tracks.push(duplicate);
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('duplicate target'))
    ).toBe(true);
    stage.scene.animations![0].tracks.pop();
    renameStageSceneItem(stage, { kind: 'model', id: 'lamp' }, 'renamed');
    expect(
      stage.scene.animations![0].tracks.slice(0, 3).every((item) => item.target.id === 'renamed')
    ).toBe(true);
    expect(stage.scene.effects!.pointLights![0].emissionSource!.model).toBe('renamed');
    removeStageSceneItem(stage, { kind: 'model', id: 'renamed' });
    expect(stage.scene.animations![0].tracks.map((item) => item.target.kind)).toEqual([
      'collision',
      'material',
    ]);
    expect(validateStageDocument(stage)).toEqual([]);
    removeStageSceneItem(stage, { kind: 'model', id: 'mesh' });
    removeStageSceneItem(stage, { kind: 'collision', id: 'main-platform' });
    expect(stage.scene.animations).toEqual([]);
  });

  it.each([-1, 65505, Infinity, NaN, [1, 2], [1, 2, 3, 4], [1, -1, 2], [1, Infinity, 2]])(
    'rejects malformed RGB %j',
    (value) => {
      const stage = fixture();
      track(stage).keyframes[0].value = value as never;
      expect(validateStageDocument(stage).length).toBeGreaterThan(0);
    }
  );
  it.each([-1, 65505, Infinity, NaN, [1, 2, 3]])('rejects malformed scalar %j', (value) => {
    const stage = fixture();
    track(stage, 1).keyframes[0].value = value as never;
    expect(validateStageDocument(stage).length).toBeGreaterThan(0);
  });
  it.each([-1, Infinity, NaN])('rejects malformed time %j', (time) => {
    const stage = fixture();
    track(stage).keyframes[0].time = time;
    expect(validateStageDocument(stage).length).toBeGreaterThan(0);
  });
  it('validates primitive slots, target references and duplicate key times', () => {
    const stage = fixture();
    track(stage).target.materialSlot = 'ReplacementName';
    expect(validateStageDocument(stage)[0].message).toContain('PrimitiveDefault');
    track(stage).target.materialSlot = 'PrimitiveDefault';
    track(stage).target.id = 'missing';
    expect(validateStageDocument(stage)[0].message).toContain('unknown material');
    track(stage).target.id = 'lamp';
    track(stage).keyframes[1].time = 0;
    expect(validateStageDocument(stage)[0].message).toContain('duplicate keyframe time');
  });
  it.each([0, 1])('rejects descending emission keyframe times for track %s', (index) => {
    const stage = fixture();
    track(stage, index).keyframes.reverse();
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('increasing order'))
    ).toBe(true);
    expect(
      parseStageDocument(renderStageFile(undefined, stage)).issues.some((issue) =>
        issue.message.includes('increasing order')
      )
    ).toBe(true);
  });
  it.each(['materialSlots', 'paletteSlots'] as const)('rejects unknown primitive %s', (field) => {
    const stage = fixture();
    const model = stage.scene.models![0];
    if (field === 'materialSlots') model.materialSlots!.Unknown = structuredClone(model.material!);
    else {
      model.palette = 'untouched';
      model.paletteSlots = { Unknown: 'paint' };
    }
    expect(
      validateStageDocument(stage).some(
        (issue) =>
          issue.path.includes(`/${field}/Unknown`) && issue.message.includes('PrimitiveDefault')
      )
    ).toBe(true);
  });
  it('rejects padded slots in imported overrides, bindings and tracks', () => {
    const stage = fixture();
    const model = stage.scene.models![1];
    model.materialSlots![' Padded '] = structuredClone(model.material!);
    model.paletteSlots![' Padded '] = 'paint';
    track(stage).target.id = model.id;
    track(stage).target.materialSlot = ' Padded ';
    const paths = validateStageDocument(stage)
      .filter((issue) => issue.message.includes('whitespace'))
      .map((issue) => issue.path);
    expect(paths).toHaveLength(3);
  });
  it.each([
    ['strength', -1],
    ['strength', 8.1],
    ['threshold', 65],
    ['knee', -1],
    ['radius', 0.2],
    ['radius', 4.1],
  ])('rejects invalid bloom %s=%s', (key, value) => {
    const stage = fixture();
    stage.lighting = { bloom: { [key]: value } };
    expect(validateStageDocument(stage).length).toBeGreaterThan(0);
  });
  it.each([{ yaw: 0.5 }, [0, Math.SQRT1_2, 0, Math.SQRT1_2] as [number, number, number, number]])(
    'matches the game prefab reflection for a rotated local Z offset: %j',
    (rotation) => {
      const model = fixture().scene.models![0];
      model.rotation = rotation;
      model.scale = [1, 1, 1];
      const offset: [number, number, number] = [1, 2, 3];
      // The game applies TRS * diag(1, 1, -1), including reflected model Y.
      const transform = stageSourceTransform(model)!;
      transform
        .forward(offset)
        .forEach((value, index) => expect(value).toBeCloseTo([-2, -26, 28][index]));
      transform
        .inverse([-2, -26, 28])
        .forEach((value, index) => expect(value).toBeCloseTo(offset[index]));
      model.scale = [-1, 1, -1];
      stageSourceTransform(model)!
        .forward(offset)
        .forEach((value, index) => expect(value).toBeCloseTo([22, -26, 32][index]));
    }
  );
  it('inverts a resolved scaled/rotated attachment and refuses unknown imported bounds or singular scales', () => {
    const stage = fixture();
    const transform = stageSourceTransform(stage.scene.models![0])!;
    const world = transform.forward([1, 2, 3]);
    expect(world[0]).toBeCloseTo(16);
    expect(world[1]).toBeCloseTo(-16);
    expect(world[2]).toBeCloseTo(18);
    transform.inverse(world).forEach((value, index) => expect(value).toBeCloseTo([1, 2, 3][index]));
    expect(stageSourceTransform(stage.scene.models![1])).toBeUndefined();
    stage.scene.models![0].scale = [0, 1, 1];
    expect(stageSourceTransform(stage.scene.models![0])).toBeUndefined();
  });
});

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
let container: HTMLDivElement;
let root: Root;
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
});
const mount = async (content: React.ReactNode) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(() => root.render(content));
};
const labeled = (label: string) => {
  const accessible = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (accessible) return accessible;
  const element = [...container.querySelectorAll('label')].find(
    (item) => item.textContent === label
  )!;
  return document.getElementById(element.htmlFor) as HTMLInputElement;
};
const edit = async (input: HTMLInputElement, value: string) => {
  await act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => input.blur());
};
const choose = async (select: HTMLSelectElement, value: string) =>
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
const click = async (text: string) =>
  act(() =>
    [...container.querySelectorAll('button')].find((item) => item.textContent === text)!.click()
  );
const Inspector: React.FC<{
  stage: StageDocument;
  kind: 'model' | 'pointLight' | 'stage';
  id?: string;
}> = ({ stage, kind, id }) => (
  <StageInspector
    stage={stage}
    selection={{ kind, id }}
    issues={[]}
    onSelectionChange={vi.fn()}
    onChange={vi.fn()}
  />
);

describe('dedicated emission authoring controls', () => {
  it('edits whole material and original slot independently, preserves references and rejects invalid HDR input', async () => {
    const stage = fixture();
    const untouched = structuredClone(stage.scene.models![1]);
    const slot = structuredClone(stage.scene.models![0].materialSlots);
    await mount(<Inspector stage={stage} kind="model" id="lamp" />);
    await edit(labeled('Linear emission R'), '2.5');
    await edit(labeled('Emission strength'), '6');
    expect(stage.scene.models![0].material).toMatchObject({
      file: 'original.mtl',
      name: 'OriginalTexture',
      emissive: [2.5, 0.2, 0.1],
      emissiveStrength: 6,
    });
    expect(stage.scene.models![0].materialSlots).toEqual(slot);
    await edit(labeled('Emission strength'), '65505');
    expect(stage.scene.models![0].material!.emissiveStrength).toBe(6);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Previous value kept');
    await choose(labeled('Finish target') as unknown as HTMLSelectElement, 'PrimitiveDefault');
    await edit(labeled('Linear emission G'), '4');
    expect(stage.scene.models![0].materialSlots!.PrimitiveDefault).toMatchObject({
      file: 'original.mtl',
      name: 'OtherTexture',
      emissive: [0.2, 4, 1],
    });
    expect(stage.scene.models![0].material!.emissive![1]).toBe(0.2);
    expect(stage.scene.models![1]).toEqual(untouched);
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('creates a named imported slot from the whole finish without changing source names or palette data', async () => {
    const stage = fixture();
    const palette = structuredClone(stage.scene.palettes);
    const base = structuredClone(stage.scene.models![1].material);
    await mount(<Inspector stage={stage} kind="model" id="mesh" />);
    await edit(
      container.querySelector('[aria-label="Original material slot"]')!,
      '  Authored Original  '
    );
    await click('Edit slot');
    await click('Create slot override from whole material');
    await edit(labeled('Linear emission B'), '3');
    expect(stage.scene.models![1].materialSlots!['Authored Original']).toEqual({
      ...base,
      emissive: [0, 0, 3],
    });
    expect(stage.scene.models![1].material).toEqual(base);
    expect(stage.scene.models![1].materialSlots!['Source Panel'].name).toBe('Replacement');
    expect(stage.scene.palettes).toEqual(palette);
  });

  it('authors bloom with bounded optional values and leaves lighting fields intact', async () => {
    const stage = fixture();
    stage.lighting = { sunIntensity: 2 };
    await mount(<Inspector stage={stage} kind="stage" />);
    expect(labeled('Bloom strength').placeholder).toBe('1.35');
    await edit(labeled('Bloom strength'), '3');
    await edit(labeled('Bloom radius'), '2');
    expect(stage.lighting).toEqual({ sunIntensity: 2, bloom: { strength: 3, radius: 2 } });
    await edit(labeled('Bloom knee'), '65');
    expect(stage.lighting.bloom!.knee).toBeUndefined();
    await edit(labeled('Bloom radius'), '');
    expect(stage.lighting.bloom!.radius).toBeUndefined();
  });

  it('edits attachment offsets and calibration using dedicated fields, preserving unrelated data', async () => {
    const stage = fixture();
    const models = structuredClone(stage.scene.models);
    await mount(<Inspector stage={stage} kind="pointLight" id="source" />);
    await edit(labeled('Source slot'), ' PrimitiveDefault ');
    expect(stage.scene.effects!.pointLights![0].emissionSource!.materialSlot).toBe(
      'PrimitiveDefault'
    );
    await edit(labeled('Local position z'), '-4');
    await edit(labeled('Source radius'), '5');
    await edit(labeled('range'), '0');
    const light = stage.scene.effects!.pointLights![0];
    expect(light.emissionSource!.localPosition).toEqual([1, 2, -4]);
    expect(light.sourceRadius).toBe(5);
    expect(light.range).toBe(100);
    expect(light).not.toHaveProperty('position');
    expect(light).not.toHaveProperty('color');
    expect(stage.scene.models).toEqual(models);
    expect(parseStageDocument(renderStageFile(undefined, stage)).document).toEqual(stage);
  });

  it('uses document history for emission edits and restores them with undo/redo', async () => {
    const original = fixture();
    const Editor = () => {
      const { state, dispatch, undo, redo, clearHistory } = useAnimator();
      useEffect(() => {
        dispatch({ type: 'SET_STAGE', payload: original });
        clearHistory();
      }, [dispatch, clearHistory]);
      return (
        <>
          <button onClick={undo}>Undo emission</button>
          <button onClick={redo}>Redo emission</button>
          {state.stage && (
            <StageInspector
              stage={state.stage}
              selection={{ kind: 'model', id: 'lamp' }}
              issues={[]}
              onSelectionChange={vi.fn()}
              onChange={() =>
                dispatch({
                  type: 'SET_STAGE',
                  payload: structuredClone(state.stage),
                  history: true,
                })
              }
            />
          )}
        </>
      );
    };
    await mount(
      <AnimatorProvider>
        <Editor />
      </AnimatorProvider>
    );
    await edit(labeled('Emission strength'), '9');
    expect(labeled('Emission strength').value).toBe('9');
    await click('Undo emission');
    expect(labeled('Emission strength').value).toBe('2');
    await click('Redo emission');
    expect(labeled('Emission strength').value).toBe('9');
  });

  it('adds and edits RGB and strength tracks without duplicate targets or times', async () => {
    const stage = fixture();
    stage.scene.animations![0].tracks = [];
    let frame = 0;
    const Timeline = () => {
      const [, refresh] = useState(0);
      return (
        <StageTimeline
          stage={stage}
          selection={{ kind: 'animation', id: 'pulse' }}
          frame={frame}
          playing={false}
          onFrameChange={vi.fn()}
          onPlayingChange={vi.fn()}
          onChange={() => refresh((value) => value + 1)}
        />
      );
    };
    await mount(<Timeline />);
    const target = container.querySelector('[aria-label="New track target"]') as HTMLSelectElement;
    await choose(target, JSON.stringify(['material', 'lamp', 'PrimitiveDefault', 'emissive']));
    await click('Add track');
    expect(track(stage).target).toMatchObject({
      kind: 'material',
      property: 'emissive',
      materialSlot: 'PrimitiveDefault',
    });
    await edit(container.querySelector('[aria-label="Track 1 keyframe 1 component 2"]')!, '2');
    expect(track(stage).keyframes[0].value).toEqual([0.2, 2, 1]);
    expect(
      [...target.options].some(
        (option) =>
          option.value === JSON.stringify(['material', 'lamp', 'PrimitiveDefault', 'emissive'])
      )
    ).toBe(false);
    frame = 5;
    await act(() => root.render(<Timeline />));
    await click('+ keyframe at 5');
    expect(track(stage).keyframes.map((key) => key.time)).toEqual([0, 5]);
    expect(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === '+ keyframe at 5'
      )!.disabled
    ).toBe(true);
    await choose(
      target,
      JSON.stringify(['material', 'lamp', 'PrimitiveDefault', 'emissiveStrength'])
    );
    await click('Add track');
    await edit(container.querySelector('[aria-label="Track 2 keyframe 1 component 1"]')!, '8');
    expect(track(stage, 1).keyframes[0].value).toBe(8);
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('animates an unlisted imported source slot without replacing its original finish', async () => {
    const stage = fixture();
    stage.scene.animations![0].tracks = [];
    const models = structuredClone(stage.scene.models);
    const Timeline = () => {
      const [, refresh] = useState(0);
      return (
        <StageTimeline
          stage={stage}
          selection={{ kind: 'animation', id: 'pulse' }}
          frame={0}
          playing={false}
          onFrameChange={vi.fn()}
          onPlayingChange={vi.fn()}
          onChange={() => refresh((value) => value + 1)}
        />
      );
    };
    await mount(<Timeline />);
    await choose(container.querySelector('[aria-label="New track target"]')!, 'custom-material');
    await edit(
      container.querySelector('[aria-label="Original slot for new material track"]')!,
      '  Original Light Panel  '
    );
    await click('Add track');
    expect(track(stage).target).toEqual({
      kind: 'material',
      id: 'mesh',
      materialSlot: 'Original Light Panel',
      property: 'emissive',
    });
    expect(stage.scene.models).toEqual(models);
    expect(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Add track'
      )!.disabled
    ).toBe(true);
    await choose(
      container.querySelector('[aria-label="Property for new material track"]')!,
      'emissiveStrength'
    );
    await click('Add track');
    expect(track(stage, 1).target.property).toBe('emissiveStrength');
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('shows sampled emission feedback and transforms a dragged attached offset without moving its model', async () => {
    const stage = fixture();
    stage.scene.collision = [];
    const original = structuredClone(stage);
    const content = (frame = 5) => (
      <StageSceneViewer
        stage={stage}
        selection={{ kind: 'pointLight', id: 'source' }}
        camera={{ x: 0, y: 0, scale: 1 }}
        showGrid={false}
        onSelect={vi.fn()}
        onCameraChange={vi.fn()}
        onChange={vi.fn()}
        previewAnimation={stage.scene.animations![0]}
        previewFrame={frame}
      />
    );
    await mount(content());
    const first = container.querySelector('[data-model="lamp"] rect')!.getAttribute('fill-opacity');
    await act(() => root.render(content(10)));
    expect(
      container.querySelector('[data-model="lamp"]')!.getAttribute('data-emission-strength')
    ).toBe('9');
    expect(
      container.querySelector('[data-model="lamp"] rect')!.getAttribute('fill-opacity')
    ).not.toBe(first);
    expect(stage).toEqual(original);
    const svg = container.querySelector('svg')!;
    Object.assign(svg, { setPointerCapture: vi.fn(), hasPointerCapture: () => false });
    const handle = container.querySelector('[aria-label="Attached offset for source"]')!;
    await act(() =>
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 16,
          clientY: -16,
          pointerId: 1,
        })
      )
    );
    await act(() =>
      svg.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 22, clientY: -12, pointerId: 1 })
      )
    );
    const offset = stage.scene.effects!.pointLights![0].emissionSource!.localPosition!;
    offset.forEach((value, index) => expect(value).toBeCloseTo([2, 4, 3][index]));
    expect(stage.scene.models).toEqual(original.scene.models);
    expect(stage.scene.effects!.pointLights![0]).not.toHaveProperty('position');
    stage.scene.effects!.pointLights![0].emissionSource!.model = 'mesh';
    stage.scene.effects!.pointLights![0].emissionSource!.materialSlot = 'Source Panel';
    await act(() => root.render(content()));
    expect(
      container.querySelector('[data-light="source"]')!.getAttribute('data-source-proxy')
    ).toBe('true');
    expect(container.textContent).toContain('attachment proxy');
    expect(container.textContent).toContain('no PBR shading or bloom');
  });
});
