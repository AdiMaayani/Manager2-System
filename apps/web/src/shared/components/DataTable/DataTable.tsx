import type { KeyboardEvent, ReactNode } from 'react';
import { PageSpinner } from '../PageSpinner';
import { EmptyState } from '../EmptyState';
import './DataTable.css';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  /** CSS width (e.g. "20%", "120px"). */
  width?: string;
  align?: 'start' | 'center' | 'end';
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  isLoading?: boolean;
  /** Empty-state title shown when there are no rows and not loading. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Forces horizontal scroll below this width. */
  minWidth?: number;
}

/**
 * One canonical table for every list screen: consistent header, row height,
 * hover, selected accent (RTL-safe), keyboard-accessible clickable rows,
 * horizontal scroll, and built-in loading/empty states.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  selectedRowId = null,
  isLoading = false,
  emptyTitle = 'לא נמצאו תוצאות',
  emptyDescription,
  minWidth = 880,
}: DataTableProps<T>) {
  if (isLoading) {
    return <PageSpinner />;
  }

  if (rows.length === 0) {
    return (
      <div className="dataTable__wrap">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="dataTable__wrap">
      <div className="dataTable__scroll">
        <table className="dataTable" style={{ minWidth: `${minWidth}px` }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`dataTable__th dataTable__cell--${column.align ?? 'start'}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selectedRowId != null && rowId === selectedRowId;
              const isClickable = Boolean(onRowClick);
              return (
                <tr
                  key={rowId}
                  className={`dataTable__row ${isClickable ? 'dataTable__row--clickable' : ''} ${
                    isSelected ? 'dataTable__row--selected' : ''
                  }`.trim()}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={isClickable ? (event) => handleKeyDown(event, row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`dataTable__td dataTable__cell--${column.align ?? 'start'}`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
