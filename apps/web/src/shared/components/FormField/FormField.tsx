import type { ReactNode } from 'react';
import './FormField.css';

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  /** Lays the field out as a horizontal row (used for checkboxes). */
  inline?: boolean;
  children: ReactNode;
}

/**
 * Standard label + required marker + help/error wrapper shared by every form
 * control (Input, Select, Textarea, Checkbox) so labels, spacing, and error
 * messaging look identical across the app.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  inline = false,
  children,
}: FormFieldProps) {
  return (
    <div className={`field ${inline ? 'field--inline' : ''}`.trim()}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        helpText && <span className="field__help">{helpText}</span>
      )}
    </div>
  );
}
