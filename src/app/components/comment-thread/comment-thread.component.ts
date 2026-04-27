import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { take } from 'rxjs/operators';
import {
  ShareComment,
  ShareFeedService,
} from 'src/app/services/share-feed.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

const COMMENT_PAGE_SIZE = 50;
const COMMENT_MAX_LENGTH = 500;

/**
 * Inline comment thread used inside `share-detail`. Mirrors
 * `Xomify-iOS/Views/Feed/ShareDetailView.swift:385-514` (composer + list +
 * delete-own). Owns its own load/post/delete state — the parent passes the
 * share id + author email so we can decide who's allowed to delete.
 */
@Component({
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.component.html',
  styleUrls: ['./comment-thread.component.scss'],
})
export class CommentThreadComponent implements OnInit, OnChanges {
  @Input() shareId!: string;
  /** Email of the share's author — they can delete any comment on the post. */
  @Input() shareAuthorEmail = '';
  /** Initial server-supplied count, used for the section heading badge. */
  @Input() initialCount = 0;

  /** Emits whenever the locally-known count changes (post or delete). */
  @Output() countChange = new EventEmitter<number>();

  comments: ShareComment[] = [];
  nextBefore: string | null = null;

  loading = false;
  loadError: string | null = null;

  draft = '';
  posting = false;
  postError: string | null = null;

  /** Set of commentIds currently being deleted, so each row disables on its own. */
  deletingIds = new Set<string>();

  readonly maxLength = COMMENT_MAX_LENGTH;

  private viewerEmail = '';
  /** Locally-tracked count: starts from initialCount, then mutates as the
   *  thread changes. Drives the section header badge in the parent. */
  private localCount = 0;

  constructor(
    private shareFeedService: ShareFeedService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.viewerEmail = this.userService.getEmail();
    this.localCount = this.initialCount;
    if (this.shareId) {
      this.loadFirstPage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['shareId'] && !changes['shareId'].firstChange) {
      // shareId swapped on the parent — restart from scratch.
      this.comments = [];
      this.nextBefore = null;
      this.loadError = null;
      this.localCount = this.initialCount;
      if (this.shareId) {
        this.loadFirstPage();
      }
    }
    if (changes['initialCount'] && this.comments.length === 0) {
      this.localCount = this.initialCount;
    }
  }

  // ============================================
  // Render helpers
  // ============================================

  get count(): number {
    // After the first load, use the actual list length so the badge stays
    // honest as the viewer posts/deletes; before that, fall back to the
    // server-supplied seed so the header doesn't read "0" while loading.
    if (this.comments.length > 0 || !this.loading) {
      return this.comments.length || this.localCount;
    }
    return this.localCount;
  }

  get canPost(): boolean {
    return !this.posting && this.draft.trim().length > 0;
  }

  get charCount(): number {
    return this.draft.length;
  }

  trackByCommentId(_index: number, comment: ShareComment): string {
    return comment.commentId;
  }

  authorOf(comment: ShareComment): string {
    return comment.displayName && comment.displayName.trim().length > 0
      ? comment.displayName
      : comment.email;
  }

  initialOf(comment: ShareComment): string {
    return this.authorOf(comment).charAt(0).toUpperCase() || '?';
  }

  /** Comment author OR share author may delete (same rule as the backend). */
  canDelete(comment: ShareComment): boolean {
    if (!this.viewerEmail) return false;
    return (
      comment.email === this.viewerEmail ||
      this.shareAuthorEmail === this.viewerEmail
    );
  }

  isDeleting(comment: ShareComment): boolean {
    return this.deletingIds.has(comment.commentId);
  }

  relativeTime(comment: ShareComment): string {
    if (!comment.createdAt) return '';
    const created = new Date(comment.createdAt).getTime();
    if (isNaN(created)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
    if (diffSec < 60) return 'just now';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(day / 365)}y ago`;
  }

  // ============================================
  // Actions
  // ============================================

  loadFirstPage(): void {
    if (this.loading) return;
    this.loading = true;
    this.loadError = null;

    this.shareFeedService
      .listComments(this.shareId, COMMENT_PAGE_SIZE)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.comments = resp.comments || [];
          this.nextBefore = resp.nextBefore || null;
          this.loading = false;
          this.localCount = this.comments.length;
          this.emitCount();
        },
        error: (err) => {
          console.error('Error loading comments:', err);
          this.loading = false;
          // Mirror iOS — backend currently 500s on threads that have never
          // had a comment, so don't drown the empty state in a banner.
          if (this.comments.length > 0) {
            this.loadError = 'Could not load comments.';
          }
        },
      });
  }

  postComment(): void {
    const trimmed = this.draft.trim();
    if (!trimmed || this.posting) return;
    if (trimmed.length > this.maxLength) {
      this.postError = `Comments are capped at ${this.maxLength} characters.`;
      return;
    }
    this.posting = true;
    this.postError = null;

    this.shareFeedService
      .createComment(this.shareId, trimmed)
      .pipe(take(1))
      .subscribe({
        next: (comment) => {
          this.posting = false;
          this.draft = '';
          // Newest-first — prepend.
          this.comments = [comment, ...this.comments];
          this.localCount = this.comments.length;
          this.emitCount();
        },
        error: (err) => {
          console.error('Error posting comment:', err);
          this.posting = false;
          this.postError = 'Could not post comment.';
          this.toastService.showNegativeToast('Could not post comment');
        },
      });
  }

  deleteComment(comment: ShareComment): void {
    if (!this.canDelete(comment) || this.deletingIds.has(comment.commentId)) {
      return;
    }
    this.deletingIds.add(comment.commentId);

    // Optimistic remove.
    const removeIndex = this.comments.findIndex(
      (c) => c.commentId === comment.commentId,
    );
    if (removeIndex < 0) {
      this.deletingIds.delete(comment.commentId);
      return;
    }
    const removed = this.comments[removeIndex];
    this.comments = this.comments.filter(
      (c) => c.commentId !== comment.commentId,
    );
    this.localCount = this.comments.length;
    this.emitCount();

    this.shareFeedService
      .deleteComment(this.shareId, comment.commentId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deletingIds.delete(comment.commentId);
        },
        error: (err) => {
          console.error('Error deleting comment:', err);
          this.deletingIds.delete(comment.commentId);
          // Rollback.
          const restored = [...this.comments];
          restored.splice(removeIndex, 0, removed);
          this.comments = restored;
          this.localCount = this.comments.length;
          this.emitCount();
          this.toastService.showNegativeToast('Could not delete comment');
        },
      });
  }

  private emitCount(): void {
    this.countChange.emit(this.count);
  }
}
