import { Button } from '../Button';
import './ErrorState.css';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'אירעה שגיאה בלתי צפויה.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="errorState" role="alert">
      <p className="errorState__message">{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} type="button">
          נסה שוב
        </Button>
      )}
    </div>
  );
}
