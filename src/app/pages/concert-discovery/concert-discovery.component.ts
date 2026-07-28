import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import {
  ConcertDiscoveryService,
  ArtistConcerts,
  ConcertEvent,
} from 'src/app/services/concert-discovery.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-concert-discovery',
  templateUrl: './concert-discovery.component.html',
  styleUrls: ['./concert-discovery.component.scss'],
})
export class ConcertDiscoveryComponent implements OnInit {
  loading = true;
  error = '';
  allConcerts: ArtistConcerts[] = [];
  filteredConcerts: ArtistConcerts[] = [];
  allEvents: ConcertEvent[] = [];
  selectedDays = 180;
  dayOptions = [30, 60, 90, 180];

  constructor(
    private concertService: ConcertDiscoveryService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadConcerts();
  }

  loadConcerts(): void {
    this.loading = true;
    this.error = '';

    this.concertService
      .getConcertsForTopArtists()
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          this.allConcerts = data;
          this.applyFilter();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading concerts:', err);
          this.error = 'Failed to load concert data. Please try again.';
          this.loading = false;
        },
      });
  }

  applyFilter(): void {
    this.filteredConcerts = this.concertService.filterByDateRange(
      this.allConcerts,
      this.selectedDays
    );
    // Flatten all events sorted by date
    this.allEvents = this.filteredConcerts
      .flatMap((ac) => ac.events)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  onFilterChange(days: number): void {
    this.selectedDays = days;
    this.applyFilter();
  }

  toggleNotify(event: ConcertEvent): void {
    event.notifyMe = this.concertService.toggleNotification(event.id);
    const msg = event.notifyMe
      ? `You'll be notified about ${event.eventName}`
      : `Notification removed for ${event.eventName}`;
    this.toastService.showPositiveToast(msg);
  }

  formatDate(date: string): string {
    return this.concertService.formatDate(date);
  }

  formatTime(time?: string): string {
    return this.concertService.formatTime(time);
  }

  get totalShows(): number {
    return this.allEvents.length;
  }

  get artistsWithShows(): number {
    return this.filteredConcerts.filter((ac) => ac.hasShows).length;
  }

  refresh(): void {
    this.loadConcerts();
  }
}
