import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  AcceptInviteResponse,
  CreateInviteResponse,
  Invite,
  InvitesService,
} from 'src/app/services/invites.service';
import { ShareService } from 'src/app/services/share.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

type InvitesTab = 'outstanding' | 'accept';

@Component({
  selector: 'app-invites',
  templateUrl: './invites.component.html',
  styleUrls: ['./invites.component.scss'],
})
export class InvitesComponent implements OnInit, OnDestroy {
  activeTab: InvitesTab = 'outstanding';

  loading = true;
  error: string | null = null;

  currentEmail = '';
  invites: Invite[] = [];

  // UI flags keyed by inviteCode so multiple rows can act independently.
  copyingCode: Record<string, boolean> = {};
  sharingCode: Record<string, boolean> = {};
  revokingCode: Record<string, boolean> = {};

  // Create / accept flows
  creating = false;
  accepting = false;
  acceptCodeInput = '';
  lastCreated: CreateInviteResponse | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private invitesService: InvitesService,
    private shareService: ShareService,
    private toastService: ToastService,
    private userService: UserService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.currentEmail = this.userService.getEmail();

    // Subscribe to the cache so mutations (create, hideLocally) reflect
    // without an extra round trip.
    const sub = this.invitesService.pendingInvites$.subscribe((invites) => {
      this.invites = invites;
    });
    this.subscriptions.push(sub);

    this.loadPending();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  // ============================================
  // Tabs
  // ============================================

  switchTab(tab: InvitesTab): void {
    this.activeTab = tab;
  }

  // ============================================
  // Load
  // ============================================

  loadPending(): void {
    if (!this.currentEmail) {
      this.loading = false;
      this.error = 'Sign in to view your invites.';
      return;
    }

    this.loading = true;
    this.error = null;

    this.invitesService
      .listPending(this.currentEmail)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading invites:', err);
          this.loading = false;
          this.error = 'Failed to load invites. Please try again.';
        },
      });
  }

  refresh(): void {
    this.loadPending();
  }

  // ============================================
  // Create invite
  // ============================================

  createInvite(): void {
    if (this.creating || !this.currentEmail) return;

    this.creating = true;
    this.invitesService
      .createInvite(this.currentEmail)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.lastCreated = resp;
          this.creating = false;
          this.toastService.showPositiveToast('Invite created');
          // Prime the user for sharing immediately.
          void this.shareCreatedLink(resp);
        },
        error: (err) => {
          console.error('Error creating invite:', err);
          this.creating = false;
          this.toastService.showNegativeToast('Could not create invite');
        },
      });
  }

  private async shareCreatedLink(resp: CreateInviteResponse): Promise<void> {
    const title = 'Join me on Xomify';
    const text = `I made a Xomify invite for you — use code ${resp.inviteCode} to become friends.`;
    await this.shareService.share({ title, text, url: resp.inviteUrl });
  }

  // ============================================
  // Row actions
  // ============================================

  trackByInviteCode(_index: number, invite: Invite): string {
    return invite.inviteCode;
  }

  async copyLink(invite: Invite, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.copyingCode[invite.inviteCode]) return;

    const link = invite.inviteUrl || invite.inviteCode;
    this.copyingCode[invite.inviteCode] = true;
    const ok = await this.shareService.copyToClipboard(link);
    this.copyingCode[invite.inviteCode] = false;

    if (ok) {
      this.toastService.showPositiveToast('Link copied');
    } else {
      this.toastService.showNegativeToast('Could not copy link');
    }
  }

  async shareInvite(invite: Invite, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.sharingCode[invite.inviteCode]) return;

    this.sharingCode[invite.inviteCode] = true;
    try {
      await this.shareService.share({
        title: 'Join me on Xomify',
        text: `Use code ${invite.inviteCode} to become friends on Xomify.`,
        url: invite.inviteUrl || window.location.origin,
      });
    } finally {
      this.sharingCode[invite.inviteCode] = false;
    }
  }

  /**
   * Client-only "revoke" — the backend has no invites_revoke endpoint yet
   * and invites_decline rejects self-decline. We hide the row locally and
   * lean on the 30-day expiry. See PR body for follow-up tracking.
   */
  revokeLocally(invite: Invite, event?: Event): void {
    event?.stopPropagation();
    if (this.revokingCode[invite.inviteCode]) return;

    this.revokingCode[invite.inviteCode] = true;
    this.invitesService.hideLocally(invite.inviteCode);
    this.revokingCode[invite.inviteCode] = false;
    this.toastService.showPositiveToast(
      'Hidden from your list — it will fully expire on its own',
    );
  }

  // ============================================
  // Accept code
  // ============================================

  acceptInvite(): void {
    if (this.accepting) return;

    const code = (this.acceptCodeInput || '').trim();
    if (!code) {
      this.toastService.showNegativeToast('Enter an invite code');
      return;
    }
    if (!this.currentEmail) {
      this.toastService.showNegativeToast('Sign in to accept an invite');
      return;
    }

    this.accepting = true;
    this.invitesService
      .acceptInvite(this.currentEmail, code)
      .pipe(take(1))
      .subscribe({
        next: (resp: AcceptInviteResponse) => {
          this.accepting = false;
          this.acceptCodeInput = '';
          this.toastService.showPositiveToast(
            `You are now friends with ${resp.senderEmail}`,
          );
          this.router.navigate(['/friend', resp.senderEmail]);
        },
        error: (err) => {
          console.error('Error accepting invite:', err);
          this.accepting = false;
          const msg =
            (err?.error?.message as string) ||
            'Could not accept invite. Double-check the code.';
          this.toastService.showNegativeToast(msg);
        },
      });
  }

  // ============================================
  // Formatting helpers
  // ============================================

  formatDate(iso: string | undefined): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  expiresLabel(invite: Invite): string {
    if (!invite.expiresAt) return '';
    const expires = new Date(invite.expiresAt).getTime();
    const now = Date.now();
    const diffMs = expires - now;
    if (diffMs <= 0) return 'Expired';

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days >= 1) return `Expires in ${days} day${days === 1 ? '' : 's'}`;
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours >= 1) return `Expires in ${hours} hr${hours === 1 ? '' : 's'}`;
    return 'Expires soon';
  }

  isExpired(invite: Invite): boolean {
    if (!invite.expiresAt) return false;
    return new Date(invite.expiresAt).getTime() <= Date.now();
  }
}
