import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { getCustomersAsync } from '@features/customers';
import { useContactMutations } from '../../hooks/useContacts';
import type { Contact, CreateContactRequest } from '../../types';
import './ContactDrawer.css';

const CATEGORY_OPTIONS = ['לקוחות', 'נציגי לקוחות', 'ספקים', 'קבלנים', 'שותפים עסקיים', 'אחר'];
const PREFERRED_CHANNEL_OPTIONS = ['טלפון', 'מייל', 'וואטסאפ', 'פגישה'];

/** Categories that require a linked Customer (DB CHECK constraint). */
const CUSTOMER_LINK_CATEGORIES = ['לקוחות', 'נציגי לקוחות'];

interface ContactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
}

interface ContactFormState {
  fullName: string;
  jobTitle: string;
  contactCategory: string;
  customerId: number | null;
  companyName: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  preferredChannel: string;
  city: string;
  address: string;
  status: string;
  notes: string;
  isActive: boolean;
}

function buildInitialState(contact: Contact | null | undefined): ContactFormState {
  return {
    fullName: contact?.fullName ?? '',
    jobTitle: contact?.jobTitle ?? '',
    contactCategory: contact?.contactCategory ?? CATEGORY_OPTIONS[0],
    customerId: contact?.customerId ?? null,
    companyName: contact?.companyName ?? '',
    phone: contact?.phone ?? '',
    secondaryPhone: contact?.secondaryPhone ?? '',
    email: contact?.email ?? '',
    preferredChannel: contact?.preferredChannel ?? '',
    city: contact?.city ?? '',
    address: contact?.address ?? '',
    status: contact?.status ?? 'פעיל',
    notes: contact?.notes ?? '',
    isActive: contact?.isActive ?? true,
  };
}

export function ContactDrawer({ isOpen, onClose, contact }: ContactDrawerProps) {
  const isEditMode = contact != null;
  const { createMutation, updateMutation, deleteMutation } = useContactMutations();

  const [form, setForm] = useState<ContactFormState>(() => buildInitialState(contact));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const requiresCustomer = CUSTOMER_LINK_CATEGORIES.includes(form.contactCategory);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomersAsync,
    enabled: requiresCustomer,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(contact));
      setError(null);
      setConfirmDelete(false);
    }
  }, [isOpen, contact]);

  function setField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategoryChange(value: string) {
    setForm((prev) => ({
      ...prev,
      contactCategory: value,
      // Clear the linked customer when switching to a category that does not require one
      customerId: CUSTOMER_LINK_CATEGORIES.includes(value) ? prev.customerId : null,
    }));
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'שם מלא הוא שדה חובה.';
    if (!form.contactCategory) return 'קטגוריה היא שדה חובה.';
    if (!form.phone.trim() && !form.email.trim()) return 'יש להזין טלפון או אימייל.';
    if (requiresCustomer && !form.customerId) return 'יש לבחור לקוח עבור קטגוריה זו.';
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    const request: CreateContactRequest = {
      fullName: form.fullName.trim(),
      jobTitle: form.jobTitle.trim() || undefined,
      contactCategory: form.contactCategory,
      customerId: form.customerId ?? undefined,
      companyName: form.companyName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      preferredChannel: form.preferredChannel || undefined,
      city: form.city.trim() || undefined,
      status: form.status || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: contact.contactId, req: request });
      } else {
        await createMutation.mutateAsync(request);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה');
    }
  }

  async function handleDelete() {
    if (!isEditMode) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(contact.contactId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקה נכשלה');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת איש קשר — ${contact.fullName}` : 'איש קשר חדש'}
    >
      <div className="contactDrawer">
        <div className="contactDrawer__grid">
          <Input
            label="שם מלא *"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            required
          />

          <Input
            label="תפקיד"
            value={form.jobTitle}
            onChange={(e) => setField('jobTitle', e.target.value)}
          />

          <div className="contactDrawer__field">
            <label className="contactDrawer__label">קטגוריה *</label>
            <select
              className="contactDrawer__select"
              value={form.contactCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {requiresCustomer && (
            <div className="contactDrawer__field">
              <label className="contactDrawer__label">לקוח *</label>
              <select
                className="contactDrawer__select"
                value={form.customerId ?? ''}
                onChange={(e) =>
                  setField('customerId', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">-- בחר לקוח --</option>
                {customers.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.customerName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="חברה"
            value={form.companyName}
            onChange={(e) => setField('companyName', e.target.value)}
          />

          <Input
            label="טלפון"
            type="tel"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
          />

          <Input
            label="טלפון נוסף"
            type="tel"
            value={form.secondaryPhone}
            onChange={(e) => setField('secondaryPhone', e.target.value)}
          />

          <Input
            label="אימייל"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
          />

          <div className="contactDrawer__field">
            <label className="contactDrawer__label">ערוץ מועדף</label>
            <select
              className="contactDrawer__select"
              value={form.preferredChannel}
              onChange={(e) => setField('preferredChannel', e.target.value)}
            >
              <option value="">בחר ערוץ</option>
              {PREFERRED_CHANNEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <Input
            label="עיר"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />

          <Input
            label="סטטוס"
            value={form.status}
            onChange={(e) => setField('status', e.target.value)}
          />
        </div>

        <div className="contactDrawer__field">
          <label className="contactDrawer__label">הערות</label>
          <textarea
            className="contactDrawer__textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>

        {isEditMode && (
          <label className="contactDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            <span>איש קשר פעיל</span>
          </label>
        )}

        {error && <p className="contactDrawer__error">{error}</p>}

        <div className="contactDrawer__actions">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && (
            <>
              {confirmDelete ? (
                <>
                  <span className="contactDrawer__confirmText">למחוק את איש הקשר?</span>
                  <Button variant="danger" onClick={handleDelete} disabled={isSaving}>
                    אישור מחיקה
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={isSaving}>
                    חזור
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={isSaving}>
                  מחיקה
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
