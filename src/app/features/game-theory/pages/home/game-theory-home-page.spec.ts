import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameTheoryHomePage } from './game-theory-home-page';
import { GAME_THEORY_MODES, GameTheoryMode } from '../../modes';

describe('GameTheoryHomePage', () => {
  // The mode list is one module-level array that other specs read, so each test puts back what
  // the app ships, rather than leaving it empty for the next file.
  const modes = GAME_THEORY_MODES as GameTheoryMode[];
  const shipped = [...modes];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameTheoryHomePage],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    modes.splice(0, modes.length, ...shipped);
  });

  it('reserves the three named slots: map, modes and today', () => {
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
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
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll(
      '[data-slot="modes"] a',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links).map((a) => a.textContent?.trim())).toEqual(['Cards', 'Bots']);
  });

  it('renders no mode links while the array is empty', () => {
    modes.length = 0;
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-slot="modes"] a')).toHaveLength(0);
  });

  it('renders inside the page shell: one h1 titled Game Theory and a back link to the library', () => {
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ui-page-shell')).not.toBeNull();
    const headings = root.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('Game Theory');
    expect(root.querySelector('[data-testid="back-home"]')?.textContent?.trim()).toBe(
      'All collections',
    );
  });
});
