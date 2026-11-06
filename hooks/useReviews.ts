'use client';

import { useCallback, useEffect, useState } from 'react';
import { EMPTY_REVIEW, type Review, type Reviews } from '@/lib/ui/review';

/**
 * Review status + notes per flagged row, saved in this browser only (never uploaded).
 * Keyed by file name and size so re-opening the same workbook restores the work.
 */
export function useReviews(fileName: string, sizeBytes: number) {
  const storageKey = `finpulse:reviews:${fileName}:${sizeBytes}`;
  const [reviews, setReviews] = useState<Reviews>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setReviews(raw ? (JSON.parse(raw) as Reviews) : {});
    } catch {
      setReviews({});
    }
  }, [storageKey]);

  const update = useCallback(
    (key: string, patch: Partial<Omit<Review, 'updatedAt'>>) => {
      setReviews((prev) => {
        const next: Reviews = {
          ...prev,
          [key]: { ...EMPTY_REVIEW, ...prev[key], ...patch, updatedAt: new Date().toISOString() },
        };
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage full or blocked (private mode): reviews still work for this session.
        }
        return next;
      });
    },
    [storageKey],
  );

  const get = useCallback((key: string): Review => reviews[key] ?? EMPTY_REVIEW, [reviews]);

  return { reviews, get, update };
}
