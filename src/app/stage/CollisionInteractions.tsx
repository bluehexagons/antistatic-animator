import React, { useEffect, useId, useState } from 'react';
import type { StageCollision } from '../../stage/types';

interface NumberFieldProps {
  label: string;
  value?: number;
  placeholder: string;
  min?: number;
  max?: number;
  integer?: boolean;
  onCommit: (value: number | undefined) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  placeholder,
  min,
  max,
  integer,
  onCommit,
}) => {
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const [badInput, setBadInput] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
    setBadInput(false);
    setError('');
  }, [value]);

  const commit = () => {
    const next = draft.trim() === '' ? undefined : Number(draft);
    if (
      badInput ||
      (next !== undefined &&
        (!Number.isFinite(next) ||
          (min !== undefined && next < min) ||
          (max !== undefined && next > max) ||
          (integer && !Number.isInteger(next))))
    ) {
      setDraft(value === undefined ? '' : String(value));
      setBadInput(false);
      setError(
        `Use a ${integer ? 'whole ' : ''}number${min !== undefined ? ` ≥ ${min}` : ''}${max !== undefined ? ` and ≤ ${max}` : ''}. Previous value kept.`
      );
      return;
    }
    setError('');
    if (next !== value) onCommit(next);
  };

  return (
    <div>
      <div className="propRow">
        <label htmlFor={id} title={label}>
          {label}
        </label>
        <input
          id={id}
          type="number"
          step={integer ? 1 : 'any'}
          min={min}
          max={max}
          placeholder={placeholder}
          value={draft}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setBadInput(event.target.validity.badInput);
            setError('');
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </div>
      {error && (
        <div id={`${id}-error`} className="stageIssue" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export const CollisionInteractions: React.FC<{
  collision: StageCollision;
  onChange: () => void;
}> = ({ collision, onChange }) => {
  const id = useId();
  const mode = !collision.hazard ? 'none' : 'instantKO' in collision.hazard ? 'ko' : 'damage';
  const hazard = collision.hazard && !('instantKO' in collision.hazard) ? collision.hazard : null;

  return (
    <div className="stageInteractions">
      <h3>Surface interactions</h3>
      <NumberField
        label="Friction override"
        value={collision.friction}
        placeholder="Character default"
        min={0}
        max={1}
        onCommit={(value) => {
          if (value === undefined) delete collision.friction;
          else collision.friction = value;
          onChange();
        }}
      />
      <p className="stageInteractionHelp">
        Leave blank to use character friction. 0 stops grounded motion; values near 1 are slippery.
      </p>
      <div className="propRow">
        <label htmlFor={`${id}-mode`}>Contact hazard</label>
        <select
          id={`${id}-mode`}
          value={mode}
          onChange={(event) => {
            if (event.target.value === 'none') delete collision.hazard;
            else if (event.target.value === 'ko') collision.hazard = { instantKO: true };
            else collision.hazard = { damage: 1 };
            onChange();
          }}
        >
          <option value="none">None</option>
          <option value="damage">Damage / launch</option>
          <option value="ko">Instant KO</option>
        </select>
      </div>
      {mode === 'ko' && (
        <p className="stageInteractionHelp">Consumes a stock and uses the normal respawn flow.</p>
      )}
      {hazard && (
        <div key="damage" className="stageHazardFields">
          <p className="stageInteractionHelp">
            Damage or knockback must be greater than 0. Blank fields use the defaults shown.
          </p>
          {(
            [
              { key: 'damage', label: 'Damage (%)', placeholder: '0', min: 0 },
              { key: 'knockback', label: 'Knockback', placeholder: '0', min: 0 },
              { key: 'angle', label: 'Angle (degrees)', placeholder: '90' },
              {
                key: 'cooldown',
                label: 'Cooldown (ticks)',
                placeholder: '30',
                min: 1,
                integer: true,
              },
            ] as const
          ).map(({ key, ...field }) => (
            <NumberField
              key={key}
              {...field}
              value={hazard[key]}
              onCommit={(value) => {
                if (value === undefined) delete hazard[key];
                else hazard[key] = value;
                onChange();
              }}
            />
          ))}
          <label className="stageMeteorToggle">
            <input
              type="checkbox"
              checked={!!hazard.meteor}
              disabled={!hazard.meteor && !(hazard.knockback && hazard.knockback > 0)}
              onChange={(event) => {
                if (event.target.checked) hazard.meteor = true;
                else delete hazard.meteor;
                onChange();
              }}
            />
            Meteor launch
          </label>
          <p className="stageInteractionHelp">
            0° launches right, 90° up, 180° left. Cooldown uses 60 ticks per second. Meteor launch
            requires positive knockback and allows meteor canceling.
          </p>
        </div>
      )}
    </div>
  );
};
