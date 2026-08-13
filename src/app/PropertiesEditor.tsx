/**
 * PropertiesEditor — a cleaner, inspector-friendly property editor.
 *
 * Renders a row per property with a type-appropriate input. Supports adding
 * and removing arbitrary properties (used for the dynamic flag system in
 * the animation/keyframe JSON).
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { objHas } from '../utils';
import { multichoice, defaultTypes, excludeProps, valueSuggestions } from '../animator/constants';
import { parseJsoncValue } from '../animator/parsing';

export type Value = string | number | boolean | unknown[] | Record<string, unknown> | null;
export type Obj = Record<string, Value>;

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

const NumberPropertyInput: React.FC<{
  id: string;
  value: number;
  onCommit: (value: number) => void;
}> = ({ id, value, onCommit }) => {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      value={draft}
      step="any"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = Number(draft);
        if (draft.trim() === '' || !Number.isFinite(next)) {
          setDraft(String(value));
          return;
        }
        onCommit(next);
        setDraft(String(next));
      }}
    />
  );
};

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  obj,
  isKeyframe = false,
  onChange,
  suggestions,
  hideKeys,
}) => {
  const hidden = useMemo(() => new Set(hideKeys ?? []), [hideKeys]);
  const editorId = useId();
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
    const inputId = `${editorId}-${k.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const choices = multichoice[k];
    if (choices) {
      const current = typeof v === 'string' && v ? v : choices.default;
      return (
        <select
          id={inputId}
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
          <input
            id={inputId}
            type="checkbox"
            checked={!!v}
            onChange={(e) => setKey(k, e.target.checked)}
          />
        );
      case 'number':
        return (
          <NumberPropertyInput
            id={inputId}
            value={Number.isFinite(v as number) ? (v as number) : 0}
            onCommit={(n) => setKey(k, n)}
          />
        );
      case 'array':
      case 'object':
        // Edit arrays and objects (e.g. `redirect`, `spawn`) as JSON. Only
        // commit when the parse yields the same shape, so a stray edit can't
        // silently turn an object/array into a bare string.
        return (
          <input
            id={inputId}
            key={`${k}:${JSON.stringify(v)}`}
            type="text"
            defaultValue={JSON.stringify(v)}
            onBlur={(e) => {
              try {
                const parsed = parseJsoncValue<Value>(e.target.value, `property "${k}"`);
                const ok =
                  t === 'array'
                    ? Array.isArray(parsed)
                    : !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
                if (ok) setKey(k, parsed);
              } catch {
                // Keep the previous value until the user enters valid JSONC.
              }
            }}
          />
        );
      default: {
        const suggestList = valueSuggestions[k];
        const listId = suggestList ? `prop-suggest-${editorId}-${k}` : undefined;
        return (
          <>
            <input
              id={inputId}
              key={`${k}:${String(v ?? '')}`}
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
          <label htmlFor={`${editorId}-${k.replace(/[^a-zA-Z0-9_-]/g, '-')}`} title={k}>
            {k}
          </label>
          {renderValueInput(k, obj[k])}
          <button
            type="button"
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

const addTypeFor = (value: string): AddType => (value === 'boolean' ? 'bool' : (value as AddType));

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
    if (defaultTypes[v]) setType(addTypeFor(defaultTypes[v]));
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
        aria-label="Property name"
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
        aria-label="Property type"
        value={type}
        onChange={(e) => setType(e.target.value as AddType)}
      >
        <option value="bool">bool</option>
        <option value="number">number</option>
        <option value="string">string</option>
        <option value="array">array</option>
        <option value="object">object</option>
      </select>
      <button
        type="button"
        className="propBtn"
        onClick={submit}
        title="Add property"
        aria-label="Add property"
      >
        +
      </button>
    </div>
  );
};
