import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { Concept, KnowledgeBase } from '../../core/models/quiz.models';
import { Button } from '../../shared/ui/button.directive';
import { Callout } from '../../shared/ui/callout';
import { Card } from '../../shared/ui/card.directive';
import { PageBack, PageShell } from '../../shared/ui/page-shell';
import { confusedWith, filterEntries, pairTip } from './glossary-search';

@Component({
  selector: 'app-glossary-page',
  standalone: true,
  imports: [RouterLink, PageShell, Button, Card, Callout],
  templateUrl: './glossary-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly quizDataService = inject(QuizDataService);

  readonly id = signal<string>('');
  readonly quizTitle = signal<string>('');
  readonly kb = signal<KnowledgeBase>({ concepts: [], pairs: [] });
  readonly query = signal<string>('');
  readonly selectedId = signal<string>('');

  readonly filtered = computed(() => filterEntries(this.kb().concepts, this.query()));
  readonly selected = computed(() =>
    this.kb().concepts.find((entry) => entry.id === this.selectedId()),
  );
  readonly back = computed<PageBack>(() => ({
    label: `← Back to ${this.quizTitle() || 'quiz'}`,
    link: `/quiz/${this.id()}`,
  }));

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.id.set(id);

    this.quizDataService.loadManifest().subscribe((manifest) => {
      const entry = manifest.quizzes.find((e) => e.id === id);
      if (!entry) {
        return;
      }
      this.quizDataService.loadQuizBundle(entry).subscribe((bundle) => {
        this.quizTitle.set(entry.title);
        this.kb.set(bundle.knowledgeBase);
      });
    });
  }

  select(selectedId: string): void {
    this.selectedId.set(selectedId);
  }

  onSearch(value: string): void {
    this.query.set(value);
  }

  confusedOthers(sel: Concept): Concept[] {
    return confusedWith(sel, this.kb());
  }

  pairTip(sel: Concept, other: Concept): string | undefined {
    return pairTip(sel.id, other.id, this.kb());
  }
}
