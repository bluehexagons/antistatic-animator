import type { StageDocument, StageMaterial, StageModel, Vec3 } from './types';

export const EMISSION_MAX = 65504;
export const BLOOM_DEFAULTS = { strength: 1.35, threshold: 1.12, knee: 0.72, radius: 1 };
export const BLOOM_BOUNDS = {
  strength: [0, 8],
  threshold: [0, 64],
  knee: [0, 64],
  radius: [0.25, 4],
} as const;

/** Source names are independent of the replacement finish's name. No asset inventory is implied. */
export const stageMaterialSlots = (stage: StageDocument, model: StageModel): string[] =>
  [
    ...new Set([
      ...(model.primitive ? ['PrimitiveDefault'] : []),
      ...Object.keys(model.materialSlots ?? {}),
      ...Object.keys(model.paletteSlots ?? {}),
      ...(stage.scene.effects?.pointLights ?? []).flatMap((light) =>
        light.emissionSource?.model.trim() === model.id.trim()
          ? [light.emissionSource.materialSlot]
          : []
      ),
      ...(stage.scene.animations ?? []).flatMap((animation) =>
        animation.tracks.flatMap((track) =>
          track.target.kind === 'material' && track.target.id.trim() === model.id.trim()
            ? [track.target.materialSlot]
            : []
        )
      ),
    ]),
  ].filter(
    (slot, index, values) => values.findIndex((value) => value.trim() === slot.trim()) === index
  );

export const stageSlotMaterial = (model: StageModel, slot: string): StageMaterial | undefined =>
  Object.entries(model.materialSlots ?? {}).find(([name]) => name.trim() === slot.trim())?.[1] ??
  model.material;

/** Authored values only. Imported MTL values/textures remain the game's responsibility. */
export const stageAuthoredEmission = (
  stage: StageDocument,
  model: StageModel,
  slot: string
): { emissive: Vec3; emissiveStrength: number } => {
  const material = stageSlotMaterial(model, slot);
  const palette =
    typeof model.palette === 'string'
      ? Object.hasOwn(stage.scene.palettes ?? {}, model.palette)
        ? stage.scene.palettes![model.palette]
        : undefined
      : model.palette;
  const binding = Object.entries(model.paletteSlots ?? {}).find(
    ([name]) => name.trim() === slot.trim()
  )?.[1];
  const baseColor =
    binding && Object.hasOwn(palette?.colors ?? {}, binding) ? palette!.colors[binding] : undefined;
  const overrideColor =
    binding && Object.hasOwn(model.paletteOverrides?.colors ?? {}, binding)
      ? model.paletteOverrides!.colors![binding]
      : undefined;
  const color = overrideColor ?? baseColor;
  const finish = color
    ? {
        ...palette?.material,
        ...model.paletteOverrides?.material,
        ...baseColor?.material,
        ...overrideColor?.material,
      }
    : undefined;
  const rgb =
    finish?.emissiveColor === 'palette' ? (color?.rgba.slice(0, 3) as Vec3) : finish?.emissiveColor;
  return {
    emissive: [...(rgb ?? material?.emissive ?? [0, 0, 0])],
    emissiveStrength: finish?.emissiveStrength ?? material?.emissiveStrength ?? 1,
  };
};

/** A display swatch for HDR linear RGB, not tone mapping or a PBR render. */
export const emissionSwatch = (rgb: Vec3, strength: number): string => {
  const peak = Math.max(1, ...rgb.map((value) => value * strength));
  return `rgb(${rgb.map((value) => Math.round(Math.pow(Math.max(0, (value * strength) / peak), 1 / 2.2) * 255)).join(', ')})`;
};

/** Exact static box transform; imported bounds, other primitives and spins need game assets/runtime. */
export const stageSourceTransform = (
  model: StageModel
): { forward: (point: Vec3) => Vec3; inverse: (point: Vec3) => Vec3 } | undefined => {
  if (model.primitive?.type !== 'box' || model.angularVelocity?.some((value) => value !== 0))
    return undefined;
  const scale = (model.size ?? [1, 1, 1]).map(
    (value, axis) =>
      // Model.build reflects Y; the stage prefab reflects local Z before TRS.
      value * (model.scale?.[axis] ?? 1) * (axis === 0 ? 1 : -1)
  );
  if (scale.some((value) => !Number.isFinite(value) || value === 0)) return undefined;
  const rotation = model.rotation;
  let q: number[];
  if (Array.isArray(rotation)) q = rotation;
  else {
    // Engine Euler order is X * Y * Z, with angles expressed in half-turns.
    const [x, y, z] = [rotation?.pitch ?? 0, rotation?.yaw ?? 0, rotation?.roll ?? 0].map(
      (value) => (value * Math.PI) / 2
    );
    const [sx, sy, sz, cx, cy, cz] = [
      Math.sin(x),
      Math.sin(y),
      Math.sin(z),
      Math.cos(x),
      Math.cos(y),
      Math.cos(z),
    ];
    q = [
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    ];
  }
  if (
    q.some((value) => !Number.isFinite(value)) ||
    Math.abs(q.reduce((sum, value) => sum + value * value, 0) - 1) > 1e-5
  )
    return undefined;
  const [x, y, z, w] = q;
  const columns = [
    [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
    [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
    [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
  ];
  const position = model.position ?? [0, 0, 0];
  const translation = [position[0], -position[1], position[2]];
  return {
    forward: (point) =>
      translation.map(
        (value, axis) =>
          value +
          columns.reduce(
            (sum, column, index) => sum + column[axis] * point[index] * scale[index],
            0
          )
      ) as Vec3,
    inverse: (point) =>
      columns.map(
        (column, index) =>
          column.reduce((sum, value, axis) => sum + value * (point[axis] - translation[axis]), 0) /
          scale[index]
      ) as Vec3,
  };
};
