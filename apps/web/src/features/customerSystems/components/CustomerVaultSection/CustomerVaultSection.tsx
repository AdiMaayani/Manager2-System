import { useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Input } from '@shared/components/Input';
import { ApiError } from '@api/client';
import { usePermissions } from '@shared/auth/usePermissions';
import { isLocalDataMode } from '@/config/appConfig';
import {
  useCustomerSystemMutations,
  useCustomerSystemSecretMutations,
  useCustomerSystemSecrets,
  useCustomerSystems,
} from '../../hooks/useCustomerSystems';
import { revealCustomerSystemSecretAsync } from '../../api/customerSystemsApiClient';
import type {
  CustomerSystem,
  CustomerSystemSecretMetadata,
  SaveCustomerSystemRequest,
} from '../../types';
import './CustomerVaultSection.css';

const SYSTEM_TYPE_OPTIONS = [
  'מצלמות',
  'אזעקה',
  'בקרת כניסה',
  'שרת',
  'חשמל חכם',
  'מערכת בקרה',
  'אודיו/וידאו',
  'רשת/תקשורת',
  'אחר',
];

const SECRET_TYPE_OPTIONS = ['סיסמה', 'משתמש+סיסמה', 'מפתח API', 'קוד גישה', 'אחר'];

interface SystemFormValues {
  systemType: string;
  systemName: string;
  vendor: string;
  model: string;
  host: string;
  port: string;
  url: string;
  locationDescription: string;
  notes: string;
  isActive: boolean;
}

function emptySystemForm(): SystemFormValues {
  return {
    systemType: SYSTEM_TYPE_OPTIONS[0],
    systemName: '',
    vendor: '',
    model: '',
    host: '',
    port: '',
    url: '',
    locationDescription: '',
    notes: '',
    isActive: true,
  };
}

function systemToForm(system: CustomerSystem): SystemFormValues {
  return {
    systemType: system.systemType,
    systemName: system.systemName,
    vendor: system.vendor ?? '',
    model: system.model ?? '',
    host: system.host ?? '',
    port: system.port != null ? String(system.port) : '',
    url: system.url ?? '',
    locationDescription: system.locationDescription ?? '',
    notes: system.notes ?? '',
    isActive: system.isActive,
  };
}

function formToRequest(values: SystemFormValues): SaveCustomerSystemRequest {
  const parsedPort = values.port.trim() ? Number(values.port.trim()) : null;
  return {
    systemType: values.systemType.trim(),
    systemName: values.systemName.trim(),
    vendor: values.vendor.trim() || null,
    model: values.model.trim() || null,
    host: values.host.trim() || null,
    port: parsedPort != null && Number.isFinite(parsedPort) ? parsedPort : null,
    url: values.url.trim() || null,
    locationDescription: values.locationDescription.trim() || null,
    notes: values.notes.trim() || null,
    isActive: values.isActive,
  };
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'אין לך הרשאה לפעולה זו.';
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface CustomerVaultSectionProps {
  customerId: number;
}

export function CustomerVaultSection({ customerId }: CustomerVaultSectionProps) {
  const { can } = usePermissions();
  const canView = can('viewCustomerSystems');
  const canManage = can('manageCustomerSystems');
  const canReveal = can('revealCustomerSystemSecrets');

  // Vault data is only available against the real API (not the mock dataset).
  const isEnabled = canView && isLocalDataMode;

  const systemsQuery = useCustomerSystems(customerId, isEnabled);
  const { createMutation } = useCustomerSystemMutations(customerId);

  const [showAddSystem, setShowAddSystem] = useState(false);
  const [addForm, setAddForm] = useState<SystemFormValues>(emptySystemForm);
  const [addError, setAddError] = useState<string | null>(null);

  if (!canView) return null;

  async function handleAddSystem(event: FormEvent) {
    event.preventDefault();
    if (!addForm.systemName.trim()) {
      setAddError('שם מערכת הוא שדה חובה.');
      return;
    }
    setAddError(null);
    try {
      await createMutation.mutateAsync(formToRequest(addForm));
      setAddForm(emptySystemForm());
      setShowAddSystem(false);
    } catch (err) {
      setAddError(describeError(err, 'יצירת מערכת נכשלה.'));
    }
  }

  const sectionTitle = 'מערכות לקוח (כספת)';

  let body: ReactNode;
  if (!isLocalDataMode) {
    body = <p className="vault__hint">כספת המערכות זמינה בחיבור לשרת בלבד.</p>;
  } else if (systemsQuery.isLoading) {
    body = <p className="vault__hint">טוען מערכות…</p>;
  } else if (systemsQuery.isError) {
    body = (
      <p className="vault__hint vault__hint--error">
        {describeError(systemsQuery.error, 'טעינת מערכות הלקוח נכשלה.')}
      </p>
    );
  } else {
    const systems = systemsQuery.data ?? [];
    body = (
      <div className="vault">
        <p className="vault__notice">
          חשיפת סיסמה נרשמת ביומן הגישה (מי, מתי, וסיבה).
        </p>

        {systems.length === 0 ? (
          <p className="vault__hint">לא הוגדרו מערכות עבור לקוח זה.</p>
        ) : (
          <ul className="vault__systemList">
            {systems.map((system) => (
              <SystemCard
                key={system.customerSystemId}
                customerId={customerId}
                system={system}
                canManage={canManage}
                canReveal={canReveal}
              />
            ))}
          </ul>
        )}

        {canManage && (
          <div className="vault__addSystem">
            {showAddSystem ? (
              <form className="vault__form" onSubmit={handleAddSystem}>
                <SystemFormFields values={addForm} onChange={setAddForm} showActive={false} />
                {addError && <p className="vault__error">{addError}</p>}
                <div className="vault__formActions">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'שומר…' : 'הוסף מערכת'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAddSystem(false);
                      setAddError(null);
                    }}
                  >
                    בטל
                  </Button>
                </div>
              </form>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setShowAddSystem(true)}>
                + מערכת חדשה
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return <DetailsSection title={sectionTitle}>{body}</DetailsSection>;
}

interface SystemFormFieldsProps {
  values: SystemFormValues;
  onChange: (next: SystemFormValues) => void;
  showActive: boolean;
}

function SystemFormFields({ values, onChange, showActive }: SystemFormFieldsProps) {
  function set<K extends keyof SystemFormValues>(key: K, value: SystemFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="vault__formGrid">
      <label className="vault__field">
        <span>סוג מערכת *</span>
        <select
          className="vault__select"
          value={values.systemType}
          onChange={(e) => set('systemType', e.target.value)}
        >
          {SYSTEM_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <Input label="שם מערכת *" value={values.systemName} onChange={(e) => set('systemName', e.target.value)} />
      <Input label="יצרן" value={values.vendor} onChange={(e) => set('vendor', e.target.value)} />
      <Input label="דגם" value={values.model} onChange={(e) => set('model', e.target.value)} />
      <Input label="כתובת IP / Host" value={values.host} onChange={(e) => set('host', e.target.value)} />
      <Input label="פורט" type="number" value={values.port} onChange={(e) => set('port', e.target.value)} />
      <Input label="קישור (URL)" value={values.url} onChange={(e) => set('url', e.target.value)} />
      <Input
        label="תיאור מיקום"
        value={values.locationDescription}
        onChange={(e) => set('locationDescription', e.target.value)}
      />
      <Input label="הערות" value={values.notes} onChange={(e) => set('notes', e.target.value)} />
      {showActive && (
        <label className="vault__checkboxRow">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          <span>מערכת פעילה</span>
        </label>
      )}
    </div>
  );
}

interface SystemCardProps {
  customerId: number;
  system: CustomerSystem;
  canManage: boolean;
  canReveal: boolean;
}

function SystemCard({ customerId, system, canManage, canReveal }: SystemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<SystemFormValues>(() => systemToForm(system));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const { updateMutation, deactivateMutation } = useCustomerSystemMutations(customerId);

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editForm.systemName.trim()) {
      setError('שם מערכת הוא שדה חובה.');
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: system.customerSystemId,
        request: formToRequest(editForm),
      });
      setIsEditing(false);
    } catch (err) {
      setError(describeError(err, 'עדכון מערכת נכשל.'));
    }
  }

  async function handleDeactivate() {
    setError(null);
    try {
      await deactivateMutation.mutateAsync(system.customerSystemId);
    } catch (err) {
      setError(describeError(err, 'השבתת מערכת נכשלה.'));
    }
  }

  const subtitle = [system.systemType, system.host, system.url].filter(Boolean).join(' · ');

  return (
    <li className="vault__system">
      <div className="vault__systemHeader">
        <button
          type="button"
          className="vault__systemToggle"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          <span className="vault__systemName">{system.systemName}</span>
          {subtitle && <span className="vault__systemMeta">{subtitle}</span>}
        </button>
        {!system.isActive && <Badge variant="neutral">לא פעילה</Badge>}
        {canManage && !isEditing && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditForm(systemToForm(system));
              setError(null);
              setIsEditing(true);
              setIsExpanded(true);
            }}
          >
            ערוך
          </Button>
        )}
      </div>

      {isEditing && (
        <form className="vault__form" onSubmit={handleSaveEdit}>
          <SystemFormFields values={editForm} onChange={setEditForm} showActive />
          {error && <p className="vault__error">{error}</p>}
          <div className="vault__formActions">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'שומר…' : 'שמור'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
              בטל
            </Button>
            {system.isActive && (
              confirmDeactivate ? (
                <>
                  <span className="vault__confirmText">להשבית מערכת זו?</span>
                  <Button type="button" variant="danger" onClick={handleDeactivate} disabled={deactivateMutation.isPending}>
                    אישור
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirmDeactivate(false)}>
                    חזור
                  </Button>
                </>
              ) : (
                <Button type="button" variant="danger" onClick={() => setConfirmDeactivate(true)}>
                  השבת מערכת
                </Button>
              )
            )}
          </div>
        </form>
      )}

      {!isEditing && error && <p className="vault__error">{error}</p>}

      {isExpanded && !isEditing && (
        <SecretsPanel
          customerSystemId={system.customerSystemId}
          canManage={canManage && system.isActive}
          canReveal={canReveal && system.isActive}
        />
      )}
    </li>
  );
}

interface SecretsPanelProps {
  customerSystemId: number;
  canManage: boolean;
  canReveal: boolean;
}

function SecretsPanel({ customerSystemId, canManage, canReveal }: SecretsPanelProps) {
  const secretsQuery = useCustomerSystemSecrets(customerSystemId, true);
  const { createMutation } = useCustomerSystemSecretMutations(customerSystemId);

  const [showAdd, setShowAdd] = useState(false);
  const [secretType, setSecretType] = useState(SECRET_TYPE_OPTIONS[0]);
  const [username, setUsername] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function resetAddForm() {
    setSecretType(SECRET_TYPE_OPTIONS[0]);
    setUsername('');
    setSecretValue('');
    setNotes('');
  }

  async function handleAddSecret(event: FormEvent) {
    event.preventDefault();
    if (!secretValue) {
      setError('ערך הסוד הוא שדה חובה.');
      return;
    }
    setError(null);
    try {
      await createMutation.mutateAsync({
        secretType: secretType.trim(),
        username: username.trim() || null,
        secretValue,
        notes: notes.trim() || null,
        isActive: true,
      });
      resetAddForm();
      setShowAdd(false);
    } catch (err) {
      setError(describeError(err, 'שמירת סוד נכשלה.'));
    }
  }

  if (secretsQuery.isLoading) {
    return <p className="vault__hint">טוען פרטי גישה…</p>;
  }
  if (secretsQuery.isError) {
    return (
      <p className="vault__hint vault__hint--error">
        {describeError(secretsQuery.error, 'טעינת פרטי הגישה נכשלה.')}
      </p>
    );
  }

  const secrets = secretsQuery.data ?? [];

  return (
    <div className="vault__secrets">
      {secrets.length === 0 ? (
        <p className="vault__hint">לא הוגדרו פרטי גישה למערכת זו.</p>
      ) : (
        <ul className="vault__secretList">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.secretId}
              customerSystemId={customerSystemId}
              secret={secret}
              canManage={canManage}
              canReveal={canReveal}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <div className="vault__addSecret">
          {showAdd ? (
            <form className="vault__form" onSubmit={handleAddSecret}>
              <div className="vault__formGrid">
                <label className="vault__field">
                  <span>סוג סוד *</span>
                  <select
                    className="vault__select"
                    value={secretType}
                    onChange={(e) => setSecretType(e.target.value)}
                  >
                    {SECRET_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <Input label="שם משתמש" value={username} onChange={(e) => setUsername(e.target.value)} />
                <Input
                  label="ערך הסוד *"
                  type="password"
                  autoComplete="new-password"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                />
                <Input label="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error && <p className="vault__error">{error}</p>}
              <div className="vault__formActions">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'שומר…' : 'הוסף סוד'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAdd(false);
                    setError(null);
                  }}
                >
                  בטל
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setShowAdd(true)}>
              + פרט גישה חדש
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface SecretRowProps {
  customerSystemId: number;
  secret: CustomerSystemSecretMetadata;
  canManage: boolean;
  canReveal: boolean;
}

function SecretRow({ customerSystemId, secret, canManage, canReveal }: SecretRowProps) {
  const { updateMutation, deactivateMutation } = useCustomerSystemSecretMutations(customerSystemId);

  const [revealState, setRevealState] = useState<'idle' | 'confirming' | 'revealing' | 'revealed'>(
    'idle',
  );
  const [revealReason, setRevealReason] = useState('');
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setError(null);
    setRevealState('revealing');
    try {
      const result = await revealCustomerSystemSecretAsync(
        customerSystemId,
        secret.secretId,
        revealReason.trim() || undefined,
      );
      setRevealedValue(result.secretValue);
      setRevealState('revealed');
    } catch (err) {
      setError(describeError(err, 'חשיפת הסוד נכשלה.'));
      setRevealState('idle');
    }
  }

  function handleHide() {
    setRevealedValue(null);
    setRevealReason('');
    setRevealState('idle');
  }

  return (
    <li className="vault__secret">
      <div className="vault__secretMain">
        <span className="vault__secretType">{secret.secretType}</span>
        {secret.username && <span className="vault__secretMeta">משתמש: {secret.username}</span>}
        <span className="vault__secretMask">{secret.maskedPreview || '••••••'}</span>
        {!secret.isActive && <Badge variant="neutral">לא פעיל</Badge>}
      </div>

      {secret.notes && <p className="vault__secretNotes">{secret.notes}</p>}

      <div className="vault__secretActions">
        {canReveal && secret.isActive && revealState === 'idle' && (
          <Button type="button" variant="secondary" onClick={() => setRevealState('confirming')}>
            חשוף סוד
          </Button>
        )}

        {canManage && secret.isActive && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              deactivateMutation.mutate(secret.secretId, {
                onError: (err) => setError(describeError(err, 'השבתת הסוד נכשלה.')),
              })
            }
            disabled={deactivateMutation.isPending}
          >
            השבת
          </Button>
        )}

        {canManage && !secret.isActive && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              updateMutation.mutate(
                {
                  secretId: secret.secretId,
                  request: {
                    secretType: secret.secretType,
                    username: secret.username ?? null,
                    notes: secret.notes ?? null,
                    isActive: true,
                  },
                },
                { onError: (err) => setError(describeError(err, 'הפעלת הסוד נכשלה.')) },
              )
            }
            disabled={updateMutation.isPending}
          >
            הפעל מחדש
          </Button>
        )}
      </div>

      {revealState === 'confirming' && (
        <div className="vault__reveal">
          <p className="vault__revealWarning">
            פעולה זו תיחשף הסיסמה ותירשם ביומן הגישה. יש לציין סיבה במידת הצורך.
          </p>
          <Input
            label="סיבת גישה (לא חובה)"
            value={revealReason}
            onChange={(e) => setRevealReason(e.target.value)}
          />
          <div className="vault__formActions">
            <Button type="button" variant="danger" onClick={handleReveal}>
              אשר חשיפה
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRevealState('idle')}>
              בטל
            </Button>
          </div>
        </div>
      )}

      {revealState === 'revealing' && <p className="vault__hint">חושף…</p>}

      {revealState === 'revealed' && revealedValue != null && (
        <div className="vault__revealed">
          <code className="vault__revealedValue">{revealedValue}</code>
          <Button type="button" variant="secondary" onClick={handleHide}>
            הסתר
          </Button>
        </div>
      )}

      {error && <p className="vault__error">{error}</p>}
    </li>
  );
}
