import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { RelatedSection } from '@shared/components/RelatedSection';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { usePermissions } from '@shared/auth/usePermissions';
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
  const { can } = usePermissions();
  // View-only roles can open a contact for review but must not reach the edit/delete UI
  // (which would only 403 on save). The API still enforces this server-side.
  const canManage = can('manageContacts');
  const { createMutation, updateMutation, deleteMutation } = useContactMutations();

  // Existing contacts open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingContact);
  const [form, setForm] = useState<ContactFormState>(() => buildInitialState(contact));
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize(true);

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
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingContact) {
      onClose();
      return;
    }

    setForm(buildInitialState(contact));
    setError(null);
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

  // Restore re-uses the standard update path with IsActive=1 (no related-entity gap).
  async function handleRestore() {
    if (!isExistingContact) return;
    setError(null);

    const request: CreateContactRequest = {
      fullName: contact.fullName,
      jobTitle: contact.jobTitle || undefined,
      contactCategory: contact.contactCategory,
      customerId: contact.customerId ?? undefined,
      companyName: contact.companyName || undefined,
      phone: contact.phone || undefined,
      secondaryPhone: contact.secondaryPhone || undefined,
      email: contact.email || undefined,
      preferredChannel: contact.preferredChannel || undefined,
      city: contact.city || undefined,
      address: contact.address || undefined,
      status: 'פעיל',
      notes: contact.notes || undefined,
      isActive: true,
    };

    try {
      const restoredContact = await updateMutation.mutateAsync({
        id: contact.contactId,
        req: request,
      });
      await onSaved?.(restoredContact ?? { ...contact, ...request });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שחזור נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const title = !isExistingContact
    ? 'איש קשר חדש'
    : isEditing
      ? `עריכת איש קשר — ${contact.fullName}`
      : `פרטי איש קשר — ${contact.fullName}`;

  // Edit mode keeps only save/cancel; destructive + restore live in the read-only footer.
  const editFooter = (
    <div className="contactDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="contactDrawer__actions">
        <Button onClick={handleSave} isLoading={isSaving}>
          שמור
        </Button>
        <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  const reviewFooter =
    isExistingContact && canManage ? (
      <div className="contactDrawer__footerContent">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="contactDrawer__dangerActions">
          {contact.isActive ? (
            <ConfirmInline
              triggerLabel="בטל פעילות"
              message="לבטל את פעילות איש הקשר?"
              confirmLabel="אישור"
              onConfirm={handleDelete}
              isPending={isSaving}
            />
          ) : (
            <ConfirmInline
              triggerLabel="שחזור"
              message="לשחזר את איש הקשר?"
              confirmLabel="אישור שחזור"
              variant="primary"
              onConfirm={handleRestore}
              isPending={isSaving}
            />
          )}
        </div>
      </div>
    ) : undefined;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      headerActions={
        isExistingContact && !isEditing && canManage ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={isEditing ? editFooter : reviewFooter}
    >
      {!isEditing && isExistingContact ? (
        <ContactReviewDetails contact={contact} />
      ) : (
        <div className="contactDrawer contactDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="שם מלא"
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

              <Select
                label="קטגוריה"
                required
                value={form.contactCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            </div>

            {isExistingContact && (
              <Checkbox
                label="איש קשר פעיל"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />
            )}
          </DetailsSection>

          <DetailsSection title="הקשר עסקי">
            <div className="contactDrawer__grid">
              {requiresCustomer && (
                <Select
                  label="לקוח"
                  required
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
                </Select>
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

              <Select
                label="ערוץ מועדף"
                value={form.preferredChannel}
                onChange={(e) => setField('preferredChannel', e.target.value)}
              >
                <option value="">בחר ערוץ</option>
                {PREFERRED_CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
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

            <Textarea
              label="הערות"
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
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
  const hasLinkedCustomer = contact.customerId != null;
  const areRelatedQueriesEnabled = hasLinkedCustomer;

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

  const linkedCustomerDisplayName = customersQuery.isLoading
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

function RelatedOverflowNote({ total }: { total: number }) {
  if (total <= MAX_RELATED_ITEMS) return null;
  return (
    <p className="contactDrawer__relatedHint">ועוד {total - MAX_RELATED_ITEMS} רשומות נוספות.</p>
  );
}
