import React, { useId, useState } from 'react';
import type {
  StageDocument,
  StageMaterial,
  StageModel,
  StagePointLight,
  Vec3,
} from '../../stage/types';
import {
  BLOOM_BOUNDS,
  BLOOM_DEFAULTS,
  EMISSION_MAX,
  emissionSwatch,
  stageMaterialSlots,
  stageSourceTransform,
} from '../../stage/emission';
import { NumberField } from './CollisionInteractions';
import { PropertiesEditor, type Obj } from '../PropertiesEditor';

export const EmissionVector: React.FC<{
  label: string;
  value: Vec3;
  rgb?: boolean;
  onChange: (value: Vec3) => void;
}> = ({ label, value, rgb, onChange }) => (
  <fieldset className="stageEmissionVector">
    <legend>{label}</legend>
    {value.map((component, index) => (
      <NumberField
        key={index}
        label={`${label} ${(rgb ? 'RGB' : 'xyz')[index]}`}
        displayLabel={(rgb ? 'RGB' : 'xyz')[index]}
        value={component}
        placeholder="0"
        min={rgb ? 0 : undefined}
        max={rgb ? EMISSION_MAX : undefined}
        onCommit={(next) => {
          const copy = [...value] as Vec3;
          copy[index] = next ?? 0;
          onChange(copy);
        }}
      />
    ))}
  </fieldset>
);

export const BloomControls: React.FC<{ stage: StageDocument; onChange: () => void }> = ({
  stage,
  onChange,
}) => (
  <div className="stageInteractions">
    <h3>Bloom</h3>
    <p className="stageInteractionHelp">
      Game bloom settings. Blank uses the default shown. The SVG proxy does not preview bloom.
    </p>
    {(Object.keys(BLOOM_DEFAULTS) as (keyof typeof BLOOM_DEFAULTS)[]).map((key) => (
      <NumberField
        key={key}
        label={`Bloom ${key}`}
        value={stage.lighting?.bloom?.[key]}
        placeholder={String(BLOOM_DEFAULTS[key])}
        min={BLOOM_BOUNDS[key][0]}
        max={BLOOM_BOUNDS[key][1]}
        onCommit={(value) => {
          if (value === undefined) {
            if (stage.lighting?.bloom) delete stage.lighting.bloom[key];
          } else {
            const lighting = (stage.lighting ??= {});
            (lighting.bloom ??= {})[key] = value;
          }
          onChange();
        }}
      />
    ))}
  </div>
);

export const MaterialEmissionControls: React.FC<{
  stage: StageDocument;
  model: StageModel;
  sourceSlot?: string;
  onChange: () => void;
}> = ({ stage, model, sourceSlot, onChange }) => {
  const id = useId();
  const [slot, setSlot] = useState(sourceSlot ?? '');
  const [newSlot, setNewSlot] = useState('');
  const [file, setFile] = useState('');
  const [name, setName] = useState('');
  const slots = stageMaterialSlots(stage, model);
  const requestedSlot = sourceSlot ?? slot;
  const targetSlot =
    Object.keys(model.materialSlots ?? {}).find((name) => name.trim() === requestedSlot.trim()) ??
    (model.primitive && requestedSlot.trim() === 'PrimitiveDefault'
      ? 'PrimitiveDefault'
      : requestedSlot.trim());
  const material = targetSlot
    ? Object.hasOwn(model.materialSlots ?? {}, targetSlot)
      ? model.materialSlots![targetSlot]
      : undefined
    : model.material;
  const changedMaterial = (next: StageMaterial) => {
    if (targetSlot) {
      const overrides = (model.materialSlots ??= {});
      Object.defineProperty(overrides, targetSlot, {
        value: next,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } else model.material = next;
    onChange();
  };
  return (
    <div className="stageInteractions">
      <h3>{sourceSlot ? 'Source material emission' : 'Material emission'}</h3>
      {!sourceSlot && (
        <>
          <div className="propRow">
            <label htmlFor={`${id}-target`}>Finish target</label>
            <select
              id={`${id}-target`}
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
            >
              <option value="">Whole material</option>
              {slot && !slots.includes(slot) && <option value={slot}>Slot: {slot}</option>}
              {slots.map((value) => (
                <option value={value} key={value}>
                  Slot: {value}
                </option>
              ))}
            </select>
          </div>
          {!model.primitive && (
            <div className="stageSlotEntry">
              <input
                aria-label="Original material slot"
                placeholder="Original mesh slot name"
                value={newSlot}
                onChange={(event) => setNewSlot(event.target.value)}
              />
              <button
                className="btn ghost"
                disabled={!newSlot.trim()}
                onClick={() => {
                  setSlot(newSlot.trim());
                  setNewSlot('');
                }}
              >
                Edit slot
              </button>
            </div>
          )}
        </>
      )}
      <p className="stageInteractionHelp">
        {targetSlot
          ? `Original source slot: ${targetSlot}. `
          : 'Applies to slots without an explicit override. '}
        {!model.primitive &&
          'Imported mesh proxy; slot inventory and texture emission are resolved in game. '}
        Linear RGB and strength are authored separately. Palette bindings are preserved; palette
        emission can take precedence in game.
      </p>
      {!material ? (
        <>
          {targetSlot && model.material ? (
            <button
              className="btn ghost"
              onClick={() => changedMaterial(structuredClone(model.material!))}
            >
              Create slot override from whole material
            </button>
          ) : (
            <>
              <p className="stageInteractionHelp">
                Choose an existing game material file and finish to create this override.
              </p>
              <div className="propRow">
                <label htmlFor={`${id}-file`}>Material file</label>
                <input
                  id={`${id}-file`}
                  value={file}
                  placeholder="finish.mtl"
                  onChange={(event) => setFile(event.target.value)}
                />
              </div>
              <div className="propRow">
                <label htmlFor={`${id}-name`}>Material name</label>
                <input
                  id={`${id}-name`}
                  value={name}
                  placeholder="Existing finish name"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <button
                className="btn ghost"
                disabled={!file.trim() || !name.trim()}
                onClick={() => changedMaterial({ file, name })}
              >
                Create material override
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <div
            className="stageEmissionSwatch"
            style={{
              background: emissionSwatch(
                material.emissive ?? [0, 0, 0],
                material.emissiveStrength ?? 1
              ),
            }}
            aria-label="Authored emission swatch"
          />
          <EmissionVector
            label="Linear emission"
            rgb
            value={material.emissive ?? [0, 0, 0]}
            onChange={(value) => {
              material.emissive = value;
              onChange();
            }}
          />
          <NumberField
            label="Emission strength"
            displayLabel="Strength"
            value={material.emissiveStrength}
            placeholder="Material default"
            min={0}
            max={EMISSION_MAX}
            onCommit={(value) => {
              if (value === undefined) delete material.emissiveStrength;
              else material.emissiveStrength = value;
              onChange();
            }}
          />
          <button
            className="btn ghost"
            onClick={() => {
              delete material.emissive;
              delete material.emissiveStrength;
              onChange();
            }}
          >
            Use material emission defaults
          </button>
          <details>
            <summary>Material reference and other properties</summary>
            <PropertiesEditor
              obj={material as unknown as Obj}
              hideKeys={['emissive', 'emissiveStrength']}
              managedKeys={['emissive', 'emissiveStrength']}
              onChange={onChange}
            />
          </details>
        </>
      )}
    </div>
  );
};

export const SourceLightControls: React.FC<{
  stage: StageDocument;
  light: StagePointLight;
  onChange: () => void;
}> = ({ stage, light, onChange }) => {
  const id = useId();
  const source = light.emissionSource;
  const model =
    source && stage.scene.models?.find((item) => item.id.trim() === source.model.trim());
  const transform = model && stageSourceTransform(model);
  const slots = model ? stageMaterialSlots(stage, model) : [];
  return (
    <div className="stageInteractions">
      <h3>Point light source</h3>
      <div className="propRow">
        <label htmlFor={`${id}-mode`}>Source mode</label>
        <select
          id={`${id}-mode`}
          value={source ? 'material' : 'standalone'}
          onChange={(event) => {
            if (event.target.value === 'material') {
              const first = stage.scene.models?.[0];
              if (!first) return;
              light.emissionSource = {
                model: first.id,
                materialSlot: stageMaterialSlots(stage, first)[0] ?? '',
              };
              delete light.position;
              delete light.color;
            } else {
              light.position = transform
                ? transform.forward(source?.localPosition ?? [0, 0, 0])
                : [0, 0, 0];
              light.color = [1, 1, 1];
              delete light.emissionSource;
            }
            onChange();
          }}
        >
          <option value="standalone">Standalone</option>
          <option value="material" disabled={!stage.scene.models?.length}>
            Material emission
          </option>
        </select>
      </div>
      {source && (
        <>
          <div className="propRow">
            <label htmlFor={`${id}-model`}>Source model</label>
            <select
              id={`${id}-model`}
              value={source.model}
              onChange={(event) => {
                source.model = event.target.value;
                const next = stage.scene.models?.find((item) => item.id === source.model);
                source.materialSlot = next
                  ? (stageMaterialSlots(stage, next)[0] ?? source.materialSlot)
                  : source.materialSlot;
                onChange();
              }}
            >
              {!stage.scene.models?.some((item) => item.id === source.model) && (
                <option value={source.model}>{source.model}</option>
              )}
              {stage.scene.models?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </div>
          <div className="propRow">
            <label htmlFor={`${id}-slot`}>Source slot</label>
            <input
              key={`${light.id}:${source.model}:${source.materialSlot}`}
              id={`${id}-slot`}
              list={`${id}-slots`}
              defaultValue={source.materialSlot}
              onBlur={(event) => {
                if (event.target.value.trim()) {
                  source.materialSlot = event.target.value.trim();
                  event.target.value = source.materialSlot;
                  onChange();
                } else event.target.value = source.materialSlot;
              }}
            />
          </div>
          <datalist id={`${id}-slots`}>
            {slots.map((slot) => (
              <option key={slot} value={slot} />
            ))}
          </datalist>
          <EmissionVector
            label="Local position"
            value={source.localPosition ?? [0, 0, 0]}
            onChange={(value) => {
              source.localPosition = value;
              onChange();
            }}
          />
          <button
            className="btn ghost"
            onClick={() => {
              delete source.localPosition;
              onChange();
            }}
          >
            Reset local offset
          </button>
          <p className="stageInteractionHelp">
            Exact mesh coordinates.{' '}
            {transform
              ? 'Drag the attached offset handle in the SVG or edit all three axes here.'
              : 'Attachment proxy only: exact transform needs game geometry or runtime motion. Edit the offset numerically.'}{' '}
            Position and color follow the material in game. Intensity multiplies emission strength;
            range and radius stay in world units.
          </p>
        </>
      )}
      {(['intensity', 'range', 'sourceRadius'] as const).map((key) => (
        <NumberField
          key={key}
          label={key === 'sourceRadius' ? 'Source radius' : key}
          value={light[key]}
          placeholder="Game default"
          min={key === 'intensity' ? 0 : 0.0001}
          onCommit={(value) => {
            if (value === undefined) delete light[key];
            else light[key] = value;
            onChange();
          }}
        />
      ))}
      {model && source?.materialSlot.trim() && (
        <MaterialEmissionControls
          key={`${model.id}:${source.materialSlot}`}
          stage={stage}
          model={model}
          sourceSlot={source.materialSlot}
          onChange={onChange}
        />
      )}
    </div>
  );
};
