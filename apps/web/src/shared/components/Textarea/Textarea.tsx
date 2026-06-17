import { useId, type TextareaHTMLAttributes } from 'react';
import { FormField } from '../FormField';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export function Textarea({
  label,
  error,
  helpText,
  id,
  className = '',
  required,
  rows = 3,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? props.name ?? generatedId;
  return (
    <FormField
      label={label}
      htmlFor={textareaId}
      required={required}
      error={error}
      helpText={helpText}
    >
      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        className={`formControl ${error ? 'formControl--error' : ''} ${className}`.trim()}
        {...props}
      />
    </FormField>
  );
}
