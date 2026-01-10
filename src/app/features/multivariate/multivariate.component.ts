import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import * as Plotly from 'plotly.js-dist-min';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService } from '../../core/services/data.service';
import { City, Indicator, PollutantType, POLLUTANT_INFO, getQualityLevel } from '../../core/models';
import { StatsUtils } from '../../shared/utils/stats.utils';

type ColorMode = 'region' | 'development' | 'urbanization' | PollutantType;

interface FeatureDefinition {
  key: string;
  label: string;
  category: 'pollution' | 'urbanisation' | 'developpement' | 'energie' | 'social';
  accessor: (indicator: Indicator | undefined, pollution: Map<PollutantType, number>) => number | null;
}

interface CityPcaRow {
  city: City;
  indicator: Indicator | undefined;
  pollution: Map<PollutantType, number>;
  features: number[];
  scores: number[];
}

@Component({
  selector: 'app-multivariate',
  imports: [CommonModule, LoadingSpinnerComponent, BaseChartDirective],
  templateUrl: './multivariate.component.html',
  styleUrls: ['./multivariate.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultivariateComponent implements OnInit, AfterViewInit {
  private readonly dataService = inject(DataService);
  readonly isLoading = signal(true);
  readonly infoOpen = signal(false);
  readonly info3dOpen = signal(false);

  readonly colorMode = signal<ColorMode>('region');
  readonly varianceExplained = signal<number[]>([0, 0, 0]);
  readonly totalVariance = computed(() => this.varianceExplained().reduce((sum, v) => sum + v, 0));
  readonly selectedFeatureKeys = signal<string[]>([]);
  readonly featureWarning = signal('');
  readonly loadings = signal<{ pc: string; items: { label: string; value: number }[] }[]>([]);
  readonly showFullLoadings = signal(false);
  readonly activeFeatureCount = signal(0);
  readonly activeCityCount = signal(0);
  private readonly plotly = Plotly as unknown as {
    react: (el: HTMLElement, data: unknown[], layout: unknown, config?: unknown) => void;
  };
  private viewReady = false;

  varianceChart: ChartConfiguration<'bar' | 'line'> = {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: { responsive: true, maintainAspectRatio: false }
  };

  scatterChart: ChartConfiguration<'scatter'> = {
    type: 'scatter',
    data: { datasets: [] },
    options: { responsive: true, maintainAspectRatio: false }
  };

  readonly features: FeatureDefinition[] = [
    { key: 'pm25', label: 'PM2.5', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('pm25') ?? null },
    { key: 'pm10', label: 'PM10', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('pm10') ?? null },
    { key: 'no2', label: 'NO2', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('no2') ?? null },
    { key: 'o3', label: 'O3', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('o3') ?? null },
    { key: 'so2', label: 'SO2', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('so2') ?? null },
    { key: 'co', label: 'CO', category: 'pollution', accessor: (_indicator, pollution) => pollution.get('co') ?? null },
    { key: 'density', label: 'Densité', category: 'urbanisation', accessor: (indicator) => indicator?.density ?? null },
    { key: 'urbanPopulationPct', label: 'Population urbaine', category: 'urbanisation', accessor: (indicator) => indicator?.urbanPopulationPct ?? null },
    { key: 'urbanGrowth', label: 'Croissance urbaine', category: 'urbanisation', accessor: (indicator) => indicator?.urbanGrowth ?? null },
    { key: 'gdpPerCapita', label: 'PIB par habitant', category: 'developpement', accessor: (indicator) => indicator?.gdpPerCapita ?? null },
    { key: 'industryPctGdp', label: 'Industrie % PIB', category: 'developpement', accessor: (indicator) => indicator?.industryPctGdp ?? null },
    { key: 'servicesPctGdp', label: 'Services % PIB', category: 'developpement', accessor: (indicator) => indicator?.servicesPctGdp ?? null },
    { key: 'coalPct', label: 'Électricité charbon', category: 'energie', accessor: (indicator) => indicator?.coalPct ?? null },
    { key: 'renewablePct', label: 'Énergies renouvelables', category: 'energie', accessor: (indicator) => indicator?.renewablePct ?? null },
    { key: 'energyPerCapita', label: 'Énergie par habitant', category: 'energie', accessor: (indicator) => indicator?.energyPerCapita ?? null },
    { key: 'lifeExpectancy', label: 'Espérance de vie', category: 'social', accessor: (indicator) => indicator?.lifeExpectancy ?? null },
    { key: 'giniIndex', label: 'Indice Gini', category: 'social', accessor: (indicator) => indicator?.giniIndex ?? null }
  ];

  private cityRows: CityPcaRow[] = [];
  private activeFeatures: FeatureDefinition[] = [];
  private eigenvalues: number[] = [];
  private eigenvectors: number[][] = [];

  ngOnInit(): void {
    if (this.dataService.isLoaded()) {
      this.initialize();
    } else {
      this.dataService.isLoaded$.subscribe(isLoaded => {
        if (isLoaded) {
          this.initialize();
        }
      });
    }
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render3DPlot();
  }

  private readonly update3dEffect = effect(() => {
    this.colorMode();
    this.varianceExplained();
    if (!this.viewReady) return;
    this.render3DPlot();
  });

  private readonly updateFeatureEffect = effect(() => {
    if (!this.selectedFeatureKeys().length) return;
    if (!this.dataService.isLoaded()) return;
    this.refreshPca();
  });

  setColorMode(value: string): void {
    if (['region', 'development', 'urbanization', 'pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(value)) {
      this.colorMode.set(value as ColorMode);
      this.buildScatterChart();
    }
  }

  onColorModeChange(event: Event): void {
    this.setColorMode((event.target as HTMLSelectElement).value);
  }

  openInfo(): void {
    this.infoOpen.set(true);
  }

  closeInfo(): void {
    this.infoOpen.set(false);
  }

  openInfo3d(): void {
    this.info3dOpen.set(true);
  }

  closeInfo3d(): void {
    this.info3dOpen.set(false);
  }

  formatLoading(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  }

  toggleFullLoadings(): void {
    this.showFullLoadings.set(!this.showFullLoadings());
  }

  getLoadingsFor(pc: { pc: string; items: { label: string; value: number }[] }): { label: string; value: number }[] {
    return this.showFullLoadings() ? pc.items : pc.items.slice(0, 6);
  }

  getTopLoadingsFor(pc: { pc: string; items: { label: string; value: number }[] }): { label: string; value: number }[] {
    return pc.items.slice(0, 6);
  }

  private initialize(): void {
    this.selectedFeatureKeys.set(this.features.map(feature => feature.key));
    this.buildData();
    this.computePca();
    this.buildVarianceChart();
    this.buildScatterChart();
    this.render3DPlot();
    this.isLoading.set(false);
  }

  private buildData(): void {
    const selectedKeys = new Set(this.selectedFeatureKeys());
    const indicators = new Map<string, Indicator>();
    this.dataService.getIndicators().forEach(indicator => {
      if (indicator.cityName) {
        indicators.set(indicator.cityName, indicator);
      }
    });
    const pollutionMap = new Map<string, Map<PollutantType, number>>();
    this.dataService.getPollutionData().forEach(row => {
      const cityMap = pollutionMap.get(row.cityName) ?? new Map<PollutantType, number>();
      cityMap.set(row.parameter, row.valueMean);
      pollutionMap.set(row.cityName, cityMap);
    });

    const selectedFeatures = this.features.filter(feature => selectedKeys.has(feature.key));
    const rawValues: number[][] = selectedFeatures.map(() => []);

    this.dataService.getCities().forEach(city => {
      const indicator = indicators.get(city.cityName);
      const pollution = pollutionMap.get(city.cityName) ?? new Map<PollutantType, number>();
      selectedFeatures.forEach((feature, index) => {
        const value = feature.accessor(indicator, pollution);
        if (Number.isFinite(value)) {
          rawValues[index].push(value as number);
        }
      });
    });

    const validFeatures: FeatureDefinition[] = [];
    const featureMeans: number[] = [];
    const featureStds: number[] = [];
    rawValues.forEach((values, index) => {
      if (values.length < 3) return;
      const mean = StatsUtils.mean(values);
      const std = StatsUtils.std(values);
      if (!Number.isFinite(mean) || !Number.isFinite(std) || std === 0) return;
      validFeatures.push(selectedFeatures[index]);
      featureMeans.push(mean);
      featureStds.push(std);
    });

    this.activeFeatures = validFeatures;
    this.activeFeatureCount.set(validFeatures.length);
    if (validFeatures.length < 3) {
      this.featureWarning.set('Pas assez de variables avec données valides pour calculer l ACP.');
      this.cityRows = [];
      return;
    }

    this.featureWarning.set('');
    this.cityRows = [];
    this.dataService.getCities().forEach(city => {
      const indicator = indicators.get(city.cityName);
      const pollution = pollutionMap.get(city.cityName) ?? new Map<PollutantType, number>();
      const featureValues = validFeatures.map((feature, index) => {
        const value = feature.accessor(indicator, pollution);
        return Number.isFinite(value) ? (value as number) : featureMeans[index];
      });
      this.cityRows.push({
        city,
        indicator,
        pollution,
        features: featureValues as number[],
        scores: []
      });
    });
    this.activeCityCount.set(this.cityRows.length);
  }

  private computePca(): void {
    if (this.cityRows.length < 3 || this.activeFeatures.length < 3) {
      this.varianceExplained.set([0, 0, 0]);
      this.loadings.set([]);
      return;
    }
    const data = this.cityRows.map(row => row.features);
    const standardized = this.standardize(data);
    const covariance = this.covarianceMatrix(standardized);
    const { eigenvalues, eigenvectors } = this.topEigen(covariance, 3);
    this.eigenvalues = eigenvalues;
    this.eigenvectors = eigenvectors;
    const total = eigenvalues.reduce((sum, val) => sum + val, 0) || 1;
    this.varianceExplained.set(eigenvalues.map(val => (val / total) * 100));

    const scores = standardized.map(row => this.project(row, eigenvectors));
    this.cityRows = this.cityRows.map((row, index) => ({
      ...row,
      scores: scores[index]
    }));
    this.buildLoadings();
  }

  private buildVarianceChart(): void {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)';
    const variance = this.varianceExplained();
    const cumulative = variance.reduce((acc: number[], value, index) => {
      const next = (acc[index - 1] ?? 0) + value;
      acc.push(next);
      return acc;
    }, []);

    const lineColor = isDark ? '#e2e8f0' : '#1f2937';
    this.varianceChart = {
      type: 'bar',
      data: {
        labels: ['PC1', 'PC2', 'PC3'],
        datasets: [
          {
            type: 'bar',
            label: 'Variance %',
            data: variance,
            backgroundColor: ['#60a5fa', '#fb923c', '#4ade80']
          },
          {
            type: 'line',
            label: 'Cumul',
            data: cumulative,
            borderColor: lineColor,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, max: 100 }
        }
      }
    };
  }

  private buildScatterChart(): void {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)';
    const datasets = this.buildScatterDatasets();
    const variance = this.varianceExplained();
    const pc1Label = `PC1 (${(variance[0] ?? 0).toFixed(1)}%)`;
    const pc2Label = `PC2 (${(variance[1] ?? 0).toFixed(1)}%)`;

    this.scatterChart = {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const point = context.raw as { x: number; y: number; city: string };
                return `${point.city}: ${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: pc1Label, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
          y: { title: { display: true, text: pc2Label, color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    };
  }

  private buildScatterDatasets(): ChartConfiguration<'scatter'>['data']['datasets'] {
    const mode = this.colorMode();
    const groupMap = new Map<string, { label: string; color: string; points: { x: number; y: number; city: string }[] }>();
    const palette = ['#2563eb', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#0ea5e9', '#facc15'];
    let colorIndex = 0;

    this.cityRows.forEach(row => {
      if (row.scores.length < 2) return;
      const key = this.getGroupKey(row, mode);
      if (!groupMap.has(key)) {
        const color = palette[colorIndex % palette.length];
        colorIndex += 1;
        groupMap.set(key, { label: key, color, points: [] });
      }
      groupMap.get(key)!.points.push({ x: row.scores[0], y: row.scores[1], city: row.city.cityName });
    });

    return Array.from(groupMap.values()).map(group => ({
      label: group.label,
      data: group.points,
      pointBackgroundColor: group.color,
      pointBorderColor: '#ffffff',
      pointRadius: 4
    }));
  }

  private buildLoadings(): void {
    const activeFeatures = this.activeFeatures;
    if (!this.eigenvectors.length || !this.eigenvalues.length || !activeFeatures.length) {
      this.loadings.set([]);
      return;
    }
    const pcs = [0, 1, 2].map((index) => {
      const eigenvalue = this.eigenvalues[index] ?? 0;
      const vector = this.eigenvectors[index] ?? [];
      const items = activeFeatures.map((feature, featureIndex) => {
        const weight = vector[featureIndex] ?? 0;
        return { label: feature.label, value: weight * Math.sqrt(Math.max(eigenvalue, 0)) };
      });
      items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      return { pc: `PC${index + 1}`, items };
    });
    this.loadings.set(pcs);
  }

  toggleFeature(key: string): void {
    const current = this.selectedFeatureKeys();
    const exists = current.includes(key);
    const next = exists ? current.filter(item => item !== key) : [...current, key];
    if (next.length < 3) {
      this.featureWarning.set('Sélectionnez au moins 3 variables pour calculer l ACP.');
      return;
    }
    this.featureWarning.set('');
    this.selectedFeatureKeys.set(next);
  }

  private refreshPca(): void {
    this.buildData();
    this.computePca();
    this.buildVarianceChart();
    this.buildScatterChart();
    this.render3DPlot();
  }

  render3DPlot(): void {
    const container = this.pca3dRef?.nativeElement;
    if (!container || this.cityRows.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    const variance = this.varianceExplained();
    const traces = this.build3DTraces();
    const layout = {
      paper_bgcolor: isDark ? '#0f172a' : '#ffffff',
      plot_bgcolor: isDark ? '#0f172a' : '#ffffff',
      scene: {
        bgcolor: isDark ? '#0f172a' : '#ffffff',
        xaxis: { title: `PC1 (${(variance[0] ?? 0).toFixed(1)}%)`, color: isDark ? '#e2e8f0' : '#475569' },
        yaxis: { title: `PC2 (${(variance[1] ?? 0).toFixed(1)}%)`, color: isDark ? '#e2e8f0' : '#475569' },
        zaxis: { title: `PC3 (${(variance[2] ?? 0).toFixed(1)}%)`, color: isDark ? '#e2e8f0' : '#475569' }
      },
      margin: { l: 0, r: 0, t: 0, b: 0 },
      showlegend: true,
      legend: { font: { color: isDark ? '#e2e8f0' : '#475569' } }
    };
    const config = { displayModeBar: true, responsive: true };
    this.plotly.react(container, traces, layout, config);
  }

  private build3DTraces(): Array<Record<string, unknown>> {
    const mode = this.colorMode();
    const groupMap = new Map<string, { label: string; color: string; points: { x: number; y: number; z: number; city: string }[] }>();
    const palette = ['#2563eb', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#0ea5e9', '#facc15'];
    let colorIndex = 0;

    this.cityRows.forEach(row => {
      if (row.scores.length < 3) return;
      const key = this.getGroupKey(row, mode);
      if (!groupMap.has(key)) {
        const color = palette[colorIndex % palette.length];
        colorIndex += 1;
        groupMap.set(key, { label: key, color, points: [] });
      }
      groupMap.get(key)!.points.push({ x: row.scores[0], y: row.scores[1], z: row.scores[2], city: row.city.cityName });
    });

    return Array.from(groupMap.values()).map(group => ({
      type: 'scatter3d',
      mode: 'markers',
      name: group.label,
      x: group.points.map(point => point.x),
      y: group.points.map(point => point.y),
      z: group.points.map(point => point.z),
      text: group.points.map(point => point.city),
      marker: { size: 4, color: group.color, opacity: 0.85 }
    }));
  }

  private getGroupKey(row: CityPcaRow, mode: ColorMode): string {
    switch (mode) {
      case 'development':
        return row.indicator?.developmentLevel ?? 'Inconnu';
      case 'urbanization':
        return row.indicator?.urbanizationLevel ?? 'Inconnu';
      case 'pm25':
      case 'pm10':
      case 'no2':
      case 'o3':
      case 'so2':
      case 'co': {
        const pollutant = mode as PollutantType;
        const value = row.pollution.get(pollutant) ?? 0;
        const label = POLLUTANT_INFO[pollutant].name;
        const level = getQualityLevel(value, pollutant);
        return `${label} ${level}`;
      }
      case 'region':
      default:
        return row.city.region || 'Inconnu';
    }
  }

  private standardize(data: number[][]): number[][] {
    const cols = data[0].length;
    const means = Array.from({ length: cols }, (_, idx) => StatsUtils.mean(data.map(row => row[idx])));
    const stds = Array.from({ length: cols }, (_, idx) => StatsUtils.std(data.map(row => row[idx])) || 1);
    return data.map(row => row.map((value, idx) => (value - means[idx]) / stds[idx]));
  }

  private covarianceMatrix(data: number[][]): number[][] {
    const n = data.length;
    const cols = data[0].length;
    const matrix = Array.from({ length: cols }, () => Array(cols).fill(0));
    for (let i = 0; i < cols; i++) {
      for (let j = i; j < cols; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += data[k][i] * data[k][j];
        }
        const value = sum / (n - 1);
        matrix[i][j] = value;
        matrix[j][i] = value;
      }
    }
    return matrix;
  }

  private topEigen(matrix: number[][], count: number): { eigenvalues: number[]; eigenvectors: number[][] } {
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    let working = matrix.map(row => [...row]);

    for (let i = 0; i < count; i++) {
      const { value, vector } = this.powerIteration(working, 200);
      eigenvalues.push(value);
      eigenvectors.push(vector);
      working = this.deflate(working, value, vector);
    }

    return { eigenvalues, eigenvectors };
  }

  private powerIteration(matrix: number[][], iterations: number): { value: number; vector: number[] } {
    const size = matrix.length;
    let vector = Array.from({ length: size }, () => Math.random());
    vector = this.normalize(vector);

    for (let i = 0; i < iterations; i++) {
      const multiplied = this.multiplyMatrixVector(matrix, vector);
      vector = this.normalize(multiplied);
    }

    const mv = this.multiplyMatrixVector(matrix, vector);
    const value = this.dot(vector, mv);
    return { value, vector };
  }

  private deflate(matrix: number[][], eigenvalue: number, eigenvector: number[]): number[][] {
    const size = matrix.length;
    const result = Array.from({ length: size }, () => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        result[i][j] = matrix[i][j] - eigenvalue * eigenvector[i] * eigenvector[j];
      }
    }
    return result;
  }

  private project(row: number[], eigenvectors: number[][]): number[] {
    return eigenvectors.map(vector => this.dot(row, vector));
  }

  private multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => this.dot(row, vector));
  }

  private dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, idx) => sum + value * b[idx], 0);
  }

  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map(value => value / norm);
  }

  @ViewChild('pca3d', { static: false }) pca3dRef?: ElementRef<HTMLDivElement>;
}
