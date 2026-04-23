import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { NotificationSettingsComponent } from './notification-settings.component';
import { NotificationsService } from 'src/app/services/notifications.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';

describe('NotificationSettingsComponent', () => {
  let component: NotificationSettingsComponent;
  let fixture: ComponentFixture<NotificationSettingsComponent>;
  let notifications: jasmine.SpyObj<NotificationsService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    const notifSpy = jasmine.createSpyObj('NotificationsService', [
      'registerDevice',
      'unregisterDevice',
    ]);
    const toastSpy = jasmine.createSpyObj('ToastService', [
      'showPositiveToast',
      'showNegativeToast',
    ]);
    const userSpy = jasmine.createSpyObj('UserService', ['getEmail']);
    userSpy.getEmail.and.returnValue('dom@example.com');

    await TestBed.configureTestingModule({
      declarations: [NotificationSettingsComponent],
      imports: [HttpClientTestingModule, FormsModule],
      providers: [
        { provide: NotificationsService, useValue: notifSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: UserService, useValue: userSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    notifications = TestBed.inject(
      NotificationsService,
    ) as jasmine.SpyObj<NotificationsService>;
    toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

    fixture = TestBed.createComponent(NotificationSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('unregister calls unregisterDevice with trimmed token and toasts success', () => {
    notifications.unregisterDevice.and.returnValue(
      of({ ok: true, deviceToken: 'tok' }),
    );
    component.deviceTokenInput = '  tok  ';

    component.unregister();

    expect(notifications.unregisterDevice).toHaveBeenCalledWith(
      'dom@example.com',
      'tok',
    );
    expect(toast.showPositiveToast).toHaveBeenCalled();
    expect(component.deviceTokenInput).toBe('');
  });

  it('unregister rejects empty input without calling the service', () => {
    component.deviceTokenInput = '  ';
    component.unregister();

    expect(notifications.unregisterDevice).not.toHaveBeenCalled();
    expect(toast.showNegativeToast).toHaveBeenCalled();
  });

  it('register calls registerDevice with the chosen platform', () => {
    notifications.registerDevice.and.returnValue(
      of({ ok: true, deviceToken: 'tok' }),
    );
    component.deviceTokenInput = 'tok';
    component.platformInput = 'android';

    component.register();

    expect(notifications.registerDevice).toHaveBeenCalledWith(
      'dom@example.com',
      'tok',
      'android',
    );
    expect(toast.showPositiveToast).toHaveBeenCalled();
  });

  it('register surfaces backend errors through a negative toast', () => {
    notifications.registerDevice.and.returnValue(
      throwError(() => new Error('boom')),
    );
    component.deviceTokenInput = 'tok';

    component.register();

    expect(toast.showNegativeToast).toHaveBeenCalled();
    expect(component.submitting).toBe(false);
  });
});
