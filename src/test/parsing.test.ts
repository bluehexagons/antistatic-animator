import { describe, expect, it } from 'vitest';
import {
  parseAnimationDocument,
  parseCharacterDocument,
  parseJsoncValue,
} from '../animator/parsing';

describe('strict JSONC parsing', () => {
  it('rejects syntax errors instead of accepting jsonc-parser partial values', () => {
    expect(() => parseJsoncValue('{"name":')).toThrow(/Unable to parse/);
    expect(() => parseJsoncValue('')).toThrow(/Unable to parse/);
  });

  it('validates the character shape needed by the editor', () => {
    expect(() => parseCharacterDocument('{"name":"Carbon"}')).toThrow(/hurtbubbles array/);
    expect(() =>
      parseCharacterDocument(
        '{"name":"Carbon","hurtbubbles":[{"name":"root","i1":0,"i2":0,"z":0}]}'
      )
    ).not.toThrow();
    expect(() =>
      parseCharacterDocument(
        '{"name":"Carbon","hurtbubbles":[{"name":"root","i1":-1,"i2":0,"z":0}]}'
      )
    ).toThrow(/endpoint indices/);
    expect(() =>
      parseCharacterDocument(
        '{"name":"Carbon","hurtbubbles":[{"name":"root","i1":0,"i2":0,"z":"bad"}]}'
      )
    ).toThrow(/finite z coordinate/);
  });

  it('validates animation entries before loading them', () => {
    expect(() => parseAnimationDocument('{"idle":{}}')).toThrow(/keyframes array/);
    expect(() => parseAnimationDocument('{"idle":{"keyframes":[{"duration":1}]}}')).not.toThrow();
    expect(() => parseAnimationDocument('{"idle":{"keyframes":[{"duration":null}]}}')).toThrow(
      /numeric duration/
    );
  });
});
