import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PlayPage } from './play-page';
import { PLAY_GAMES } from '../../play-games';

@Component({ selector: 'app-test-game', standalone: true, template: '<p>test game</p>' })
class TestGame {}

describe('PlayPage', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ game: 'unknown-game' }));
    TestBed.configureTestingModule({
      imports: [PlayPage],
      providers: [{ provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } }],
    });
  });

  afterEach(() => {
    delete (PLAY_GAMES as Record<string, unknown>)['test-game'];
  });

  it('says the game is not available when :game has no entry', () => {
    const fixture = TestBed.createComponent(PlayPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("This game isn't available yet.");
  });

  it('renders the component registered for :game', () => {
    (PLAY_GAMES as Record<string, unknown>)['test-game'] = TestGame;
    params.next(convertToParamMap({ game: 'test-game' }));
    const fixture = TestBed.createComponent(PlayPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('test game');
  });
});
