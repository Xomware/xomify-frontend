import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BroadcastBannerComponent } from './broadcast-banner.component';
import { Broadcast } from 'src/app/services/broadcasts.service';

describe('BroadcastBannerComponent', () => {
  let component: BroadcastBannerComponent;
  let fixture: ComponentFixture<BroadcastBannerComponent>;

  const broadcasts: Broadcast[] = [
    { id: 'b1', title: 'New feature', body: 'Check it out' },
    { id: 'b2', title: 'Another update', body: 'More info' },
  ];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      declarations: [BroadcastBannerComponent],
    });
    fixture = TestBed.createComponent(BroadcastBannerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows all broadcasts by default', () => {
    component.broadcasts = broadcasts;
    component.ngOnChanges({ broadcasts: {} as any });
    expect(component.visibleBroadcasts.length).toBe(2);
  });

  it('hides a broadcast once dismissed', () => {
    component.broadcasts = broadcasts;
    component.ngOnChanges({ broadcasts: {} as any });

    component.dismiss(broadcasts[0]);

    expect(component.visibleBroadcasts.length).toBe(1);
    expect(component.visibleBroadcasts[0].id).toBe('b2');
  });

  it('persists dismissals across component instances (localStorage)', () => {
    component.broadcasts = broadcasts;
    component.ngOnChanges({ broadcasts: {} as any });
    component.dismiss(broadcasts[0]);

    const fixture2 = TestBed.createComponent(BroadcastBannerComponent);
    const component2 = fixture2.componentInstance;
    component2.broadcasts = broadcasts;
    component2.ngOnChanges({ broadcasts: {} as any });

    expect(component2.visibleBroadcasts.length).toBe(1);
    expect(component2.visibleBroadcasts[0].id).toBe('b2');
  });
});
