import { describe, expect, it } from 'vitest';
import { rewriteStandaloneRuntimeImports } from '../../scripts/stage-validator-module.mjs';

describe('stage validator Vite plugin', () => {
  it('unwraps CommonJS helpers after Vite default-import interop', () => {
    expect(
      rewriteStandaloneRuntimeImports(
        'const func2 = require("ajv/dist/runtime/ucs2length").default;'
      )
    ).toBe(
      'import func2Import from "ajv/dist/runtime/ucs2length";const func2=typeof func2Import==="function"?func2Import:func2Import.default;'
    );
  });
});
