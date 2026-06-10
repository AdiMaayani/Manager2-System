import { useEffect, useMemo, useState } from 'react';
import { Button } from '@shared/components/Button';
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
import type { QuoteStatus, SaveQuoteRequest } from '../../types';
import { formatCurrency } from '../../utils/format';
import { QuoteLineItemsEditor, type QuoteLineFormState } from '../QuoteLineItemsEditor';
import './QuoteDrawer.css';

interface QuoteDrawerProps {
  isOpen: boolean;
  quoteId: number | null;
  onClose: () => void;
  onSaved?: () => void;
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

export function QuoteDrawer({
  isOpen,
  quoteId,
  onClose,
  onSaved,
  initialProjectId,
}: QuoteDrawerProps) {
  const isEditMode = quoteId != null;
  const { data: quote, isLoading: isLoadingQuote } = useQuote(isOpen && isEditMode ? quoteId : null);
  const { data: customerOptions } = useQuoteCustomerOptions();
  const { data: projectOptions } = useQuoteProjectOptions();
  const { createMutation, updateMutation, deactivateMutation } = useQuoteMutations();

  const [form, setForm] = useState<QuoteFormState>(() => buildCreateState(initialProjectId));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setConfirmDeactivate(false);

    if (!isEditMode) {
      setForm(buildCreateState(initialProjectId));
    }
  }, [isOpen, isEditMode, initialProjectId]);

  useEffect(() => {
    if (!isOpen || !isEditMode || !quote) return;

    setForm({
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
    });
  }, [isOpen, isEditMode, quote]);

  function setField<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      if (isEditMode && quoteId != null) {
        await updateMutation.mutateAsync({ id: quoteId, request });
      } else {
        await createMutation.mutateAsync(request);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת הצעת המחיר נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isEditMode || quoteId == null) return;
    setError(null);

    try {
      await deactivateMutation.mutateAsync(quoteId);
      onSaved?.();
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

  const title = isEditMode
    ? `עריכת הצעת מחיר ${quote?.quoteNumber ?? ''}`.trim()
    : 'הצעת מחיר חדשה';

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title}>
      {isEditMode && isLoadingQuote ? (
        <PageSpinner />
      ) : (
        <div className="quoteDrawer">
          <div className="quoteDrawer__grid">
            <div className="quoteDrawer__field">
              <label className="quoteDrawer__label">מספר הצעה</label>
              <div className="quoteDrawer__readonly">
                {isEditMode ? quote?.quoteNumber ?? '-' : 'ייווצר אוטומטית'}
              </div>
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

            <Input
              label="מע״מ (%)"
              type="number"
              min="0"
              step="0.01"
              value={form.vatRate}
              onChange={(event) => setField('vatRate', event.target.value)}
            />
          </div>

          <div className="quoteDrawer__field">
            <label className="quoteDrawer__label">הערות</label>
            <textarea
              className="quoteDrawer__textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </div>

          <QuoteLineItemsEditor
            lineItems={form.lineItems}
            onAddLine={handleAddLine}
            onChangeLine={handleChangeLine}
            onRemoveLine={handleRemoveLine}
          />

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

          {error && <p className="quoteDrawer__error">{error}</p>}

          <div className="quoteDrawer__actions">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'שומר...' : 'שמור'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              ביטול
            </Button>

            {isEditMode && quote?.isActive && (
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
      )}
    </Drawer>
  );
}
