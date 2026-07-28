import { Injectable } from '@angular/core';

/**
 * Thin wrapper around `prefers-reduced-motion` so components don't each
 * re-implement the `matchMedia` check. Queried live (not cached) — cheap
 * call, and callers only read it when (re)starting a rotation timer, not on
 * every frame.
 */
@Injectable({
  providedIn: 'root',
})
export class ReducedMotionService {
  prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
