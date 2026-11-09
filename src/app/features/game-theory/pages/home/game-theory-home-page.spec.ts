import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { GameTheoryHomePage } from './game-theory-home-page';
import { GAME_THEORY_MODES, GameTheoryMode } from '../../modes';
import { GameTheoryData, GameTheoryDataService } from '../../data/game-theory-data.service';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';
import type { GameTheoryConcept } from '../../../../core/models/quiz.models';
import type { MasteryState } from '../../../../core/models/practice.models';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';
import { FakeGtLearnService } from '../../../../../testing/fake-gt-learn.service';
import { APP_CLOCK } from '../../../../core/app-clock';
import { MemoryStorage } from '../../../../../testing/memory-storage';
import { dateKeyOf } from '../../../../core/utils/dates';

function concept(
  id: string,
  name: string,
  tier: GameTheoryConcept['tier'],
  prerequisites: string[] = [],
): GameTheoryConcept {
  return {
    id,
    name,
    type: 'game-theory',
    shortDefinition: `${name}, in one line.`,
    longExplanation: `${name}, explained.`,
    example: `An example of ${name}.`,
    tier,
    prerequisites,
    modes: ['cards', 'equilibrium'],
  };
}

const NOW = new Date('2026-11-04T12:00:00Z');
const TODAY = dateKeyOf(NOW);

const CONCEPTS: GameTheoryConcept[] = [
  concept('best-response', 'Best response', 1),
  concept('nash-equilibrium', 'Nash equilibrium', 1, ['best-response']),
  concept('backward-induction', 'Backward induction', 2, ['nash-equilibrium']),
];

const DATA: GameTheoryData = {
  concepts: { version: 1, concepts: CONCEPTS, pairs: [] },
  tutorials: { version: 1, tutorials: [] },
  checks: { version: 1, checks: [] },
};

describe('GameTheoryHomePage', () => {
  // The mode list is one module-level array that other specs read, so each test puts back what
  // the app ships, rather than leaving it empty for the next file.
  const modes = GAME_THEORY_MODES as GameTheoryMode[];
  const shipped = [...modes];

  let evidence: FakeGtEvidenceService;
  let learn: FakeGtLearnService;
  let data: { load: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> };

  /**
   * The page with content that loads (or fails on the first load, when contentFails is set). Mastery
   * states and introduced concepts are set on the learn fake before the page opens.
   */
  function create(
    options: {
      contentFails?: boolean;
      mastery?: Record<string, MasteryState>;
      introduced?: string[];
      daily?: Record<string, { kind: 'equilibrium' | 'classify' | 'eliminate'; correct: boolean; reasonCorrect: boolean }>;
    } = {},
  ) {
    evidence = new FakeGtEvidenceService();
    learn = new FakeGtLearnService();
    learn.seedIntroduced(options.introduced ?? []);
    for (const [id, state] of Object.entries(options.mastery ?? {})) {
      learn.setMastery(id, state);
    }
    for (const [date, entry] of Object.entries(options.daily ?? {})) {
      learn.recordDailyAnswer(date, entry);
    }
    data = {
      load: vi.fn((): Observable<GameTheoryData> =>
        options.contentFails ? throwError(() => new Error('content down')) : of(DATA),
      ),
      retry: vi.fn((): Observable<GameTheoryData> => of(DATA)),
    };
    TestBed.configureTestingModule({
      imports: [GameTheoryHomePage],
      providers: [
        provideRouter([]),
        { provide: GameTheoryDataService, useValue: data },
        { provide: GtEvidenceService, useValue: evidence },
        { provide: GtLearnService, useValue: learn },
        { provide: APP_CLOCK, useValue: () => NOW },
      ],
    });
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    modes.splice(0, modes.length, ...shipped);
  });

  it('reserves the three named slots: map, modes and today', () => {
    const fixture = create();
    const slots = Array.from(
      fixture.nativeElement.querySelectorAll('[data-slot]') as NodeListOf<HTMLElement>,
    ).map((el) => el.dataset['slot']);
    expect(slots).toEqual(['map', 'modes', 'today']);
  });

  it('renders one link per entry in GAME_THEORY_MODES', () => {
    const entries: GameTheoryMode[] = [
      { id: 'cards', title: 'Cards', path: 'game-theory/cards', requires: [] },
      { id: 'bots', title: 'Bots', path: 'game-theory/bots/play', requires: [] },
    ];
    modes.splice(0, modes.length, ...entries);
    const fixture = create();
    const links = fixture.nativeElement.querySelectorAll(
      '[data-slot="modes"] a',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links).map((a) => a.textContent?.trim())).toEqual(['Cards', 'Bots']);
  });

  it('links each mode to its route, with the slashes of its path kept as route separators', () => {
    const entries: GameTheoryMode[] = [
      { id: 'cards', title: 'Cards', path: 'game-theory/cards', requires: [] },
      { id: 'bots', title: 'Bots', path: 'game-theory/bots/play', requires: [] },
    ];
    modes.splice(0, modes.length, ...entries);
    const fixture = create();
    const hrefs = Array.from(
      fixture.nativeElement.querySelectorAll('[data-slot="modes"] a') as NodeListOf<HTMLAnchorElement>,
    ).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/game-theory/cards', '/game-theory/bots/play']);
  });

  it('renders no mode links while the array is empty', () => {
    modes.length = 0;
    const fixture = create();
    expect(fixture.nativeElement.querySelectorAll('[data-slot="modes"] a')).toHaveLength(0);
  });

  it('renders inside the page shell: one h1 titled Game Theory and a back link to the library', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ui-page-shell')).not.toBeNull();
    const headings = root.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('Game Theory');
    expect(root.querySelector('[data-testid="back-home"]')?.textContent?.trim()).toBe(
      '← Back to library',
    );
  });

  describe('today panel and reset (spec §9.2, §10)', () => {
    it('says the daily unlocks after Nash equilibrium while it is not introduced, and no longer after the first tutorial', () => {
      const root = create({ introduced: [] }).nativeElement as HTMLElement;
      const today = root.querySelector('[data-slot="today"]')?.textContent ?? '';

      expect(today).toContain('Unlocks after Nash equilibrium.');
      expect(today).not.toContain('Unlocks after your first tutorial.');
    });

    it('links to an open daily when nash-equilibrium is introduced and today is not answered', () => {
      const root = create({ introduced: ['nash-equilibrium'] }).nativeElement as HTMLElement;

      expect(root.querySelector<HTMLAnchorElement>('[data-testid="today-open"]')?.getAttribute('href')).toBe(
        '/game-theory/daily',
      );
    });

    it('shows today as done with its mark, and a strip of the last fourteen days', () => {
      const root = create({
        introduced: ['nash-equilibrium'],
        daily: { [TODAY]: { kind: 'equilibrium', correct: true, reasonCorrect: false } },
      }).nativeElement as HTMLElement;

      expect(root.querySelector('[data-testid="today-status"]')?.textContent).toContain('✓');
      const strip = root.querySelector('[data-testid="today-strip"]')?.textContent?.trim() ?? '';
      expect(strip).toHaveLength(14);
      expect(strip.endsWith('✓')).toBe(true);
    });

    it('labels the strip on the page, and gives it an accessible name with the counts', () => {
      const root = create({
        introduced: ['nash-equilibrium'],
        daily: { [TODAY]: { kind: 'equilibrium', correct: true, reasonCorrect: false } },
      }).nativeElement as HTMLElement;

      expect(root.querySelector('[data-testid="today-strip-caption"]')?.textContent).toContain(
        'Daily puzzles, last 14 days',
      );
      const strip = root.querySelector('[data-testid="today-strip"]');
      expect(strip?.getAttribute('role')).toBe('img');
      expect(strip?.getAttribute('aria-label')).toBe('1 right, 0 wrong, 13 no answer');
    });

    it('resets every game-theory key after one confirmation, and keeps other keys', () => {
      const store = new MemoryStorage();
      vi.stubGlobal('localStorage', store);
      store.setItem('stats:game-theory:cards', '{}');
      store.setItem('stats:game-theory:plan', '{}');
      store.setItem('stats:app:practice', '{}');
      try {
        const fixture = create({ introduced: ['nash-equilibrium'] });
        const root = fixture.nativeElement as HTMLElement;
        (root.querySelector('[data-testid="hub-reset"]') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(root.textContent).toContain('Are you sure');
        (root.querySelector('[data-testid="hub-reset-confirm"]') as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(store.getItem('stats:game-theory:cards')).toBeNull();
        expect(store.getItem('stats:game-theory:plan')).toBeNull();
        expect(store.getItem('stats:app:practice')).toBe('{}');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('concept map (G18)', () => {
    const nodes = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('[data-slot="map"] [data-testid^="map-node-"]')) as HTMLElement[];

    it('shows one heading per tier and one node per concept, each with its glyph and word', () => {
      const fixture = create({ mastery: { 'best-response': 'mastered' } });
      const root = fixture.nativeElement as HTMLElement;
      const headings = Array.from(root.querySelectorAll('[data-slot="map"] h2')).map((h) =>
        h.textContent?.trim(),
      );

      expect(headings).toEqual(['Tier 1', 'Tier 2']);
      const bestResponse = root.querySelector('[data-testid="map-node-best-response"]');
      expect(bestResponse?.textContent).toContain('Mastered');
      expect(nodes(root)).toHaveLength(3);
    });

    it('shows each node status as an icon, not a text glyph that reads as a bullet', () => {
      const fixture = create({ mastery: { 'best-response': 'mastered' } });
      const root = fixture.nativeElement as HTMLElement;
      const bestResponse = root.querySelector('[data-testid="map-node-best-response"]');

      expect(bestResponse?.textContent).not.toContain('●');
      expect(bestResponse?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    });

    it('draws each node as a library Card, so the hub matches the library cards', () => {
      const fixture = create();

      for (const card of nodes(fixture.nativeElement as HTMLElement)) {
        expect(card.hasAttribute('uiCard')).toBe(true);
      }
    });

    it('starts the concept map 24px below the title, as the other homes do', () => {
      const fixture = create();
      const map = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="map"]');

      expect(map?.classList).toContain('mt-6');
    });

    it('links each node to its tutorial', () => {
      const fixture = create();
      const href = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
        '[data-testid="map-node-nash-equilibrium"]',
      )?.getAttribute('href');

      expect(href).toBe('/game-theory/learn/nash-equilibrium');
    });

    it('fills each grid cell with its card, so cards in a row end at the same height', () => {
      const fixture = create();
      const cards = nodes(fixture.nativeElement as HTMLElement);

      expect(cards.length).toBeGreaterThan(1);
      for (const card of cards) {
        expect(card.classList).toContain('h-full');
      }
    });

    it('names the first unmet prerequisite as Recommended first', () => {
      const root = create().nativeElement as HTMLElement;

      expect(
        root.querySelector('[data-testid="map-node-nash-equilibrium"]')?.textContent,
      ).toContain('Recommended first: Best response');
    });

    it('drops the Recommended first note once the prerequisite is introduced', () => {
      const root = create({ introduced: ['best-response'] }).nativeElement as HTMLElement;

      expect(
        root.querySelector('[data-testid="map-node-nash-equilibrium"]')?.textContent,
      ).not.toContain('Recommended first');
    });

    it('shows a retry state when the content fails, and loads the content again on Retry', () => {
      const fixture = create({ contentFails: true });
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-testid="map-failed"]')?.textContent).toContain(
        "Couldn't load",
      );

      (root.querySelector('[data-testid="map-retry"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(data.retry).toHaveBeenCalledTimes(1);
      expect(nodes(root)).toHaveLength(3);
    });

    it('migrates the stored evidence and refreshes the summary once the content has loaded', () => {
      create();

      expect(evidence.migrations).toEqual([
        { version: 1, conceptIds: ['best-response', 'nash-equilibrium', 'backward-induction'] },
      ]);
      expect(learn.refreshCalls).toEqual([
        {
          conceptIds: ['best-response', 'nash-equilibrium', 'backward-induction'],
          requiresChallenge: {
            'best-response': true,
            'nash-equilibrium': true,
            'backward-induction': true,
          },
        },
      ]);
    });
  });
});
