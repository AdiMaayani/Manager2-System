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
        <button className="errorState__retry" onClick={onRetry} type="button">
          נסה שוב
        </button>
      )}
    </div>
  );
}
