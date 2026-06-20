import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { MISSING_PRODUCT_IMAGE_LABEL } from '../../utils/productImages';
import './InventoryImage.css';

export type InventoryImageVariant = 'category' | 'card' | 'drawer';

interface InventoryImageProps {
  // Ordered candidate URLs, highest priority first. Each is tried in turn; falsy entries are
  // ignored. For products this is [uploadedImage, seededSkuImage] — never a category image.
  sources: (string | null | undefined)[];
  alt: string;
  variant?: InventoryImageVariant;
  // When every candidate fails (or none exist), render the explicit product missing-image state
  // instead of a blank box. Product cards/drawer set this; category imagery does not.
  showMissingState?: boolean;
  // Drawer/above-the-fold imagery loads eagerly; grids default to lazy to keep lists light.
  eager?: boolean;
}

// Presentational image wrapper with a fixed aspect-ratio box and object-fit cover. It walks the
// ordered `sources` on load failure and, once exhausted, renders an explicit missing state — it
// never substitutes an unrelated (e.g. category) image and never loops on errors.
export function InventoryImage({
  sources,
  alt,
  variant = 'card',
  showMissingState = false,
  eager = false,
}: InventoryImageProps) {
  const candidates = sources.filter(
    (source): source is string => typeof source === 'string' && source.trim().length > 0,
  );
  const candidatesKey = candidates.join('|');

  // Index of the candidate currently being attempted. Reset (during render, the supported React
  // pattern) whenever the candidate list changes, so a new item/upload starts from the top.
  const [failedKey, setFailedKey] = useState(candidatesKey);
  const [attemptIndex, setAttemptIndex] = useState(0);
  if (failedKey !== candidatesKey) {
    setFailedKey(candidatesKey);
    setAttemptIndex(0);
  }

  const currentSrc = candidates[attemptIndex];

  if (!currentSrc) {
    return (
      <div className={`inventoryImage inventoryImage--${variant}`}>
        {showMissingState && (
          <div className="inventoryImage__missing">
            <ImageOff size={28} aria-hidden="true" />
            <span>{MISSING_PRODUCT_IMAGE_LABEL}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`inventoryImage inventoryImage--${variant}`}>
      <img
        className="inventoryImage__img"
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        // Advance to the next candidate; once past the end, currentSrc becomes undefined and the
        // missing state renders. attemptIndex only increases, so there is no error loop.
        onError={() => setAttemptIndex((index) => index + 1)}
      />
    </div>
  );
}
