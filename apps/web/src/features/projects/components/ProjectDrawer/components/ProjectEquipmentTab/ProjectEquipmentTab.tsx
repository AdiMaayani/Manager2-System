import { useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { ProjectEquipmentItem } from '../../../../types';
import { EQUIPMENT_STATUS_OPTIONS } from '../../../../utils/projectDisplayUtils';
import './ProjectEquipmentTab.css';

interface ProjectEquipmentTabProps {
  items: ProjectEquipmentItem[];
  isEditMode: boolean;
  onChange: (items: ProjectEquipmentItem[]) => void;
}

function getEquipmentStatusLabel(status: string): string {
  return EQUIPMENT_STATUS_OPTIONS.find((option) => option.code === status)?.display ?? status;
}

export function ProjectEquipmentTab({
  items,
  isEditMode,
  onChange,
}: ProjectEquipmentTabProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('waiting');
  const [location, setLocation] = useState('');

  const updateItem = (id: string, patch: Partial<ProjectEquipmentItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    onChange(nextItems);
  };

  const addItem = () => {
    if (!name.trim()) return;

    onChange([
      ...items,
      {
        id: `eq-${Date.now()}`,
        name: name.trim(),
        status,
        location: location.trim(),
      },
    ]);

    setName('');
    setStatus('waiting');
    setLocation('');
  };

  if (isEditMode) {
    return (
      <div className="projectEquipmentTab">
        <div className="projectEquipmentTab__editList">
          {items.map((item, index) => (
            <div key={item.id} className="projectEquipmentTab__editCard">
              <Input
                label="שם"
                value={item.name}
                onChange={(event) => updateItem(item.id, { name: event.target.value })}
              />
              <label className="projectEquipmentTab__field">
                <span>סטטוס</span>
                <select
                  className="projectEquipmentTab__select"
                  value={item.status}
                  onChange={(event) => updateItem(item.id, { status: event.target.value })}
                >
                  {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="מיקום"
                value={item.location}
                onChange={(event) => updateItem(item.id, { location: event.target.value })}
              />
              <div className="projectEquipmentTab__actions">
                <Button type="button" variant="ghost" onClick={() => moveItem(index, -1)}>
                  למעלה
                </Button>
                <Button type="button" variant="ghost" onClick={() => moveItem(index, 1)}>
                  למטה
                </Button>
                <Button type="button" variant="ghost" onClick={() => removeItem(item.id)}>
                  הסר
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="projectEquipmentTab__addForm">
          <Input label="שם" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="projectEquipmentTab__field">
            <span>סטטוס</span>
            <select
              className="projectEquipmentTab__select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.display}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="מיקום"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addItem}>
            הוסף פריט
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="projectEquipmentTab">
      <table className="projectEquipmentTab__table">
        <thead>
          <tr>
            <th>מערכת / פריט</th>
            <th>מיקום</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.location || '-'}</td>
              <td>
                <Badge variant="primary">{getEquipmentStatusLabel(item.status)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
