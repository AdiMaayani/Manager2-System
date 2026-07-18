import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Checkbox } from '@shared/components/Checkbox';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { InlineAlert } from '@shared/components/InlineAlert';
import { Input } from '@shared/components/Input';
import { RelatedSection } from '@shared/components/RelatedSection';
import { Textarea } from '@shared/components/Textarea';
import {
  ValidatedAddressField,
  buildAddressProfilePayload,
  createSiteWithAddressProfileAsync,
  deactivateSiteAsync,
  getSiteAddressProfileOptionalAsync,
  mapAddressProfileToFieldState,
  updateSiteWithAddressProfileAsync,
  type ValidatedAddressFieldState,
} from '@features/geo';
import { getCustomerSitesAsync } from '../../api/customersApiClient';
import type { CustomerSite } from '../../types';
import './CustomerSitesSection.css';

interface CustomerSitesSectionProps {
  customerId: number;
  canManage: boolean;
}

interface CustomerSiteFormState {
  siteName: string;
  notes: string;
  isPrimary: boolean;
  address: ValidatedAddressFieldState;
}

function createEmptySiteForm(): CustomerSiteFormState {
  return {
    siteName: '',
    notes: '',
    isPrimary: false,
    address: { inputAddress: '', validationStatus: null },
  };
}

export function CustomerSitesSection({
  customerId,
  canManage,
}: CustomerSitesSectionProps) {
  const queryClient = useQueryClient();
  const sitesQuery = useQuery({
    queryKey: ['customers', customerId, 'sites'],
    queryFn: () => getCustomerSitesAsync(customerId),
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerSiteFormState>(createEmptySiteForm);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deactivatingSiteId, setDeactivatingSiteId] = useState<number | null>(null);

  const sites = sitesQuery.data ?? [];
  const canShowManageControls = canManage && sitesQuery.isSuccess;

  function openCreateSite() {
    setEditingSiteId(null);
    setStatusMessage(null);
    setForm({
      ...createEmptySiteForm(),
      isPrimary: sites.length === 0,
    });
    setSiteError(null);
    setIsEditorOpen(true);
  }

  async function openEditSite(site: CustomerSite) {
    setEditingSiteId(site.siteId);
    setSiteError(null);
    setStatusMessage(null);
    setIsEditorOpen(true);
    setForm({
      siteName: site.siteName,
      notes: site.notes ?? '',
      isPrimary: site.isPrimary,
      address: {
        inputAddress: [site.addressLine, site.city].filter(Boolean).join(', '),
        validationStatus: null,
      },
    });

    try {
      const profile = await getSiteAddressProfileOptionalAsync(site.siteId);
      if (profile) {
        setForm((current) => ({
          ...current,
          address: mapAddressProfileToFieldState(profile),
        }));
      }
    } catch {
      // The operational address remains editable even when profile loading fails.
    }
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setEditingSiteId(null);
    setForm(createEmptySiteForm());
    setSiteError(null);
  }

  async function invalidateSiteQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'sites'] }),
      queryClient.invalidateQueries({ queryKey: ['projectLookups', 'sites'] }),
      queryClient.invalidateQueries({ queryKey: ['serviceCalls', 'sites'] }),
    ]);
  }

  async function handleSaveSite() {
    if (!form.siteName.trim()) {
      setStatusMessage(null);
      setSiteError('יש להזין שם אתר.');
      return;
    }

    setIsSaving(true);
    setSiteError(null);
    setStatusMessage(null);
    try {
      const request = {
        customerId,
        siteName: form.siteName.trim(),
        isPrimary: form.isPrimary,
        notes: form.notes.trim() || undefined,
        addressProfile: buildAddressProfilePayload(form.address) ?? undefined,
      };

      const isCreating = editingSiteId == null;
      if (isCreating) {
        await createSiteWithAddressProfileAsync(request);
      } else {
        await updateSiteWithAddressProfileAsync(editingSiteId, {
          ...request,
          siteId: editingSiteId,
        });
      }

      await invalidateSiteQueries();
      setIsEditorOpen(false);
      setEditingSiteId(null);
      setForm(createEmptySiteForm());
      setStatusMessage(isCreating ? 'האתר נוצר בהצלחה.' : 'פרטי האתר עודכנו בהצלחה.');
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : 'שמירת האתר נכשלה.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivateSite(site: CustomerSite) {
    setSiteError(null);
    setStatusMessage(null);
    setDeactivatingSiteId(site.siteId);
    try {
      await deactivateSiteAsync(site.siteId);
      await invalidateSiteQueries();
      if (editingSiteId === site.siteId) {
        closeEditor();
      }
      setStatusMessage('האתר הושבת בהצלחה.');
    } catch (error) {
      setSiteError(
        error instanceof Error
          ? error.message
          : 'השבתת האתר נכשלה. ודא שאין עבודות פתוחות באתר.',
      );
    } finally {
      setDeactivatingSiteId(null);
    }
  }

  return (
    <div className="customerSitesSection">
      <RelatedSection
        title="אתרים"
        count={sitesQuery.data ? sites.length : null}
        isLoading={sitesQuery.isLoading}
        isError={sitesQuery.isError}
        emptyText="אין אתרים פעילים המשויכים ללקוח זה. ניתן להוסיף אתר חדש."
      >
        {sites.length > 0 && (
          <ul className="customerSitesSection__list">
            {sites.map((site) => (
              <li key={site.siteId} className="customerSitesSection__site">
                <div className="customerSitesSection__siteInfo">
                  <span className="customerSitesSection__name">
                    {site.siteName}
                    {site.isPrimary && (
                      <span className="customerSitesSection__primaryTag">אתר ראשי</span>
                    )}
                  </span>
                  <span className="customerSitesSection__address">
                    {[site.addressLine, site.city].filter(Boolean).join(' · ') || 'ללא כתובת'}
                  </span>
                </div>
                {canManage && (
                  <div className="customerSitesSection__siteActions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void openEditSite(site)}
                    >
                      פתח וערוך
                    </Button>
                    <ConfirmInline
                      triggerLabel="השבתה"
                      message="להשבית את האתר?"
                      confirmLabel="אישור השבתה"
                      onConfirm={() => handleDeactivateSite(site)}
                      isPending={deactivatingSiteId === site.siteId}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </RelatedSection>

      {canShowManageControls && (
        <div className="customerSitesSection__manage">
          {/* Shared status/error banners live outside the editor so create, edit, and deactivate
              failures stay visible even when the editor is closed. Success and error are mutually
              exclusive because each handler clears the other before setting its own message. */}
          {siteError && <InlineAlert variant="danger">{siteError}</InlineAlert>}
          {statusMessage && !siteError && (
            <InlineAlert variant="success" onDismiss={() => setStatusMessage(null)}>
              {statusMessage}
            </InlineAlert>
          )}

          {!isEditorOpen && (
            <Button type="button" variant="secondary" onClick={openCreateSite}>
              אתר חדש
            </Button>
          )}

          {isEditorOpen && (
            <div className="customerSitesSection__editor">
              <Input
                label="שם האתר"
                required
                value={form.siteName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, siteName: event.target.value }))
                }
              />
              <ValidatedAddressField
                label="כתובת (אופציונלי)"
                value={form.address}
                onChange={(address) => setForm((current) => ({ ...current, address }))}
                helpText="אפשר להקליד ולשמור ידנית גם כאשר שירות ההשלמה אינו זמין."
              />
              <Textarea
                label="הערות"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={2}
              />
              <Checkbox
                label="אתר ראשי"
                checked={form.isPrimary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                }
              />
              <div className="customerSitesSection__actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={closeEditor}
                >
                  ביטול
                </Button>
                <Button
                  type="button"
                  isLoading={isSaving}
                  disabled={isSaving}
                  onClick={() => void handleSaveSite()}
                >
                  {editingSiteId == null ? 'צור אתר' : 'שמור אתר'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
