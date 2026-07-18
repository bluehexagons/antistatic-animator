import React, { useState } from 'react';
import { PropertiesEditor, type Obj } from './PropertiesEditor';
import type {
  StageCollision,
  StageCollisionFlag,
  StageDocument,
  StageSelection,
  Vec2,
  Vec3,
  Vec4,
} from '../stage/types';
import type { StageIssue } from '../stage/document';
import { renameStageSceneItem } from '../stage/document';

interface StageInspectorProps {
  stage: StageDocument;
  selection: StageSelection;
  issues: StageIssue[];
  onSelectionChange: (selection: StageSelection) => void;
  onChange: () => void;
}

const Section: React.FC<{ title: string; count?: string | number; children: React.ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <div className="section">
    <div className="sectionHeader">
      {title}
      {count !== undefined && <span className="sectionCount">{count}</span>}
    </div>
    <div className="sectionBody">{children}</div>
  </div>
);

const VectorEditor: React.FC<{
  label: string;
  value: Vec2 | Vec3 | Vec4;
  onChange: (value: number[]) => void;
}> = ({ label, value, onChange }) => (
  <div className="stageVectorRow">
    <label>{label}</label>
    <div>
      {value.map((component, index) => (
        <input
          key={index}
          type="number"
          step="any"
          value={component}
          aria-label={`${label} ${'xyzw'[index]}`}
          onChange={(event) => {
            const next = [...value];
            next[index] = Number(event.target.value) || 0;
            onChange(next);
          }}
        />
      ))}
    </div>
  </div>
);

const axisFlags: StageCollisionFlag[] = ['top', 'bottom', 'left', 'right'];
const optionFlags: StageCollisionFlag[] = [
  'solid',
  'blastZone',
  'leftGrabbable',
  'rightGrabbable',
  'symmetric',
  'asymmetric',
  'grounded',
  'skip',
];

const CollisionFlags: React.FC<{ collision: StageCollision; onChange: () => void }> = ({
  collision,
  onChange,
}) => {
  const toggle = (flag: StageCollisionFlag, enabled: boolean) => {
    const flags = new Set(collision.flags);
    if (axisFlags.includes(flag) && enabled) axisFlags.forEach((axis) => flags.delete(axis));
    if (enabled) flags.add(flag);
    else flags.delete(flag);
    collision.flags = [...flags];
    onChange();
  };
  return (
    <div className="stageFlagGrid">
      {[...axisFlags, ...optionFlags].map((flag) => (
        <label key={flag}>
          <input
            type="checkbox"
            checked={collision.flags.includes(flag)}
            onChange={(event) => toggle(flag, event.target.checked)}
          />
          {flag}
        </label>
      ))}
    </div>
  );
};

export const StageInspector: React.FC<StageInspectorProps> = ({
  stage,
  selection,
  issues,
  onSelectionChange,
  onChange,
}) => {
  const [, refresh] = useState(0);
  const changed = () => {
    refresh((value) => value + 1);
    onChange();
  };
  const selectedObject = (() => {
    switch (selection.kind) {
      case 'model':
        return stage.scene.models?.find((item) => item.id === selection.id);
      case 'collision':
        return stage.scene.collision?.find((item) => item.id === selection.id);
      case 'pointLight':
        return stage.scene.effects?.pointLights?.find((item) => item.id === selection.id);
      case 'fogVolume':
        return stage.scene.effects?.fogVolumes?.find((item) => item.id === selection.id);
      case 'particleEmitter':
        return stage.scene.effects?.particleEmitters?.find((item) => item.id === selection.id);
      case 'animation':
        return stage.scene.animations?.find((item) => item.id === selection.id);
      default:
        return stage;
    }
  })();

  if (!selectedObject) {
    return (
      <aside className="inspector">
        <Section title="Inspector">Selection no longer exists.</Section>
      </aside>
    );
  }

  const record = selectedObject as unknown as Obj;
  const position =
    'position' in selectedObject ? (selectedObject.position as Vec3 | undefined) : undefined;
  const collision = selection.kind === 'collision' ? (selectedObject as StageCollision) : null;
  const lighting = (stage.lighting ?? {}) as unknown as Obj;
  const collisionModel = (stage.scene.collisionModel ?? {}) as unknown as Obj;
  const selectedIssues = issues.filter(
    (issue) => selection.kind === 'stage' || !selection.id || issue.path.includes(selection.id)
  );

  return (
    <aside className="inspector">
      <Section title="Issues" count={issues.length || 'clean'}>
        {issues.length === 0 ? (
          <div className="stageIssue clean">Stage matches scene schema v2.</div>
        ) : (
          issues.map((issue, index) => (
            <div className="stageIssue" key={`${issue.path}:${index}`}>
              <strong>{issue.path}</strong> {issue.message}
            </div>
          ))
        )}
      </Section>
      {selection.kind === 'stage' ? (
        <>
          <Section title="Stage document">
            <PropertiesEditor
              obj={record}
              hideKeys={['scene', 'lighting']}
              suggestions={[
                'kind',
                'blastLeft',
                'blastTop',
                'blastBottom',
                'blastRight',
                'scaleX',
                'scaleY',
                'symmetric',
                'pivot',
                'reverbPreset',
              ]}
              onChange={changed}
            />
          </Section>
          <Section title="Lighting">
            <PropertiesEditor
              obj={lighting}
              suggestions={[
                'sunDirection',
                'sunColor',
                'sunIntensity',
                'ambientColor',
                'backgroundColor',
                'environmentMap',
                'environmentRotation',
                'fogNear',
                'fogFar',
                'atmosphere',
                'colorGrading',
              ]}
              onChange={() => {
                stage.lighting = lighting;
                changed();
              }}
            />
          </Section>
          <Section title="Collision model">
            <PropertiesEditor
              obj={collisionModel}
              suggestions={['depth', 'thickness', 'z', 'castsShadows', 'material']}
              onChange={() => {
                stage.scene.collisionModel = collisionModel;
                changed();
              }}
            />
          </Section>
        </>
      ) : (
        <>
          <Section title={selection.kind} count={selectedIssues.length || undefined}>
            <div className="propRow">
              <label>id</label>
              <input
                type="text"
                defaultValue={selection.id}
                onBlur={(event) => {
                  const next = renameStageSceneItem(stage, selection, event.target.value);
                  onSelectionChange(next);
                  changed();
                }}
              />
            </div>
            {position && (
              <VectorEditor
                label="position"
                value={position}
                onChange={(value) => {
                  (selectedObject as { position?: Vec3 }).position = value as Vec3;
                  changed();
                }}
              />
            )}
            {collision && (
              <>
                <VectorEditor
                  label="from"
                  value={collision.from}
                  onChange={(value) => {
                    collision.from = value as Vec2;
                    changed();
                  }}
                />
                <VectorEditor
                  label="to"
                  value={collision.to}
                  onChange={(value) => {
                    collision.to = value as Vec2;
                    changed();
                  }}
                />
                <CollisionFlags collision={collision} onChange={changed} />
              </>
            )}
            <PropertiesEditor
              obj={record}
              hideKeys={['id', 'position', 'from', 'to', 'flags', 'tracks']}
              onChange={changed}
            />
          </Section>
          {selection.kind === 'animation' && (
            <Section title="Tracks" count={(selectedObject as { tracks: unknown[] }).tracks.length}>
              <div className="stageIssue clean">
                Edit animation tracks and keyframes in the timeline.
              </div>
            </Section>
          )}
        </>
      )}
    </aside>
  );
};
