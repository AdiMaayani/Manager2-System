import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { StatusBadge } from '@shared/components/StatusBadge';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { deleteWorkReportAsync, getReportByIdAsync } from '../../api/reportsApiClient';
import type { WorkReportDetails } from '../../types';
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

export function ReportDetailModal({
  reportId,
  isOpen,
  onClose,
  onEdit,
  onDeleted,
}: ReportDetailModalProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'detail', reportId],
    queryFn: () => getReportByIdAsync(reportId!),
    enabled: isOpen && reportId != null && reportId > 0,
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

  function handleClose() {
    setDeleteError(null);
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
            <dl className="reportDetailModal__meta">
              <div>
                <dt>תאריך</dt>
                <dd>{formatReportDate(report.reportDate)}</dd>
              </div>
              <div>
                <dt>סטטוס</dt>
                <dd>
                  <StatusBadge domain="report" status={report.status} />
                </dd>
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
                <dt>תפקיד</dt>
                <dd>{report.role ?? '—'}</dd>
              </div>
              <div>
                <dt>אתר / מיקום</dt>
                <dd>{report.site ?? '—'}</dd>
              </div>
              <div>
                <dt>שעות עבודה</dt>
                <dd>
                  {(report.start || report.end)
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

          {report.systems.length > 0 && (
            <section className="reportDetailModal__section">
              <h3>מערכות שבוצעו</h3>
              <div className="reportDetailModal__chips">
                {report.systems.map((system) => (
                  <span key={system} className="reportDetailModal__chip">
                    {system}
                  </span>
                ))}
              </div>
            </section>
          )}

          {report.relatedWorkers.length > 0 && (
            <section className="reportDetailModal__section">
              <h3>עובדים קשורים</h3>
              <p className="reportDetailModal__text">
                {report.relatedWorkers
                  .map((worker) => worker.name)
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </section>
          )}

          {(report.notes?.trim() || report.followUpRequired) && (
            <section className="reportDetailModal__section">
              <h3>הערות</h3>
              {report.notes?.trim() && (
                <p className="reportDetailModal__text">{report.notes}</p>
              )}
              {report.followUpRequired && (
                <p className="reportDetailModal__text">
                  דורש ביקור חוזר
                  {report.followUpReason ? `: ${report.followUpReason}` : ''}
                </p>
              )}
            </section>
          )}

          <div className="reportDetailModal__footer">
            {deleteError && <InlineAlert variant="danger">{deleteError}</InlineAlert>}
            <div className="reportDetailModal__actions">
              <Button type="button" onClick={() => onEdit(report)}>
                עריכה
              </Button>
              <ConfirmInline
                triggerLabel="מחיקה"
                message="למחוק את הדיווח לצמיתות?"
                confirmLabel="אישור מחיקה"
                onConfirm={() => deleteReport.mutate(report.reportId)}
                isPending={deleteReport.isPending}
              />
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
