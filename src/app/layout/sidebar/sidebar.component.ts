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
        { icon: 'fire', label: 'Énergie', route: '/analysis/energy' },
        { icon: 'currency-dollar', label: 'Développement', route: '/analysis/development' },
        { icon: 'building-office-2', label: 'Urbanisation', route: '/analysis/urbanization' },
        { icon: 'arrow-path', label: 'Renouvelables', route: '/analysis/renewable' },
        { icon: 'chart-pie', label: 'Niveau dév.', route: '/analysis/level' }
      ]
    },
    { icon: 'scale', label: 'Comparaison', route: '/comparison' },
    { icon: 'calendar', label: 'Évolutions', route: '/temporal' },
    { icon: 'sparkles', label: 'Corrélations', route: '/correlation' },
    { icon: 'beaker', label: 'Multivariée', route: '/multivariate' },
    { icon: 'cpu-chip', label: 'Prédictions', route: '/prediction' },
    { icon: 'table-cells', label: 'Données', route: '/data' },
    { icon: 'information-circle', label: 'À propos', route: '/about' }
  ];

  toggleSidebar() {
    this.sidebarState.toggle();
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }
}
