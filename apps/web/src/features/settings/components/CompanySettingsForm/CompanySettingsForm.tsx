import { useState, type FormEvent } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { CompanySettings, UpdateCompanySettingsRequest } from '../../types';
import './CompanySettingsForm.css';

interface CompanySettingsFormProps {
  companySettings: CompanySettings;
  isAdmin: boolean;
  isSaving: boolean;
  onSave: (request: UpdateCompanySettingsRequest) => Promise<void>;
}

interface CompanySettingsFormState {
  companyName: string;
  legalName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  website: string;
}

function buildInitialState(companySettings: CompanySettings): CompanySettingsFormState {
  return {
    companyName: companySettings.companyName ?? '',
    legalName: companySettings.legalName ?? '',
    registrationNumber: companySettings.registrationNumber ?? '',
    email: companySettings.email ?? '',
    phone: companySettings.phone ?? '',
    address: companySettings.address ?? '',
    website: companySettings.website ?? '',
  };
}

function trimOptionalValue(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidWebsite(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatUpdatedAt(value: string): string {
  if (!value) return 'לא זמין';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא זמין';

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function CompanySettingsForm({
  companySettings,
  isAdmin,
  isSaving,
  onSave,
}: CompanySettingsFormProps) {
  const [form, setForm] = useState<CompanySettingsFormState>(() =>
    buildInitialState(companySettings),
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function setField<K extends keyof CompanySettingsFormState>(
    key: K,
    value: CompanySettingsFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccessMessage(null);
  }

  function validate(): string | null {
    if (!form.companyName.trim()) return 'שם חברה הוא שדה חובה.';
    if (form.email.trim() && !isValidEmail(form.email)) return 'כתובת האימייל אינה תקינה.';
    if (form.website.trim() && !isValidWebsite(form.website)) {
      return 'כתובת האתר חייבת להתחיל ב-http:// או https://.';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await onSave({
        companyName: form.companyName.trim(),
        legalName: trimOptionalValue(form.legalName),
        registrationNumber: trimOptionalValue(form.registrationNumber),
        email: trimOptionalValue(form.email),
        phone: trimOptionalValue(form.phone),
        address: trimOptionalValue(form.address),
        website: trimOptionalValue(form.website),
      });
      setSuccessMessage('פרטי החברה נשמרו בהצלחה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת פרטי החברה נכשלה.');
    }
  }

  return (
    <form className="companySettingsForm" onSubmit={handleSubmit}>
      <div className="companySettingsForm__grid">
        <Input
          label="שם חברה *"
          value={form.companyName}
          onChange={(event) => setField('companyName', event.target.value)}
          disabled={!isAdmin || isSaving}
          required
        />
        <Input
          label="שם משפטי"
          value={form.legalName}
          onChange={(event) => setField('legalName', event.target.value)}
          disabled={!isAdmin || isSaving}
        />
        <Input
          label="מספר עוסק / חברה"
          value={form.registrationNumber}
          onChange={(event) => setField('registrationNumber', event.target.value)}
          disabled={!isAdmin || isSaving}
        />
        <Input
          label="אימייל מערכת"
          type="email"
          value={form.email}
          onChange={(event) => setField('email', event.target.value)}
          disabled={!isAdmin || isSaving}
        />
        <Input
          label="טלפון ראשי"
          type="tel"
          value={form.phone}
          onChange={(event) => setField('phone', event.target.value)}
          disabled={!isAdmin || isSaving}
        />
        <Input
          label="אתר"
          type="url"
          value={form.website}
          onChange={(event) => setField('website', event.target.value)}
          disabled={!isAdmin || isSaving}
          placeholder="https://example.com"
        />
      </div>

      <div className="companySettingsForm__field">
        <label className="companySettingsForm__label">כתובת</label>
        <textarea
          className="companySettingsForm__textarea"
          rows={3}
          value={form.address}
          onChange={(event) => setField('address', event.target.value)}
          disabled={!isAdmin || isSaving}
        />
      </div>

      <div className="companySettingsForm__meta">
        עודכן לאחרונה: {formatUpdatedAt(companySettings.updatedAt)}
      </div>

      {!isAdmin && (
        <p className="companySettingsForm__note">
          רק משתמשים עם תפקיד Admin יכולים לערוך ולשמור את פרטי החברה.
        </p>
      )}

      {error && <p className="companySettingsForm__error">{error}</p>}
      {successMessage && <p className="companySettingsForm__success">{successMessage}</p>}

      {isAdmin && (
        <div className="companySettingsForm__actions">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור פרטי חברה'}
          </Button>
        </div>
      )}
    </form>
  );
}
