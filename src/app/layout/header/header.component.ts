import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarStateService } from '../../core/services/sidebar-state.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  readonly sidebarState = inject(SidebarStateService);
  readonly searchQuery = signal('');

  onSearch() {
    const query = this.searchQuery().trim();
    if (query) {
      console.log('Search for:', query);
      // TODO: Implement search functionality
    }
  }
}
