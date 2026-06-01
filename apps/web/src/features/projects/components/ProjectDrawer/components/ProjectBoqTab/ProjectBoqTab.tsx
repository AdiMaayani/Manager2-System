import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { ProjectBoqRow } from '../../../../types';
import { BOQ_UNIT_OPTIONS } from '../../../../utils/projectDisplayUtils';
import './ProjectBoqTab.css';

interface ProjectBoqTabProps {
  rows: ProjectBoqRow[];
  isEditMode: boolean;
  onChange: (rows: ProjectBoqRow[]) => void;
}

export function ProjectBoqTab({ rows, isEditMode, onChange }: ProjectBoqTabProps) {
  const updateRow = (id: string, patch: Partial<ProjectBoqRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        id: `boq-${Date.now()}`,
        item: '',
        quantity: '1',
        unit: BOQ_UNIT_OPTIONS[0],
      },
    ]);
  };

  if (isEditMode) {
    return (
      <div className="projectBoqTab">
        <table className="projectBoqTab__table">
          <thead>
            <tr>
              <th>פריט</th>
              <th>כמות</th>
              <th>יחידה</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Input
                    value={row.item}
                    onChange={(event) => updateRow(row.id, { item: event.target.value })}
                  />
                </td>
                <td>
                  <Input
                    value={row.quantity}
                    onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="projectBoqTab__select"
                    value={row.unit}
                    onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  >
                    {BOQ_UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Button type="button" variant="ghost" onClick={() => removeRow(row.id)}>
                    הסר
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="button" variant="secondary" onClick={addRow}>
          הוסף שורה
        </Button>
      </div>
    );
  }

  return (
    <div className="projectBoqTab">
      <table className="projectBoqTab__table">
        <thead>
          <tr>
            <th>מערכת</th>
            <th>פריט</th>
            <th>כמות</th>
            <th>יחידה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.system || '-'}</td>
              <td>{row.item}</td>
              <td>{row.quantity}</td>
              <td>{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
