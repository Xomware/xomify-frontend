import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FavoriteCategory } from 'src/app/services/favorites.service';

export interface NewListPayload {
  category: FavoriteCategory;
  genreLabel: string;
}

const MAX_LABEL_LENGTH = 60;

/**
 * "+ New list" modal — picks a category (song/album/artist) and a free-form
 * genre label ("Top Rap Albums"). Same accessible-dialog pattern as the
 * other Favorites modals (focus trap, Esc/backdrop close, focus restore).
 */
@Component({
  selector: 'app-favorites-new-list-modal',
  templateUrl: './favorites-new-list-modal.component.html',
  styleUrls: ['./favorites-new-list-modal.component.scss'],
})
export class FavoritesNewListModalComponent implements AfterViewInit {
  @Input() saving = false;
  @Output() created = new EventEmitter<NewListPayload>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLElement>;
  @ViewChild('labelInput') labelInputRef?: ElementRef<HTMLInputElement>;

  category: FavoriteCategory = 'songs';
  genreLabel = '';
  readonly maxLabelLength = MAX_LABEL_LENGTH;

  private previouslyFocused: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => this.labelInputRef?.nativeElement.focus());
  }

  get trimmedLabel(): string {
    return this.genreLabel.trim();
  }

  get isValid(): boolean {
    return this.trimmedLabel.length > 0 && this.trimmedLabel.length <= this.maxLabelLength;
  }

  submit(): void {
    if (!this.isValid || this.saving) return;
    this.created.emit({ category: this.category, genreLabel: this.trimmedLabel });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.saving) this.requestClose();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving) this.requestClose();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusables = this.focusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  requestClose(): void {
    this.previouslyFocused?.focus?.();
    this.closed.emit();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialogRef?.nativeElement;
    if (!root) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }
}
