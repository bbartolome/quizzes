import { describe, expect, it } from 'vitest';
import { CANONICAL_GAMES, eightSymmetries } from '../../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../../testing/seeds';
import type { MatrixGame, PayoffMatrix } from '../matrix.types';
import { mulberry32 } from '../rng';
import { matrixSignature } from './signature';

/** A random n x n game with integer payoffs 0..9, drawn from a seed. */
function randomGame(seed: number, n: number): MatrixGame {
  const draw = mulberry32(seed);
  const grid = () =>
    Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(draw() * 10)));
  const labels = Array.from({ length: n }, (_, i) => `S${i + 1}`);
  return {
    rowLabels: labels,
    colLabels: labels,
    payoffs: { rows: n, cols: n, row: grid(), col: grid() },
  };
}

/** Every row order, column order and player swap of a square game. */
function everyRelabelling(m: PayoffMatrix): PayoffMatrix[] {
  const orders = (n: number): number[][] => {
    if (n === 1) {
      return [[0]];
    }
    const out: number[][] = [];
    for (const rest of orders(n - 1)) {
      for (let at = 0; at < n; at++) {
        out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
      }
    }
    return out;
  };
  const variants: PayoffMatrix[] = [];
  const transpose = (g: number[][]) => g[0].map((_, c) => g.map((line) => line[c]));
  for (const swap of [false, true]) {
    const base = swap
      ? { rows: m.cols, cols: m.rows, row: transpose(m.col), col: transpose(m.row) }
      : m;
    for (const rowOrder of orders(base.rows)) {
      for (const colOrder of orders(base.cols)) {
        variants.push({
          rows: base.rows,
          cols: base.cols,
          row: rowOrder.map((r) => colOrder.map((c) => base.row[r][c])),
          col: rowOrder.map((r) => colOrder.map((c) => base.col[r][c])),
        });
      }
    }
  }
  return variants;
}

describe('matrixSignature', () => {
  it('is the same for all 8 relabellings of a 2x2 game', () => {
    forSeeds((seed) => {
      const game = randomGame(seed, 2);
      const signature = matrixSignature(game);
      for (const payoffs of eightSymmetries(game.payoffs)) {
        expect(matrixSignature({ ...game, payoffs })).toBe(signature);
      }
    }, 200);
  });

  it('is the same under every row order, column order and player swap of a 3x3 game', () => {
    forSeeds((seed) => {
      const game = randomGame(seed, 3);
      const signature = matrixSignature(game);
      for (const payoffs of everyRelabelling(game.payoffs)) {
        expect(matrixSignature({ ...game, payoffs })).toBe(signature);
      }
    }, 60);
  });

  it('gives the five canonical games five different signatures', () => {
    const signatures = Object.values(CANONICAL_GAMES).map((payoffs) =>
      matrixSignature({ rowLabels: ['a', 'b'], colLabels: ['a', 'b'], payoffs }),
    );
    expect(new Set(signatures).size).toBe(5);
  });

  it('changes when a single payoff changes', () => {
    const game = CANONICAL_GAMES['stag-hunt'];
    const changed: PayoffMatrix = {
      ...game,
      row: [
        [game.row[0][0] + 1, game.row[0][1]],
        [game.row[1][0], game.row[1][1]],
      ],
    };
    const labels = ['a', 'b'];
    expect(matrixSignature({ rowLabels: labels, colLabels: labels, payoffs: changed })).not.toBe(
      matrixSignature({ rowLabels: labels, colLabels: labels, payoffs: game }),
    );
  });

  it('ignores the labels and the cover story', () => {
    const payoffs = CANONICAL_GAMES['prisoners-dilemma'];
    const plain = matrixSignature({ rowLabels: ['A', 'B'], colLabels: ['A', 'B'], payoffs });
    const dressed = matrixSignature({
      rowLabels: ['Share the market', 'Grab the market'],
      colLabels: ['Share the market', 'Grab the market'],
      payoffs,
      story: 'Two firms in one market.',
    });
    expect(dressed).toBe(plain);
  });
});
