import { Component, output } from '@angular/core';

@Component({
  selector: 'app-bank-unavailable',
  standalone: true,
  template: `
    <div
      class="rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
    >
      <p class="text-gray-700">
        Couldn't load this quiz. Check your connection and try again.
      </p>
      <button
        type="button"
        (click)="retry.emit()"
        class="mt-4 rounded-lg border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Retry
      </button>
    </div>
  `,
})
export class BankUnavailable {
  readonly retry = output<void>();
}
