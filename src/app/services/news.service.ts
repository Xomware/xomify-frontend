import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
}

interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class NewsService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly NEWS_API_URL = 'https://newsapi.org/v2/everything';

  constructor(private http: HttpClient) {}

  getArtistNews(artistName: string): Observable<NewsArticle[]> {
    const cacheKey = artistName.toLowerCase();
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return of(cached.articles);
    }

    if (!environment.newsApiKey) {
      return of(this.getMockArticles(artistName));
    }

    return this.http
      .get<{ articles: NewsArticle[] }>(this.NEWS_API_URL, {
        params: {
          q: artistName,
          sortBy: 'publishedAt',
          pageSize: '5',
          apiKey: environment.newsApiKey,
        },
      })
      .pipe(
        map((res) => res.articles || []),
        tap((articles) => {
          this.cache.set(cacheKey, { articles, timestamp: Date.now() });
        })
      );
  }

  private getMockArticles(artistName: string): NewsArticle[] {
    const now = new Date();
    const mockTemplates = [
      {
        title: `${artistName} Announces Surprise World Tour for 2026`,
        description: `Fans were thrilled when ${artistName} took to social media to announce a massive world tour spanning 45 cities across North America, Europe, and Asia. Tickets go on sale next Friday.`,
        source: 'Rolling Stone',
        hoursAgo: 2,
      },
      {
        title: `${artistName}'s Latest Album Breaks Streaming Records`,
        description: `The newest release from ${artistName} has shattered first-week streaming records on Spotify, amassing over 500 million streams in just seven days. Critics are calling it a career-defining work.`,
        source: 'Billboard',
        hoursAgo: 5,
      },
      {
        title: `Behind the Scenes: ${artistName}'s Creative Process Revealed`,
        description: `In an exclusive interview, ${artistName} opens up about the inspiration behind their latest music, discussing late-night studio sessions and unexpected collaborations that shaped the sound.`,
        source: 'Pitchfork',
        hoursAgo: 18,
      },
      {
        title: `${artistName} Collaborates with Grammy-Winning Producer on New Single`,
        description: `A highly anticipated collaboration between ${artistName} and multiple Grammy-winning producer has finally been confirmed. The single is expected to drop later this month.`,
        source: 'NME',
        hoursAgo: 36,
      },
      {
        title: `${artistName} Tops Critics' List of Must-See Live Acts This Year`,
        description: `Music critics across major publications have unanimously placed ${artistName} at the top of their must-see live performances list, citing electrifying stage presence and unmatched energy.`,
        source: 'The Guardian',
        hoursAgo: 72,
      },
    ];

    // Use artist name hash to vary which 3-5 articles appear
    const hash = artistName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const count = 3 + (hash % 3); // 3, 4, or 5 articles
    const articles: NewsArticle[] = [];

    for (let i = 0; i < count; i++) {
      const t = mockTemplates[i];
      const publishedAt = new Date(now.getTime() - t.hoursAgo * 3600 * 1000).toISOString();
      articles.push({
        title: t.title,
        description: t.description,
        url: `https://example.com/news/${artistName.toLowerCase().replace(/\s+/g, '-')}-${i}`,
        urlToImage: null,
        publishedAt,
        source: { name: t.source },
      });
    }

    this.cache.set(artistName.toLowerCase(), { articles, timestamp: Date.now() });
    return articles;
  }
}
