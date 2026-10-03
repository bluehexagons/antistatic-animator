import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StageInspector } from '../app/StageInspector';
import {
  createStageDocument,
  parseStageDocument,
  renderStageFile,
  validateStageDocument,
} from '../stage/document';
import type { StageDocument } from '../stage/types';

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

let container: HTMLDivElement;
let root: Root;

afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
});

const mount = async (stage: StageDocument) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const changed = vi.fn(() => render());
  const render = () =>
    root.render(
      <StageInspector
        stage={stage}
        selection={{ kind: 'collision', id: stage.scene.collision![0].id }}
        issues={validateStageDocument(stage)}
        onSelectionChange={() => {}}
        onChange={changed}
      />
    );
  await act(render);
  return changed;
};

const inputFor = (label: string) => {
  const element = [...container.querySelectorAll('label')].find(
    (item) => item.textContent === label
  );
  expect(element, `Missing label: ${label}`).toBeTruthy();
  return document.getElementById(element!.htmlFor) as HTMLInputElement;
};

const setNumber = async (label: string, value: string) => {
  const input = inputFor(label);
  await act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => input.blur());
};

const setMode = async (value: string) => {
  const input = inputFor('Contact hazard');
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('collision interaction authoring', () => {
  it('prevents generic properties from bypassing the interaction controls', async () => {
    const stage = createStageDocument('Managed properties');
    await mount(stage);
    const name = container.querySelector<HTMLInputElement>('[aria-label="Property name"]')!;
    for (const key of ['hazard', 'friction']) {
      await act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, key);
        name.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(() =>
        container.querySelector<HTMLButtonElement>('[aria-label="Add property"]')!.click()
      );
      expect(Object.hasOwn(stage.scene.collision![0], key)).toBe(false);
    }
    expect(validateStageDocument(stage)).toEqual([]);
  });

  it('keeps inherited friction absent, accepts bounds, and rejects invalid overrides', async () => {
    const stage = createStageDocument('Friction');
    const collision = stage.scene.collision![0];
    const changed = await mount(stage);
    expect(changed).not.toHaveBeenCalled();
    expect(collision.friction).toBeUndefined();
    expect(inputFor('Friction override').placeholder).toBe('Character default');

    await setNumber('Friction override', '1');
    expect(collision.friction).toBe(1);
    await setNumber('Friction override', '1.2');
    expect(collision.friction).toBe(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Previous value kept');
    await setNumber('Friction override', '0');
    expect(collision.friction).toBe(0);
    const input = inputFor('Friction override');
    // Browsers report unfinished exponents as an empty value with badInput.
    // happy-dom does not reproduce that numeric-editing state by itself.
    Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true });
    await setNumber('Friction override', '');
    expect(collision.friction).toBe(0);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Previous value kept');
    delete (input as unknown as { validity?: unknown }).validity;
    await setNumber('Friction override', '');
    expect(Object.hasOwn(collision, 'friction')).toBe(false);
  });

  it('authors launch parameters, preserves defaults, and safely changes hazard modes', async () => {
    const stage = createStageDocument('Hazards');
    const collision = stage.scene.collision![0];
    await mount(stage);
    await setMode('damage');
    expect(collision.hazard).toEqual({ damage: 1 });
    const meteor = container.querySelector<HTMLInputElement>('.stageMeteorToggle input')!;
    expect(meteor.disabled).toBe(true);
    await setNumber('Damage (%)', '18');
    await setNumber('Knockback', '24');
    await setNumber('Angle (degrees)', '-90');
    await setNumber('Cooldown (ticks)', '45');
    await act(() => meteor.click());
    expect(collision.hazard).toEqual({
      damage: 18,
      knockback: 24,
      angle: -90,
      cooldown: 45,
      meteor: true,
    });
    expect(validateStageDocument(stage)).toEqual([]);

    await setNumber('Cooldown (ticks)', '1.5');
    expect(collision.hazard).toHaveProperty('cooldown', 45);
    await setNumber('Cooldown (ticks)', '');
    expect(collision.hazard).not.toHaveProperty('cooldown');
    await setMode('ko');
    expect(collision.hazard).toEqual({ instantKO: true });
    expect(validateStageDocument(stage)).toEqual([]);
    expect(parseStageDocument(renderStageFile(undefined, stage)).document).toEqual(stage);
    await setMode('none');
    expect(Object.hasOwn(collision, 'hazard')).toBe(false);
  });

  it('shows invalid zero-effect hazards in the selected collision issues', async () => {
    const stage = createStageDocument('Invalid hazard');
    await mount(stage);
    await setMode('damage');
    await setNumber('Damage (%)', '0');
    expect(validateStageDocument(stage).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('No issues for the selected object');
    expect(container.querySelector('.stageIssue strong')?.textContent).toContain('/hazard');
    await setNumber('Knockback', '10');
    expect(validateStageDocument(stage)).toEqual([]);
  });
});
