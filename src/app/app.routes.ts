import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map/map.component').then((m) => m.MapComponent)
  },
  {
    path: 'analysis',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/temporal',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/transport',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/environment',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/multivariate',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/models',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/plan',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/transparency',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/limits',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/energy',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/development',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/urbanization',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/renewable',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'analysis/level',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent)
  },
  {
    path: 'comparison',
    loadComponent: () =>
      import('./features/comparison/comparison.component').then((m) => m.ComparisonComponent)
  },
  {
    path: 'temporal',
    loadComponent: () =>
      import('./features/temporal/temporal.component').then((m) => m.TemporalComponent)
  },
  {
    path: 'correlation',
    loadComponent: () =>
      import('./features/correlation/correlation.component').then((m) => m.CorrelationComponent)
  },
  {
    path: 'multivariate',
    loadComponent: () =>
      import('./features/multivariate/multivariate.component').then((m) => m.MultivariateComponent)
  },
  {
    path: 'prediction',
    loadComponent: () =>
      import('./features/prediction/prediction.component').then((m) => m.PredictionComponent)
  },
  {
    path: 'data',
    loadComponent: () =>
      import('./features/data-explorer/data-explorer.component').then((m) => m.DataExplorerComponent)
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about.component').then((m) => m.AboutComponent)
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/contact/contact.component').then((m) => m.ContactComponent)
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
