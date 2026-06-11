import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Input } from '@shared/components/Input';
import { isLocalDataMode } from '@/config/appConfig';
import { getCustomersAsync } from '@features/customers';
import { getProjectsListAsync, getSitesAsync } from '@features/projects/api/projectsApiClient';
import { useContactMutations } from '../../hooks/useContacts';
import type { Contact, CreateContactRequest } from '../../types';
import './ContactDrawer.css';

const CATEGORY_OPTIONS = ['לקוחות', 'נציגי לקוחות', 'ספקים', 'קבלנים', 'שותפים עסקיים', 'אחר'];
const PREFERRED_CHANNEL_OPTIONS = ['טלפון', 'מייל', 'וואטסאפ', 'פגישה'];
const MAX_RELATED_ITEMS = 5;

/** Categories that require a linked Customer (DB CHECK constraint). */
const CUSTOMER_LINK_CATEGORIES = ['לקוחות', 'נציגי לקוחות'];

interface ContactDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (contact: Contact) => void | Promise<void>;
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
  notes: string;
  isActive: boolean;
}

function buildInitialState(contact: Contact | null): ContactFormState {
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
    notes: contact?.notes ?? '',
    isActive: contact?.isActive ?? true,
  };
}

export function ContactDrawer({ isOpen, onClose, onSaved, contact }: ContactDrawerProps) {
  if (!isOpen) return null;

  // Remount per contact so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <ContactDrawerContent
      key={contact?.contactId ?? 'new'}
      contact={contact ?? null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface ContactDrawerContentProps {
  contact: Contact | null;
  onClose: () => void;
  onSaved?: (contact: Contact) => void | Promise<void>;
}

function ContactDrawerContent({ contact, onClose, onSaved }: ContactDrawerContentProps) {
  const isExistingContact = contact != null;
  const { createMutation, updateMutation, deleteMutation } = useContactMutations();

  // Existing contacts open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingContact);
  const [form, setForm] = useState<ContactFormState>(() => buildInitialState(contact));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const requiresCustomer = CUSTOMER_LINK_CATEGORIES.includes(form.contactCategory);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomersAsync,
    enabled: isEditing && requiresCustomer,
    staleTime: 60_000,
  });

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

  function handleStartEdit() {
    setForm(buildInitialState(contact));
    setError(null);
    setConfirmDelete(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingContact) {
      onClose();
      return;
    }

    setForm(buildInitialState(contact));
    setError(null);
    setConfirmDelete(false);
    setIsEditing(false);
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
      secondaryPhone: form.secondaryPhone.trim() || undefined,
      email: form.email.trim() || undefined,
      preferredChannel: form.preferredChannel || undefined,
      city: form.city.trim() || undefined,
      address: form.address.trim() || undefined,
      // The textual status mirrors the single isActive control so the badge
      // and the boolean never disagree.
      status: form.isActive ? 'פעיל' : 'לא פעיל',
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      let savedContact: Contact;
      if (isExistingContact) {
        const updatedContact = await updateMutation.mutateAsync({
          id: contact.contactId,
          req: request,
        });
        savedContact = updatedContact ?? { ...contact, ...request };
      } else {
        savedContact = await createMutation.mutateAsync(request);
      }

      setIsEditing(false);
      setConfirmDelete(false);
      await onSaved?.(savedContact);

      // Without a parent to hand the saved record back to, fall back to the
      // previous behavior of closing after a successful save.
      if (!onSaved) {
        onClose();
      }
    } catch (err) {
      setIsEditing(true);
      setError(err instanceof Error ? err.message : 'שמירה נכשלה');
    }
  }

  async function handleDelete() {
    if (!isExistingContact) return;
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

  const title = !isExistingContact
    ? 'איש קשר חדש'
    : isEditing
      ? `עריכת איש קשר — ${contact.fullName}`
      : `פרטי איש קשר — ${contact.fullName}`;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      headerActions={
        isExistingContact && !isEditing ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={
        isEditing ? (
          <div className="contactDrawer__footerContent">
            {error && <p className="contactDrawer__error">{error}</p>}
            <div className="contactDrawer__actions">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'שומר...' : 'שמור'}
              </Button>
              <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                בטל שינויים
              </Button>

              {isExistingContact && (
                <div className="contactDrawer__dangerActions">
                  {confirmDelete ? (
                    <>
                      <span className="contactDrawer__confirmText">למחוק את איש הקשר?</span>
                      <Button variant="danger" onClick={handleDelete} disabled={isSaving}>
                        אישור מחיקה
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmDelete(false)}
                        disabled={isSaving}
                      >
                        חזור
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setConfirmDelete(true)}
                      disabled={isSaving}
                    >
                      מחק איש קשר
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {!isEditing && isExistingContact ? (
        <ContactReviewDetails contact={contact} />
      ) : (
        <div className="contactDrawer contactDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="שם מלא *"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              required
            />
            <div className="contactDrawer__grid">
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

            </div>

            {isExistingContact && (
              <label className="contactDrawer__checkboxRow">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span>איש קשר פעיל</span>
              </label>
            )}
          </DetailsSection>

          <DetailsSection title="הקשר עסקי">
            <div className="contactDrawer__grid">
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
            </div>
          </DetailsSection>

          <DetailsSection title="פרטי התקשרות">
            <div className="contactDrawer__grid">
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
            </div>
          </DetailsSection>

          <DetailsSection title="כתובת והערות">
            <div className="contactDrawer__grid">
              <Input
                label="עיר"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
              />
            </div>
            <Input
              label="כתובת"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
            />

            <div className="contactDrawer__field">
              <label className="contactDrawer__label">הערות</label>
              <textarea
                className="contactDrawer__textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface ContactReviewDetailsProps {
  contact: Contact;
}

function ContactReviewDetails({ contact }: ContactReviewDetailsProps) {
  // Related operational data is read through existing feature API clients.
  // In mock mode these endpoints are unavailable, so the queries stay
  // disabled and each section explains that instead of inventing data.
  const hasLinkedCustomer = contact.customerId != null;
  const areRelatedQueriesEnabled = isLocalDataMode && hasLinkedCustomer;

  const customersQuery = useQuery({
    queryKey: ['contacts', 'related', 'customers'],
    queryFn: getCustomersAsync,
    enabled: areRelatedQueriesEnabled,
    staleTime: 60_000,
  });

  const projectsQuery = useQuery({
    queryKey: ['contacts', 'related', 'projects'],
    queryFn: getProjectsListAsync,
    enabled: areRelatedQueriesEnabled,
  });

  const sitesQuery = useQuery({
    queryKey: ['contacts', 'related', 'sites'],
    queryFn: getSitesAsync,
    enabled: areRelatedQueriesEnabled,
  });

  const linkedCustomer = (customersQuery.data ?? []).find(
    (customer) => customer.customerId === contact.customerId,
  );

  // ProjectListItem carries customerName only (no customerId), so projects are
  // matched by the linked customer's exact name.
  const linkedCustomerName = linkedCustomer?.customerName.trim();
  const relatedProjects = linkedCustomerName
    ? (projectsQuery.data ?? []).filter(
        (project) => project.customerName?.trim() === linkedCustomerName,
      )
    : [];
  const relatedSites = (sitesQuery.data ?? []).filter(
    (site) => site.customerId === contact.customerId,
  );

  const linkedCustomerDisplayName = !isLocalDataMode
    ? `לקוח #${contact.customerId}`
    : customersQuery.isLoading
      ? 'טוען…'
      : (linkedCustomer?.customerName ?? `לקוח #${contact.customerId}`);

  const linkedCustomerValue = !hasLinkedCustomer ? undefined : (
    <Link
      className="contactDrawer__inlineLink"
      to={`/customers?customerId=${contact.customerId}`}
    >
      {linkedCustomerDisplayName}
    </Link>
  );

  return (
    <div className="contactDrawer contactDrawer--review">
      <DetailsSection title="פרטים כלליים">
        <div className="contactDrawer__detailsGrid">
          <DetailsField label="שם מלא" value={contact.fullName} />
          <DetailsField label="תפקיד" value={contact.jobTitle} />
          <DetailsField label="קטגוריה" value={contact.contactCategory} />
          <DetailsField
            label="סטטוס"
            value={
              <Badge variant={contact.isActive ? 'success' : 'neutral'}>
                {contact.status ?? (contact.isActive ? 'פעיל' : 'לא פעיל')}
              </Badge>
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="פרטי התקשרות">
        <div className="contactDrawer__detailsGrid">
          <DetailsField label="טלפון" value={contact.phone} />
          <DetailsField label="טלפון נוסף" value={contact.secondaryPhone} />
          <DetailsField label="אימייל" value={contact.email} />
          <DetailsField label="ערוץ מועדף" value={contact.preferredChannel} />
        </div>
      </DetailsSection>

      <DetailsSection title="הקשר עסקי">
        <div className="contactDrawer__detailsGrid">
          <DetailsField label="לקוח מקושר" value={linkedCustomerValue} />
          <DetailsField label="חברה" value={contact.companyName} />
        </div>
      </DetailsSection>

      <DetailsSection title="כתובת והערות">
        <div className="contactDrawer__detailsGrid">
          <DetailsField label="עיר" value={contact.city} />
          <DetailsField label="כתובת" value={contact.address} />
        </div>
        <DetailsField label="הערות" value={contact.notes} />
      </DetailsSection>

      {hasLinkedCustomer && (
        <>
          <RelatedSection
            title="פרויקטים של הלקוח"
            count={
              projectsQuery.data && (customersQuery.data || customersQuery.isError)
                ? relatedProjects.length
                : null
            }
            isLoading={projectsQuery.isLoading || customersQuery.isLoading}
            isError={projectsQuery.isError || customersQuery.isError}
            isUnavailable={!areRelatedQueriesEnabled}
            emptyText="אין פרויקטים מקושרים ללקוח של איש הקשר."
          >
            <ul className="contactDrawer__relatedList">
              {relatedProjects.slice(0, MAX_RELATED_ITEMS).map((project) => (
                <li key={project.workItemId}>
                  <Link
                    className="contactDrawer__relatedItem contactDrawer__relatedItem--link"
                    to={`/projects?projectId=${project.workItemId}`}
                  >
                    <span className="contactDrawer__relatedPrimary">{project.title}</span>
                    <span className="contactDrawer__relatedMeta">
                      {project.projectNumber}
                      {project.siteName ? ` · ${project.siteName}` : ''}
                    </span>
                    <Badge variant="neutral">{project.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <RelatedOverflowNote total={relatedProjects.length} />
          </RelatedSection>

          <RelatedSection
            title="אתרים של הלקוח"
            count={sitesQuery.data ? relatedSites.length : null}
            isLoading={sitesQuery.isLoading}
            isError={sitesQuery.isError}
            isUnavailable={!areRelatedQueriesEnabled}
            emptyText="אין אתרים מקושרים ללקוח של איש הקשר."
          >
            <ul className="contactDrawer__relatedList">
              {relatedSites.slice(0, MAX_RELATED_ITEMS).map((site) => (
                <li key={site.siteId} className="contactDrawer__relatedItem">
                  <span className="contactDrawer__relatedPrimary">{site.siteName}</span>
                  <span className="contactDrawer__relatedMeta">
                    {[site.city, site.addressLine].filter(Boolean).join(' · ')}
                  </span>
                  {site.isPrimary && <Badge variant="primary">ראשי</Badge>}
                </li>
              ))}
            </ul>
            <RelatedOverflowNote total={relatedSites.length} />
          </RelatedSection>
        </>
      )}
    </div>
  );
}

interface RelatedSectionProps {
  title: string;
  /** Number of related records, or null while the data has not loaded yet. */
  count: number | null;
  isLoading: boolean;
  isError: boolean;
  isUnavailable: boolean;
  emptyText: string;
  children: ReactNode;
}

function RelatedSection({
  title,
  count,
  isLoading,
  isError,
  isUnavailable,
  emptyText,
  children,
}: RelatedSectionProps) {
  const sectionTitle = count != null ? `${title} (${count})` : title;

  let body: ReactNode;
  if (isUnavailable) {
    body = (
      <p className="contactDrawer__relatedHint">נתונים מקושרים זמינים בחיבור לשרת בלבד.</p>
    );
  } else if (isLoading) {
    body = <p className="contactDrawer__relatedHint">טוען נתונים מקושרים…</p>;
  } else if (isError) {
    body = (
      <p className="contactDrawer__relatedHint contactDrawer__relatedHint--error">
        טעינת הנתונים המקושרים נכשלה.
      </p>
    );
  } else if (count === 0) {
    body = <p className="contactDrawer__relatedHint">{emptyText}</p>;
  } else {
    body = children;
  }

  return <DetailsSection title={sectionTitle}>{body}</DetailsSection>;
}

function RelatedOverflowNote({ total }: { total: number }) {
  if (total <= MAX_RELATED_ITEMS) return null;
  return (
    <p className="contactDrawer__relatedHint">ועוד {total - MAX_RELATED_ITEMS} רשומות נוספות.</p>
  );
}
