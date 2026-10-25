import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PageShell } from './page-shell';

@Component({
  imports: [PageShell],
  template: `
    <ui-page-shell
      [title]="title()"
      [eyebrow]="eyebrow()"
      [description]="description()"
      [width]="width()"
      [back]="back()"
    >
      <p class="body">Body</p>
      <div footer class="footer">Footer</div>
    </ui-page-shell>
  `,
})
class Host {
  readonly title = signal('Library');
  readonly eyebrow = signal<string | undefined>('Quizzes');
  readonly description = signal<string | undefined>('Pick one');
  readonly width = signal<'narrow' | 'wide'>('wide');
  readonly back = signal<{ label: string; link: string } | undefined>({ label: '← Back to library', link: '/' });
}

function render() {
  TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, fixture };
}

describe('PageShell (S2, §6.1, §6.2, §6.3, §7.2)', () => {
  it('renders the page background and the content column padding', () => {
    const { root } = render();
    expect(root.querySelector('.bg-surface')).not.toBeNull();
    expect(root.querySelector('.min-h-screen')).not.toBeNull();
    const column = root.querySelector('.max-w-5xl');
    expect(column?.classList).toContain('px-4');
    expect(column?.classList).toContain('py-8');
    expect(column?.classList).toContain('sm:px-8');
  });

  it('renders exactly one h1 with the type-title role', () => {
    const { root } = render();
    const headings = root.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Library');
    expect(headings[0].classList).toContain('type-title');
  });

  it('keeps the h1 when the title is empty (renders immediately)', () => {
    const { root, host, fixture } = render();
    host.title.set('');
    fixture.detectChanges();
    expect(root.querySelectorAll('h1').length).toBe(1);
  });

  it('renders an eyebrow with type-eyebrow, and omits it when not given', () => {
    const { root, host, fixture } = render();
    expect(root.querySelector('.type-eyebrow')?.textContent?.trim()).toBe('Quizzes');
    host.eyebrow.set(undefined);
    fixture.detectChanges();
    expect(root.querySelector('.type-eyebrow')).toBeNull();
  });

  it('renders the description with type-detail, and omits it when not given', () => {
    const { root, host, fixture } = render();
    expect(root.querySelector('.type-detail')?.textContent?.trim()).toBe('Pick one');
    host.description.set(undefined);
    fixture.detectChanges();
    expect(root.querySelector('.type-detail')).toBeNull();
  });

  it('projects the default content and the [footer] slot', () => {
    const { root } = render();
    expect(root.querySelector('.body')).not.toBeNull();
    expect(root.querySelector('.footer')).not.toBeNull();
  });

  it('wide width uses max-w-5xl, narrow uses max-w-2xl', () => {
    const { root, host, fixture } = render();
    expect(root.querySelector('.max-w-5xl')).not.toBeNull();
    host.width.set('narrow');
    fixture.detectChanges();
    expect(root.querySelector('.max-w-2xl')).not.toBeNull();
    expect(root.querySelector('.max-w-5xl')).toBeNull();
  });

  it('renders the back link with its label and link, and omits it when not given', () => {
    const { root, host, fixture } = render();
    const link = [...root.querySelectorAll('a')].find((a) => a.textContent?.trim() === '← Back to library');
    expect(link?.getAttribute('href')).toBe('/');
    host.back.set(undefined);
    fixture.detectChanges();
    expect([...root.querySelectorAll('a')].some((a) => a.textContent?.trim() === '← Back to library')).toBe(false);
  });
});
