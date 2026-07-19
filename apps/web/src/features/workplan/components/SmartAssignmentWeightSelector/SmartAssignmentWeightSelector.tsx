import { useId } from 'react';
import { Input } from '@shared/components/Input';
import type { SmartAssignmentWeights } from '../../types';
import {
  SMART_ASSIGNMENT_WEIGHT_KEYS,
  SMART_ASSIGNMENT_WEIGHT_LABELS,
  SMART_ASSIGNMENT_WEIGHT_PRESETS,
  cloneSmartAssignmentWeights,
  getSmartAssignmentWeightsError,
  getSmartAssignmentWeightsTotal,
  type SmartAssignmentWeightPresetKey,
} from '../../lib/smartAssignmentWeights';
import './SmartAssignmentWeightSelector.css';

interface SmartAssignmentWeightSelectorProps {
  value: SmartAssignmentWeights;
  preset: SmartAssignmentWeightPresetKey;
  onChange: (weights: SmartAssignmentWeights) => void;
  onPresetChange: (preset: SmartAssignmentWeightPresetKey) => void;
  disabled?: boolean;
}

const PRESET_OPTIONS = [
  ...SMART_ASSIGNMENT_WEIGHT_PRESETS,
  {
    key: 'manual' as const,
    label: 'ידני',
    description: 'הזנת משקל נפרד לכל גורם.',
    weights: null,
  },
];

export function SmartAssignmentWeightSelector({
  value,
  preset,
  onChange,
  onPresetChange,
  disabled = false,
}: SmartAssignmentWeightSelectorProps) {
  const componentId = useId();
  const helpId = `${componentId}-help`;
  const statusId = `${componentId}-status`;
  const radioGroupName = `${componentId}-preset`;
  const error = getSmartAssignmentWeightsError(value);
  const total = getSmartAssignmentWeightsTotal(value);

  function selectPreset(nextPreset: SmartAssignmentWeightPresetKey) {
    onPresetChange(nextPreset);
    if (nextPreset === 'manual') return;
    const selected = SMART_ASSIGNMENT_WEIGHT_PRESETS.find((item) => item.key === nextPreset);
    if (selected) onChange(cloneSmartAssignmentWeights(selected.weights));
  }

  return (
    <fieldset className="smartWeights" disabled={disabled} aria-describedby={`${helpId} ${statusId}`}>
      <legend className="smartWeights__legend">משקלי החישוב</legend>
      <p id={helpId} className="smartWeights__help">
        בחרו שילוב מוצע או הזינו משקלים ידנית. המשקלים משפיעים רק על ההרצה הנוכחית.
      </p>

      <div className="smartWeights__presets" role="radiogroup" aria-label="שילובי משקלים">
        {PRESET_OPTIONS.map((option) => (
          <label
            key={option.key}
            className={`smartWeights__preset ${preset === option.key ? 'smartWeights__preset--selected' : ''}`.trim()}
          >
            <input
              type="radio"
              name={radioGroupName}
              value={option.key}
              checked={preset === option.key}
              onChange={() => selectPreset(option.key)}
            />
            <span className="smartWeights__presetText">
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="smartWeights__inputs" aria-label="משקלים באחוזים">
        {SMART_ASSIGNMENT_WEIGHT_KEYS.map((key) => (
          <Input
            key={key}
            label={`${SMART_ASSIGNMENT_WEIGHT_LABELS[key]} (%)`}
            type="number"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            value={value[key]}
            readOnly={preset !== 'manual'}
            aria-invalid={preset === 'manual' && Boolean(error)}
            onChange={(event) => {
              const nextValue = event.target.value === '' ? 0 : Number(event.target.value);
              onPresetChange('manual');
              onChange({ ...value, [key]: nextValue });
            }}
          />
        ))}
      </div>

      <p
        id={statusId}
        className={`smartWeights__total ${error ? 'smartWeights__total--error' : ''}`.trim()}
        role={error ? 'alert' : 'status'}
      >
        סה״כ: <strong dir="ltr">{Number.isFinite(total) ? total.toFixed(2).replace(/\.00$/, '') : '—'}%</strong>
        {error ? ` · ${error}` : ' · מוכן להרצה'}
      </p>
    </fieldset>
  );
}
