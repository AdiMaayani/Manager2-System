import { useState } from 'react';
import { FALLBACK_CATEGORY_IMAGE } from '../../utils/categoryImages';
import './InventoryImage.css';

export type InventoryImageVariant = 'category' | 'card' | 'drawer';

interface InventoryImageProps {
  src?: string | null;
  alt: string;
  variant?: InventoryImageVariant;
  fallbackSrc?: string;
  // Drawer/above-the-fold imagery loads eagerly; grids default to lazy to keep lists light.
  eager?: boolean;
}

// Presentational image wrapper with a fixed aspect-ratio box, object-fit cover,
// and graceful fallback so the UI never shows a broken-image state.
export function InventoryImage({
  src,
  alt,
  variant = 'card',
  fallbackSrc = FALLBACK_CATEGORY_IMAGE,
  eager = false,
}: InventoryImageProps) {
  const primarySrc = src && src.trim() ? src : fallbackSrc;
  // Tracks which url failed to load so we can derive the displayed source during render
  // (no effect needed). When `src` changes, `primarySrc` changes and the fallback resets.
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const currentSrc =
    erroredSrc === primarySrc && primarySrc !== fallbackSrc ? fallbackSrc : primarySrc;

  return (
    <div className={`inventoryImage inventoryImage--${variant}`}>
      <img
        className="inventoryImage__img"
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onError={() => {
          if (currentSrc !== fallbackSrc) {
            setErroredSrc(primarySrc);
          }
        }}
      />
    </div>
  );
}
