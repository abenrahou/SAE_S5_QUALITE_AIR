import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KpiCard } from '../../shared/components/kpi-card/kpi-card';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, KpiCard, IconComponent, LoadingSpinnerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly dataService = inject(DataService);

  // Loading state
  readonly isLoading = signal(true);

  // KPI Data
  readonly totalCities = signal(0);
  readonly totalCountries = signal(0);
  readonly yearsAnalyzed = 5;
  readonly totalIndicators = 40;

  // Statistics
  readonly avgPM25 = signal(0);
  readonly minPM25City = signal('');
  readonly maxPM25City = signal('');
  readonly covidImpact = signal('-25%');

  ngOnInit(): void {
    console.log('Dashboard: Initializing...');

    // Check immediately if data is already loaded (for navigation back to dashboard)
    if (this.dataService.isLoaded()) {
      console.log('Dashboard: Data already loaded, loading KPIs immediately...');
      this.loadKPIs();
      this.isLoading.set(false);
      console.log('Dashboard: Loading complete, displaying content');
    } else {
      // Wait for data to be loaded
      this.dataService.isLoaded$.subscribe(isLoaded => {
        console.log('Dashboard: isLoaded changed to:', isLoaded);
        if (isLoaded) {
          console.log('Dashboard: Data is loaded, loading KPIs...');
          this.loadKPIs();
          this.isLoading.set(false);
          console.log('Dashboard: Loading complete, displaying content');
        }
      });
    }
  }

  private loadKPIs(): void {
    // Get summary statistics from DataService
    const summary = this.dataService.getStatsSummary();

    console.log('Dashboard KPIs:', summary);

    this.totalCities.set(summary.totalCities);
    this.totalCountries.set(summary.totalCountries);
    this.avgPM25.set(Math.round(summary.avgPM25 * 10) / 10);
    this.minPM25City.set(summary.minPM25City);
    this.maxPM25City.set(summary.maxPM25City);

    // If no data loaded yet, use mock data for demonstration
    if (this.totalCities() === 0) {
      this.useMockData();
    }
  }

  private useMockData(): void {
    // Mock data for demonstration when CSVs aren't loaded yet
    this.totalCities.set(101);
    this.totalCountries.set(73);
    this.avgPM25.set(25.3);
    this.minPM25City.set('Reykjavik');
    this.maxPM25City.set('Delhi');
  }
}
