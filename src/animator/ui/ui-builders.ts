/**
 * UI Builders (Deprecated)
 *
 * This module contained imperative DOM manipulation code that has been converted
 * to React components.
 *
 * See:
 * - src/animator/components/PropertyEditor.tsx (replaces makePropDisplay)
 * - src/animator/components/StatsDisplay.tsx (replaces makeStatDisplay)
 * - src/animator/components/KeyframeCopier.tsx (replaces keyframeCopier)
 * - src/animator/components/BubblePreview.tsx (replaces bubblePreview)
 * - src/animator/components/HurtbubbleEditor.tsx (replaces makeKeyframeEditor)
 */

export const previewUpdate: (() => void)[] = [];

// Empty stubs for backwards compatibility
export function makePropDisplay() {
  console.warn('makePropDisplay is deprecated. Use PropertyEditor component.');
  return document.createElement('div');
}

export function makeStatDisplay() {
  console.warn('makeStatDisplay is deprecated. Use StatsDisplay component.');
  return document.createElement('div');
}

export function keyframeCopier() {
  console.warn('keyframeCopier is deprecated. Use KeyframeCopier component.');
  return document.createElement('div');
}

export function bubblePreview() {
  console.warn('bubblePreview is deprecated. Use BubblePreview component.');
  return document.createElement('div');
}
