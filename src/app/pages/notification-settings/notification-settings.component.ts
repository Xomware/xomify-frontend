import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  DevicePlatform,
  NotificationsService,
} from 'src/app/services/notifications.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

type Mode = 'unregister' | 'register';

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss'],
})
export class NotificationSettingsComponent implements OnInit {
  mode: Mode = 'unregister';

  currentEmail = '';

  deviceTokenInput = '';
  platformInput: DevicePlatform = 'ios';

  submitting = false;

  constructor(
    private notificationsService: NotificationsService,
    private toastService: ToastService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.currentEmail = this.userService.getEmail();
  }

  switchMode(mode: Mode): void {
    this.mode = mode;
  }

  unregister(): void {
    if (this.submitting) return;

    const token = (this.deviceTokenInput || '').trim();
    if (!token) {
      this.toastService.showNegativeToast('Enter a device token');
      return;
    }
    if (!this.currentEmail) {
      this.toastService.showNegativeToast('Sign in to manage notifications');
      return;
    }

    this.submitting = true;
    this.notificationsService
      .unregisterDevice(this.currentEmail, token)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.deviceTokenInput = '';
          this.toastService.showPositiveToast('Device unregistered');
        },
        error: (err) => {
          console.error('Error unregistering device:', err);
          this.submitting = false;
          this.toastService.showNegativeToast('Could not unregister device');
        },
      });
  }

  register(): void {
    if (this.submitting) return;

    const token = (this.deviceTokenInput || '').trim();
    if (!token) {
      this.toastService.showNegativeToast('Enter a device token');
      return;
    }
    if (!this.currentEmail) {
      this.toastService.showNegativeToast('Sign in to manage notifications');
      return;
    }

    this.submitting = true;
    this.notificationsService
      .registerDevice(this.currentEmail, token, this.platformInput)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.deviceTokenInput = '';
          this.toastService.showPositiveToast('Device registered');
        },
        error: (err) => {
          console.error('Error registering device:', err);
          this.submitting = false;
          this.toastService.showNegativeToast('Could not register device');
        },
      });
  }
}
