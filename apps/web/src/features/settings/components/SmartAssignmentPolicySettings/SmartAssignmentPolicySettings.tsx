import { useCallback, useMemo, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Checkbox } from '@shared/components/Checkbox';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { InlineAlert } from '@shared/components/InlineAlert';
import { Input } from '@shared/components/Input';
import { Modal } from '@shared/components/Modal';
import { PageSpinner } from '@shared/components/PageSpinner';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import {
  DEFAULT_SMART_ASSIGNMENT_PREVIEW_SCORES,
  buildSmartAssignmentPreviewRequest,
  buildSmartAssignmentUpdateRequest,
  editablePolicyFromProfile,
  getSmartAssignmentPreviewSignature,
  getSmartAssignmentPolicyControlAccess,
  getSmartAssignmentProfileLabel,
  isSmartAssignmentPolicyDirty,
  validateSmartAssignmentPolicy,
  validateSmartAssignmentPreviewScores,
} from '../../lib/smartAssignmentPolicyForm';
import {
  usePreviewSmartAssignmentPolicy,
  useResetSmartAssignmentPolicy,
  useSmartAssignmentPolicies,
  useUpdateSmartAssignmentPolicy,
} from '../../hooks/useSmartAssignmentPolicies';
import {
  SMART_ASSIGNMENT_PROFILE_KEYS,
  type SmartAssignmentPolicyEditable,
  type SmartAssignmentPolicyProfile,
  type SmartAssignmentPolicyWeights,
  type SmartAssignmentPreviewScores,
  type SmartAssignmentProfileKey,
} from '../../types';
import './SmartAssignmentPolicySettings.css';

const PROFILE_ORDER = Object.values(SMART_ASSIGNMENT_PROFILE_KEYS);

const WEIGHT_FIELDS: Array<{
  key: keyof SmartAssignmentPolicyWeights;
  label: string;
  helpText: string;
}> = [
  { key: 'professionalFit', label: 'התאמה מקצועית', helpText: 'תפקיד וכישורים רלוונטיים למשימה.' },
  { key: 'availability', label: 'זמינות', helpText: 'כיסוי חלון המשימה והיעדר חסימות.' },
  { key: 'workload', label: 'עומס עבודה', helpText: 'עומס חזוי ביחס לקיבולת העובד.' },
  { key: 'geography', label: 'גיאוגרפיה', helpText: 'זמן נסיעה משוער אל אתר המשימה.' },
  { key: 'experience', label: 'ניסיון', helpText: 'ניסיון בכישורים הרלוונטיים למשימה.' },
];

const SAFETY_RULES = [
  'עובד לא פעיל או עובד שאינו ניתן לשיבוץ אינו נכנס לרשימת המועמדים.',
  'כל עובד שנכנס לרשימת המועמדים מדורג וניתן לבחירה; הציון הוא כלי תומך החלטה.',
  'פער מקצועי, כישור חסר או חוסר זמינות מפחיתים את הציון ומוצגים כעובדה, אך אינם פוסלים עובד.',
  'שיבוץ ידני נשאר החלטת המשבץ ואינו נדרס אוטומטית על ידי ההמלצה.',
  'כללי הרשאה ושלמות מסד הנתונים אינם ניתנים לשינוי במסך זה.',
];

const FACTOR_LABELS: Record<string, string> = {
  professionalfit: 'התאמה מקצועית',
  professional: 'התאמה מקצועית',
  availability: 'זמינות',
  workload: 'עומס עבודה',
  geography: 'גיאוגרפיה',
  geographic: 'גיאוגרפיה',
  experience: 'ניסיון',
};

interface SmartAssignmentPolicySettingsProps {
  canManage: boolean;
}

function numberInputValue(value: number): number | '' {
  return Number.isFinite(value) ? value : '';
}

function parseNumberInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function formatScore(value: number): string {
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(value)}%`
    : '—';
}

function formatUpdatedAt(value?: string | null): string {
  if (!value) return 'לא זמין';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא זמין';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getFactorLabel(code?: string | null, fallback?: string | null): string {
  const normalizedCode = (code ?? '').replace(/[^a-z]/gi, '').toLowerCase();
  return FACTOR_LABELS[normalizedCode] ?? fallback ?? 'גורם ציון';
}

export function SmartAssignmentPolicySettings({ canManage }: SmartAssignmentPolicySettingsProps) {
  const controlAccess = useMemo(
    () => getSmartAssignmentPolicyControlAccess(canManage),
    [canManage],
  );
  const policiesQuery = useSmartAssignmentPolicies();
  const updateMutation = useUpdateSmartAssignmentPolicy();
  const resetMutation = useResetSmartAssignmentPolicy();
  const previewMutation = usePreviewSmartAssignmentPolicy();
  const [selectedProfileKey, setSelectedProfileKey] =
    useState<SmartAssignmentProfileKey>(SMART_ASSIGNMENT_PROFILE_KEYS.Default);
  const [draftOverride, setDraftOverride] = useState<SmartAssignmentPolicyEditable | null>(null);
  const [sampleScores, setSampleScores] = useState<SmartAssignmentPreviewScores>({
    ...DEFAULT_SMART_ASSIGNMENT_PREVIEW_SCORES,
  });
  const [previewedSignature, setPreviewedSignature] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingProfileKey, setPendingProfileKey] = useState<SmartAssignmentProfileKey | null>(null);

  const selectedProfile = useMemo(
    () => policiesQuery.data?.find((policy) => policy.profileKey === selectedProfileKey) ?? null,
    [policiesQuery.data, selectedProfileKey],
  );
  const baseline = useMemo(
    () => (selectedProfile ? editablePolicyFromProfile(selectedProfile) : null),
    [selectedProfile],
  );
  const draft = draftOverride ?? baseline;
  const isDirty = Boolean(draft && baseline && isSmartAssignmentPolicyDirty(draft, baseline));
  const blocker = useBlocker(isDirty);

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    [isDirty],
  );
  useBeforeUnload(handleBeforeUnload);

  function loadProfile(profile: SmartAssignmentPolicyProfile) {
    const editable = editablePolicyFromProfile(profile);
    setSelectedProfileKey(profile.profileKey);
    setDraftOverride(editable);
    setEditingVersion(profile.version);
    setChangeReason('');
    setPreviewedSignature(null);
    setSampleScores({ ...DEFAULT_SMART_ASSIGNMENT_PREVIEW_SCORES });
    setActionError(null);
    previewMutation.reset();
  }

  const validation = useMemo(
    () => (draft ? validateSmartAssignmentPolicy(draft) : null),
    [draft],
  );
  const previewScoreError = useMemo(
    () => validateSmartAssignmentPreviewScores(sampleScores),
    [sampleScores],
  );
  const currentPreviewSignature = useMemo(
    () =>
      draft
        ? getSmartAssignmentPreviewSignature(selectedProfileKey, draft, sampleScores)
        : null,
    [draft, sampleScores, selectedProfileKey],
  );
  const hasCurrentPreview = Boolean(
    currentPreviewSignature && previewedSignature === currentPreviewSignature && previewMutation.data,
  );
  const isPending = updateMutation.isPending || resetMutation.isPending || previewMutation.isPending;
  const canSave = Boolean(
    controlAccess.canSave && isDirty && validation?.isValid && hasCurrentPreview && !isPending,
  );

  function clearPreview() {
    setPreviewedSignature(null);
    previewMutation.reset();
    setSuccessMessage(null);
  }

  function updateDraft(updater: (current: SmartAssignmentPolicyEditable) => SmartAssignmentPolicyEditable) {
    setEditingVersion((current) => current ?? selectedProfile?.version ?? null);
    setDraftOverride((current) => updater(current ?? draft!));
    clearPreview();
  }

  function updateWeight(key: keyof SmartAssignmentPolicyWeights, value: number) {
    updateDraft((current) => ({
      ...current,
      weights: { ...current.weights, [key]: value },
    }));
  }

  function updateSampleScore(key: keyof SmartAssignmentPreviewScores, value: number) {
    setSampleScores((current) => ({ ...current, [key]: value }));
    clearPreview();
  }

  function activateProfile(profileKey: SmartAssignmentProfileKey) {
    setSelectedProfileKey(profileKey);
    setDraftOverride(null);
    setEditingVersion(null);
    setPendingProfileKey(null);
    setChangeReason('');
    setPreviewedSignature(null);
    previewMutation.reset();
    setSuccessMessage(null);
    setActionError(null);
  }

  function requestProfileChange(profileKey: SmartAssignmentProfileKey) {
    if (profileKey === selectedProfileKey) return;
    if (isDirty) {
      setPendingProfileKey(profileKey);
      return;
    }
    activateProfile(profileKey);
  }

  async function handlePreview() {
    if (!draft || !validation?.isValid || previewScoreError) return;
    setActionError(null);
    setSuccessMessage(null);
    const request = buildSmartAssignmentPreviewRequest(selectedProfileKey, draft, sampleScores);
    const signature = getSmartAssignmentPreviewSignature(selectedProfileKey, draft, sampleScores);
    try {
      await previewMutation.mutateAsync(request);
      setPreviewedSignature(signature);
    } catch (error) {
      setPreviewedSignature(null);
      setActionError(error instanceof Error ? error.message : 'יצירת התצוגה המקדימה נכשלה.');
    }
  }

  async function handleSave() {
    if (!draft || !selectedProfile || !canSave) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateMutation.mutateAsync({
        profileKey: selectedProfileKey,
        request: buildSmartAssignmentUpdateRequest(
          draft,
          editingVersion ?? selectedProfile.version,
          changeReason,
        ),
      });
      loadProfile(updated);
      setSuccessMessage(`המדיניות נשמרה בהצלחה כגרסה ${updated.version}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'שמירת מדיניות השיבוץ נכשלה.');
    }
  }

  async function handleReset() {
    if (!controlAccess.canReset) return;
    setActionError(null);
    setSuccessMessage(null);
    try {
      const resetPolicy = await resetMutation.mutateAsync(selectedProfileKey);
      loadProfile(resetPolicy);
      setSuccessMessage(`ברירות המחדל נשמרו כגרסה ${resetPolicy.version}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'איפוס מדיניות השיבוץ נכשל.');
    }
  }

  if (policiesQuery.isLoading) return <PageSpinner />;
  if (policiesQuery.error) {
    return (
      <ErrorState
        message={
          policiesQuery.error instanceof Error
            ? policiesQuery.error.message
            : 'טעינת מדיניות השיבוץ נכשלה.'
        }
        onRetry={() => policiesQuery.refetch()}
      />
    );
  }
  if (!policiesQuery.data?.length) {
    return <EmptyState title="לא נמצאו פרופילי שיבוץ חכם" />;
  }
  if (!selectedProfile || !draft || !validation) return <PageSpinner />;

  const previewContributions = previewMutation.data?.contributions ?? [];
  return (
    <div className="smartPolicySettings">
      {!controlAccess.canEdit && (
        <InlineAlert variant="info">
          המדיניות מוצגת לקריאה בלבד. שמירה, איפוס ותצוגה מקדימה זמינים רק למנהלי הגדרות מורשים.
        </InlineAlert>
      )}

      <div className="smartPolicySettings__profileHeader">
        <Select
          label="פרופיל מדיניות"
          value={selectedProfileKey}
          onChange={(event) => requestProfileChange(event.target.value as SmartAssignmentProfileKey)}
          disabled={isPending}
        >
          {PROFILE_ORDER.filter((key) =>
            policiesQuery.data.some((profile) => profile.profileKey === key),
          ).map((profileKey) => (
            <option key={profileKey} value={profileKey}>
              {getSmartAssignmentProfileLabel(profileKey)}
            </option>
          ))}
        </Select>
        <div className="smartPolicySettings__metadata" aria-label="פרטי גרסת מדיניות">
          <span>גרסה <strong>{selectedProfile.version}</strong></span>
          <span>עודכן: <strong>{formatUpdatedAt(selectedProfile.updatedAtUtc)}</strong></span>
          {selectedProfile.updatedByUserId != null && (
            <span>עודכן על ידי: <strong>משתמש #{selectedProfile.updatedByUserId}</strong></span>
          )}
          <Badge variant={selectedProfile.isPersisted ? 'success' : 'warning'}>
            {selectedProfile.isPersisted ? 'מדיניות שמורה' : 'ברירת מחדל מובנית'}
          </Badge>
          <Badge variant={draft.isActive ? 'success' : 'neutral'}>
            {draft.isActive ? 'פעיל' : 'לא פעיל'}
          </Badge>
        </div>
      </div>

      {!selectedProfile.isPersisted && (
        <InlineAlert variant="info">
          לפרופיל זה עדיין אין גרסה שמורה. עד השמירה הוא משתמש במדיניות ברירת המחדל של המערכת.
        </InlineAlert>
      )}

      <div className="smartPolicySettings__identityGrid">
        <Input
          label="שם הפרופיל"
          value={draft.displayName}
          onChange={(event) => updateDraft((current) => ({ ...current, displayName: event.target.value }))}
          disabled={!canManage || isPending}
          required
        />
        <Checkbox
          label="פרופיל פעיל"
          checked={draft.isActive}
          onChange={(event) => updateDraft((current) => ({ ...current, isActive: event.target.checked }))}
          disabled={!canManage || isPending || selectedProfileKey === SMART_ASSIGNMENT_PROFILE_KEYS.Default}
        />
      </div>
      <Textarea
        label="תיאור הפרופיל"
        value={draft.description}
        onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
        disabled={!canManage || isPending}
        rows={2}
      />

      <section className="smartPolicySettings__group">
        <div className="smartPolicySettings__groupHeader">
          <h3>עקרונות החלטה קבועים</h3>
          <Badge>לא ניתנים לשינוי</Badge>
        </div>
        <ul className="smartPolicySettings__safetyList">
          {SAFETY_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </section>

      <section className="smartPolicySettings__group">
        <div className="smartPolicySettings__groupHeader">
          <h3>העדפות דירוג</h3>
          <p>העדפות אלו משנות את סדר ההמלצות בלבד ואינן מונעות בחירת עובד.</p>
        </div>
        <div className="smartPolicySettings__preferenceGrid">
          <Checkbox
            label="השתמש ברציפות כשובר שוויון"
            checked={draft.useContinuityAsTieBreak}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              useContinuityAsTieBreak: event.target.checked,
            }))}
            disabled={!canManage || isPending}
          />
          <Checkbox
            label="איזון עומס מדומה בחישוב קבוצתי"
            checked={draft.enableBatchSimulatedLoadBalancing}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              enableBatchSimulatedLoadBalancing: event.target.checked,
            }))}
            disabled={!canManage || isPending}
          />
        </div>
      </section>

      <section className="smartPolicySettings__group">
        <div className="smartPolicySettings__groupHeader smartPolicySettings__groupHeader--withTotal">
          <div>
            <h3>גורמי ציון</h3>
            <p>המשקלים אינם מנורמלים אוטומטית וחייבים להסתכם בדיוק ב־100%.</p>
          </div>
          <div
            className={`smartPolicySettings__total ${Math.abs(validation.weightTotal - 100) <= 0.0001 ? 'smartPolicySettings__total--valid' : 'smartPolicySettings__total--invalid'}`}
            role="status"
          >
            סה״כ: {formatScore(validation.weightTotal)}
          </div>
        </div>
        <div className="smartPolicySettings__weightsGrid">
          {WEIGHT_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={`${field.label} (%)`}
              helpText={field.helpText}
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={numberInputValue(draft.weights[field.key])}
              onChange={(event) => updateWeight(field.key, parseNumberInput(event.target.value))}
              disabled={!canManage || isPending}
              className="smartPolicySettings__numberInput"
            />
          ))}
        </div>
      </section>

      <section className="smartPolicySettings__group">
        <div className="smartPolicySettings__groupHeader">
          <h3>ערכי ברירת מחדל במקרה של מידע חסר</h3>
          <p>הציון נשאר בטווח 0–100; משקל של גורם חסר אינו מחולק מחדש.</p>
        </div>
        <div className="smartPolicySettings__defaultsGrid">
          <Input
            label="זמינות חסרה"
            type="number"
            min={0}
            max={100}
            value={numberInputValue(draft.missingAvailabilityScore)}
            onChange={(event) => updateDraft((current) => ({ ...current, missingAvailabilityScore: parseNumberInput(event.target.value) }))}
            disabled={!canManage || isPending}
            className="smartPolicySettings__numberInput"
          />
          <Input
            label="מסלול נסיעה חסר"
            type="number"
            min={0}
            max={100}
            value={numberInputValue(draft.missingRouteScore)}
            onChange={(event) => updateDraft((current) => ({ ...current, missingRouteScore: parseNumberInput(event.target.value) }))}
            disabled={!canManage || isPending}
            className="smartPolicySettings__numberInput"
          />
          <Input
            label="נתוני עומס חסרים"
            type="number"
            min={0}
            max={100}
            value={numberInputValue(draft.missingWorkloadScore)}
            onChange={(event) => updateDraft((current) => ({ ...current, missingWorkloadScore: parseNumberInput(event.target.value) }))}
            disabled={!canManage || isPending}
            className="smartPolicySettings__numberInput"
          />
          <Input
            label="נתוני ניסיון חסרים"
            type="number"
            min={0}
            max={100}
            value={numberInputValue(draft.missingExperienceScore)}
            onChange={(event) => updateDraft((current) => ({ ...current, missingExperienceScore: parseNumberInput(event.target.value) }))}
            disabled={!canManage || isPending}
            className="smartPolicySettings__numberInput"
          />
          <Input
            label="ללא דרישות תפקיד או כישורים"
            type="number"
            min={0}
            max={100}
            value={numberInputValue(draft.noRequirementsProfessionalFitScore)}
            onChange={(event) => updateDraft((current) => ({ ...current, noRequirementsProfessionalFitScore: parseNumberInput(event.target.value) }))}
            disabled={!canManage || isPending}
            className="smartPolicySettings__numberInput"
          />
        </div>
      </section>

      {validation.errors.length > 0 && (
        <InlineAlert variant="danger">
          <ul className="smartPolicySettings__validationList">
            {validation.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </InlineAlert>
      )}

      <section className="smartPolicySettings__group smartPolicySettings__preview">
        <div className="smartPolicySettings__groupHeader">
          <h3>תצוגה מקדימה לפני שמירה</h3>
          <p>ציוני הדוגמה נשלחים למנוע החישוב המשותף בשרת. הפעולה אינה שומרת מדיניות ואינה משבצת עובד.</p>
        </div>
        <div className="smartPolicySettings__previewScores">
          {WEIGHT_FIELDS.map((field) => (
            <Input
              key={field.key}
              label={`${field.label} — ציון דוגמה`}
              type="number"
              min={0}
              max={100}
              value={numberInputValue(sampleScores[field.key])}
              onChange={(event) => updateSampleScore(field.key, parseNumberInput(event.target.value))}
              disabled={!canManage || isPending}
              className="smartPolicySettings__numberInput"
            />
          ))}
        </div>
        {previewScoreError && <InlineAlert variant="danger">{previewScoreError}</InlineAlert>}
        {controlAccess.canPreview && (
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            isLoading={previewMutation.isPending}
            disabled={!validation.isValid || Boolean(previewScoreError)}
          >
            חשב תצוגה מקדימה
          </Button>
        )}
        {previewMutation.data && previewedSignature === currentPreviewSignature && (
          <div className="smartPolicySettings__previewResult">
            <div className="smartPolicySettings__previewTotal">
              <span>ציון כולל לדוגמה</span>
              <strong>{formatScore(previewMutation.data.totalScore)}</strong>
            </div>
            <div className="smartPolicySettings__contributions">
              {previewContributions.map((contribution, index) => (
                <div className="smartPolicySettings__contribution" key={`${contribution.factorCode ?? contribution.key ?? 'factor'}-${index}`}>
                  <span>{getFactorLabel(contribution.factorCode ?? contribution.key, contribution.label)}</span>
                  <span>{formatScore(contribution.score)} × {formatScore(contribution.weightPercent)}</span>
                  <strong>{formatScore(contribution.weightedContribution)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
        {isDirty && !hasCurrentPreview && controlAccess.canPreview && validation.isValid && (
          <InlineAlert variant="warning">יש להריץ תצוגה מקדימה עדכנית לפני שמירת השינויים.</InlineAlert>
        )}
      </section>

      <Textarea
        label="סיבת שינוי (אופציונלי)"
        value={changeReason}
        onChange={(event) => setChangeReason(event.target.value)}
        disabled={!canManage || isPending}
        rows={2}
        helpText="הסיבה נשמרת יחד עם גרסת המדיניות לצורכי ביקורת."
      />

      {actionError && <InlineAlert variant="danger">{actionError}</InlineAlert>}
      {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

      {controlAccess.canEdit && (
        <div className="smartPolicySettings__actions">
          <Button type="button" onClick={handleSave} isLoading={updateMutation.isPending} disabled={!canSave}>
            שמור גרסת מדיניות
          </Button>
          <ConfirmInline
            key={`reset-${selectedProfileKey}-${selectedProfile.version}`}
            triggerLabel="אפס לברירת המחדל"
            message="האיפוס יישמר מיד כגרסה חדשה וישמור את הגרסאות הקודמות. להמשיך?"
            confirmLabel="אפס ושמור גרסה"
            onConfirm={handleReset}
            isPending={resetMutation.isPending}
            isDisabled={isPending}
          />
          {isDirty && <Badge variant="warning">יש שינויים שלא נשמרו</Badge>}
        </div>
      )}

      <Modal
        isOpen={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        title="שינויים שלא נשמרו"
      >
        <div className="smartPolicySettings__confirmDialog">
          <p>יציאה מהמסך תמחק את השינויים שבטיוטת המדיניות.</p>
          <div className="smartPolicySettings__confirmActions">
            <Button type="button" variant="secondary" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
              המשך עריכה
            </Button>
            <Button type="button" variant="danger" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
              צא ללא שמירה
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={pendingProfileKey != null}
        onClose={() => setPendingProfileKey(null)}
        title="מעבר לפרופיל אחר"
      >
        <div className="smartPolicySettings__confirmDialog">
          <p>מעבר לפרופיל אחר ימחק את השינויים שלא נשמרו בפרופיל הנוכחי.</p>
          <div className="smartPolicySettings__confirmActions">
            <Button type="button" variant="secondary" onClick={() => setPendingProfileKey(null)}>
              המשך עריכה
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => pendingProfileKey && activateProfile(pendingProfileKey)}
            >
              עבור ללא שמירה
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
