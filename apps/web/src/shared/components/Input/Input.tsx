import { useId, type InputHTMLAttributes } from 'react';
import { FormField } from '../FormField';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export function Input({
  label,
  error,
  helpText,
  id,
  className = '',
  required,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={inputId}
      required={required}
      error={error}
      helpText={helpText}
    >
      <input
        id={inputId}
        required={required}
        className={`formControl ${error ? 'formControl--error' : ''} ${className}`.trim()}
        {...props}
      />
    </FormField>
  );
}
