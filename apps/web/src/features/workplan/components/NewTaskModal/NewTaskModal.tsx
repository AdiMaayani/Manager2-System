import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { isLocalDataMode } from '@/config/appConfig';
import { assignEmployeeToWorkItemAsync, createWorkItemAsync } from '../../api/workplanApiClient';
import type { WorkPlanProjectFilter } from '../../types';
import './NewTaskModal.css';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectFilter: WorkPlanProjectFilter;
  defaultProjectId?: number | null;
}

export function NewTaskModal({
  isOpen,
  onClose,
  projectFilter,
  defaultProjectId,
}: NewTaskModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parentId =
    typeof projectFilter === 'number'
      ? projectFilter
      : defaultProjectId ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('יש להזין כותרת משימה');
      if (!parentId) throw new Error('יש לבחור פרויקט לפני יצירת משימה');

      if (!isLocalDataMode) {
        await new Promise((r) => setTimeout(r, 300));
        return { ok: true };
      }

      const created = (await createWorkItemAsync({
        title: title.trim(),
        status: 'מתוכנן',
        billingType: 'שעתי',
        customerId: 1,
        siteId: 1,
        parentWorkItemId: parentId,
      })) as { workItemId?: number };

      const workItemId = created?.workItemId;
      if (workItemId && employeeId) {
        await assignEmployeeToWorkItemAsync(workItemId, {
          employeeId: Number(employeeId),
          assignmentRole: 'מבצע',
        });
      }

      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplan'] });
      setTitle('');
      setEmployeeId('');
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'יצירת המשימה נכשלה');
    },
  });

  function handleClose() {
    setError(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="משימה חדשה">
      <form
        className="newTaskModal"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {!parentId && (
          <p className="newTaskModal__hint">
            בחר פרויקט ספציפי (לא &quot;כל הפרויקטים&quot;) כדי ליצור משימה.
          </p>
        )}

        <Input
          label="כותרת משימה"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Input
          label="מזהה עובד לשיוך (אופציונלי)"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          type="number"
        />

        {error && <p className="newTaskModal__error">{error}</p>}

        <div className="newTaskModal__actions">
          <Button type="submit" disabled={mutation.isPending || !parentId}>
            {mutation.isPending ? 'שומר...' : 'צור משימה'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}
