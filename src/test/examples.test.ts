import { describe, expect, it } from 'vitest';
import { EXAMPLE_PROJECTS, EXAMPLE_WORKSPACE_FILES } from '../examples';
import { isCharacterDataFile } from '../app/file-names';
import { lintAnimation } from '../animator/lint';
import type { AnimationMap, EntityData } from '../animator/types';
import { parseStageDocument } from '../stage/document';
import { stageModelDisplayHalfExtents, stageModelDisplayPosition } from '../stage/view';

describe('bundled examples', () => {
  it('includes a character and three stage projects with parseable files', () => {
    expect(EXAMPLE_PROJECTS).toHaveLength(4);
    for (const example of EXAMPLE_PROJECTS) {
      expect(example.files.length).toBeGreaterThan(0);
      expect(new Set(example.files.map((file) => file.path)).size).toBe(example.files.length);
      for (const file of example.files) expect(file.content).toMatch(/^\{|^\[/);
    }
  });

  it('makes every stage example pass scene-schema and semantic validation', () => {
    const stageFiles = EXAMPLE_PROJECTS.flatMap((example) => example.files).filter((file) =>
      file.path.includes('/stages/')
    );
    expect(stageFiles).toHaveLength(3);
    for (const stageFile of stageFiles) {
      const parsed = parseStageDocument(stageFile.content);
      expect(parsed.issues, stageFile.path).toEqual([]);
      expect(parsed.document?.scene.schemaVersion).toBe(2);
    }
  });

  it('combines the character and stage examples into one workspace', () => {
    expect(EXAMPLE_WORKSPACE_FILES.some((file) => isCharacterDataFile(file.path))).toBe(true);
    expect(EXAMPLE_WORKSPACE_FILES.some((file) => file.path.includes('/stages/'))).toBe(true);
  });

  it('gives the practice fighter varied, lint-clean gameplay animations', () => {
    const character = JSON.parse(
      EXAMPLE_WORKSPACE_FILES.find((file) => file.path.endsWith('practice-fighter.json'))!.content
    ) as EntityData;
    const animations = JSON.parse(
      EXAMPLE_WORKSPACE_FILES.find((file) => file.path.endsWith('practice-fighter_anim.json'))!
        .content
    ) as AnimationMap;
    expect(Object.keys(animations)).toEqual(['idle', 'dash', 'jab', 'sweep', 'uair', 'taunt']);
    expect(animations.taunt.keyframes).toHaveLength(4);
    expect(animations.uair.type).toBe('aerial');
    expect(animations.sweep.keyframes[1].hitbubbles).toEqual(
      expect.arrayContaining([expect.objectContaining({ next: true })])
    );
    expect(animations.sweep.keyframes[2].hitbubbles).toEqual([]);
    for (const [name, animation] of Object.entries(animations)) {
      expect(lintAnimation(character, animation, name), name).toEqual([]);
    }
  });

  it('shows representative static, moving-collision, and multi-track stage data', () => {
    const stages = new Map(
      EXAMPLE_WORKSPACE_FILES.filter((file) => file.path.includes('/stages/')).map((file) => [
        file.path,
        parseStageDocument(file.content).document!,
      ])
    );
    const laboratory = stages.get('app/assets/stages/training-platform.json')!;
    const forge = stages.get('app/assets/stages/ember-forge.json')!;
    const relay = stages.get('app/assets/stages/orbital-relay.json')!;

    expect(laboratory.scene.animations?.[0].tracks[0].target.kind).toBe('collision');
    expect(forge.lighting?.atmosphere).toBeDefined();
    expect(forge.scene.effects?.particleEmitters).toHaveLength(1);
    expect(relay.scene.animations?.some((animation) => animation.tracks.length > 1)).toBe(true);
  });

  it('keeps stage models aligned with runtime collision and symmetry semantics', () => {
    const stageFiles = EXAMPLE_WORKSPACE_FILES.filter((file) => file.path.includes('/stages/'));
    for (const file of stageFiles) {
      const stage = parseStageDocument(file.content).document!;
      const models = new Map(stage.scene.models?.map((model) => [model.id, model]));
      for (const collision of stage.scene.collision ?? []) {
        if (collision.model) {
          const model = models.get(collision.model)!;
          const position = stageModelDisplayPosition(stage, model.position ?? [0, 0, 0]);
          const extents = stageModelDisplayHalfExtents(stage, model);
          expect(position[0], `${file.path}:${collision.id}`).toBeCloseTo(
            (collision.from[0] + collision.to[0]) / 2
          );
          expect(position[1], `${file.path}:${collision.id}`).toBeCloseTo(collision.from[1] + 2);
          expect(extents[0], `${file.path}:${collision.id}`).toBeCloseTo(
            Math.abs(collision.to[0] - collision.from[0]) / 2
          );
        }

        const pivot = stage.pivot ?? 0;
        const entirelyOnOneSide =
          (collision.from[0] < pivot && collision.to[0] < pivot) ||
          (collision.from[0] > pivot && collision.to[0] > pivot);
        if (stage.symmetric && entirelyOnOneSide) {
          expect(collision.flags, `${file.path}:${collision.id}`).toContain('asymmetric');
        }
      }
    }
  });
});
