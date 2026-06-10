import { Button } from '@shared/components/Button';
import { formatCurrency } from '../../utils/format';
import './QuoteLineItemsEditor.css';

export interface QuoteLineFormState {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const UNIT_OPTIONS = ['יח׳', 'מ׳', 'ק״ג', 'סט', 'שעה', 'קומפלט'];

interface QuoteLineItemsEditorProps {
  lineItems: QuoteLineFormState[];
  onAddLine: () => void;
  onChangeLine: (index: number, field: keyof QuoteLineFormState, value: string) => void;
  onRemoveLine: (index: number) => void;
}

function computeLineTotal(line: QuoteLineFormState): number {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function QuoteLineItemsEditor({
  lineItems,
  onAddLine,
  onChangeLine,
  onRemoveLine,
}: QuoteLineItemsEditorProps) {
  return (
    <div className="quoteLineItemsEditor">
      {/* The section title is provided by the wrapping DetailsSection card. */}
      <div className="quoteLineItemsEditor__header">
        <Button variant="secondary" onClick={onAddLine}>
          + הוסף שורה
        </Button>
      </div>

      {lineItems.length === 0 ? (
        <p className="quoteLineItemsEditor__empty">לא נוספו שורות. הוסיפו שורת תמחור ראשונה.</p>
      ) : (
        <div className="quoteLineItemsEditor__tableWrap">
          <table className="quoteLineItemsEditor__table">
            <thead>
              <tr>
                <th className="quoteLineItemsEditor__descCol">תיאור</th>
                <th>כמות</th>
                <th>יחידה</th>
                <th>מחיר יחידה</th>
                <th>סה״כ שורה</th>
                <th aria-label="פעולות" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="quoteLineItemsEditor__input"
                      value={line.description}
                      placeholder="תיאור הפריט"
                      onChange={(event) => onChangeLine(index, 'description', event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="quoteLineItemsEditor__input quoteLineItemsEditor__input--num"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(event) => onChangeLine(index, 'quantity', event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="quoteLineItemsEditor__input quoteLineItemsEditor__input--unit"
                      list="quoteLineUnitOptions"
                      value={line.unit}
                      onChange={(event) => onChangeLine(index, 'unit', event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="quoteLineItemsEditor__input quoteLineItemsEditor__input--num"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) => onChangeLine(index, 'unitPrice', event.target.value)}
                    />
                  </td>
                  <td className="quoteLineItemsEditor__lineTotal">
                    {formatCurrency(computeLineTotal(line))}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="quoteLineItemsEditor__remove"
                      onClick={() => onRemoveLine(index)}
                      aria-label="מחק שורה"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="quoteLineUnitOptions">
            {UNIT_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
