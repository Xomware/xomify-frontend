import { Pipe, PipeTransform } from '@angular/core';

/**
 * Shared timestamp formatting for the Admin Portal — replaces four
 * near-identical `humanTs`/`humanDate` component methods (health/users/
 * crons/notifications panels all had their own copy). Dom's density ask
 * ("real timestamps absolute + relative") wants both, so this renders
 * `Jul 28, 2:14 PM · 2h ago` by default; pass `'absolute'` or `'relative'`
 * for just one half where table width is tight.
 */
export type AxTimestampMode = 'full' | 'absolute' | 'relative';

@Pipe({ name: 'axTimestamp' })
export class AxTimestampPipe implements PipeTransform {
  transform(iso: string | null | undefined, mode: AxTimestampMode = 'full'): string {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return String(iso);

    if (mode === 'absolute') return absolute(ms);
    if (mode === 'relative') return relative(ms);
    return `${absolute(ms)} · ${relative(ms)}`;
  }
}

function absolute(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relative(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}
