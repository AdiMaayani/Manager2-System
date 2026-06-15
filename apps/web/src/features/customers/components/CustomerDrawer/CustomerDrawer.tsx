import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Input } from '@shared/components/Input';
import { usePermissions } from '@shared/auth/usePermissions';
import { isLocalDataMode } from '@/config/appConfig';
import { getProjectsListAsync, getSitesAsync } from '@features/projects/api/projectsApiClient';
import { getQuotesAsync } from '@features/quotes/api/quotesApiClient';
import {
  getQuoteStatusBadgeVariant,
  getQuoteStatusLabel,
} from '@features/quotes/constants/quoteStatus';
import { getServiceCallsAsync } from '@features/serviceCalls/api/serviceCallsApiClient';
import { getContactsAsync } from '@features/contacts/api/contactsApiClient';
import { CustomerVaultSection } from '@features/customerSystems';
import { useCustomerMutations } from '../../hooks/useCustomers';
import type { Customer, CreateCustomerRequest } from '../../types';
import './CustomerDrawer.css';

const CUSTOMER_TYPE_OPTIONS = ['עסקי', 'פרטי', 'גוף ציבורי', 'תאגיד'];
const MAX_RELATED_ITEMS = 5;

// Local copies of the Service Calls screen labels; components/constants of that
// feature are not exported for cross-feature use.
const SERVICE_CALL_STATUS_LABELS: Record<string, string> = {
  Open: 'פתוחה',
  InProgress: 'בטיפול',
  Done: 'בוצעה',
  Cancelled: 'בוטלה',
};

const SERVICE_CALL_STATUS_VARIANTS: Record<
  string,
  'neutral' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  Open: 'warning',
  InProgress: 'primary',
  Done: 'success',
  Cancelled: 'danger',
};

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
  notes: string;
  isActive: boolean;
}

function buildInitialState(customer: Customer | null): CustomerFormState {
  return {
    customerName: customer?.customerName ?? '',
    customerType: customer?.customerType ?? CUSTOMER_TYPE_OPTIONS[0],
    primaryPhone: customer?.primaryPhone ?? '',
    primaryEmail: customer?.primaryEmail ?? '',
    city: customer?.city ?? '',
    region: customer?.region ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
    isActive: customer?.isActive ?? true,
  };
}

function formatRelatedDate(value?: string | null): string {
  if (!value) return '';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleDateString('he-IL');
}

function formatRelatedCurrency(value: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CustomerDrawer({ isOpen, onClose, onSaved, customer }: CustomerDrawerProps) {
  if (!isOpen) return null;

  // Remount per customer so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <CustomerDrawerContent
      key={customer?.customerId ?? 'new'}
      customer={customer ?? null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface CustomerDrawerContentProps {
  customer: Customer | null;
  onClose: () => void;
  onSaved?: (customer: Customer) => void | Promise<void>;
}

function CustomerDrawerContent({ customer, onClose, onSaved }: CustomerDrawerContentProps) {
  const isExistingCustomer = customer != null;
  const { can } = usePermissions();
  // View-only roles (e.g. ProjectManager) can open a customer for review but must not reach the
  // edit/deactivate UI, which would only 403 on save. The API still enforces this server-side.
  const canManage = can('manageCustomers');
  const { createMutation, updateMutation, deactivateMutation } = useCustomerMutations();

  // Existing customers open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingCustomer);
  const [form, setForm] = useState<CustomerFormState>(() => buildInitialState(customer));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  function setField<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleStartEdit() {
    setForm(buildInitialState(customer));
    setError(null);
    setConfirmDeactivate(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingCustomer) {
      onClose();
      return;
    }

    setForm(buildInitialState(customer));
    setError(null);
    setConfirmDeactivate(false);
    setIsEditing(false);
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
      // The textual status mirrors the single isActive control so the badge
      // and the boolean never disagree.
      status: form.isActive ? 'פעיל' : 'לא פעיל',
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };

    try {
      let savedCustomer: Customer;
      if (isExistingCustomer) {
        const updatedCustomer = await updateMutation.mutateAsync({
          id: customer.customerId,
          request,
        });
        savedCustomer = updatedCustomer ?? { ...customer, ...request };
      } else {
        savedCustomer = await createMutation.mutateAsync(request);
      }

      setIsEditing(false);
      setConfirmDeactivate(false);
      await onSaved?.(savedCustomer);

      // Without a parent to hand the saved record back to, fall back to the
      // previous behavior of closing after a successful create.
      if (!isExistingCustomer && !onSaved) {
        onClose();
      }
    } catch (err) {
      setIsEditing(true);
      setError(err instanceof Error ? err.message : 'שמירה נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isExistingCustomer) return;
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

  const title = !isExistingCustomer
    ? 'לקוח חדש'
    : isEditing
      ? `עריכת לקוח — ${customer.customerName}`
      : `פרטי לקוח — ${customer.customerName}`;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      headerActions={
        isExistingCustomer && !isEditing && canManage ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={
        isEditing ? (
          <div className="customerDrawer__footerContent">
            {error && <p className="customerDrawer__error">{error}</p>}
            <div className="customerDrawer__actions">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'שומר...' : 'שמור'}
              </Button>
              <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                בטל שינויים
              </Button>

              {isExistingCustomer && customer.isActive && (
                <div className="customerDrawer__dangerActions">
                  {confirmDeactivate ? (
                    <>
                      <span className="customerDrawer__confirmText">להשבית את הלקוח?</span>
                      <Button variant="danger" onClick={handleDeactivate} disabled={isSaving}>
                        אישור השבתה
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
                      השבת לקוח
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {!isEditing && isExistingCustomer ? (
        <CustomerReviewDetails customer={customer} />
      ) : (
        <div className="customerDrawer customerDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="שם לקוח *"
              value={form.customerName}
              onChange={(e) => setField('customerName', e.target.value)}
              required
            />
            <div className="customerDrawer__grid">
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
            </div>

            {isExistingCustomer && (
              <label className="customerDrawer__checkboxRow">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span>לקוח פעיל</span>
              </label>
            )}
          </DetailsSection>

          <DetailsSection title="פרטי התקשרות">
            <div className="customerDrawer__grid">
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
            </div>
          </DetailsSection>

          <DetailsSection title="מיקום">
            <div className="customerDrawer__grid">
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
          </DetailsSection>

          <DetailsSection title="מידע נוסף">
            <div className="customerDrawer__field">
              <label className="customerDrawer__label">הערות</label>
              <textarea
                className="customerDrawer__textarea"
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

interface CustomerReviewDetailsProps {
  customer: Customer;
}

function CustomerReviewDetails({ customer }: CustomerReviewDetailsProps) {
  // Related operational data is read through existing feature API clients.
  // In mock mode these endpoints are unavailable, so the queries stay
  // disabled and each section explains that instead of inventing data.
  const areRelatedQueriesEnabled = isLocalDataMode;

  const projectsQuery = useQuery({
    queryKey: ['customers', 'related', 'projects'],
    queryFn: getProjectsListAsync,
    enabled: areRelatedQueriesEnabled,
  });

  const quotesQuery = useQuery({
    queryKey: ['customers', 'related', 'quotes', customer.customerId],
    queryFn: () => getQuotesAsync({ customerId: customer.customerId }),
    enabled: areRelatedQueriesEnabled,
  });

  const serviceCallsQuery = useQuery({
    queryKey: ['customers', 'related', 'serviceCalls'],
    queryFn: getServiceCallsAsync,
    enabled: areRelatedQueriesEnabled,
  });

  const contactsQuery = useQuery({
    queryKey: ['customers', 'related', 'contacts'],
    queryFn: getContactsAsync,
    enabled: areRelatedQueriesEnabled,
  });

  const sitesQuery = useQuery({
    queryKey: ['customers', 'related', 'sites'],
    queryFn: getSitesAsync,
    enabled: areRelatedQueriesEnabled,
  });

  // ProjectListItem carries customerName only (no customerId), so projects are
  // matched by the customer's exact name.
  const customerName = customer.customerName.trim();
  const relatedProjects = (projectsQuery.data ?? []).filter(
    (project) => project.customerName?.trim() === customerName,
  );
  const relatedQuotes = quotesQuery.data ?? [];
  const relatedServiceCalls = (serviceCallsQuery.data ?? []).filter(
    (serviceCall) => serviceCall.customerId === customer.customerId,
  );
  const relatedContacts = (contactsQuery.data ?? []).filter(
    (contact) => contact.customerId === customer.customerId,
  );
  const relatedSites = (sitesQuery.data ?? []).filter(
    (site) => site.customerId === customer.customerId,
  );

  return (
    <div className="customerDrawer customerDrawer--review">
      <DetailsSection title="פרטי לקוח">
        <div className="customerDrawer__detailsGrid">
          <DetailsField label="שם לקוח" value={customer.customerName} />
          <DetailsField label="סוג לקוח" value={customer.customerType} />
          <DetailsField
            label="סטטוס"
            value={
              <Badge variant={customer.isActive ? 'success' : 'neutral'}>
                {customer.status ?? (customer.isActive ? 'פעיל' : 'לא פעיל')}
              </Badge>
            }
          />
          <DetailsField label="טלפון" value={customer.primaryPhone} />
          <DetailsField label="אימייל" value={customer.primaryEmail} />
        </div>
      </DetailsSection>

      <DetailsSection title="מיקום והערות">
        <div className="customerDrawer__detailsGrid">
          <DetailsField label="עיר" value={customer.city} />
          <DetailsField label="אזור" value={customer.region} />
          <DetailsField label="כתובת" value={customer.address} />
        </div>
        <DetailsField label="הערות" value={customer.notes} />
      </DetailsSection>

      <CustomerVaultSection customerId={customer.customerId} />

      <RelatedSection
        title="פרויקטים"
        count={projectsQuery.data ? relatedProjects.length : null}
        isLoading={projectsQuery.isLoading}
        isError={projectsQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין פרויקטים מקושרים ללקוח זה."
      >
        <ul className="customerDrawer__relatedList">
          {relatedProjects.slice(0, MAX_RELATED_ITEMS).map((project) => (
            <li key={project.workItemId}>
              <Link
                className="customerDrawer__relatedItem customerDrawer__relatedItem--link"
                to={`/projects?projectId=${project.workItemId}`}
              >
                <span className="customerDrawer__relatedPrimary">{project.title}</span>
                <span className="customerDrawer__relatedMeta">
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
        title="הצעות מחיר"
        count={quotesQuery.data ? relatedQuotes.length : null}
        isLoading={quotesQuery.isLoading}
        isError={quotesQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין הצעות מחיר מקושרות ללקוח זה."
      >
        <ul className="customerDrawer__relatedList">
          {relatedQuotes.slice(0, MAX_RELATED_ITEMS).map((quote) => (
            <li key={quote.quoteId}>
              <Link
                className="customerDrawer__relatedItem customerDrawer__relatedItem--link"
                to={`/quotes?quoteId=${quote.quoteId}`}
              >
                <span className="customerDrawer__relatedPrimary">{quote.quoteNumber}</span>
                <span className="customerDrawer__relatedMeta">
                  {formatRelatedDate(quote.quoteDate)} · {formatRelatedCurrency(quote.total)}
                </span>
                <Badge variant={getQuoteStatusBadgeVariant(quote.status)}>
                  {getQuoteStatusLabel(quote.status)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
        <RelatedOverflowNote total={relatedQuotes.length} />
      </RelatedSection>

      <RelatedSection
        title="קריאות שירות"
        count={serviceCallsQuery.data ? relatedServiceCalls.length : null}
        isLoading={serviceCallsQuery.isLoading}
        isError={serviceCallsQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין קריאות שירות מקושרות ללקוח זה."
        footer={
          relatedServiceCalls.length > 0 ? (
            <Link className="customerDrawer__relatedFooterLink" to="/service-calls">
              לכל קריאות השירות
            </Link>
          ) : undefined
        }
      >
        <ul className="customerDrawer__relatedList">
          {relatedServiceCalls.slice(0, MAX_RELATED_ITEMS).map((serviceCall) => (
            <li key={serviceCall.workItemId}>
              <Link
                className="customerDrawer__relatedItem customerDrawer__relatedItem--link"
                to={`/service-calls?serviceCallId=${serviceCall.workItemId}`}
              >
                <span className="customerDrawer__relatedPrimary">{serviceCall.title}</span>
                <span className="customerDrawer__relatedMeta">
                  {[
                    serviceCall.siteName,
                    formatRelatedDate(serviceCall.plannedStart ?? serviceCall.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <Badge variant={SERVICE_CALL_STATUS_VARIANTS[serviceCall.status] ?? 'neutral'}>
                  {SERVICE_CALL_STATUS_LABELS[serviceCall.status] ?? serviceCall.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
        <RelatedOverflowNote total={relatedServiceCalls.length} />
      </RelatedSection>

      <RelatedSection
        title="אנשי קשר"
        count={contactsQuery.data ? relatedContacts.length : null}
        isLoading={contactsQuery.isLoading}
        isError={contactsQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין אנשי קשר מקושרים ללקוח זה."
        footer={
          relatedContacts.length > 0 ? (
            <Link className="customerDrawer__relatedFooterLink" to="/contacts">
              לרשימת אנשי הקשר
            </Link>
          ) : undefined
        }
      >
        <ul className="customerDrawer__relatedList">
          {relatedContacts.slice(0, MAX_RELATED_ITEMS).map((contact) => (
            <li key={contact.contactId}>
              <Link
                className="customerDrawer__relatedItem customerDrawer__relatedItem--link"
                to={`/contacts?contactId=${contact.contactId}`}
              >
                <span className="customerDrawer__relatedPrimary">{contact.fullName}</span>
                <span className="customerDrawer__relatedMeta">
                  {[contact.jobTitle, contact.phone].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <RelatedOverflowNote total={relatedContacts.length} />
      </RelatedSection>

      <RelatedSection
        title="אתרים"
        count={sitesQuery.data ? relatedSites.length : null}
        isLoading={sitesQuery.isLoading}
        isError={sitesQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין אתרים מקושרים ללקוח זה."
      >
        <ul className="customerDrawer__relatedList">
          {relatedSites.slice(0, MAX_RELATED_ITEMS).map((site) => (
            <li key={site.siteId} className="customerDrawer__relatedItem">
              <span className="customerDrawer__relatedPrimary">{site.siteName}</span>
              <span className="customerDrawer__relatedMeta">
                {[site.city, site.addressLine].filter(Boolean).join(' · ')}
              </span>
              {site.isPrimary && <Badge variant="primary">ראשי</Badge>}
            </li>
          ))}
        </ul>
        <RelatedOverflowNote total={relatedSites.length} />
      </RelatedSection>
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
  footer?: ReactNode;
  children: ReactNode;
}

function RelatedSection({
  title,
  count,
  isLoading,
  isError,
  isUnavailable,
  emptyText,
  footer,
  children,
}: RelatedSectionProps) {
  const sectionTitle = count != null ? `${title} (${count})` : title;

  let body: ReactNode;
  if (isUnavailable) {
    body = (
      <p className="customerDrawer__relatedHint">נתונים מקושרים זמינים בחיבור לשרת בלבד.</p>
    );
  } else if (isLoading) {
    body = <p className="customerDrawer__relatedHint">טוען נתונים מקושרים…</p>;
  } else if (isError) {
    body = (
      <p className="customerDrawer__relatedHint customerDrawer__relatedHint--error">
        טעינת הנתונים המקושרים נכשלה.
      </p>
    );
  } else if (count === 0) {
    body = <p className="customerDrawer__relatedHint">{emptyText}</p>;
  } else {
    body = (
      <>
        {children}
        {footer}
      </>
    );
  }

  return <DetailsSection title={sectionTitle}>{body}</DetailsSection>;
}

function RelatedOverflowNote({ total }: { total: number }) {
  if (total <= MAX_RELATED_ITEMS) return null;
  return (
    <p className="customerDrawer__relatedHint">ועוד {total - MAX_RELATED_ITEMS} רשומות נוספות.</p>
  );
}
