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

type Value = string | number | boolean | unknown[] | Record<string, unknown> | null;
type Obj = Record<string, Value>;

interface PropertiesEditorProps {
  obj: Obj;
  /** True for keyframe-style objects: hides `keyframes`, ensures `tween` is offered. */
  isKeyframe?: boolean;
  onChange: () => void;
  /** Optional list of properties always offered for quick-add. */
  suggestions?: string[];
  /** Extra keys to hide (e.g. those already shown by dedicated controls). */
  hideKeys?: readonly string[];
}

const inferType = (v: Value): 'string' | 'number' | 'bool' | 'array' | 'object' | 'other' => {
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'array';
  if (v !== null && typeof v === 'object') return 'object';
  return 'other';
};

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  obj,
  isKeyframe = false,
  onChange,
  suggestions,
  hideKeys,
}) => {
  const hidden = useMemo(() => new Set(hideKeys ?? []), [hideKeys]);
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
        if (hidden.has(k)) return false;
        if (excludeProps.has(k)) {
          // Show 'hitbubbles: true' as a flag, but not arrays or 'keyframes'/'hurtbubbles'.
          if (k === 'hitbubbles' && obj[k] === true) return true;
          return false;
        }
        return true;
      }),
    [obj, keyList.join(','), hidden]
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
      case 'object':
        // Edit arrays and objects (e.g. `redirect`, `spawn`) as JSON. Only
        // commit when the parse yields the same shape, so a stray edit can't
        // silently turn an object/array into a bare string.
        return (
          <input
            type="text"
            defaultValue={JSON.stringify(v)}
            onBlur={(e) => {
              try {
                const parsed = JSONC.parse(e.target.value);
                const ok =
                  t === 'array' ? Array.isArray(parsed) : !!parsed && typeof parsed === 'object';
                if (ok) setKey(k, parsed);
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
          else if (type === 'array') obj[name] = [];
          else if (type === 'object') obj[name] = {};
          else obj[name] = '';
          tick();
        }}
      />
    </div>
  );
};

type AddType = 'bool' | 'number' | 'string' | 'array' | 'object';

interface AddPropertyProps {
  isKeyframe: boolean;
  existing: Set<string>;
  suggestions?: string[];
  onAdd: (name: string, type: AddType) => void;
}

const AddProperty: React.FC<AddPropertyProps> = ({ existing, onAdd, suggestions }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AddType>('bool');

  const handleNameChange = (v: string) => {
    setName(v);
    if (defaultTypes[v]) setType(defaultTypes[v] as AddType);
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
      <select value={type} onChange={(e) => setType(e.target.value as AddType)}>
        <option value="bool">bool</option>
        <option value="number">number</option>
        <option value="string">string</option>
        <option value="array">array</option>
        <option value="object">object</option>
      </select>
      <button className="propBtn" onClick={submit} title="Add property" aria-label="Add property">
        +
      </button>
    </div>
  );
};
