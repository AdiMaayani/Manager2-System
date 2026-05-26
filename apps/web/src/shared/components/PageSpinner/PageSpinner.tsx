import { Spinner } from '../Spinner';
import './PageSpinner.css';

export function PageSpinner() {
  return (
    <div className="pageSpinner">
      <Spinner size="lg" />
    </div>
  );
}
