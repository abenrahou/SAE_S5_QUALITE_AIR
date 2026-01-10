import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarStateService {
  readonly isCollapsed = signal(false);

  toggle(): void {
    this.isCollapsed.update((value) => !value);
  }

  setCollapsed(value: boolean): void {
    this.isCollapsed.set(value);
  }
}
