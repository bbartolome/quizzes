import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Concept } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { PageBack, PageShell } from '../../shared/ui/page-shell';
import { ProgressDisplay, deckForKind, progressDisplay } from './home-page-helpers';

@Component({
  selector: 'app-flash-card-home-page',
  imports: [Button, Card, PageShell, RouterLink],
  templateUrl: './flash-card-home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashCardHomePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly quizData = inject(QuizDataService);
  private readonly stats = inject(StatsService);

  /** Empty until the manifest entry is found; the shell renders at once and the body waits for the title. */
  readonly title = signal('');
  readonly description = signal('');
  readonly progress = signal<ProgressDisplay>({ roundsPlayed: null, accuracy: null });
  readonly deck = signal<Concept[]>([]);
  protected readonly back: PageBack = { label: '← Back to library', link: '/' };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const conceptType = this.route.snapshot.data['conceptType'] as Concept['type'];

    this.quizData.loadManifest().subscribe((manifest) => {
      const entry = manifest.quizzes.find((e) => e.id === id);
      if (!entry) {
        return;
      }
      this.title.set(entry.title);
      this.description.set(entry.description);
      this.progress.set(progressDisplay(this.stats.getStats(id)));
      this.quizData.loadKnowledgeBase().subscribe((kb) => {
        this.deck.set(deckForKind(kb.concepts, conceptType));
      });
    });
  }
}
