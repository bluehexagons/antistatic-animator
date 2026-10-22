import { describe, expect, it } from 'vitest';
import {
  createStageDocument,
  parseStageDocument,
  renderStageFile,
  validateStageDocument,
} from '../stage/document';

const fixture = () => {
  const stage = createStageDocument('Lighting volumes');
  stage.scene.effects = {
    rectLights: [
      { id: 'panel', position: [0, 0, 10], halfU: [2, 0, 0], halfV: [0, 1, 0], range: 30 },
    ],
    diffuseProbes: {
      minimum: [0, 0, 0],
      maximum: [2, 2, 2],
      dimensions: [2, 2, 2],
      baked: {
        version: 1,
        fingerprint: 'a'.repeat(64),
        irradiance: Array(144).fill(Math.PI),
        cells: [1],
      },
    },
  };
  return stage;
};

describe('bounded stage lighting authoring', () => {
  it('preserves rectangle and baked probe payloads through an unrelated JSONC edit', () => {
    const stage = fixture();
    expect(validateStageDocument(stage)).toEqual([]);
    const source = `// authored lighting\n${JSON.stringify(stage, null, 2)}`;
    stage.name = 'Edited name';
    const output = renderStageFile(source, stage);
    expect(output).toContain('// authored lighting');
    expect(parseStageDocument(output).document).toEqual(stage);
    expect(renderStageFile(output, stage)).toBe(output);
  });

  it('rejects degenerate rectangles and IDs shared with point lights', () => {
    const stage = fixture();
    stage.scene.effects!.rectLights![0].halfV = [1, 0, 0];
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('rectangle area'))
    ).toBe(true);
    stage.scene.effects!.rectLights![0].halfV = [0, 1, 0];
    stage.scene.effects!.pointLights = [{ id: 'panel', position: [0, 0, 0] }];
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('duplicate local light'))
    ).toBe(true);
  });

  it('rejects malformed and unsupported bakes while permitting unbaked authoring', () => {
    const stage = fixture();
    const volume = stage.scene.effects!.diffuseProbes!;
    volume.baked!.cells = [];
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('grid dimensions'))
    ).toBe(true);
    volume.baked!.cells = [1];
    stage.lighting = { environmentMap: 'test.hdr' };
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('static stage'))
    ).toBe(true);
    delete volume.baked;
    expect(validateStageDocument(stage)).toEqual([]);
    volume.maximum[0] = 0;
    expect(
      validateStageDocument(stage).some((issue) => issue.message.includes('volume bounds'))
    ).toBe(true);
  });
});
