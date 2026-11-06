import { describe, it, expect, vi } from 'vitest';
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BotsPage } from './bots-page';
import { BOT_IDS, ROSTER } from '../../lib/bots';
import type { BotId } from '../../lib/bots.types';
import { mulberry32 } from '../../lib/rng';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { GtGamesService } from '../../state/gt-games.service';
import { APP_CLOCK } from '../../../../core/app-clock';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GameTheoryDataService, type GameTheoryData } from '../../data/game-theory-data.service';
import { NAMEABLE, pickHiddenBot } from '../../lib/name-bot';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';
import { of } from 'rxjs';
import conceptsJson from '../../../../../../public/data/quizzes/game-theory/concepts.json';
import checksJson from '../../../../../../public/data/quizzes/game-theory/checks.json';
import tutorialsJson from '../../../../../../public/data/quizzes/game-theory/tutorials.json';

const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');
// The play horizon stops at 40 turns, so a match always ends well before this bound.
const MAX_CLICKS = 200;

let failed: WritableSignal<boolean>;
let games: { record: ReturnType<typeof vi.fn>; saveFailed: Signal<boolean> };
let evidence: FakeGtEvidenceService;
const CONTENT = { concepts: conceptsJson, tutorials: tutorialsJson, checks: checksJson } as unknown as GameTheoryData;

/** Opens the page on a mode. saveFailed starts true when asked, so the write message shows. */
function open(mode = 'play', saveFailed = false): ComponentFixture<BotsPage> {
  failed = signal(saveFailed);
  games = { record: vi.fn(() => true), saveFailed: failed.asReadonly() };
  evidence = new FakeGtEvidenceService();
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
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GameTheoryDataService, useValue: { load: () => of(CONTENT), retry: () => of(CONTENT) } },
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

function nameTurnRows(fixture: ComponentFixture<BotsPage>): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="name-turn"]'));
}

/** The text of a node with its whitespace collapsed, so template line breaks do not count. */
function normalised(node: HTMLElement): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
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

  it('draws the chosen bot as a secondary button, so the selected look shows', () => {
    const fixture = open();
    click(fixture, 'bot-copycat');

    const chosen = el(fixture, 'bot-copycat')?.classList;
    expect(chosen).toContain('border-strong');
    expect(chosen).not.toContain('bg-accent');
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

  it('shows a not-available message for a mode that does not exist', () => {
    const fixture = open('nonsense');

    expect(el(fixture, 'bots-unavailable')).not.toBeNull();
    expect(el(fixture, 'bots-start')).toBeNull();
  });
});

/** The hidden bot a page draws first from a fresh seeded rng, as the name-the-bot page does. */
function hiddenBotOf(seed: number): BotId {
  return pickHiddenBot(mulberry32(seed));
}

/** Plays ten human turns, so the name options appear. */
function tenTurns(fixture: ComponentFixture<BotsPage>): void {
  for (let i = 0; i < 10; i++) {
    click(fixture, 'bots-move-C');
  }
}

describe('BotsPage name-the-bot mode (spec §8.1)', () => {
  it('plays ten turns against a hidden bot, then offers four names', () => {
    const fixture = open('name');
    click(fixture, 'bots-start');
    tenTurns(fixture);

    const options = fixture.nativeElement.querySelectorAll('[data-testid^="bots-name-"]');
    expect(options).toHaveLength(4);
  });

  it("does not reveal the bot's name while the match is going", () => {
    const fixture = open('name');
    click(fixture, 'bots-start');
    click(fixture, 'bots-move-C');

    for (const id of NAMEABLE) {
      expect(text(fixture)).not.toContain(ROSTER[id].name);
    }
  });

  it("shows each turn of the hidden match, your move and the bot's, before the guess, without naming the bot", () => {
    const fixture = open('name');
    click(fixture, 'bots-start');
    click(fixture, 'bots-move-C');
    click(fixture, 'bots-move-D');

    const turns = fixture.componentInstance.nameMatch()?.turns ?? [];
    const rows = nameTurnRows(fixture);
    expect(turns).toHaveLength(2);
    expect(rows).toHaveLength(2);
    rows.forEach((row, i) => {
      const turn = turns[i];
      expect(row.getAttribute('data-human-move')).toBe(turn?.playedA);
      expect(row.getAttribute('data-bot-move')).toBe(turn?.playedB);
      expect(normalised(row)).toBe(`Turn ${i + 1}: you ${turn?.playedA}, the bot ${turn?.playedB}`);
    });
    for (const id of NAMEABLE) {
      expect(text(fixture)).not.toContain(ROSTER[id].name);
    }
  });

  it("a right name is marked correct, recorded as a challenge for the bot's concept, and the tell is shown", () => {
    const fixture = open('name');
    click(fixture, 'bots-start');
    tenTurns(fixture);
    const hidden = hiddenBotOf(SEED);
    click(fixture, `bots-name-${hidden}`);

    expect(text(fixture)).toContain('Correct');
    expect(text(fixture)).toContain(ROSTER[hidden].tell);
    expect(evidence.records).toEqual([
      { conceptIds: ROSTER[hidden].conceptIds, correct: true, facet: 'challenges' },
    ]);
    expect(games.record).toHaveBeenCalledWith(expect.objectContaining({ kind: 'name-the-bot' }));
  });

  it("a wrong name is marked wrong, and the bot's name is revealed", () => {
    const fixture = open('name');
    click(fixture, 'bots-start');
    tenTurns(fixture);
    const hidden = hiddenBotOf(SEED);
    const wrong = NAMEABLE.find((id) => id !== hidden) ?? hidden;
    click(fixture, `bots-name-${wrong}`);

    expect(text(fixture)).toContain('Not this time');
    expect(text(fixture)).toContain(ROSTER[hidden].name);
    expect(evidence.records[0]?.correct).toBe(false);
  });
});

describe('BotsPage tournament mode (spec §8.1)', () => {
  it('draws the chosen population as a secondary button, so the selected look shows', () => {
    const fixture = open('tournament');
    click(fixture, 'preset-hostile');

    const chosen = el(fixture, 'preset-hostile')?.classList;
    expect(chosen).toContain('border-strong');
    expect(chosen).not.toContain('bg-accent');
  });

  it('ranks a preset population, one row per bot, with the winner named first', () => {
    const fixture = open('tournament');
    click(fixture, 'preset-everyone');
    click(fixture, 'tournament-run');

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tournament-row"]');
    expect(rows).toHaveLength(8);
    expect(el(fixture, 'tournament-winner')?.textContent).toContain(
      (rows[0] as HTMLElement).textContent?.trim().split(':')[0] ?? '',
    );
  });

  it('asks whether the winner changed after a second run, and records the answer in the games log', () => {
    const fixture = open('tournament');
    click(fixture, 'preset-everyone');
    click(fixture, 'tournament-run');
    click(fixture, 'preset-hostile');
    click(fixture, 'tournament-run');
    click(fixture, 'tournament-changed-yes');

    const record = games.record.mock.calls.at(-1)?.[0] as { kind: string; summary: Record<string, unknown> };
    expect(record.kind).toBe('tournament');
    expect(record.summary).toHaveProperty('winnerChanged');
    expect(record.summary).toHaveProperty('changeCheckCorrect');
  });

  it('scores the bots reason check after a run under tit-for-tat', () => {
    const fixture = open('tournament');
    click(fixture, 'preset-everyone');
    click(fixture, 'tournament-run');
    const check = checksJson.checks.find((c) => c.context === 'bots');
    if (!check) throw new Error('no bots check in checks.json');
    const correct = check.options.find((o) => o.correct);
    if (!correct) throw new Error('no correct option');
    click(fixture, `check-${correct.id}`);

    expect(evidence.records).toEqual([
      { conceptIds: ['tit-for-tat'], correct: true, facet: 'challenges' },
    ]);
  });

  it('its reason check names no bot that the round robin does not play, and not tit for tat, under any preset', () => {
    const fixture = open('tournament');
    for (const preset of ['everyone', 'cooperative', 'hostile']) {
      click(fixture, `preset-${preset}`);
      click(fixture, 'tournament-run');
      const prompt = el(fixture, 'tournament-reason')?.querySelector('legend')?.textContent ?? '';
      const population = fixture.componentInstance.lastRun()?.result.population ?? [];

      expect(prompt.trim(), `${preset} prompt`).not.toBe('');
      expect(prompt, `${preset} prompt`).not.toMatch(/tit for tat/i);
      for (const id of BOT_IDS) {
        const name = ROSTER[id].name;
        if (new RegExp(`\\b${name}\\b`, 'i').test(prompt)) {
          expect(population, `${preset} prompt names ${name}`).toContain(id);
        }
      }
    }
  });
});
