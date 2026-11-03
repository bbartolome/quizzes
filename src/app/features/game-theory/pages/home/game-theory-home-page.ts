import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_THEORY_MODES } from '../../modes';

/** The game-theory hub. Its mode list comes from GAME_THEORY_MODES; three slots are reserved for later lanes. */
@Component({
  selector: 'app-game-theory-home-page',
  standalone: true,
  templateUrl: './game-theory-home-page.html',
  imports: [RouterLink],
})
export class GameTheoryHomePage {
  readonly modes = GAME_THEORY_MODES;
}
