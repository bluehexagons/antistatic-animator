/**
 * PropertiesEditor — a cleaner, inspector-friendly property editor.
 *
 * Renders a row per property with a type-appropriate input. Supports adding
 * and removing arbitrary properties (used for the dynamic flag system in
 * the animation/keyframe JSON).
 */

import React, { useCallback, useMemo, useState } from 'react';
import * as JSONC from 'jsonc-parser';
import { objHas } from '../utils';
import { multichoice, defaultTypes, excludeProps, valueSuggestions } from '../animator/constants';

type Value = string | number | boolean | unknown[] | null;
type Obj = Record<string, Value>;

interface PropertiesEditorProps {
  obj: Obj;
  /** True for keyframe-style objects: hides `keyframes`, ensures `tween` is offered. */
  isKeyframe?: boolean;
  onChange: () => void;
  /** Optional list of properties always offered for quick-add. */
  suggestions?: string[];
}

const inferType = (v: Value): 'string' | 'number' | 'bool' | 'array' | 'other' => {
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'array';
  return 'other';
};

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  obj,
  isKeyframe = false,
  onChange,
  suggestions,
}) => {
  // Force re-render trigger for in-place mutations
  const [, bump] = useState(0);
  const tick = useCallback(() => {
    bump((n) => n + 1);
    onChange();
  }, [onChange]);

  const keyList = Object.getOwnPropertyNames(obj);
  const keys = useMemo(
    () =>
      keyList.filter((k) => {
        if (excludeProps.has(k)) {
          // Show 'hitbubbles: true' as a flag, but not arrays or 'keyframes'/'hurtbubbles'.
          if (k === 'hitbubbles' && obj[k] === true) return true;
          return false;
        }
        return true;
      }),
    [obj, keyList.join(',')]
  );

  const removeKey = (k: string) => {
    delete obj[k];
    tick();
  };

  const setKey = (k: string, v: Value) => {
    obj[k] = v;
    tick();
  };

  const renderValueInput = (k: string, v: Value) => {
    const choices = multichoice[k];
    if (choices) {
      const current = typeof v === 'string' && v ? v : choices.default;
      return (
        <select
          value={current}
          onChange={(e) => {
            const val = e.target.value;
            if (val === choices.default) delete obj[k];
            else obj[k] = val;
            tick();
          }}
        >
          {choices.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      );
    }
    const t = inferType(v);
    switch (t) {
      case 'bool':
        return (
          <input type="checkbox" checked={!!v} onChange={(e) => setKey(k, e.target.checked)} />
        );
      case 'number':
        return (
          <input
            type="number"
            value={Number.isFinite(v as number) ? (v as number) : 0}
            step="any"
            onChange={(e) => setKey(k, parseFloat(e.target.value) || 0)}
          />
        );
      case 'array':
        return (
          <input
            type="text"
            defaultValue={JSON.stringify(v)}
            onBlur={(e) => {
              try {
                const parsed = JSONC.parse(e.target.value);
                if (Array.isArray(parsed)) setKey(k, parsed);
              } catch {
                /* ignore */
              }
            }}
          />
        );
      default: {
        const suggestList = valueSuggestions[k];
        const listId = suggestList ? `prop-suggest-${k}` : undefined;
        return (
          <>
            <input
              type="text"
              list={listId}
              defaultValue={typeof v === 'string' ? v : String(v ?? '')}
              onBlur={(e) => setKey(k, e.target.value)}
            />
            {suggestList && (
              <datalist id={listId}>
                {suggestList.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </>
        );
      }
    }
  };

  return (
    <div>
      {keys.map((k) => (
        <div key={k} className="propRow">
          <label title={k}>{k}</label>
          {renderValueInput(k, obj[k])}
          <button
            className="propBtn"
            onClick={() => removeKey(k)}
            title="Remove property"
            aria-label="Remove property"
          >
            ×
          </button>
        </div>
      ))}
      <AddProperty
        isKeyframe={isKeyframe}
        existing={new Set(keys)}
        suggestions={suggestions}
        onAdd={(name, type) => {
          if (!name || objHas(obj, name)) return;
          if (multichoice[name]) obj[name] = multichoice[name].default;
          else if (type === 'bool') obj[name] = true;
          else if (type === 'number') obj[name] = 0;
          else obj[name] = '';
          tick();
        }}
      />
    </div>
  );
};

interface AddPropertyProps {
  isKeyframe: boolean;
  existing: Set<string>;
  suggestions?: string[];
  onAdd: (name: string, type: 'bool' | 'number' | 'string') => void;
}

const AddProperty: React.FC<AddPropertyProps> = ({ existing, onAdd, suggestions }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'bool' | 'number' | 'string'>('bool');

  const handleNameChange = (v: string) => {
    setName(v);
    if (defaultTypes[v]) setType(defaultTypes[v] as 'bool' | 'number' | 'string');
  };

  const submit = () => {
    if (!name) return;
    onAdd(name, type);
    setName('');
  };

  const listId = 'propname-suggestions';
  const allSuggestions = useMemo(() => {
    const base = suggestions ?? Object.keys(defaultTypes);
    return base.filter((k) => !existing.has(k)).sort();
  }, [suggestions, existing]);

  return (
    <div className="propAdd">
      <input
        list={listId}
        placeholder="add property…"
        className="input"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <datalist id={listId}>
        {allSuggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as 'bool' | 'number' | 'string')}
      >
        <option value="bool">bool</option>
        <option value="number">number</option>
        <option value="string">string</option>
      </select>
      <button className="propBtn" onClick={submit} title="Add property" aria-label="Add property">
        +
      </button>
    </div>
  );
};
