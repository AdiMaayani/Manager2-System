import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Drawer } from '@shared/components/Drawer';
import { Input } from '@shared/components/Input';
import { PageSpinner } from '@shared/components/PageSpinner';
import { QUOTE_STATUS_OPTIONS, getQuoteStatusLabel } from '../../constants/quoteStatus';
import {
  useQuote,
  useQuoteCustomerOptions,
  useQuoteMutations,
  useQuoteProjectOptions,
} from '../../hooks/useQuotes';
import type { QuoteDetails, QuoteStatus, SaveQuoteRequest } from '../../types';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format';
import { QuoteStatusBadge } from '../QuoteStatusBadge';
import { QuoteLineItemsEditor, type QuoteLineFormState } from '../QuoteLineItemsEditor';
import './QuoteDrawer.css';

interface QuoteDrawerProps {
  isOpen: boolean;
  quoteId: number | null;
  onClose: () => void;
  onSaved?: (quoteId: number) => void;
  initialProjectId?: number;
}

interface QuoteFormState {
  customerId: string;
  projectId: string;
  quoteDate: string;
  validUntil: string;
  status: QuoteStatus;
  notes: string;
  vatRate: string;
  lineItems: QuoteLineFormState[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyLine(): QuoteLineFormState {
  return { description: '', quantity: '1', unit: 'יח׳', unitPrice: '0' };
}

function buildCreateState(initialProjectId?: number): QuoteFormState {
  return {
    customerId: '',
    projectId: initialProjectId ? String(initialProjectId) : '',
    quoteDate: todayIso(),
    validUntil: '',
    status: 'Draft',
    notes: '',
    vatRate: '17',
    lineItems: [createEmptyLine()],
  };
}

function buildFormFromQuote(quote: QuoteDetails): QuoteFormState {
  return {
    customerId: String(quote.customerId),
    projectId: quote.projectId ? String(quote.projectId) : '',
    quoteDate: quote.quoteDate.slice(0, 10),
    validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : '',
    status: quote.status,
    notes: quote.notes ?? '',
    vatRate: String(quote.vatRate),
    lineItems:
      quote.lineItems.length > 0
        ? quote.lineItems.map((line) => ({
            description: line.description,
            quantity: String(line.quantity),
            unit: line.unit,
            unitPrice: String(line.unitPrice),
          }))
        : [createEmptyLine()],
  };
}

export function QuoteDrawer({ isOpen, quoteId, onClose, onSaved, initialProjectId }: QuoteDrawerProps) {
  if (!isOpen) return null;

  // Remount per quote so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <QuoteDrawerContent
      key={quoteId ?? 'new'}
      quoteId={quoteId}
      onClose={onClose}
      onSaved={onSaved}
      initialProjectId={initialProjectId}
    />
  );
}

interface QuoteDrawerContentProps {
  quoteId: number | null;
  onClose: () => void;
  onSaved?: (quoteId: number) => void;
  initialProjectId?: number;
}

function QuoteDrawerContent({ quoteId, onClose, onSaved, initialProjectId }: QuoteDrawerContentProps) {
  const isExistingQuote = quoteId != null;
  const { data: quote, isLoading: isLoadingQuote } = useQuote(quoteId);
  const { data: customerOptions } = useQuoteCustomerOptions();
  const { data: projectOptions } = useQuoteProjectOptions();
  const { createMutation, updateMutation, deactivateMutation } = useQuoteMutations();

  // Existing quotes open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingQuote);
  const [form, setForm] = useState<QuoteFormState>(() => buildCreateState(initialProjectId));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  function setField<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleStartEdit() {
    if (!quote) return;
    setForm(buildFormFromQuote(quote));
    setError(null);
    setConfirmDeactivate(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingQuote || !quote) {
      onClose();
      return;
    }

    setForm(buildFormFromQuote(quote));
    setError(null);
    setConfirmDeactivate(false);
    setIsEditing(false);
  }

  function handleAddLine() {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, createEmptyLine()] }));
  }

  function handleChangeLine(index: number, field: keyof QuoteLineFormState, value: string) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
  }

  function handleRemoveLine(index: number) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  const vatRateNumber = useMemo(() => {
    const parsed = Number(form.vatRate);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [form.vatRate]);

  const subtotal = useMemo(() => {
    return form.lineItems.reduce((sum, line) => {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
      return sum + Math.round(quantity * unitPrice * 100) / 100;
    }, 0);
  }, [form.lineItems]);

  const vatAmount = useMemo(() => Math.round((subtotal * vatRateNumber) / 100 * 100) / 100, [subtotal, vatRateNumber]);
  const total = useMemo(() => Math.round((subtotal + vatAmount) * 100) / 100, [subtotal, vatAmount]);

  function buildRequest(): SaveQuoteRequest | null {
    const customerId = Number(form.customerId);
    if (!customerId) {
      setError('יש לבחור לקוח.');
      return null;
    }

    if (!form.quoteDate) {
      setError('תאריך הצעה הוא שדה חובה.');
      return null;
    }

    const meaningfulLines = form.lineItems.filter(
      (line) => line.description.trim() || Number(line.unitPrice) > 0 || Number(line.quantity) > 0,
    );

    if (meaningfulLines.length === 0) {
      setError('יש להוסיף לפחות שורת תמחור אחת.');
      return null;
    }

    for (const line of meaningfulLines) {
      if (!line.description.trim()) {
        setError('לכל שורה דרוש תיאור.');
        return null;
      }

      if (!line.unit.trim()) {
        setError('לכל שורה דרושה יחידת מידה.');
        return null;
      }

      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);

      if (!Number.isFinite(quantity) || quantity < 0) {
        setError('כמות חייבת להיות מספר לא שלילי.');
        return null;
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setError('מחיר יחידה חייב להיות מספר לא שלילי.');
        return null;
      }
    }

    return {
      customerId,
      projectId: form.projectId ? Number(form.projectId) : null,
      quoteDate: form.quoteDate,
      validUntil: form.validUntil || null,
      status: form.status,
      notes: form.notes.trim() || null,
      vatRate: vatRateNumber,
      lineItems: meaningfulLines.map((line, index) => ({
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit: line.unit.trim(),
        unitPrice: Number(line.unitPrice),
        sortOrder: index + 1,
      })),
    };
  }

  async function handleSave() {
    const request = buildRequest();
    if (!request) return;

    setError(null);

    try {
      if (isExistingQuote) {
        await updateMutation.mutateAsync({ id: quoteId, request });
        setIsEditing(false);
        setConfirmDeactivate(false);
      } else {
        const createdQuote = await createMutation.mutateAsync(request);
        if (onSaved) {
          // Hand the new id back so the parent reopens this drawer in review mode.
          onSaved(createdQuote.quoteId);
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת הצעת המחיר נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isExistingQuote) return;
    setError(null);

    try {
      await deactivateMutation.mutateAsync(quoteId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ביטול הצעת המחיר נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending;

  const activeCustomers = useMemo(
    () => (customerOptions ?? []).filter((customer) => customer.isActive || String(customer.customerId) === form.customerId),
    [customerOptions, form.customerId],
  );

  const isQuoteReady = !isExistingQuote || quote != null;

  const title = !isExistingQuote
    ? 'הצעת מחיר חדשה'
    : isEditing
      ? `עריכת הצעת מחיר ${quote?.quoteNumber ?? ''}`.trim()
      : `פרטי הצעת מחיר — ${quote?.quoteNumber ?? ''}`.trim();

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={isQuoteReady ? title : 'הצעת מחיר'}
      headerActions={
        isExistingQuote && !isEditing && quote ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={
        isEditing && isQuoteReady ? (
          <div className="quoteDrawer__footerContent">
            {error && <p className="quoteDrawer__error">{error}</p>}
            <div className="quoteDrawer__actions">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'שומר...' : 'שמור'}
              </Button>
              <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                ביטול
              </Button>

              {isExistingQuote && quote?.isActive && (
                <>
                  {confirmDeactivate ? (
                    <>
                      <span className="quoteDrawer__confirmText">לבטל את הצעת המחיר?</span>
                      <Button variant="danger" onClick={handleDeactivate} disabled={isSaving}>
                        אישור ביטול
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmDeactivate(false)}
                        disabled={isSaving}
                      >
                        חזור
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setConfirmDeactivate(true)}
                      disabled={isSaving}
                    >
                      ביטול הצעה
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {!isQuoteReady ? (
        isLoadingQuote ? (
          <PageSpinner />
        ) : (
          <p className="quoteDrawer__loadError">טעינת הצעת המחיר נכשלה.</p>
        )
      ) : !isEditing && quote ? (
        <QuoteReviewDetails quote={quote} />
      ) : (
        <div className="quoteDrawer quoteDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <div className="quoteDrawer__grid">
              <div className="quoteDrawer__field">
                <label className="quoteDrawer__label">מספר הצעה</label>
                <div className="quoteDrawer__readonly">
                  {isExistingQuote ? quote?.quoteNumber ?? '-' : 'ייווצר אוטומטית'}
                </div>
              </div>

              <div className="quoteDrawer__field">
                <label className="quoteDrawer__label">סטטוס</label>
                <select
                  className="quoteDrawer__select"
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value as QuoteStatus)}
                >
                  {QUOTE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {getQuoteStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="quoteDrawer__field">
                <label className="quoteDrawer__label">לקוח *</label>
                <select
                  className="quoteDrawer__select"
                  value={form.customerId}
                  onChange={(event) => setField('customerId', event.target.value)}
                >
                  <option value="">בחרו לקוח</option>
                  {activeCustomers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="quoteDrawer__field">
                <label className="quoteDrawer__label">פרויקט (אופציונלי)</label>
                <select
                  className="quoteDrawer__select"
                  value={form.projectId}
                  onChange={(event) => setField('projectId', event.target.value)}
                >
                  <option value="">ללא פרויקט</option>
                  {(projectOptions ?? []).map((project) => (
                    <option key={project.workItemId} value={project.workItemId}>
                      {project.title}
                      {project.customerName ? ` — ${project.customerName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </DetailsSection>

          <DetailsSection title="תאריכים">
            <div className="quoteDrawer__grid">
              <Input
                label="תאריך הצעה *"
                type="date"
                value={form.quoteDate}
                onChange={(event) => setField('quoteDate', event.target.value)}
                required
              />

              <Input
                label="בתוקף עד"
                type="date"
                value={form.validUntil}
                onChange={(event) => setField('validUntil', event.target.value)}
              />
            </div>
          </DetailsSection>

          <DetailsSection title="שורות תמחור">
            <QuoteLineItemsEditor
              lineItems={form.lineItems}
              onAddLine={handleAddLine}
              onChangeLine={handleChangeLine}
              onRemoveLine={handleRemoveLine}
            />
          </DetailsSection>

          <DetailsSection title="סיכום כספי">
            <div className="quoteDrawer__grid">
              <Input
                label="מע״מ (%)"
                type="number"
                min="0"
                step="0.01"
                value={form.vatRate}
                onChange={(event) => setField('vatRate', event.target.value)}
              />
            </div>

            <div className="quoteDrawer__totals">
              <div className="quoteDrawer__totalsRow">
                <span>סה״כ לפני מע״מ</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="quoteDrawer__totalsRow">
                <span>מע״מ ({vatRateNumber}%)</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="quoteDrawer__totalsRow quoteDrawer__totalsRow--grand">
                <span>סה״כ לתשלום</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </DetailsSection>

          <DetailsSection title="הערות">
            <div className="quoteDrawer__field">
              <label className="quoteDrawer__label">הערות</label>
              <textarea
                className="quoteDrawer__textarea"
                rows={3}
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </div>
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface QuoteReviewDetailsProps {
  quote: QuoteDetails;
}

function QuoteReviewDetails({ quote }: QuoteReviewDetailsProps) {
  return (
    <div className="quoteDrawer quoteDrawer--review">
      <DetailsSection title="פרטי הצעה">
        <div className="quoteDrawer__detailsGrid">
          <DetailsField
            label="מספר הצעה"
            value={<span className="quoteDrawer__numberValue">{quote.quoteNumber}</span>}
          />
          <DetailsField
            label="סטטוס"
            value={
              <span className="quoteDrawer__statusBadges">
                <QuoteStatusBadge status={quote.status} />
                {!quote.isActive && <Badge variant="neutral">בוטל</Badge>}
              </span>
            }
          />
          <DetailsField label="תאריך הצעה" value={formatDate(quote.quoteDate)} />
          <DetailsField
            label="בתוקף עד"
            value={quote.validUntil ? formatDate(quote.validUntil) : undefined}
          />
        </div>
      </DetailsSection>

      <DetailsSection title="לקוח ופרויקט">
        <div className="quoteDrawer__detailsGrid">
          {/* The Customers screen has no per-customer deep link route, so the
              customer is shown read-only rather than as a link. */}
          <DetailsField label="לקוח" value={quote.customerName} />
          <DetailsField
            label="פרויקט"
            value={
              quote.projectId ? (
                <Link
                  className="quoteDrawer__projectLink"
                  to={`/projects?projectId=${quote.projectId}`}
                >
                  {quote.projectTitle ?? `פרויקט #${quote.projectId}`}
                </Link>
              ) : undefined
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title={`שורות תמחור (${quote.lineItems.length})`}>
        {quote.lineItems.length === 0 ? (
          <p className="quoteDrawer__reviewHint">אין שורות תמחור בהצעה זו.</p>
        ) : (
          <div className="quoteDrawer__reviewLinesWrap">
            <table className="quoteDrawer__reviewLines">
              <thead>
                <tr>
                  <th>תיאור</th>
                  <th>כמות</th>
                  <th>יחידה</th>
                  <th>מחיר יחידה</th>
                  <th>סה״כ שורה</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((line) => (
                  <tr key={line.quoteLineItemId}>
                    <td className="quoteDrawer__reviewLineDesc">{line.description}</td>
                    <td>{formatNumber(line.quantity)}</td>
                    <td>{line.unit}</td>
                    <td>{formatCurrency(line.unitPrice)}</td>
                    <td className="quoteDrawer__reviewLineTotal">
                      {formatCurrency(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailsSection>

      <DetailsSection title="סיכום כספי">
        <div className="quoteDrawer__totals">
          <div className="quoteDrawer__totalsRow">
            <span>סה״כ לפני מע״מ</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="quoteDrawer__totalsRow">
            <span>מע״מ ({quote.vatRate}%)</span>
            <span>{formatCurrency(quote.vatAmount)}</span>
          </div>
          <div className="quoteDrawer__totalsRow quoteDrawer__totalsRow--grand">
            <span>סה״כ לתשלום</span>
            <span>{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </DetailsSection>

      <DetailsSection title="הערות">
        <DetailsField label="הערות" value={quote.notes} />
      </DetailsSection>
    </div>
  );
}
