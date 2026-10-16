import { Routes } from '@angular/router';
import { LibraryPage } from './features/library/library-page';
import { QuizHomePage } from './features/quiz-home/quiz-home-page';

export const routes: Routes = [
  { path: '', component: LibraryPage },
  { path: 'quiz/:id', component: QuizHomePage },
];
