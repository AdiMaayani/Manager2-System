import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { Input } from '@shared/components/Input';
import { RelatedSection } from '@shared/components/RelatedSection';
import { Textarea } from '@shared/components/Textarea';
import {
  ValidatedAddressField,
  buildAddressProfilePayload,
  createSiteWithAddressProfileAsync,
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
  const [isSaving, setIsSaving] = useState(false);

  const sites = sitesQuery.data ?? [];

  function openCreateSite() {
    setEditingSiteId(null);
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

  async function invalidateSiteQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'sites'] }),
      queryClient.invalidateQueries({ queryKey: ['projectLookups', 'sites'] }),
      queryClient.invalidateQueries({ queryKey: ['serviceCalls', 'sites'] }),
    ]);
  }

  async function handleSaveSite() {
    if (!form.siteName.trim()) {
      setSiteError('יש להזין שם אתר.');
      return;
    }

    setIsSaving(true);
    setSiteError(null);
    try {
      const request = {
        customerId,
        siteName: form.siteName.trim(),
        isPrimary: form.isPrimary,
        notes: form.notes.trim() || undefined,
        addressProfile: buildAddressProfilePayload(form.address) ?? undefined,
      };

      if (editingSiteId == null) {
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
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : 'שמירת האתר נכשלה.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RelatedSection
      title="אתרים"
      count={sitesQuery.data ? sites.length : null}
      isLoading={sitesQuery.isLoading}
      isError={sitesQuery.isError}
      emptyText="אין אתרים המשויכים ללקוח זה."
      footer={
        canManage ? (
          <Button type="button" variant="secondary" onClick={openCreateSite}>
            אתר חדש
          </Button>
        ) : undefined
      }
    >
      {sites.length > 0 && (
        <ul className="customerSitesSection__list">
          {sites.map((site) => (
            <li key={site.siteId} className="customerSitesSection__site">
              <div>
                <span className="customerSitesSection__name">{site.siteName}</span>
                <span className="customerSitesSection__address">
                  {[site.addressLine, site.city].filter(Boolean).join(' · ') || 'ללא כתובת'}
                </span>
              </div>
              {canManage && (
                <Button type="button" variant="ghost" onClick={() => void openEditSite(site)}>
                  פתח וערוך
                </Button>
              )}
            </li>
          ))}
        </ul>
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
          {siteError && <InlineAlert variant="danger">{siteError}</InlineAlert>}
          <div className="customerSitesSection__actions">
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => setIsEditorOpen(false)}
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
    </RelatedSection>
  );
}
