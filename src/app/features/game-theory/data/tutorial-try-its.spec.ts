import { describe, expect, it } from 'vitest';
import tutorialsJson from '../../../../../public/data/quizzes/game-theory/tutorials.json';

// A try-it asks the player to apply the idea to a new game (issue #63). If its game is the worked
// example's game, the player can copy the worked example's answer instead.

interface Step {
  kind: string;
  game?: { payoffs: { row: number[][]; col: number[][] } };
}

const payoffKey = (game: NonNullable<Step['game']>) =>
  JSON.stringify([game.payoffs.row, game.payoffs.col]);

describe('tutorial try-its use a different game from their worked examples', () => {
  for (const tutorial of tutorialsJson.tutorials) {
    it(`${tutorial.conceptId}: no try-it repeats a worked example's payoffs`, () => {
      const steps = tutorial.steps as Step[];
      const worked = steps.filter((s) => s.kind === 'worked' && s.game).map((s) => payoffKey(s.game!));
      const faded = steps.filter((s) => s.kind === 'faded' && s.game);

      expect(faded).not.toHaveLength(0);
      for (const step of faded) {
        expect(worked).not.toContain(payoffKey(step.game!));
      }
    });
  }
});
