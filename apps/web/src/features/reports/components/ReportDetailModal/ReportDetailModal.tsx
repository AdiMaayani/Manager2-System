import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { StatusBadge } from '@shared/components/StatusBadge';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Input } from '@shared/components/Input';
import { Textarea } from '@shared/components/Textarea';
import {
  canAmendReport,
  canEditReportAttachments,
  canEditReportInventory,
  canEditReportText,
  canFinalizeReport,
  canReverseReport,
} from '@shared/constants/reportLifecycle';
import {
  addReportInventoryLineAsync,
  deleteReportAttachmentAsync,
  deleteReportInventoryLineAsync,
  deleteWorkReportAsync,
  getInventoryBySkuAsync,
  getReportAttachmentBlobAsync,
  REPORTS_INVALIDATION,
  uploadReportAttachmentAsync,
} from '../../api/reportsApiClient';
import {
  useAmendReport,
  useFinalizeReport,
  useReportDetail,
  useReverseReport,
} from '../../hooks/useReports';
import { SkuCameraScanner } from '../SkuCameraScanner';
import type { WorkReportDetails, WorkReportInventoryLine } from '../../types';
import './ReportDetailModal.css';

interface ReportDetailModalProps {
  reportId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (report: WorkReportDetails) => void;
  onDeleted: () => void;
}

function formatReportDate(value?: string | null) {
  if (!value) return '—';
  return value.split('T')[0];
}

function normalizeSkuInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

export function ReportDetailModal({
  reportId,
  isOpen,
  onClose,
  onEdit,
  onDeleted,
}: ReportDetailModalProps) {
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [skuInput, setSkuInput] = useState('');
  const scanBufferRef = useRef('');
  const [reverseReason, setReverseReason] = useState('');
  const scanTimeoutRef = useRef<number | null>(null);

  const { data: report, isLoading, error, refetch } = useReportDetail(reportId, isOpen);
  const finalizeReport = useFinalizeReport();
  const reverseReport = useReverseReport();
  const amendReport = useAmendReport();

  const canEditInventory = canEditReportInventory(report?.lifecycleStatus);
  const canEditAttachments = canEditReportAttachments(report?.lifecycleStatus);
  const canEditText = canEditReportText(report?.lifecycleStatus);

  const invalidateDetail = useCallback(async () => {
    if (reportId == null) return;
    await queryClient.invalidateQueries({ queryKey: REPORTS_INVALIDATION.detail(reportId) });
  }, [queryClient, reportId]);

  const addLineMutation = useMutation({
    mutationFn: async (line: { inventoryItemId: number; quantity: number; usageType: string }) => {
      if (reportId == null) throw new Error('missing report');
      return addReportInventoryLineAsync(reportId, line);
    },
    onSuccess: invalidateDetail,
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'הוספת שורת מלאי נכשלה');
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: number) => {
      if (reportId == null) throw new Error('missing report');
      return deleteReportInventoryLineAsync(reportId, lineId);
    },
    onSuccess: invalidateDetail,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      if (reportId == null) throw new Error('missing report');
      return uploadReportAttachmentAsync(reportId, file);
    },
    onSuccess: invalidateDetail,
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: number) => {
      if (reportId == null) throw new Error('missing report');
      return deleteReportAttachmentAsync(reportId, attachmentId);
    },
    onSuccess: invalidateDetail,
  });

  const deleteReport = useMutation({
    mutationFn: (id: number) => deleteWorkReportAsync(id),
    onSuccess: () => {
      setDeleteError(null);
      onDeleted();
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'מחיקת הדיווח נכשלה');
    },
  });

  const handleSkuLookup = useCallback(async (rawSku?: string) => {
    const sku = normalizeSkuInput(rawSku ?? skuInput);
    if (!sku) return;
    setActionError(null);
    try {
      const item = await getInventoryBySkuAsync(sku);
      const existing = report?.inventoryLines.find((l) => l.inventoryItemId === item.inventoryItemId);
      if (existing) {
        await addLineMutation.mutateAsync({
          inventoryItemId: item.inventoryItemId,
          quantity: existing.quantity + 1,
          usageType: existing.usageType,
        });
      } else {
        await addLineMutation.mutateAsync({
          inventoryItemId: item.inventoryItemId,
          quantity: 1,
          usageType: 'Used',
        });
      }
      setSkuInput('');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `מק״ט "${sku}" לא נמצא במלאי`,
      );
    }
  }, [addLineMutation, report, skuInput]);

  useEffect(() => {
    if (!isOpen || !canEditInventory) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' && scanBufferRef.current.trim()) {
        event.preventDefault();
        void handleSkuLookup(scanBufferRef.current);
        scanBufferRef.current = '';
      } else if (event.key.length === 1) {
        scanBufferRef.current += event.key;
        if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = window.setTimeout(() => {
          scanBufferRef.current = '';
        }, 200);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEditInventory, handleSkuLookup, isOpen]);

  async function handlePlayAttachment(attachmentId: number) {
    if (reportId == null) return;
    const blob = await getReportAttachmentBlobAsync(reportId, attachmentId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function handleClose() {
    setDeleteError(null);
    setActionError(null);
    setIsMaximized(false);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={report ? `דיווח #${report.reportId}` : 'פרטי דיווח'}
      isMaximized={isMaximized}
      onToggleMaximize={() => setIsMaximized((value) => !value)}
    >
      {isLoading && <PageSpinner />}
      {error && (
        <ErrorState
          message={error instanceof Error ? error.message : 'טעינת הדיווח נכשלה'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && report && (
        <div className="reportDetailModal">
          <section className="reportDetailModal__section">
            <h3>פרטי דיווח</h3>
            <div className="reportDetailModal__badges">
              <StatusBadge domain="report" status={report.status} />
              <StatusBadge domain="reportLifecycle" status={report.lifecycleStatus} />
            </div>
            <dl className="reportDetailModal__meta">
              <div>
                <dt>תאריך</dt>
                <dd>{formatReportDate(report.reportDate)}</dd>
              </div>
              {report.reportType !== 'service_call' && (
                <div>
                  <dt>פרויקט</dt>
                  <dd>{report.projectTitle ?? '—'}</dd>
                </div>
              )}
              <div>
                <dt>לקוח</dt>
                <dd>{report.customerName ?? '—'}</dd>
              </div>
              {report.serviceCallId != null && (
                <div>
                  <dt>קריאת שירות</dt>
                  <dd>
                    {report.serviceCallTitle
                      ? `#${report.serviceCallId} · ${report.serviceCallTitle}`
                      : `#${report.serviceCallId}`}
                  </dd>
                </div>
              )}
              <div>
                <dt>מדווח</dt>
                <dd>{report.reportedByName ?? '—'}</dd>
              </div>
              <div>
                <dt>שעות עבודה</dt>
                <dd>
                  {report.start || report.end
                    ? `${report.start ?? '—'} – ${report.end ?? '—'}`
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="reportDetailModal__section">
            <h3>סיכום עבודה</h3>
            <p className="reportDetailModal__text">{report.summary?.trim() || '—'}</p>
          </section>

          <section className="reportDetailModal__section">
            <h3>שורות מלאי</h3>
            {canEditInventory && (
              <div className="reportDetailModal__skuScan">
                <Input
                  label="סריקת / הזנת מק״ט"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSkuLookup();
                    }
                  }}
                  placeholder="סרוק או הקלד מק״ט ולחץ Enter"
                />
                <Button type="button" variant="secondary" onClick={() => void handleSkuLookup()}>
                  חפש מק״ט
                </Button>
                <SkuCameraScanner
                  disabled={addLineMutation.isPending}
                  onSkuDetected={(sku) => void handleSkuLookup(sku)}
                />
              </div>
            )}
            {report.inventoryLines.length === 0 ? (
              <p className="reportDetailModal__text">אין שורות מלאי</p>
            ) : (
              <ul className="reportDetailModal__inventoryList">
                {report.inventoryLines.map((line: WorkReportInventoryLine) => (
                  <li key={line.workReportInventoryItemId} className="reportDetailModal__inventoryRow">
                    <span>{line.itemNameSnapshot ?? line.skuSnapshot ?? `#${line.inventoryItemId}`}</span>
                    <span>{line.quantity}</span>
                    <span>{line.usageType}</span>
                    {canEditInventory && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => deleteLineMutation.mutate(line.workReportInventoryItemId)}
                      >
                        הסר
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!canEditInventory && report.lifecycleStatus === 'Finalized' && (
              <p className="reportDetailModal__hint">שורות המלאי נעולות לאחר סופק.</p>
            )}
          </section>

          <section className="reportDetailModal__section">
            <h3>קבצים מצורפים</h3>
            {canEditAttachments && (
              <Input
                label="העלאת קובץ (תמונה / וידאו)"
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAttachmentMutation.mutate(file);
                }}
              />
            )}
            {report.attachments.length === 0 ? (
              <p className="reportDetailModal__text">אין קבצים מצורפים</p>
            ) : (
              <ul className="reportDetailModal__attachments">
                {report.attachments.map((attachment) => (
                  <li key={attachment.workReportAttachmentId}>
                    <button
                      type="button"
                      className="reportDetailModal__attachmentLink"
                      onClick={() => void handlePlayAttachment(attachment.workReportAttachmentId)}
                    >
                      {attachment.originalFileName}
                    </button>
                    {canEditAttachments && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          deleteAttachmentMutation.mutate(attachment.workReportAttachmentId)
                        }
                      >
                        הסר
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canReverseReport(report.lifecycleStatus) && (
            <section className="reportDetailModal__section">
              <h3>החזרת מלאי (Reverse)</h3>
              <Textarea
                label="סיבת החזרה"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                rows={2}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!reverseReason.trim() || reverseReport.isPending}
                onClick={() =>
                  reverseReport.mutate(
                    { reportId: report.reportId, reason: reverseReason.trim() },
                    { onError: (err) => setActionError(err instanceof Error ? err.message : 'ההחזרה נכשלה') },
                  )
                }
              >
                החזר מלאי
              </Button>
            </section>
          )}

          <div className="reportDetailModal__footer">
            {(deleteError || actionError) && (
              <InlineAlert variant="danger">{deleteError ?? actionError}</InlineAlert>
            )}
            <div className="reportDetailModal__actions">
              {canEditText && (
                <Button type="button" onClick={() => onEdit(report)}>
                  עריכה
                </Button>
              )}
              {canFinalizeReport(report.lifecycleStatus) && (
                <Button
                  type="button"
                  onClick={() =>
                    finalizeReport.mutate(report.reportId, {
                      onError: (err) =>
                        setActionError(err instanceof Error ? err.message : 'סופק נכשל'),
                    })
                  }
                  isLoading={finalizeReport.isPending}
                >
                  סופק (Finalize)
                </Button>
              )}
              {canAmendReport(report.lifecycleStatus) && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => amendReport.mutate(report.reportId)}
                  isLoading={amendReport.isPending}
                >
                  תיקון (Amend)
                </Button>
              )}
              {canEditText && (
                <ConfirmInline
                  triggerLabel="מחיקה"
                  message="למחוק את הדיווח? פעולה זו אינה הפיכה."
                  confirmLabel="אישור מחיקה"
                  onConfirm={() => deleteReport.mutate(report.reportId)}
                  isPending={deleteReport.isPending}
                />
              )}
              <Button type="button" variant="secondary" onClick={handleClose}>
                סגור
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
