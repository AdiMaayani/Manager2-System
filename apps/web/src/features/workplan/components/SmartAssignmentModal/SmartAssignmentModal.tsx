import { useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { PageSpinner } from '@shared/components/PageSpinner';
import { fetchSmartAssignmentAsync } from '../../hooks/useWorkPlanData';
import type { SmartAssignmentResponse } from '../../types';
import './SmartAssignmentModal.css';

interface SmartAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number | null;
}

export function SmartAssignmentModal({ isOpen, onClose, projectId }: SmartAssignmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartAssignmentResponse | null>(null);

  async function handleRun() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchSmartAssignmentAsync(projectId);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת המלצות');
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="שיבוץ חכם">
      <div className="smartAssignmentModal">
        {!result && !isLoading && (
          <p className="smartAssignmentModal__intro">
            הרצת אלגוריתם שיבוץ עבור{' '}
            {projectId ? `פרויקט #${projectId}` : 'כל הפרויקטים הפעילים'}.
          </p>
        )}

        {isLoading && <PageSpinner />}

        {error && <p className="smartAssignmentModal__error">{error}</p>}

        {result && (
          <div className="smartAssignmentModal__results">
            <p className="smartAssignmentModal__summary">{result.summary.message}</p>
            <ul className="smartAssignmentModal__stats">
              <li>משימות: {result.summary.totalTasks}</li>
              <li>המלצות: {result.summary.tasksWithRecommendations}</li>
              <li>חריגות: {result.summary.violationsCount}</li>
              <li>אזהרות: {result.summary.warningsCount}</li>
            </ul>

            {result.taskResults.length > 0 && (
              <table className="smartAssignmentModal__table">
                <thead>
                  <tr>
                    <th>משימה</th>
                    <th>מומלץ</th>
                    <th>ציון</th>
                  </tr>
                </thead>
                <tbody>
                  {result.taskResults.map((row) => (
                    <tr key={row.workItemId}>
                      <td>{row.taskTitle}</td>
                      <td>{row.recommendedEmployeeName ?? '—'}</td>
                      <td>{Math.round(row.score * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {result.employeeLoad.length > 0 && (
              <div className="smartAssignmentModal__load">
                <h4>עומס עובדים</h4>
                <ul>
                  {result.employeeLoad.map((load) => (
                    <li key={load.employeeId}>
                      {load.employeeName}: {load.assignedHours}ש / {load.capacityHours ?? 8}ש (
                      {Math.round(load.loadPercentage)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="smartAssignmentModal__actions">
          {!result && (
            <Button type="button" onClick={handleRun} disabled={isLoading}>
              הרץ שיבוץ
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={handleClose}>
            סגור
          </Button>
        </div>
      </div>
    </Modal>
  );
}
