import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameTheoryHomePage } from './game-theory-home-page';
import { GAME_THEORY_MODES, GameTheoryMode } from '../../modes';

describe('GameTheoryHomePage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GameTheoryHomePage],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    (GAME_THEORY_MODES as GameTheoryMode[]).length = 0;
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
    (GAME_THEORY_MODES as GameTheoryMode[]).push(...entries);
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll(
      '[data-slot="modes"] a',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(Array.from(links).map((a) => a.textContent?.trim())).toEqual(['Cards', 'Bots']);
  });

  it('renders no mode links while the array is empty', () => {
    const fixture = TestBed.createComponent(GameTheoryHomePage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-slot="modes"] a')).toHaveLength(0);
  });
});
