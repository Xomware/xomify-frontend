import { Component, Input } from '@angular/core';
import { NewsArticle } from 'src/app/services/news.service';

@Component({
  selector: 'app-news-card',
  templateUrl: './news-card.component.html',
  styleUrls: ['./news-card.component.scss'],
})
export class NewsCardComponent {
  @Input() article!: NewsArticle;
  @Input() fallbackImage: string = '';

  get thumbnailUrl(): string {
    return this.article?.urlToImage || this.fallbackImage || 'assets/img/banner-logo-x-rework.png';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackImage || 'assets/img/banner-logo-x-rework.png';
  }
}
