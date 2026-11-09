import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AuctionPage } from './auction-page';
import { APP_CLOCK } from '../../../../../core/app-clock';
import { GameTheoryData, GameTheoryDataService } from '../../../data/game-theory-data.service';
import { GtEvidenceService } from '../../../state/gt-evidence.service';
import { GtGamesService } from '../../../state/gt-games.service';
import { GAME_THEORY_RNG } from '../../../state/gt-tokens';
import { mulberry32 } from '../../../lib/rng';
import type { GameTheoryContent } from '../../../../../core/models/quiz.models';
import { FakeGtEvidenceService } from '../../../../../../testing/fake-gt-evidence.service';
import conceptsJson from '../../../../../../../public/data/quizzes/game-theory/concepts.json';
import tutorialsJson from '../../../../../../../public/data/quizzes/game-theory/tutorials.json';
import checksJson from '../../../../../../../public/data/quizzes/game-theory/checks.json';

const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');
const CONTENT = {
  concepts: conceptsJson as unknown as GameTheoryContent,
  tutorials: tutorialsJson,
  checks: checksJson,
} as unknown as GameTheoryData;

let evidence: FakeGtEvidenceService;
let games: { record: ReturnType<typeof vi.fn>; saveFailed: () => boolean };

/** Opens the auction page for one game: first-price, second-price or common-value. */
function open(game = 'first-price'): ComponentFixture<AuctionPage> {
  evidence = new FakeGtEvidenceService();
  games = { record: vi.fn(() => true), saveFailed: () => false };
  TestBed.configureTestingModule({
    imports: [AuctionPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: new BehaviorSubject(convertToParamMap({ game })).asObservable() },
      },
      { provide: GAME_THEORY_RNG, useValue: mulberry32(SEED) },
      { provide: APP_CLOCK, useValue: () => NOW },
      { provide: GtGamesService, useValue: games },
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GameTheoryDataService, useValue: { load: () => of(CONTENT), retry: () => of(CONTENT) } },
    ],
  });
  const fixture = TestBed.createComponent(AuctionPage);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<AuctionPage>, id: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
}

function click(fixture: ComponentFixture<AuctionPage>, id: string): void {
  const node = el(fixture, id);
  if (!node) throw new Error(`no element with test id ${id}`);
  node.click();
  fixture.detectChanges();
}

describe('AuctionPage (play/:game, §8.3)', () => {
  it('shows the player\'s own value and a bid control for a private first-price game', () => {
    const fixture = open('first-price');

    expect(el(fixture, 'auction-value')?.textContent).toContain('Your value');
    expect(el(fixture, 'auction-bid')).not.toBeNull();
  });

  it('shows a signal, and says the true value is not known, for a common-value game', () => {
    const fixture = open('common-value');
    const value = el(fixture, 'auction-value')?.textContent ?? '';

    expect(value).toContain('signal');
    expect(value).toContain('not known');
  });

  it('resolves the auction when the bid is submitted, and records the game under its kind', () => {
    const fixture = open('first-price');
    click(fixture, 'auction-submit');

    const outcome = el(fixture, 'auction-outcome')?.textContent ?? '';
    expect(outcome.includes('You won') || outcome.includes('You lost')).toBe(true);
    expect(games.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'first-price', summary: expect.objectContaining({ bid: 50 }) }),
    );
  });

  it('shows the reason check after the result, and a right answer is recorded under its concept', () => {
    const fixture = open('first-price');
    click(fixture, 'auction-submit');

    expect(el(fixture, 'auction-reason')).not.toBeNull();
    click(fixture, 'auction-reason-a');

    expect(evidence.records).toEqual([
      { conceptIds: ['first-price-auction'], correct: true, facet: 'challenges' },
    ]);
  });

  it('spans the bid slider over every common-value signal, from 30 to 170', () => {
    const fixture = open('common-value');
    const slider = el(fixture, 'auction-bid') as HTMLInputElement;

    expect(slider.min).toBe('30');
    expect(slider.max).toBe('170');
  });

  it('lets a common-value bidder bid above 100, near a signal of 142', () => {
    const fixture = open('common-value');
    const slider = el(fixture, 'auction-bid') as HTMLInputElement;
    slider.value = '143';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label[for="auction-bid"]') as HTMLElement;
    expect(label.textContent).toContain('Your bid: 143');
  });

  it('shows the common-value signal, price and profit as whole numbers', () => {
    const fixture = open('common-value');
    const signal = el(fixture, 'auction-value')?.textContent ?? '';
    click(fixture, 'auction-submit');
    const outcome = el(fixture, 'auction-outcome')?.textContent ?? '';

    expect(signal).toMatch(/Your signal: \d+\. /);
    expect(outcome).not.toMatch(/\d\.\d/);
  });

  it('draws the chosen policy as a secondary button, so the selected look shows', () => {
    const fixture = open('common-value');
    click(fixture, 'auction-policy-curse-aware');

    const chosen = el(fixture, 'auction-policy-curse-aware')?.classList;
    expect(chosen).toContain('border-strong');
    expect(chosen).not.toContain('bg-accent');
  });

  it('draws the chosen reason answer as a secondary button, so the selected look shows', () => {
    const fixture = open('first-price');
    click(fixture, 'auction-submit');
    click(fixture, 'auction-reason-a');

    const chosen = el(fixture, 'auction-reason-a')?.classList;
    expect(chosen).toContain('border-strong');
    expect(chosen).not.toContain('bg-accent');
  });

  it.each([
    ['first-price', 'with the equilibrium shade'],
    ['second-price', 'truthfully'],
    ['common-value', 'at their own signal'],
  ])('names the other bidders\' rule as a full sentence, for %s', (game, rule) => {
    const fixture = open(game);
    const setup = fixture.nativeElement.textContent ?? '';

    expect(setup).toContain(`The other bidders bid ${rule}.`);
    expect(setup).not.toContain('fixed rule');
  });

  it('says how many simulated auctions the player won at a loss, not a bare count of times', () => {
    const fixture = open('first-price');
    click(fixture, 'auction-simulate');

    const result = el(fixture, 'auction-simulated')?.textContent ?? '';
    expect(result).toMatch(/You (never won at a loss \(0 of 1000 auctions\)|won at a loss in \d+ of 1000 auctions)\./);
    expect(result).not.toContain(' times.');
  });

  it('lets both sliders fill the column width instead of the native 129px track', () => {
    const fixture = open('first-price');

    for (const id of ['auction-bidders', 'auction-bid']) {
      expect(el(fixture, id)?.classList).toContain('w-full');
    }
  });

  it('names the page type in the kicker, so the Game Theory link is not repeated above it', () => {
    const fixture = open('first-price');

    expect(fixture.nativeElement.querySelector('p.type-eyebrow')?.textContent?.trim()).toBe('Play');
  });

  it('styles both sliders in the app accent, and sets each label on its own line so the gap shows', () => {
    const fixture = open('first-price');

    for (const id of ['auction-bidders', 'auction-bid']) {
      expect(el(fixture, id)?.classList).toContain('accent-accent');
      const label = fixture.nativeElement.querySelector(`label[for="${id}"]`) as HTMLElement;
      expect(label.classList).toContain('block');
    }
  });

  it('simulates a thousand auctions with a chosen policy, and says the result is in this setup', () => {
    const fixture = open('first-price');
    click(fixture, 'auction-simulate');

    const result = el(fixture, 'auction-simulated')?.textContent ?? '';
    expect(result).toContain('1000 auctions');
    expect(result).toContain('in this setup');
  });
});
