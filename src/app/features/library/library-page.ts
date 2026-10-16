import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';

export interface QuizCard {
  entry: QuizManifestEntry;
  streak: number;
  roundsPlayed: number;
  correct: number;
  attempted: number;
  accuracy: number | null;
}

export interface CollectionSummary {
  totalRounds: number;
  accuracy: number | null;
  recentlyPlayed: QuizCard | null;
}

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, AsyncPipe],
  templateUrl: './library-page.html',
})
export class LibraryPage {
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);

  protected readonly cards$: Observable<QuizCard[]> = this.quizData.loadManifest().pipe(
    map((manifest) =>
      [...manifest.quizzes]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((entry) => this.toCard(entry)),
    ),
  );

  protected readonly summary$: Observable<CollectionSummary> = this.cards$.pipe(
    map((cards) => {
      let totalRounds = 0;
      let correct = 0;
      let attempted = 0;
      let bestStreak = -1;
      let bestRounds = -1;
      let recentlyPlayed: QuizCard | null = null;
      for (const card of cards) {
        totalRounds += card.roundsPlayed;
        correct += card.correct;
        attempted += card.attempted;
        const newer =
          card.streak > bestStreak ||
          (card.streak === bestStreak && card.roundsPlayed > bestRounds);
        if (newer) {
          bestStreak = card.streak;
          bestRounds = card.roundsPlayed;
          recentlyPlayed = card;
        }
      }
      return {
        totalRounds,
        accuracy: attempted > 0 ? correct / attempted : null,
        recentlyPlayed,
      };
    }),
  );

  protected formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  protected accentTint(accent: string): string {
    const rgba = this.withAlpha(accent, 0.08);
    return rgba ?? '#ffffff';
  }

  protected resetAll(): void {
    if (confirm('Reset all quiz progress across every collection? This cannot be undone.')) {
      this.stats.resetAll();
    }
  }

  private toCard(entry: QuizManifestEntry): QuizCard {
    const s = this.stats.getStats(entry.id);
    let correct = 0;
    let attempted = 0;
    for (const value of Object.values(s.perTrait)) {
      correct += value.correct;
      attempted += value.attempted;
    }
    return {
      entry,
      streak: s.streak,
      roundsPlayed: s.roundsPlayed,
      correct,
      attempted,
      accuracy: attempted > 0 ? correct / attempted : null,
    };
  }

  /** Convert #rgb/#rrggbb hex to an rgba() string at the given alpha, or null if not hex. */
  private withAlpha(hexColor: string, alpha: number): string | null {
    const hex = hexColor.trim().replace(/^#/, '');
    let r: number, g: number, b: number;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      r = parseInt(hex.charAt(0).repeat(2), 16);
      g = parseInt(hex.charAt(1).repeat(2), 16);
      b = parseInt(hex.charAt(2).repeat(2), 16);
    } else if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return null;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
