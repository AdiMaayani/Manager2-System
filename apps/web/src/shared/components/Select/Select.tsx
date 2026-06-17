import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FormField } from '../FormField';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  /** Convenience: render options from data. Ignored when `children` is given. */
  options?: SelectOption[];
  children?: ReactNode;
}

export function Select({
  label,
  error,
  helpText,
  options,
  children,
  id,
  className = '',
  required,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? props.name ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={selectId}
      required={required}
      error={error}
      helpText={helpText}
    >
      <select
        id={selectId}
        required={required}
        className={`formControl ${error ? 'formControl--error' : ''} ${className}`.trim()}
        {...props}
      >
        {children ??
          options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </FormField>
  );
}
