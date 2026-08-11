import { describe, expect, it } from 'vitest';
import { EXAMPLE_PROJECTS } from '../examples';
import { parseStageDocument } from '../stage/document';

describe('bundled examples', () => {
  it('includes multiple local projects with parseable files', () => {
    expect(EXAMPLE_PROJECTS.length).toBeGreaterThanOrEqual(2);
    for (const example of EXAMPLE_PROJECTS) {
      expect(example.files.length).toBeGreaterThan(0);
      expect(new Set(example.files.map((file) => file.path)).size).toBe(example.files.length);
      for (const file of example.files) expect(file.content).toMatch(/^\{|^\[/);
    }
  });

  it('includes a stage example that passes scene-schema validation', () => {
    const stageFile = EXAMPLE_PROJECTS.flatMap((example) => example.files).find((file) =>
      file.path.includes('/stages/')
    );
    expect(stageFile).toBeDefined();
    const parsed = parseStageDocument(stageFile!.content);
    expect(parsed.issues).toEqual([]);
    expect(parsed.document?.scene.schemaVersion).toBe(2);
  });
});
