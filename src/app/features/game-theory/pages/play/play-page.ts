import { Component, computed, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PLAY_GAMES } from '../../play-games';

/** Dispatches `game-theory/play/:game` to the component registered for that game. */
@Component({
  selector: 'app-play-page',
  standalone: true,
  templateUrl: './play-page.html',
  imports: [NgComponentOutlet],
})
export class PlayPage {
  private readonly route = inject(ActivatedRoute);

  private readonly game = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('game') ?? '')),
    { initialValue: '' },
  );

  readonly component = computed(() => PLAY_GAMES[this.game()] ?? null);
}
