import { useEffect, useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useCustomerMutations } from '../../hooks/useCustomers';
import type { Customer, CreateCustomerRequest } from '../../types';
import './CustomerDrawer.css';

const CUSTOMER_TYPE_OPTIONS = ['עסקי', 'פרטי', 'גוף ציבורי', 'תאגיד'];
const STATUS_OPTIONS = ['פעיל', 'לא פעיל', 'ממתין'];

interface CustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (customer: Customer) => void | Promise<void>;
  customer?: Customer | null;
}

interface CustomerFormState {
  customerName: string;
  customerType: string;
  primaryPhone: string;
  primaryEmail: string;
  city: string;
  region: string;
  address: string;
  status: string;
  notes: string;
  isActive: boolean;
}

function buildInitialState(customer: Customer | null | undefined): CustomerFormState {
  return {
    customerName: customer?.customerName ?? '',
    customerType: customer?.customerType ?? CUSTOMER_TYPE_OPTIONS[0],
    primaryPhone: customer?.primaryPhone ?? '',
    primaryEmail: customer?.primaryEmail ?? '',
    city: customer?.city ?? '',
    region: customer?.region ?? '',
    address: customer?.address ?? '',
    status: customer?.status ?? STATUS_OPTIONS[0],
    notes: customer?.notes ?? '',
    isActive: customer?.isActive ?? true,
  };
}

export function CustomerDrawer({ isOpen, onClose, onSaved, customer }: CustomerDrawerProps) {
  const isEditMode = customer != null;
  const { createMutation, updateMutation, deactivateMutation } = useCustomerMutations();

  const [form, setForm] = useState<CustomerFormState>(() => buildInitialState(customer));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(customer));
      setError(null);
      setConfirmDeactivate(false);
    }
  }, [isOpen, customer]);

  function setField<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.customerName.trim()) return 'שם לקוח הוא שדה חובה.';
    if (!form.customerType) return 'סוג לקוח הוא שדה חובה.';
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    const request: CreateCustomerRequest = {
      customerName: form.customerName.trim(),
      customerType: form.customerType,
      primaryPhone: form.primaryPhone.trim() || undefined,
      primaryEmail: form.primaryEmail.trim() || undefined,
      city: form.city.trim() || undefined,
      region: form.region.trim() || undefined,
      address: form.address.trim() || undefined,
      status: form.status || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      let savedCustomer: Customer;
      if (isEditMode) {
        const updatedCustomer = await updateMutation.mutateAsync({ id: customer.customerId, request });
        savedCustomer = updatedCustomer ?? { ...customer, ...request };
      } else {
        savedCustomer = await createMutation.mutateAsync(request);
      }
      await onSaved?.(savedCustomer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isEditMode) return;
    setError(null);
    try {
      await deactivateMutation.mutateAsync(customer.customerId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ביטול פעילות נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת לקוח — ${customer.customerName}` : 'לקוח חדש'}
    >
      <div className="customerDrawer">
        <div className="customerDrawer__grid">
          <Input
            label="שם לקוח *"
            value={form.customerName}
            onChange={(e) => setField('customerName', e.target.value)}
            required
          />

          <div className="customerDrawer__field">
            <label className="customerDrawer__label">סוג לקוח *</label>
            <select
              className="customerDrawer__select"
              value={form.customerType}
              onChange={(e) => setField('customerType', e.target.value)}
            >
              {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <Input
            label="טלפון"
            type="tel"
            value={form.primaryPhone}
            onChange={(e) => setField('primaryPhone', e.target.value)}
          />

          <Input
            label="אימייל"
            type="email"
            value={form.primaryEmail}
            onChange={(e) => setField('primaryEmail', e.target.value)}
          />

          <Input
            label="עיר"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />

          <Input
            label="אזור"
            value={form.region}
            onChange={(e) => setField('region', e.target.value)}
          />
        </div>

        <Input
          label="כתובת"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
        />

        <div className="customerDrawer__field">
          <label className="customerDrawer__label">סטטוס</label>
          <select
            className="customerDrawer__select"
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="customerDrawer__field">
          <label className="customerDrawer__label">הערות</label>
          <textarea
            className="customerDrawer__textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>

        {isEditMode && (
          <label className="customerDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            <span>לקוח פעיל</span>
          </label>
        )}

        {error && <p className="customerDrawer__error">{error}</p>}

        <div className="customerDrawer__actions">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && customer.isActive && (
            <>
              {confirmDeactivate ? (
                <>
                  <span className="customerDrawer__confirmText">לבטל את פעילות הלקוח?</span>
                  <Button variant="danger" onClick={handleDeactivate} disabled={isSaving}>
                    אישור ביטול
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDeactivate(false)} disabled={isSaving}>
                    חזור
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmDeactivate(true)} disabled={isSaving}>
                  ביטול פעילות
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
