import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { Input } from '@shared/components/Input';
import { downloadProjectDrawingFileAsync } from '../../../../api/projectsApiClient';
import type {
  CreateProjectDrawingRequest,
  ProjectDrawing,
  UpdateProjectDrawingRequest,
  UploadProjectDrawingRequest,
} from '../../../../types';
import { formatProjectDate } from '../../../../utils/projectDisplayUtils';
import './ProjectDrawingsTab.css';

interface ProjectDrawingsTabProps {
  drawings: ProjectDrawing[];
  isEditMode: boolean;
  isSaving: boolean;
  onCreate: (body: CreateProjectDrawingRequest) => Promise<void>;
  onUpload: (body: UploadProjectDrawingRequest) => Promise<void>;
  onUpdate: (
    projectDrawingId: number,
    body: UpdateProjectDrawingRequest,
  ) => Promise<void>;
  onDelete: (projectDrawingId: number) => Promise<void>;
}

interface DrawingDraft {
  name: string;
  type: 'PDF' | 'DWG';
  date: string;
  note: string;
  file: File | null;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function draftFromDrawing(drawing: ProjectDrawing): DrawingDraft {
  return {
    name: drawing.name,
    type: drawing.type,
    date: drawing.date?.slice(0, 10) || todayYmd(),
    note: drawing.note ?? '',
    file: null,
  };
}

function buildDrawingRequest(
  draft: DrawingDraft,
): Omit<UpdateProjectDrawingRequest, 'sortOrder'> | { error: string } {
  const name = draft.name.trim();

  if (!name) {
    return { error: 'שם השרטוט הוא שדה חובה.' };
  }

  if (!draft.date) {
    return { error: 'יש לבחור תאריך.' };
  }

  return {
    name,
    type: draft.type,
    drawingDate: draft.date,
    note: draft.note.trim() || undefined,
  };
}

function formatFileSize(fileSizeBytes?: number): string {
  if (!fileSizeBytes) return '';
  if (fileSizeBytes < 1024 * 1024) {
    return `${Math.round(fileSizeBytes / 1024)} KB`;
  }
  return `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadDrawing(drawing: ProjectDrawing) {
  const blob = await downloadProjectDrawingFileAsync(drawing.projectId, drawing.projectDrawingId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = drawing.originalFileName ?? drawing.name;
  link.click();
  URL.revokeObjectURL(url);
}

interface DrawingEditCardProps {
  drawing: ProjectDrawing;
  isSaving: boolean;
  onSave: (
    projectDrawingId: number,
    body: UpdateProjectDrawingRequest,
  ) => Promise<void>;
  onDelete: (projectDrawingId: number) => Promise<void>;
  onValidationError: (message: string) => void;
}

function DrawingEditCard({
  drawing,
  isSaving,
  onSave,
  onDelete,
  onValidationError,
}: DrawingEditCardProps) {
  const [draft, setDraft] = useState<DrawingDraft>(() => draftFromDrawing(drawing));

  const saveDrawing = async () => {
    const request = buildDrawingRequest(draft);

    if ('error' in request) {
      onValidationError(request.error);
      return;
    }

    await onSave(drawing.projectDrawingId, {
      ...request,
      sortOrder: drawing.sortOrder,
    });
  };

  return (
    <div className="projectDrawingsTab__editCard">
      <Input
        label="שם"
        value={draft.name}
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
      />
      <label className="projectDrawingsTab__field">
        <span>סוג</span>
        <select
          className="projectDrawingsTab__select"
          value={draft.type}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              type: event.target.value as 'PDF' | 'DWG',
            }))
          }
        >
          <option value="PDF">PDF</option>
          <option value="DWG">DWG</option>
        </select>
      </label>
      <Input
        label="תאריך"
        type="date"
        value={draft.date}
        onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
      />
      <Input
        label="הערה"
        value={draft.note}
        onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
      />
      {drawing.originalFileName && (
        <div className="projectDrawingsTab__fileMeta">
          <span>{drawing.originalFileName}</span>
          {drawing.fileSizeBytes && <span>{formatFileSize(drawing.fileSizeBytes)}</span>}
        </div>
      )}
      <div className="projectDrawingsTab__actions">
        <Button type="button" variant="secondary" onClick={saveDrawing} disabled={isSaving}>
          שמור שרטוט
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => downloadDrawing(drawing)}
          disabled={isSaving || !drawing.filePath}
        >
          הורד קובץ
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onDelete(drawing.projectDrawingId)}
          disabled={isSaving}
        >
          הסר
        </Button>
      </div>
    </div>
  );
}

export function ProjectDrawingsTab({
  drawings,
  isEditMode,
  isSaving,
  onCreate,
  onUpload,
  onUpdate,
  onDelete,
}: ProjectDrawingsTabProps) {
  const [newDrawingDraft, setNewDrawingDraft] = useState<DrawingDraft>({
    name: '',
    type: 'PDF',
    date: todayYmd(),
    note: '',
    file: null,
  });
  const [error, setError] = useState<string | null>(null);

  const addDrawing = async () => {
    const request = buildDrawingRequest(newDrawingDraft);

    if ('error' in request) {
      setError(request.error);
      return;
    }

    setError(null);
    if (newDrawingDraft.file) {
      await onUpload({
        ...request,
        sortOrder: drawings.length + 1,
        file: newDrawingDraft.file,
      });
    } else {
      await onCreate({
        ...request,
        sortOrder: drawings.length + 1,
      });
    }

    setNewDrawingDraft({
      name: '',
      type: 'PDF',
      date: todayYmd(),
      note: '',
      file: null,
    });
  };

  if (isEditMode) {
    return (
      <div className="projectDrawingsTab">
        {error && <div className="projectDrawingsTab__error">{error}</div>}
        <div className="projectDrawingsTab__editList">
          {drawings.map((drawing) => (
            <DrawingEditCard
              key={`${drawing.projectDrawingId}-${drawing.updatedAt ?? drawing.createdAt ?? ''}`}
              drawing={drawing}
              isSaving={isSaving}
              onSave={onUpdate}
              onDelete={onDelete}
              onValidationError={setError}
            />
          ))}
          {drawings.length === 0 && (
            <EmptyState
              title="אין שרטוטים לפרויקט"
              description="הוסף מטא-דאטה של שרטוטים כדי לשמור אותו במסד הנתונים."
            />
          )}
        </div>

        <div className="projectDrawingsTab__addForm">
          <Input
            label="שם"
            value={newDrawingDraft.name}
            onChange={(event) =>
              setNewDrawingDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
          <label className="projectDrawingsTab__field">
            <span>סוג</span>
            <select
              className="projectDrawingsTab__select"
              value={newDrawingDraft.type}
              onChange={(event) =>
                setNewDrawingDraft((current) => ({
                  ...current,
                  type: event.target.value as 'PDF' | 'DWG',
                }))
              }
            >
              <option value="PDF">PDF</option>
              <option value="DWG">DWG</option>
            </select>
          </label>
          <Input
            label="תאריך"
            type="date"
            value={newDrawingDraft.date}
            onChange={(event) =>
              setNewDrawingDraft((current) => ({ ...current, date: event.target.value }))
            }
          />
          <Input
            label="הערה"
            value={newDrawingDraft.note}
            onChange={(event) =>
              setNewDrawingDraft((current) => ({ ...current, note: event.target.value }))
            }
          />
          <label className="projectDrawingsTab__field">
            <span>קובץ PDF/DWG</span>
            <input
              className="projectDrawingsTab__fileInput"
              type="file"
              accept=".pdf,.dwg"
              onChange={(event) =>
                setNewDrawingDraft((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))
              }
            />
          </label>
          <Button type="button" variant="secondary" onClick={addDrawing} disabled={isSaving}>
            {newDrawingDraft.file ? 'העלה שרטוט' : 'הוסף שרטוט'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="projectDrawingsTab">
      {drawings.length === 0 && (
        <EmptyState title="אין שרטוטים לפרויקט" description="שרטוטים שיוגדרו יופיעו כאן." />
      )}
      {drawings.length > 0 && (
        <div className="projectDrawingsTab__viewList">
          {drawings.map((drawing) => (
            <div key={drawing.projectDrawingId} className="projectDrawingsTab__card">
              <strong>{drawing.name}</strong>
              <span>{drawing.type}</span>
              <span>{formatProjectDate(drawing.date)}</span>
              {drawing.originalFileName && (
                <span>
                  {drawing.originalFileName}
                  {drawing.fileSizeBytes ? ` · ${formatFileSize(drawing.fileSizeBytes)}` : ''}
                </span>
              )}
              {drawing.note && <p>{drawing.note}</p>}
              <Button
                type="button"
                variant="ghost"
                onClick={() => downloadDrawing(drawing)}
                disabled={!drawing.filePath}
              >
                הורד קובץ
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
