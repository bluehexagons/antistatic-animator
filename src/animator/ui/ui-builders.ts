/**
 * UI Builder Functions
 *
 * Vanilla JS functions for building DOM elements for the animator editor.
 * These handle property editors, stats displays, keyframe copiers, and preview canvases.
 */

import * as JSONC from 'jsonc-parser';
import type { EntityData, Animation, Keyframe, Generic } from '../types';
import { multichoice, defaultTypes, excludeProps } from '../constants';
import { editing } from '../state/EditingState';
import { editorCamera } from '../state/CameraState';
import { paintBubbles } from '../rendering/bubble-painter';
import { objHas } from '../../utils';

/** Preview update callbacks */
export const previewUpdate: (() => void)[] = [];

/**
 * Create property editor for an object (animation or keyframe)
 */
export function makePropDisplay(obj: Generic, isKeyframe = false): HTMLDivElement {
  const div = document.createElement('div');
  const propList = Object.getOwnPropertyNames(obj);
  const addRow = document.createElement('div');
  const addProp = document.createElement('span');
  const addType = document.createElement('select');
  const addButton = document.createElement('button');
  let option = document.createElement('option');

  const submitProp = () => {
    if (addProp.textContent === '') {
      return;
    }
    switch (addType.value) {
      case 'bool':
        obj[addProp.textContent] = true;
        break;
      case 'string':
        obj[addProp.textContent] = '';
        break;
      case 'number':
        obj[addProp.textContent] = 0;
        break;
    }
    if (objHas(multichoice, addProp.textContent)) {
      obj[addProp.textContent] = multichoice[addProp.textContent].default;
    }
    const input = addPropRow(addProp.textContent);
    if (input === null) {
      // No action needed for null input
    } else if (input instanceof HTMLInputElement) {
      input.select();
    } else {
      // span or other text node
      const range = document.createRange();
      range.selectNodeContents(input);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }

    addProp.textContent = '';
  };

  div.className = 'prop-list';
  addRow.className = 'prop';
  addProp.className = 'input';
  addProp.contentEditable = 'true';
  option.text = 'bool';
  addType.add(option);
  option = document.createElement('option');
  option.text = 'number';
  addType.add(option);
  option = document.createElement('option');
  option.text = 'string';
  addType.add(option);

  addButton.className = 'prop-btn';
  addButton.appendChild(document.createTextNode('+'));
  addButton.addEventListener('click', submitProp);
  addProp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitProp();
      e.preventDefault();
      return false;
    }
    return true;
  });
  addProp.addEventListener('input', (_e) => {
    if (objHas(defaultTypes, addProp.textContent)) {
      addType.value = defaultTypes[addProp.textContent];
    }
  });
  addRow.appendChild(addProp);
  addRow.appendChild(addType);
  addRow.appendChild(addButton);
  div.appendChild(addRow);

  const addPropRow = (k: string): HTMLSpanElement | HTMLInputElement | HTMLSelectElement | null => {
    let v = obj[k];

    const row = document.createElement('div');
    const label = document.createElement('label');
    let input: HTMLSpanElement | HTMLInputElement | HTMLSelectElement = null;
    const remove = document.createElement('button');

    const update = () => {
      switch (typeof v) {
        case 'string':
          if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
            obj[k] = input.value;
          } else {
            obj[k] = input.textContent;
          }
          if (objHas(multichoice, k) && multichoice[k].default === obj[k]) {
            delete obj[k];
          }
          break;
        case 'number':
          obj[k] = parseFloat(input.textContent);
          input.textContent = obj[k].toString(10);
          break;
        case 'boolean':
          obj[k] = (input as HTMLInputElement).checked;
          input.textContent = obj[k] ? 'true' : 'false';
          break;
        case 'undefined':
          break;
        default:
          if (Array.isArray(v)) {
            const parsed = JSONC.parse(input.textContent);
            if (Array.isArray(parsed)) {
              obj[k] = parsed;
              input.textContent = JSON.stringify(obj[k]);
            }
            break;
          }
        // not editable yet
      }
    };

    if (objHas(multichoice, k) && !v) {
      v = multichoice[k].default;
    }

    switch (typeof v) {
      case 'boolean':
        if (!v) {
          input = document.createElement('span');
        }
        break;
      case 'string':
        if (objHas(multichoice, k)) {
          const choices = multichoice[k].choices;
          input = document.createElement('select');
          for (let i = 0; i < choices.length; i++) {
            const o = document.createElement('option');
            o.value = choices[i];
            o.textContent = choices[i];
            (input as HTMLSelectElement).options.add(o);
          }
        } else {
          input = document.createElement('span');
        }
        break;
      default:
        input = document.createElement('span');
    }

    if (excludeProps.has(k) && (k !== 'hitbubbles' || v !== true)) {
      return null;
    }

    row.className = 'prop';
    label.appendChild(document.createTextNode(k + (typeof v !== 'boolean' ? ':' : '')));

    if (input instanceof HTMLSelectElement) {
      if (objHas(multichoice, k) && !v) {
        v = '';
        input.value = multichoice[k].default;
      } else {
        input.value = v;
      }

      input.addEventListener('change', () => {
        update();
      });
    } else if (input instanceof HTMLSpanElement) {
      input.contentEditable = 'true';
      input.className = 'input';
      switch (typeof v) {
        case 'string':
          input.textContent = v;
          break;
        case 'number':
          input.textContent = v.toString(10);
          break;
        case 'boolean':
          input.textContent = v ? 'true' : 'false';
          break;
        default:
          if (Array.isArray(v)) {
            input.textContent = JSON.stringify(v);
            break;
          }
          input.contentEditable = 'false';
          input.textContent = `<${typeof v}>`;
          break;
      }
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          update();
          e.preventDefault();
          return false;
        }
        return true;
      });
      input.addEventListener('blur', update);
    }

    remove.appendChild(document.createTextNode('\u00d7'));
    remove.className = 'prop-btn';
    remove.addEventListener('click', () => {
      delete obj[k];
      div.removeChild(row);
    });

    row.appendChild(label);
    if (input !== null) {
      row.appendChild(input);
    }
    row.appendChild(remove);
    div.insertBefore(row, addRow);
    return input;
  };

  for (let i = 0; i < propList.length; i++) {
    addPropRow(propList[i]);
  }

  if (isKeyframe && !objHas(obj, 'tween')) {
    addPropRow('tween');
  }

  return div;
}

/**
 * Create stats display for an animation
 */
export function makeStatDisplay(obj: Animation): HTMLDivElement {
  const div = document.createElement('div');
  let windup = 0;
  let frame = 0;
  const hitboxTimings: string[] = [];
  let backswing = 0;
  let kfn = 0;
  const kfs = obj.keyframes;

  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    if (objHas(kf, 'hitbubbles')) {
      break;
    }
    frame += kf.duration;
    windup += kf.duration;
  }

  let lastHB = kfn;
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    frame += kf.duration;
    if (!objHas(kf, 'hitbubbles')) {
      continue;
    }
    lastHB = kfn;
    hitboxTimings.push(`${frame - kf.duration + 1}-${frame}`);
  }

  kfn = lastHB + 1;
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    backswing += kf.duration;
  }

  frame = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    frame += kfs[i].duration;
  }

  if (objHas(obj, 'iasa')) {
    backswing -= obj['iasa'];
    frame -= obj['iasa'];
  }

  const totalEl = document.createElement('div');
  totalEl.appendChild(document.createTextNode('Duration: ' + frame));
  const windupEl = document.createElement('div');
  windupEl.appendChild(document.createTextNode('Windup: ' + windup));
  const hitbubblesEl = document.createElement('div');
  hitbubblesEl.appendChild(document.createTextNode('Hits: ' + hitboxTimings.join(', ')));
  const backswingEl = document.createElement('div');
  backswingEl.appendChild(document.createTextNode('Backswing: ' + backswing));

  div.appendChild(totalEl);
  div.appendChild(windupEl);
  div.appendChild(hitbubblesEl);
  div.appendChild(backswingEl);

  return div;
}

/**
 * Create keyframe manipulation buttons
 */
export function keyframeCopier(
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: (character: EntityData, anim: Animation) => void,
  showEditor: (
    character: EntityData,
    animation: Animation,
    keyframe: number,
    updateThumbnail: () => void
  ) => void
): HTMLDivElement {
  const div = document.createElement('div');
  const insertBefore = document.createElement('button');
  const insertAfter = document.createElement('button');
  const removeKeyframe = document.createElement('button');
  const copyFromEditor = document.createElement('button');

  // Handler functions
  const handleCopyFromEnd =
    (
      _character: EntityData,
      _animation: Animation,
      _keyframe: number,
      _element: HTMLButtonElement
    ) =>
    () => {};

  const handleSwapPrevious =
    (character: EntityData, animation: Animation, keyframe: number) => () => {
      const temp = animation.keyframes[keyframe];
      animation.keyframes[keyframe] = animation.keyframes[keyframe - 1];
      animation.keyframes[keyframe - 1] = temp;
      loadAnimation(character, animation);
      showEditor(character, animation, keyframe - 1, previewUpdate[keyframe - 1]);
    };

  const handleInsertBefore =
    (character: EntityData, animation: Animation, keyframe: number) => () => {
      const kf = animation.keyframes[keyframe];
      const newKeyframe: Keyframe = {
        duration: kf.duration,
        hurtbubbles: null,
      };
      if (objHas(kf, 'hurtbubbles') && kf.hurtbubbles) {
        newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles);
      }
      animation.keyframes.splice(keyframe, 0, newKeyframe);
      loadAnimation(character, animation);
      // Only show editor if the new keyframe has hurtbubbles
      if (newKeyframe.hurtbubbles) {
        showEditor(character, animation, keyframe, previewUpdate[keyframe]);
      }
    };

  const handleRemoveKeyframe =
    (character: EntityData, animation: Animation, keyframe: number) => () => {
      animation.keyframes.splice(keyframe, 1);
      loadAnimation(character, animation);
    };

  const handleCopyFromEditor =
    (character: EntityData, animation: Animation, keyframe: number) => () => {
      const fromKF = editing.animation?.keyframes[editing.keyframe];
      const toKF = animation.keyframes[keyframe];

      // Guard against missing editing data or hurtbubbles arrays
      if (!fromKF || !fromKF.hurtbubbles || !toKF.hurtbubbles) {
        console.warn('Cannot copy hurtbubbles: missing data');
        return;
      }

      const fromHB = fromKF.hurtbubbles;
      const toHB = toKF.hurtbubbles;

      for (let i = 0; i < fromHB.length && i < toHB.length; i++) {
        toHB[i] = fromHB[i];
      }
      loadAnimation(character, animation);
      showEditor(character, animation, keyframe, previewUpdate[keyframe]);
    };

  const handleInsertAfter =
    (character: EntityData, animation: Animation, keyframe: number) => () => {
      const kf = animation.keyframes[keyframe];
      const newKeyframe: Keyframe = {
        duration: kf.duration,
        hurtbubbles: null,
      };
      if (objHas(kf, 'hurtbubbles') && kf.hurtbubbles) {
        newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles);
      }
      animation.keyframes.splice(keyframe + 1, 0, newKeyframe);
      loadAnimation(character, animation);
      // Only show editor if the new keyframe has hurtbubbles
      if (newKeyframe.hurtbubbles) {
        showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1]);
      }
    };

  const handleCopyFromStart =
    (
      _character: EntityData,
      _animation: Animation,
      _keyframe: number,
      _element: HTMLButtonElement
    ) =>
    () => {};

  const handleSwapNext = (character: EntityData, animation: Animation, keyframe: number) => () => {
    const temp = animation.keyframes[keyframe];
    animation.keyframes[keyframe] = animation.keyframes[keyframe + 1];
    animation.keyframes[keyframe + 1] = temp;
    loadAnimation(character, animation);
    showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1]);
  };

  if (keyframe === 0) {
    const copyFromEnd = document.createElement('button');
    copyFromEnd.appendChild(document.createTextNode('>v'));
    copyFromEnd.title = 'copy from end';
    copyFromEnd.addEventListener(
      'click',
      handleCopyFromEnd(character, animation, keyframe, copyFromEnd)
    );
    div.appendChild(copyFromEnd);
  } else {
    const swapPrevious = document.createElement('button');
    swapPrevious.appendChild(document.createTextNode('<'));
    swapPrevious.title = 'move left';
    swapPrevious.addEventListener('click', handleSwapPrevious(character, animation, keyframe));
    div.appendChild(swapPrevious);
  }

  insertBefore.appendChild(document.createTextNode('<<'));
  insertBefore.title = 'clone left';
  insertBefore.addEventListener('click', handleInsertBefore(character, animation, keyframe));
  div.appendChild(insertBefore);

  copyFromEditor.appendChild(document.createTextNode('v'));
  copyFromEditor.title = 'copy from editor';
  copyFromEditor.addEventListener('click', handleCopyFromEditor(character, animation, keyframe));
  div.appendChild(copyFromEditor);

  removeKeyframe.appendChild(document.createTextNode('x'));
  removeKeyframe.title = 'remove keyframe';
  removeKeyframe.addEventListener('click', handleRemoveKeyframe(character, animation, keyframe));
  div.appendChild(removeKeyframe);

  insertAfter.appendChild(document.createTextNode('>>'));
  insertAfter.title = 'clone right';
  insertAfter.addEventListener('click', handleInsertAfter(character, animation, keyframe));
  div.appendChild(insertAfter);

  if (keyframe === animation.keyframes.length - 1) {
    const copyFromStart = document.createElement('button');
    copyFromStart.appendChild(document.createTextNode('v<'));
    copyFromStart.title = 'copy from start';
    copyFromStart.addEventListener(
      'click',
      handleCopyFromStart(character, animation, keyframe, copyFromStart)
    );
    div.appendChild(copyFromStart);
  } else {
    const swapNext = document.createElement('button');
    swapNext.appendChild(document.createTextNode('>'));
    swapNext.title = 'move right';
    swapNext.addEventListener('click', handleSwapNext(character, animation, keyframe));
    div.appendChild(swapNext);
  }

  return div;
}

/**
 * Create bubble preview canvas for a keyframe
 */
export function bubblePreview(
  character: EntityData,
  animation: Animation,
  keyframe: number,
  editorCanvas: HTMLCanvasElement,
  editorCtx: CanvasRenderingContext2D
): HTMLDivElement {
  const div = document.createElement('div');
  const kf = animation.keyframes[keyframe];

  // Resolve hitbubble references
  if (objHas(kf, 'hitbubbles')) {
    let ckf = kf;
    let hbkf = keyframe;
    while (ckf.hitbubbles === true) {
      // find last reference to hitbubbles
      hbkf--;
      ckf = animation.keyframes[hbkf];
    }
    // hitbubbles resolved but not used in preview
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const scale = 1;

  const update = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintBubbles(
      character,
      animation,
      keyframe,
      ctx,
      editorCamera.x,
      editorCamera.y,
      canvas.width,
      canvas.height,
      scale
    );
  };

  previewUpdate[keyframe] = update;

  canvas.width = 70;
  canvas.height = 50;
  canvas.style.width = '70px';
  canvas.style.height = '50px';
  canvas.addEventListener('click', () => {
    if (!editorCanvas || !editorCtx) return;

    editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    editing.character = character;
    editing.animation = animation;
    editing.keyframe = keyframe;
    editing.bubble = -1;

    paintBubbles(
      character,
      animation,
      keyframe,
      editorCtx,
      editorCamera.x,
      editorCamera.y,
      editorCanvas.width,
      editorCanvas.height,
      editorCamera.scale
    );
  });

  div.appendChild(canvas);
  update();

  return div;
}
