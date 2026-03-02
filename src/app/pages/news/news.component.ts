import { Component, OnInit } from '@angular/core';
import { forkJoin, take } from 'rxjs';
import { ArtistService } from 'src/app/services/artist.service';
import { NewsService, NewsArticle } from 'src/app/services/news.service';
import { ToastService } from 'src/app/services/toast.service';

interface ArtistTab {
  name: string;
  id: string;
  imageUrl: string;
}

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
})
export class NewsComponent implements OnInit {
  loading = true;
  artists: ArtistTab[] = [];
  activeTab = 'all';
  articles: NewsArticle[] = [];
  skeletonItems = Array(6);

  // Map artist name to their image for fallback
  private artistImages = new Map<string, string>();
  // Store all articles per artist for "All" tab
  private artistArticles = new Map<string, NewsArticle[]>();

  constructor(
    private artistService: ArtistService,
    private newsService: NewsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadArtists();
  }

  private loadArtists(): void {
    const cached = this.artistService.getShortTermTopArtists();

    if (cached.length > 0) {
      this.setupArtistTabs(cached);
    } else {
      this.artistService
        .getTopArtists('short_term', 10)
        .pipe(take(1))
        .subscribe({
          next: (data) => {
            this.artistService.setShortTermTopArtists(data.items);
            this.setupArtistTabs(data.items);
          },
          error: () => {
            this.toastService.showNegativeToast('Error loading artists');
            this.loading = false;
          },
        });
    }
  }

  private setupArtistTabs(artists: any[]): void {
    // Take top 10 artists for tabs
    const topArtists = artists.slice(0, 10);
    this.artists = topArtists.map((a) => ({
      name: a.name,
      id: a.id,
      imageUrl: a.images?.[0]?.url || '',
    }));

    this.artists.forEach((a) => this.artistImages.set(a.name, a.imageUrl));
    this.selectTab('all');
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    this.loading = true;
    this.articles = [];

    if (tab === 'all') {
      this.loadAllNews();
    } else {
      this.loadArtistNews(tab);
    }
  }

  private loadAllNews(): void {
    const requests = this.artists.map((a) =>
      this.newsService.getArtistNews(a.name)
    );

    forkJoin(requests)
      .pipe(take(1))
      .subscribe({
        next: (results) => {
          results.forEach((articles, i) => {
            this.artistArticles.set(this.artists[i].name, articles);
          });

          // Take 2 per artist, merge, dedupe by URL, sort by date
          const merged: NewsArticle[] = [];
          const seenUrls = new Set<string>();

          for (const artist of this.artists) {
            const artistNews = this.artistArticles.get(artist.name) || [];
            let added = 0;
            for (const article of artistNews) {
              if (!seenUrls.has(article.url) && added < 2) {
                seenUrls.add(article.url);
                merged.push(article);
                added++;
              }
            }
          }

          merged.sort(
            (a, b) =>
              new Date(b.publishedAt).getTime() -
              new Date(a.publishedAt).getTime()
          );

          this.articles = merged;
          this.loading = false;
        },
        error: () => {
          this.toastService.showNegativeToast('Error loading news');
          this.loading = false;
        },
      });
  }

  private loadArtistNews(artistName: string): void {
    this.newsService
      .getArtistNews(artistName)
      .pipe(take(1))
      .subscribe({
        next: (articles) => {
          this.articles = articles;
          this.loading = false;
        },
        error: () => {
          this.toastService.showNegativeToast('Error loading news');
          this.loading = false;
        },
      });
  }

  getArtistImage(artistName: string): string {
    return this.artistImages.get(artistName) || '';
  }

  get activeArtistImage(): string {
    if (this.activeTab === 'all') return '';
    return this.artistImages.get(this.activeTab) || '';
  }
}
