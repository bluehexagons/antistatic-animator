/**
 * PropertyEditor Component
 *
 * Displays and edits properties of animation objects and keyframes.
 * Converted from the legacy makePropDisplay function.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as JSONC from 'jsonc-parser';
import { objHas } from '../../utils';
import { multichoice, defaultTypes, excludeProps } from '../constants';

interface PropertyEditorProps {
  /** The object to edit (Animation or Keyframe) */
  obj: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Whether this is editing a keyframe (adds 'tween' prop by default) */
  isKeyframe?: boolean;
  /** Callback when properties change */
  onChange?: () => void;
}

interface PropertyRowProps {
  propKey: string;
  value: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  obj: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onRemove: (key: string) => void;
  onChange: () => void;
}

const PropertyRow: React.FC<PropertyRowProps> = ({ propKey, value, obj, onRemove, onChange }) => {
  const inputRef = useRef<HTMLSpanElement | HTMLInputElement | HTMLSelectElement>(null);
  const [localValue, setLocalValue] = useState(() => {
    if (objHas(multichoice, propKey) && !value) {
      return multichoice[propKey].default;
    }
    return value;
  });

  const update = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    switch (typeof localValue) {
      case 'string':
        if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
          obj[propKey] = input.value;
        } else {
          obj[propKey] = input.textContent || '';
        }
        // Remove property if it's the default multichoice value
        if (objHas(multichoice, propKey) && multichoice[propKey].default === obj[propKey]) {
          delete obj[propKey];
        }
        break;
      case 'number': {
        const numValue = parseFloat(input.textContent || '0');
        obj[propKey] = numValue;
        if (input.textContent !== numValue.toString(10)) {
          input.textContent = numValue.toString(10);
        }
        break;
      }
      case 'boolean':
        obj[propKey] = (input as HTMLInputElement).checked;
        input.textContent = obj[propKey] ? 'true' : 'false';
        break;
      default:
        if (Array.isArray(localValue)) {
          try {
            const parsed = JSONC.parse(input.textContent || '[]');
            if (Array.isArray(parsed)) {
              obj[propKey] = parsed;
              input.textContent = JSON.stringify(obj[propKey]);
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
        break;
    }
    onChange();
  }, [propKey, localValue, obj, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        update();
        e.preventDefault();
      }
    },
    [update]
  );

  const handleRemove = useCallback(() => {
    delete obj[propKey];
    onRemove(propKey);
    onChange();
  }, [propKey, obj, onRemove, onChange]);

  // Skip rendering for excluded props (except 'hitbubbles: true')
  if (excludeProps.has(propKey) && (propKey !== 'hitbubbles' || localValue !== true)) {
    return null;
  }

  // Render different input types based on value type
  const renderInput = () => {
    const val = localValue;

    // Multichoice dropdown
    if (typeof val === 'string' && objHas(multichoice, propKey)) {
      const choices = multichoice[propKey].choices;
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={val || multichoice[propKey].default}
          onChange={(e) => {
            setLocalValue(e.target.value);
            update();
          }}
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    }

    // Boolean hidden (shown only as label)
    if (typeof val === 'boolean' && !val) {
      return null;
    }

    // Editable span for other types
    const getTextContent = () => {
      switch (typeof val) {
        case 'string':
          return val;
        case 'number':
          return val.toString(10);
        case 'boolean':
          return val ? 'true' : 'false';
        default:
          if (Array.isArray(val)) {
            return JSON.stringify(val);
          }
          return `<${typeof val}>`;
      }
    };

    return (
      <span
        ref={inputRef as React.RefObject<HTMLSpanElement>}
        className="input"
        contentEditable={typeof val !== 'object' || Array.isArray(val)}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={update}
      >
        {getTextContent()}
      </span>
    );
  };

  return (
    <div className="prop">
      <label>
        {propKey}
        {typeof localValue !== 'boolean' ? ':' : ''}
      </label>
      {renderInput()}
      <button className="prop-btn" onClick={handleRemove}>
        ×
      </button>
    </div>
  );
};

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  obj,
  isKeyframe = false,
  onChange,
}) => {
  const [properties, setProperties] = useState<string[]>(() => {
    const props = Object.getOwnPropertyNames(obj);
    // Add 'tween' for keyframes if not present
    if (isKeyframe && !objHas(obj, 'tween')) {
      props.push('tween');
    }
    return props;
  });

  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState('bool');
  const newPropInputRef = useRef<HTMLSpanElement>(null);

  const handleAddProperty = useCallback(() => {
    if (newPropName === '') return;

    // Create the property with default value based on type
    switch (newPropType) {
      case 'bool':
        obj[newPropName] = true;
        break;
      case 'string':
        obj[newPropName] = '';
        break;
      case 'number':
        obj[newPropName] = 0;
        break;
    }

    // Set to multichoice default if applicable
    if (objHas(multichoice, newPropName)) {
      obj[newPropName] = multichoice[newPropName].default;
    }

    setProperties([...properties, newPropName]);
    setNewPropName('');
    onChange?.();

    // Focus the newly created input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.prop-list .prop .input');
      const lastInput = inputs[inputs.length - 1] as HTMLElement;
      if (lastInput) {
        if (lastInput instanceof HTMLInputElement) {
          lastInput.select();
        } else {
          const range = document.createRange();
          range.selectNodeContents(lastInput);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }, 0);
  }, [newPropName, newPropType, obj, properties, onChange]);

  const handleNewPropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleAddProperty();
        e.preventDefault();
      }
    },
    [handleAddProperty]
  );

  const handleNewPropInput = useCallback(() => {
    const text = newPropInputRef.current?.textContent || '';
    setNewPropName(text);

    // Auto-select type based on defaultTypes
    if (objHas(defaultTypes, text)) {
      setNewPropType(defaultTypes[text]);
    }
  }, []);

  const handleRemoveProperty = useCallback(
    (key: string) => {
      setProperties(properties.filter((p) => p !== key));
    },
    [properties]
  );

  useEffect(() => {
    // Sync properties if obj changes externally
    const currentProps = Object.getOwnPropertyNames(obj);
    if (isKeyframe && !objHas(obj, 'tween') && !currentProps.includes('tween')) {
      currentProps.push('tween');
    }
    setProperties(currentProps);
  }, [obj, isKeyframe]);

  return (
    <div className="prop-list">
      {properties.map((key) => (
        <PropertyRow
          key={key}
          propKey={key}
          value={obj[key]}
          obj={obj}
          onRemove={handleRemoveProperty}
          onChange={() => onChange?.()}
        />
      ))}

      <div className="prop">
        <span
          ref={newPropInputRef}
          className="input"
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleNewPropKeyDown}
          onInput={handleNewPropInput}
        >
          {newPropName}
        </span>
        <select value={newPropType} onChange={(e) => setNewPropType(e.target.value)}>
          <option value="bool">bool</option>
          <option value="number">number</option>
          <option value="string">string</option>
        </select>
        <button className="prop-btn" onClick={handleAddProperty}>
          +
        </button>
      </div>
    </div>
  );
};
