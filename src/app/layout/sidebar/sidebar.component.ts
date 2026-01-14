import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SidebarStateService } from '../../core/services/sidebar-state.service';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  children?: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  readonly themeService = inject(ThemeService);
  readonly sidebarState = inject(SidebarStateService);
  readonly isCollapsed = this.sidebarState.isCollapsed;

  readonly menuItems: MenuItem[] = [
    { icon: 'home', label: 'Accueil', route: '/dashboard' },
    { icon: 'map', label: 'Carte mondiale', route: '/map' },
    {
      icon: 'chart-bar',
      label: 'Analyses',
      route: '/analysis',
      children: [
        { icon: 'calendar', label: 'Temporal & COVID', route: '/analysis/temporal' },
        { icon: 'building-office-2', label: 'Urbanisation', route: '/analysis/urbanization' },
        { icon: 'currency-dollar', label: 'Developpement', route: '/analysis/development' },
        { icon: 'scale', label: 'Transport', route: '/analysis/transport' },
        { icon: 'fire', label: 'Energie', route: '/analysis/energy' },
        { icon: 'sparkles', label: 'Environnement', route: '/analysis/environment' },
        { icon: 'beaker', label: 'ACP', route: '/analysis/multivariate' },
        { icon: 'cpu-chip', label: 'Modeles', route: '/analysis/models' },
        { icon: 'chart-pie', label: 'Plan d action', route: '/analysis/plan' },
        { icon: 'information-circle', label: 'Transparence', route: '/analysis/transparency' },
        { icon: 'chart-bar', label: 'Limites', route: '/analysis/limits' }
      ]
    },
    { icon: 'scale', label: 'Comparaison', route: '/comparison' },
    { icon: 'calendar', label: 'Evolutions', route: '/temporal' },
    { icon: 'sparkles', label: 'Correlations', route: '/correlation' },
    { icon: 'beaker', label: 'Multivariee', route: '/multivariate' },
    { icon: 'cpu-chip', label: 'Predictions', route: '/prediction' },
    { icon: 'table-cells', label: 'Donnees', route: '/data' },
    { icon: 'information-circle', label: 'A propos', route: '/about' }
  ];

  toggleSidebar() {
    this.sidebarState.toggle();
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }
}
