import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BubbleEditor } from '../app/BubbleEditor';
import type { Animation, EntityData } from '../animator/types';

const character: EntityData = {
  name: 'carbon',
  hurtbubbles: [
    { name: 'body', i1: 0, i2: 0, z: 0 },
    { name: 'head', i1: 1, i2: 1, z: 0 },
  ],
};

const animation: Animation = {
  keyframes: [{ duration: 1, hurtbubbles: [0, 0, 5, 1, 10, 20, 6, 2] }],
};

const noop = () => {};

describe('BubbleEditor render smoke', () => {
  it('renders bone names and coordinate fields', () => {
    const html = renderToStaticMarkup(
      <BubbleEditor
        character={character}
        animation={animation}
        keyframe={0}
        selectedBubble={-1}
        onSelectBubble={noop}
        onChange={noop}
      />
    );
    expect(html).toContain('body');
    expect(html).toContain('head');
    // x/y/r column headers
    expect(html).toContain('x');
    expect(html).toContain('y');
    expect(html).toContain('r');
    expect(html).toContain('state');
  });

  it('highlights the selected bubble row', () => {
    const html = renderToStaticMarkup(
      <BubbleEditor
        character={character}
        animation={animation}
        keyframe={0}
        selectedBubble={0}
        onSelectBubble={noop}
        onChange={noop}
      />
    );
    expect(html).toContain('active');
  });

  it('shows empty state when no hurtbubbles', () => {
    const emptyAnim: Animation = { keyframes: [{ duration: 1 }] };
    const html = renderToStaticMarkup(
      <BubbleEditor
        character={character}
        animation={emptyAnim}
        keyframe={0}
        selectedBubble={-1}
        onSelectBubble={noop}
        onChange={noop}
      />
    );
    expect(html).toContain('No hurtbubbles');
  });

  it('shows bone detail for the selected bubble', () => {
    const html = renderToStaticMarkup(
      <BubbleEditor
        character={character}
        animation={animation}
        keyframe={0}
        selectedBubble={1}
        onSelectBubble={noop}
        onChange={noop}
      />
    );
    expect(html).toContain('boneDetailName');
  });
});
