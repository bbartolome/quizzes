import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-sticky-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-default bg-raised/95 px-4 py-3 backdrop-blur',
  },
  template: `
    <ng-content />
    <ng-content select="[actions]" />
  `,
})
export class StickyFooter {}
