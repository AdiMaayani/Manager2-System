import { Badge } from '@shared/components/Badge';
import { AddressValidationStatuses } from '../../types';
import './ValidatedAddressDisplay.css';

interface ValidatedAddressDisplayProps {
  formattedAddress?: string | null;
  validationStatus?: string | null;
  showMissingWarning?: boolean;
}

function getStatusLabel(status?: string | null): string {
  switch (status) {
    case AddressValidationStatuses.Validated:
      return 'כתובת מאומתת';
    case AddressValidationStatuses.Typed:
      return 'טקסט חופשי';
    case AddressValidationStatuses.Stale:
      return 'נדרש אימות מחדש';
    case AddressValidationStatuses.Invalid:
      return 'כתובת לא תקינה';
    default:
      return 'ללא פרופיל גיאוגרפי';
  }
}

function getStatusVariant(status?: string | null): 'success' | 'warning' | 'neutral' | 'danger' {
  if (status === AddressValidationStatuses.Validated) return 'success';
  if (status === AddressValidationStatuses.Invalid) return 'danger';
  if (status === AddressValidationStatuses.Stale) return 'warning';
  return 'neutral';
}

export function ValidatedAddressDisplay({
  formattedAddress,
  validationStatus,
  showMissingWarning = true,
}: ValidatedAddressDisplayProps) {
  const isMissing = !validationStatus || validationStatus !== AddressValidationStatuses.Validated;

  return (
    <div className="validatedAddressDisplay">
      <div className="validatedAddressDisplay__row">
        <span className="validatedAddressDisplay__text">
          {formattedAddress?.trim() || 'לא הוזנה כתובת מאומתת'}
        </span>
        <Badge variant={getStatusVariant(validationStatus)}>{getStatusLabel(validationStatus)}</Badge>
      </div>
      {showMissingWarning && isMissing && (
        <p className="validatedAddressDisplay__warning" role="status">
          לא קיימת כתובת מאומתת לאתר זה. ניתן להמשיך, אך חישוב מרחק/נסיעה עלול להיות חסר.
        </p>
      )}
    </div>
  );
}
