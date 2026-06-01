import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { ProjectDrawing } from '../../../../types';
import { formatProjectDate } from '../../../../utils/projectDisplayUtils';
import './ProjectDrawingsTab.css';

interface ProjectDrawingsTabProps {
  drawings: ProjectDrawing[];
  isEditMode: boolean;
  onChange: (drawings: ProjectDrawing[]) => void;
}

export function ProjectDrawingsTab({
  drawings,
  isEditMode,
  onChange,
}: ProjectDrawingsTabProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'PDF' | 'DWG'>('PDF');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');

  const removeDrawing = (id: string) => {
    onChange(drawings.filter((drawing) => drawing.id !== id));
  };

  const addDrawing = () => {
    if (!name.trim()) return;

    onChange([
      ...drawings,
      {
        id: `drawing-${Date.now()}`,
        name: name.trim(),
        type,
        date: date || new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
      },
    ]);

    setName('');
    setDate('');
    setNote('');
  };

  return (
    <div className="projectDrawingsTab">
      {isEditMode ? (
        <div className="projectDrawingsTab__editList">
          {drawings.map((drawing) => (
            <div key={drawing.id} className="projectDrawingsTab__card">
              <strong>{drawing.name}</strong>
              <span>{drawing.type}</span>
              <Button type="button" variant="ghost" onClick={() => removeDrawing(drawing.id)}>
                הסר
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="projectDrawingsTab__viewList">
          {drawings.map((drawing) => (
            <div key={drawing.id} className="projectDrawingsTab__card">
              <strong>{drawing.name}</strong>
              <span>{drawing.type}</span>
              <span>{formatProjectDate(drawing.date)}</span>
              {drawing.note && <p>{drawing.note}</p>}
            </div>
          ))}
        </div>
      )}

      {isEditMode && (
        <div className="projectDrawingsTab__addForm">
          <Input label="שם" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="projectDrawingsTab__field">
            <span>סוג</span>
            <select
              className="projectDrawingsTab__select"
              value={type}
              onChange={(event) => setType(event.target.value as 'PDF' | 'DWG')}
            >
              <option value="PDF">PDF</option>
              <option value="DWG">DWG</option>
            </select>
          </label>
          <Input
            label="תאריך"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input label="הערה" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="button" variant="secondary" onClick={addDrawing}>
            הוסף שרטוט
          </Button>
        </div>
      )}
    </div>
  );
}
