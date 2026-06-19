import type { ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { InlineAlert } from '@shared/components/InlineAlert';
import {
  deleteReportAttachmentAsync,
  getReportAttachmentBlobAsync,
  uploadReportAttachmentAsync,
} from '../../api/reportsApiClient';
import type { WorkReportAttachment } from '../../types';
import './ReportFormAttachmentsSection.css';

export interface PendingAttachment {
  tempId: string;
  file: File;
}

interface ReportFormAttachmentsSectionProps {
  canEdit: boolean;
  reportId?: number | null;
  pendingAttachments: PendingAttachment[];
  onPendingAttachmentsChange: (attachments: PendingAttachment[]) => void;
  savedAttachments?: WorkReportAttachment[];
  onSavedAttachmentsChange?: () => void;
}

function createTempId() {
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ReportFormAttachmentsSection({
  canEdit,
  reportId,
  pendingAttachments,
  onPendingAttachmentsChange,
  savedAttachments = [],
  onSavedAttachmentsChange,
}: ReportFormAttachmentsSectionProps) {
  const isEditMode = reportId != null;

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (reportId == null) throw new Error('missing report');
      return uploadReportAttachmentAsync(reportId, file);
    },
    onSuccess: () => onSavedAttachmentsChange?.(),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => {
      if (reportId == null) throw new Error('missing report');
      return deleteReportAttachmentAsync(reportId, attachmentId);
    },
    onSuccess: () => onSavedAttachmentsChange?.(),
  });

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (isEditMode) {
      uploadMutation.mutate(file);
      return;
    }

    onPendingAttachmentsChange([
      ...pendingAttachments,
      { tempId: createTempId(), file },
    ]);
  }

  function handleRemovePending(tempId: string) {
    onPendingAttachmentsChange(pendingAttachments.filter((item) => item.tempId !== tempId));
  }

  async function handleOpenAttachment(attachmentId: number) {
    if (reportId == null) return;
    const blob = await getReportAttachmentBlobAsync(reportId, attachmentId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function handleOpenPending(file: File) {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const hasAttachments = isEditMode
    ? savedAttachments.length > 0
    : pendingAttachments.length > 0;

  const mutationError =
    uploadMutation.error instanceof Error
      ? uploadMutation.error.message
      : deleteMutation.error instanceof Error
        ? deleteMutation.error.message
        : null;

  return (
    <section className="reportFormAttachmentsSection">
      <h3>קבצים מצורפים</h3>

      {!canEdit && (
        <p className="reportFormAttachmentsSection__hint">
          לא ניתן לערוך קבצים מצורפים בדיווח זה.
        </p>
      )}

      {canEdit && (
        <Input
          label="העלאת קובץ (תמונה / וידאו)"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          disabled={uploadMutation.isPending}
        />
      )}

      {uploadMutation.isPending && (
        <p className="reportFormAttachmentsSection__hint">מעלה קובץ...</p>
      )}

      {mutationError && <InlineAlert variant="danger">{mutationError}</InlineAlert>}

      {!hasAttachments ? (
        <p className="reportFormAttachmentsSection__empty">אין קבצים מצורפים</p>
      ) : (
        <ul className="reportFormAttachmentsSection__list">
          {isEditMode
            ? savedAttachments.map((attachment) => (
                <li key={attachment.workReportAttachmentId} className="reportFormAttachmentsSection__row">
                  <button
                    type="button"
                    className="reportFormAttachmentsSection__link"
                    onClick={() => void handleOpenAttachment(attachment.workReportAttachmentId)}
                  >
                    {attachment.originalFileName}
                  </button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(attachment.workReportAttachmentId)}
                      disabled={deleteMutation.isPending}
                    >
                      הסר
                    </Button>
                  )}
                </li>
              ))
            : pendingAttachments.map((item) => (
                <li key={item.tempId} className="reportFormAttachmentsSection__row">
                  <button
                    type="button"
                    className="reportFormAttachmentsSection__link"
                    onClick={() => handleOpenPending(item.file)}
                  >
                    {item.file.name}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemovePending(item.tempId)}
                  >
                    הסר
                  </Button>
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}
