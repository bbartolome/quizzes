import { describe, it, expect, vi } from 'vitest';
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BotsPage } from './bots-page';
import { BOT_IDS, ROSTER } from '../../lib/bots';
import { mulberry32 } from '../../lib/rng';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { GtGamesService } from '../../state/gt-games.service';
import { APP_CLOCK } from '../../../../core/app-clock';

const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');
// The play horizon stops at 40 turns, so a match always ends well before this bound.
const MAX_CLICKS = 200;

let failed: WritableSignal<boolean>;
let games: { record: ReturnType<typeof vi.fn>; saveFailed: Signal<boolean> };

/** Opens the page on a mode. saveFailed starts true when asked, so the write message shows. */
function open(mode = 'play', saveFailed = false): ComponentFixture<BotsPage> {
  failed = signal(saveFailed);
  games = { record: vi.fn(() => true), saveFailed: failed.asReadonly() };
  TestBed.configureTestingModule({
    imports: [BotsPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ mode })).asObservable(),
        },
      },
      { provide: GAME_THEORY_RNG, useValue: mulberry32(SEED) },
      { provide: APP_CLOCK, useValue: () => NOW },
      { provide: GtGamesService, useValue: games },
    ],
  });
  const fixture = TestBed.createComponent(BotsPage);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<BotsPage>, id: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
}

function text(fixture: ComponentFixture<BotsPage>): string {
  return fixture.nativeElement.textContent ?? '';
}

function click(fixture: ComponentFixture<BotsPage>, id: string): void {
  const node = el(fixture, id);
  if (!node) throw new Error(`no element with test id ${id}`);
  node.click();
  fixture.detectChanges();
}

function start(fixture: ComponentFixture<BotsPage>, botId: string): void {
  click(fixture, `bot-${botId}`);
  click(fixture, 'bots-start');
}

function setNoise(fixture: ComponentFixture<BotsPage>, value: string): void {
  const input = el(fixture, 'bots-noise') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

/** Plays the same human move until the summary appears. Returns the number of clicks. */
function playToEnd(fixture: ComponentFixture<BotsPage>, move: 'C' | 'D'): number {
  let clicks = 0;
  while (!el(fixture, 'bots-summary') && clicks < MAX_CLICKS) {
    click(fixture, `bots-move-${move}`);
    clicks += 1;
  }
  return clicks;
}

function turnRows(fixture: ComponentFixture<BotsPage>): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="bots-turn"]'));
}

describe('BotsPage (play mode)', () => {
  it('has one heading, Bots', () => {
    const fixture = open();

    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Bots');
  });

  it('offers every bot of the roster to play against', () => {
    const fixture = open();

    for (const id of BOT_IDS) {
      expect(el(fixture, `bot-${id}`), id).not.toBeNull();
      expect(el(fixture, `bot-${id}`)?.textContent).toContain(ROSTER[id].name);
    }
  });

  it('tells the player the continuation chance, and never the number of turns', () => {
    const fixture = open();

    expect(text(fixture)).toContain('90%');
    expect(text(fixture)).not.toMatch(/\b40\b/);
  });

  it('caps noise at 0.1 and says that noise flips only the bot\'s moves', () => {
    const fixture = open();

    const noise = el(fixture, 'bots-noise') as HTMLInputElement;
    expect(noise.min).toBe('0');
    expect(noise.max).toBe('0.1');
    expect(text(fixture)).toContain("Noise flips only the bot's moves");
  });

  it('plays one human move per click, and each turn row shows the human move', () => {
    const fixture = open();
    start(fixture, 'copycat');

    click(fixture, 'bots-move-C');

    const rows = turnRows(fixture);
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-human-move')).toBe('C');
  });

  it("ends with a summary that names the bot's tell, and records the match once", () => {
    const fixture = open();
    start(fixture, 'copycat');

    playToEnd(fixture, 'C');

    expect(el(fixture, 'bots-summary')?.textContent).toContain(ROSTER.copycat.tell);
    expect(games.record).toHaveBeenCalledTimes(1);
    expect(games.record.mock.calls[0][0]).toMatchObject({
      kind: 'repeated-pd',
      at: NOW.toISOString(),
    });
  });

  it('never flips the human move, even at the highest noise', () => {
    const fixture = open();
    setNoise(fixture, '0.1');
    start(fixture, 'always-cooperate');

    playToEnd(fixture, 'C');

    const rows = turnRows(fixture);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.getAttribute('data-human-move')).toBe('C');
    }
  });

  it('says progress cannot be saved when the write fails', () => {
    const fixture = open('play', true);

    expect(text(fixture)).toContain("Progress can't be saved in this browser");
  });

  it('shows a not-available message for a mode other than play', () => {
    const fixture = open('name');

    expect(el(fixture, 'bots-unavailable')).not.toBeNull();
    expect(el(fixture, 'bots-start')).toBeNull();
  });
});
