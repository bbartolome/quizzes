import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { KnowledgeBaseEntry } from '../../core/models/quiz.models';
import { filterEntries } from './glossary-search';

@Component({
  selector: 'app-glossary-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './glossary-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPage {
  private readonly route = inject(ActivatedRoute);
  private readonly quizDataService = inject(QuizDataService);

  readonly id = signal<string>('');
  readonly quizTitle = signal<string>('');
  readonly kb = signal<KnowledgeBaseEntry[]>([]);
  readonly query = signal<string>('');
  readonly selectedId = signal<string>('');

  readonly filtered = computed(() => filterEntries(this.kb(), this.query()));
  readonly selected = computed(() =>
    this.kb().find((entry) => entry.id === this.selectedId()),
  );

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

  confusedOthers(sel: KnowledgeBaseEntry): KnowledgeBaseEntry[] {
    return this.kb().filter((candidate) => sel.commonlyConfusedWith.includes(candidate.id));
  }
}
