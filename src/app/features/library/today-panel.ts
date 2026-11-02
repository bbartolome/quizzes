import { Component, input } from '@angular/core';
import { QuizCard } from './library-cards';

// Red stub: the real panel lands in the implementation commit.
@Component({
  selector: 'app-today-panel',
  template: '',
})
export class TodayPanel {
  readonly cards = input<readonly QuizCard[] | null>(null);
}
