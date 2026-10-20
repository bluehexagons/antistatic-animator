import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StageInspector } from '../app/StageInspector';
import { StageSceneViewer } from '../app/StageSceneViewer';
import {
  addStageSceneItem,
  createStageDocument,
  parseStageDocument,
  removeStageSceneItem,
  renameStageSceneItem,
  renderStageFile,
  validateStageDocument,
} from '../stage/document';
import type { StageDocument } from '../stage/types';

const fixture = (): StageDocument => {
  const stage = createStageDocument('Attached lights');
  stage.scene.models = [
    {
      id: 'lamp',
      primitive: { type: 'box' },
      position: [10, 20, 30],
      size: [2, 3, 4],
      rotation: { yaw: 90 },
    },
  ];
  stage.scene.effects = {
    pointLights: [
      {
        id: 'glow',
        emissionSource: {
          model: 'lamp',
          materialSlot: 'PrimitiveDefault',
          localPosition: [1, -2, 3],
        },
        intensity: 500,
        range: 200,
        sourceRadius: 2,
      },
      { id: 'standalone', position: [100, 200, 300], color: [1, 0, 0] },
    ],
  };
  return stage;
};

const whitespaceFixture = (): StageDocument => {
  const stage = fixture();
  stage.scene.models![0].id = ' lamp ';
  stage.scene.collision![0].model = '\tlamp ';
  stage.scene.effects!.pointLights![0].emissionSource!.model = ' lamp\n';
  stage.scene.effects!.pointLights![0].emissionSource!.materialSlot = ' PrimitiveDefault\t';
  stage.scene.effects!.particleEmitters = [{ id: 'sparks', target: 'lamp\t' }];
  stage.scene.animations = [
    {
      id: 'pulse',
      tracks: [
        { target: { kind: 'model', id: '\nlamp' }, keyframes: [{ time: 0, position: [0, 0, 0] }] },
      ],
    },
  ];
  return stage;
};

describe('emission-linked point light documents', () => {
  it.each([
    ['lamp', ' lamp ', 'PrimitiveDefault'],
    [' lamp ', 'lamp', 'PrimitiveDefault'],
    [' lamp ', '\tlamp\n', ' PrimitiveDefault\t'],
  ])(
    'validates trimmed IDs and slots, preserving authored strings through saves: %j',
    (id, model, materialSlot) => {
      const stage = fixture();
      stage.scene.models![0].id = id;
      stage.scene.effects!.pointLights![0].emissionSource = { model, materialSlot };
      const source = `// lighting note\n${JSON.stringify(stage, null, 2)}\n`.replace(
        '"intensity": 500,',
        '"intensity": 500, // calibration note'
      );
      const parsed = parseStageDocument(source);
      expect(parsed).toEqual({ document: stage, issues: [] });
      expect(validateStageDocument(parsed.document)).toEqual([]);
      expect(renderStageFile(source, parsed.document!)).toBe(source);
      parsed.document!.scene.effects!.pointLights![0].intensity = 750;
      const saved = renderStageFile(source, parsed.document!);
      expect(saved).toContain('// calibration note');
      const roundTrip = parseStageDocument(saved);
      expect(roundTrip).toEqual({ document: parsed.document, issues: [] });
      expect(roundTrip.document!.scene.models![0].id).toBe(id);
      expect(roundTrip.document!.scene.effects!.pointLights![0].emissionSource).toEqual({
        model,
        materialSlot,
      });
    }
  );

  it('renames all canonical model references to the trimmed new ID and round-trips them', () => {
    const stage = whitespaceFixture();
    const original = renderStageFile(undefined, stage);
    expect(validateStageDocument(stage)).toEqual([]);
    const renamed = renameStageSceneItem(stage, { kind: 'model', id: 'lamp' }, '\tnew-lamp ');
    expect(renamed).toEqual({ kind: 'model', id: 'new-lamp' });
    expect(stage.scene.models![0].id).toBe('new-lamp');
    expect(stage.scene.collision![0].model).toBe('new-lamp');
    expect(stage.scene.effects!.particleEmitters![0].target).toBe('new-lamp');
    expect(stage.scene.animations![0].tracks[0].target.id).toBe('new-lamp');
    expect(stage.scene.effects!.pointLights![0].emissionSource).toMatchObject({
      model: 'new-lamp',
      materialSlot: ' PrimitiveDefault\t',
      localPosition: [1, -2, 3],
    });
    expect(parseStageDocument(renderStageFile(original, stage))).toEqual({
      document: stage,
      issues: [],
    });
  });

  it('removes canonical model dependents before save without leaving dangling references', () => {
    const stage = whitespaceFixture();
    const original = renderStageFile(undefined, stage);
    expect(removeStageSceneItem(stage, { kind: 'model', id: '\tlamp\n' })).toBe(true);
    expect(stage.scene.models).toEqual([]);
    expect(stage.scene.collision![0]).not.toHaveProperty('model');
    expect(stage.scene.effects!.particleEmitters![0]).not.toHaveProperty('target');
    expect(stage.scene.animations).toEqual([]);
    expect(stage.scene.effects!.pointLights!.map((light) => light.id)).toEqual(['standalone']);
    expect(parseStageDocument(renderStageFile(original, stage))).toEqual({
      document: stage,
      issues: [],
    });
  });

  it('rejects duplicate canonical model IDs and avoids them on rename or creation', () => {
    const stage = whitespaceFixture();
    stage.scene.models!.push({ id: ' model-0 ', primitive: { type: 'box' } });
    const original = structuredClone(stage);
    const selection = { kind: 'model' as const, id: ' lamp ' };
    expect(renameStageSceneItem(stage, selection, 'model-0')).toEqual(selection);
    expect(stage).toEqual(original);
    expect(addStageSceneItem(stage, 'model')).toEqual({ kind: 'model', id: 'model-1' });
    expect(validateStageDocument(stage)).toEqual([]);
    stage.scene.models!.push({ id: '\tlamp', primitive: { type: 'box' } });
    expect(validateStageDocument(stage)).toContainEqual({
      path: '/scene/models',
      message: 'duplicate id "lamp"',
    });
  });

  it('canonicalizes the ID and references when explicitly renaming to the same trimmed ID', () => {
    const stage = whitespaceFixture();
    expect(renameStageSceneItem(stage, { kind: 'model', id: ' lamp ' }, ' lamp\t')).toEqual({
      kind: 'model',
      id: 'lamp',
    });
    expect(stage.scene.models![0].id).toBe('lamp');
    expect(stage.scene.effects!.pointLights![0].emissionSource!.model).toBe('lamp');
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('parses, edits and saves exact source coordinates and calibration without baking transforms', () => {
    const stage = fixture();
    const source = `// lighting note\n${JSON.stringify(stage, null, 2)}`;
    const parsed = parseStageDocument(source);
    expect(parsed.issues).toEqual([]);
    const document = parsed.document!;
    const light = document.scene.effects!.pointLights![0];
    light.intensity = 750;
    document.scene.models![0].position = [-40, 50, 60];
    const output = renderStageFile(source, document);
    expect(output).toContain('// lighting note');
    expect(parseStageDocument(output)).toEqual({ document, issues: [] });
    expect(light.emissionSource?.localPosition).toEqual([1, -2, 3]);
    expect(light).toMatchObject({ intensity: 750, range: 200, sourceRadius: 2 });
    expect(light).not.toHaveProperty('position');
    expect(light).not.toHaveProperty('color');
    delete light.emissionSource!.localPosition;
    expect(parseStageDocument(renderStageFile(output, document)).document).toEqual(document);
    expect(light.emissionSource).not.toHaveProperty('localPosition');
  });

  it.each(['position', 'color'] as const)('rejects top-level %s on a linked light', (key) => {
    const stage = fixture();
    stage.scene.effects!.pointLights![0][key] = [1, 2, 3];
    const parsed = parseStageDocument(JSON.stringify(stage));
    expect(parsed.document).toBeNull();
    expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it.each([
    {},
    { model: 'lamp' },
    { model: 'lamp', materialSlot: '' },
    { model: 1, materialSlot: 'PrimitiveDefault' },
    { model: 'lamp', materialSlot: 'PrimitiveDefault', localPosition: [1, 2] },
    { model: 'lamp', materialSlot: 'PrimitiveDefault', localPosition: [1, 2, 3, 4] },
    { model: 'lamp', materialSlot: 'PrimitiveDefault', position: [1, 2, 3] },
  ])('rejects malformed emission sources: %j', (source) => {
    const stage = fixture();
    stage.scene.effects!.pointLights![0].emissionSource = source as never;
    expect(parseStageDocument(JSON.stringify(stage)).document).toBeNull();
  });

  it('validates model references and known primitive slots, leaving imported mesh slots to the game', () => {
    const stage = fixture();
    const light = stage.scene.effects!.pointLights![0];
    light.emissionSource!.model = 'missing';
    expect(validateStageDocument(stage)).toContainEqual({
      path: '/scene/effects/pointLights/glow/emissionSource/model',
      message: 'unknown model "missing"',
    });
    light.emissionSource!.model = 'lamp';
    light.emissionSource!.materialSlot = 'ReplacedMaterialName';
    expect(validateStageDocument(stage)[0].message).toContain('expected "PrimitiveDefault"');
    delete stage.scene.models![0].primitive;
    stage.scene.models![0].name = 'external-mesh';
    // Overrides are sparse and cannot be treated as a mesh's complete slot inventory.
    stage.scene.models![0].materialSlots = {
      OtherSlot: { file: 'finish.mtl', name: 'ReplacementMaterial' },
    };
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('updates source model IDs on rename and removes only dependent lights on model deletion', () => {
    const stage = fixture();
    const renamed = renameStageSceneItem(stage, { kind: 'model', id: 'lamp' }, 'renamed');
    expect(stage.scene.effects!.pointLights![0].emissionSource?.model).toBe('renamed');
    expect(validateStageDocument(stage)).toEqual([]);
    expect(removeStageSceneItem(stage, renamed)).toBe(true);
    expect(stage.scene.effects!.pointLights!.map((light) => light.id)).toEqual(['standalone']);
    expect(validateStageDocument(stage)).toEqual([]);
    expect(parseStageDocument(renderStageFile(undefined, stage)).document).toEqual(stage);
  });
});

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

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

const setText = async (input: HTMLInputElement, value: string) => {
  await act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => input.blur());
};

const propertyInput = (name: string) => {
  const accessible = container.querySelector<HTMLInputElement>(`[aria-label="${name}"]`);
  if (accessible) return accessible;
  const label = [...container.querySelectorAll('label')].find((item) => item.textContent === name);
  return label ? (document.getElementById(label.htmlFor) as HTMLInputElement) : null;
};

describe('emission-linked light authoring', () => {
  it('labels linked lights, edits their source and intensity, and blocks world position/color additions', async () => {
    const stage = fixture();
    await mount(
      <StageInspector
        stage={stage}
        selection={{ kind: 'pointLight', id: 'glow' }}
        issues={[]}
        onSelectionChange={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(propertyInput('Source slot')?.value).toBe('PrimitiveDefault');
    expect(container.textContent).toContain('attached offset handle');
    expect(container.querySelector('[aria-label="position x"]')).toBeNull();
    expect(propertyInput('color')).toBeNull();
    const name = container.querySelector<HTMLInputElement>('[aria-label="Property name"]')!;
    for (const key of ['position', 'color']) {
      await setText(name, key);
      await act(() =>
        container.querySelector<HTMLButtonElement>('[aria-label="Add property"]')!.click()
      );
      expect(stage.scene.effects!.pointLights![0]).not.toHaveProperty(key);
    }
    for (const [axis, value] of [
      ['x', '-1'],
      ['y', '2'],
      ['z', '-3'],
    ]) {
      await setText(propertyInput(`Local position ${axis}`)!, value);
    }
    await setText(propertyInput('intensity')!, '800');
    const light = stage.scene.effects!.pointLights![0];
    expect(light.emissionSource?.localPosition).toEqual([-1, 2, -3]);
    expect(light.intensity).toBe(800);
    const saved = parseStageDocument(renderStageFile(undefined, stage));
    expect(saved).toEqual({ document: stage, issues: [] });
  });

  it('clears authored world position and color when attaching a standalone light in the inspector', async () => {
    const stage = fixture();
    const light = stage.scene.effects!.pointLights![1];
    await mount(
      <StageInspector
        stage={stage}
        selection={{ kind: 'pointLight', id: light.id }}
        issues={[]}
        onSelectionChange={vi.fn()}
        onChange={vi.fn()}
      />
    );
    const modeLabel = [...container.querySelectorAll('label')].find(
      (label) => label.textContent === 'Source mode'
    )!;
    const mode = document.getElementById(modeLabel.htmlFor) as HTMLSelectElement;
    await act(() => {
      mode.value = 'material';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(light.emissionSource?.model).toBe('lamp');
    expect(light).not.toHaveProperty('position');
    expect(light).not.toHaveProperty('color');
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('shows attached offset handles and prevents a stale world drag from writing position after attachment', async () => {
    const stage = fixture();
    stage.scene.collision = [];
    const changed = vi.fn();
    const content = () => (
      <StageSceneViewer
        stage={stage}
        selection={{ kind: 'pointLight', id: 'glow' }}
        camera={{ x: 0, y: 0, scale: 1 }}
        onSelect={vi.fn()}
        onCameraChange={vi.fn()}
        onChange={changed}
        showGrid={false}
      />
    );
    await mount(content());
    const svg = container.querySelector('svg')!;
    Object.assign(svg, { setPointerCapture: vi.fn(), hasPointerCapture: () => false });
    const handle = container.querySelector('circle[cx="100"][cy="200"][r="5"]')!;
    expect(handle).toBeTruthy();
    expect(
      container.querySelector('[data-light="glow"] [aria-label="Attached offset for glow"]')
    ).toBeTruthy();
    expect(container.querySelector('[data-light="glow"]')?.getAttribute('data-source-proxy')).toBe(
      'false'
    );
    await act(() =>
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 100,
          clientY: 200,
          pointerId: 1,
        })
      )
    );
    await act(() =>
      svg.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 125, clientY: 230, pointerId: 1 })
      )
    );
    const light = stage.scene.effects!.pointLights![1];
    expect(light.position).toEqual([125, 230, 300]);
    light.emissionSource = { model: 'lamp', materialSlot: 'PrimitiveDefault' };
    delete light.position;
    delete light.color;
    await act(() =>
      svg.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: 150, clientY: 260, pointerId: 1 })
      )
    );
    expect(light).not.toHaveProperty('position');
    await act(() => root.render(content()));
    expect(
      container.querySelector(
        '[data-light="standalone"] [aria-label="Attached offset for standalone"]'
      )
    ).toBeTruthy();
    expect(validateStageDocument(stage)).toEqual([]);
  });
});
