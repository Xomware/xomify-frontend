import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { XomtracksAdminComponent } from './xomtracks-admin.component';

describe('XomtracksAdminComponent', () => {
  let component: XomtracksAdminComponent;
  let fixture: ComponentFixture<XomtracksAdminComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [XomtracksAdminComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(XomtracksAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults to the Users tab', () => {
    expect(component.activeTab).toBe('users');
  });

  it('setTab switches the active tab', () => {
    component.setTab('calls');
    expect(component.activeTab).toBe('calls');
  });

  it('viewAs() jumps to the View As tab pre-loaded with the given email', () => {
    component.viewAs('someone@example.com');
    expect(component.activeTab).toBe('viewas');
    expect(component.viewAsPresetEmail).toBe('someone@example.com');
  });
});
