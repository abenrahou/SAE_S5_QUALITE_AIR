import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartDataset, ChartType } from 'chart.js';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService, DatasetRow } from '../../core/services/data.service';
import { City, Indicator, PollutantType, POLLUTANT_INFO } from '../../core/models';

interface ChartBlock {
  title: string;
  description: string;
  type: ChartType;
  data: ChartConfiguration['data'];
  options: ChartConfiguration['options'];
}

type RadarDataset = ChartDataset<'radar', number[]> & { rawValues: number[] };
type BarDataset = ChartDataset<'bar', Array<number | null>> & { rawValues: Array<number | null> };

@Component({
  selector: 'app-comparison',
  imports: [CommonModule, BaseChartDirective, LoadingSpinnerComponent],
  templateUrl: './comparison.component.html',
  styleUrls: ['./comparison.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComparisonComponent implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(true);
  readonly selectedCities = signal<City[]>([]);
  readonly timePollutant = signal<PollutantType>('pm25');

  private pollutionIndex = new Map<string, Map<PollutantType, number>>();
  private minMaxByPollutant = new Map<PollutantType, { min: number; max: number }>();
  private indicators = new Map<string, Indicator>();
  private annualRows: DatasetRow[] = [];

  readonly cityNames = computed(() => this.dataService.getCities().map(c => c.cityName).sort());
  readonly indicatorMap = signal<Map<string, Indicator>>(new Map());
  readonly pollutantOptions = Object.entries(POLLUTANT_INFO).map(([key, info]) => ({
    value: key as PollutantType,
    label: info.name
  }));
  readonly availableTimePollutants = computed(() => {
    const cities = this.selectedCities();
    if (cities.length < 2) return [] as PollutantType[];
    const available = new Set<PollutantType>();
    cities.forEach(city => {
      const cityMap = this.pollutionIndex.get(city.cityName);
      if (!cityMap) return;
      (Object.keys(POLLUTANT_INFO) as PollutantType[]).forEach(pollutant => {
        if (Number.isFinite(cityMap.get(pollutant))) {
          available.add(pollutant);
        }
      });
    });
    return Array.from(available);
  });
  readonly timePollutantOptions = computed(() =>
    this.pollutantOptions.filter(option => this.availableTimePollutants().includes(option.value))
  );
  readonly pollutantInfo = computed(() => POLLUTANT_INFO[this.timePollutant()]);

  radarChart: ChartBlock = this.emptyChart('radar');
  energyMetricCharts: ChartBlock[] = [];
  devMetricCharts: ChartBlock[] = [];
  urbanMetricCharts: ChartBlock[] = [];
  timeChart: ChartBlock = this.emptyChart('line');

  readonly activeEnergyDot = signal(0);
  readonly activeDevDot = signal(0);
  readonly activeUrbanDot = signal(0);

  readonly extremes = computed(() => {
    const pollutant = this.timePollutant();
    const values = this.selectedCities().map(city => ({
      name: city.cityName,
      value: this.getPollutionValue(city.cityName, pollutant)
    })).filter(item => Number.isFinite(item.value));

    if (!values.length) {
      return { maxCity: '', maxValue: 'n/a', minCity: '', minValue: 'n/a' };
    }

    const sorted = [...values].sort((a, b) => a.value - b.value);
    return {
      minCity: sorted[0].name,
      minValue: sorted[0].value.toFixed(1),
      maxCity: sorted[sorted.length - 1].name,
      maxValue: sorted[sorted.length - 1].value.toFixed(1)
    };
  });

  private readonly updateEffect = effect(() => {
    if (this.selectedCities().length < 2) {
      this.radarChart = this.emptyChart('radar');
      this.energyMetricCharts = [];
      this.devMetricCharts = [];
      this.urbanMetricCharts = [];
      this.timeChart = this.emptyChart('line');
      return;
    }
    const available = this.availableTimePollutants();
    if (!available.includes(this.timePollutant())) {
      this.timePollutant.set(available[0] ?? 'pm25');
    }
    this.buildCharts();
  });

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

  addCity(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const city = this.dataService.getCities().find(c => c.cityName === trimmed);
    if (!city) return;
    if (this.selectedCities().find(item => item.cityName === city.cityName)) return;
    if (this.selectedCities().length >= 4) return;

    this.selectedCities.update(current => [...current, city]);
    this.persistSelection();
  }

  removeCity(name: string): void {
    this.selectedCities.update(current => current.filter(city => city.cityName !== name));
    this.persistSelection();
  }

  resetSelection(): void {
    this.selectedCities.set([]);
    this.persistSelection();
  }

  changeTimePollutant(value: string): void {
    if (this.isValidPollutant(value)) {
      this.timePollutant.set(value as PollutantType);
      this.buildCharts();
    }
  }

  onTimePollutantChange(event: Event): void {
    this.changeTimePollutant((event.target as HTMLSelectElement).value);
  }

  scrollCarousel(container: HTMLElement, direction: number): void {
    const amount = container.clientWidth * 0.85;
    container.scrollBy({ left: amount * direction, behavior: 'smooth' });
  }

  scrollToIndex(container: HTMLElement, index: number): void {
    const amount = container.clientWidth;
    container.scrollTo({ left: amount * index, behavior: 'smooth' });
  }

  updateActiveDot(container: HTMLElement, group: 'energy' | 'development' | 'urban'): void {
    const index = Math.round(container.scrollLeft / container.clientWidth);
    const clamped = Math.max(0, Math.min(2, index));
    if (group === 'energy') {
      this.activeEnergyDot.set(clamped);
    } else if (group === 'development') {
      this.activeDevDot.set(clamped);
    } else {
      this.activeUrbanDot.set(clamped);
    }
  }

  buildCharts(): void {
    if (this.selectedCities().length < 2) return;
    this.radarChart = this.buildRadarChart();
    this.energyMetricCharts = [
      this.buildSingleMetricChart('% charbon', 'coalPct', '%'),
      this.buildSingleMetricChart('% renouvelables', 'renewablePct', '%'),
      this.buildSingleMetricChart('Énergie par habitant', 'energyPerCapita', 'kg eq. pétrole')
    ];
    this.devMetricCharts = [
      this.buildSingleMetricChart('PIB par habitant', 'gdpPerCapita', 'k USD', value => value / 1000),
      this.buildSingleMetricChart('% industrie', 'industryPctGdp', '%'),
      this.buildSingleMetricChart('% services', 'servicesPctGdp', '%')
    ];
    this.urbanMetricCharts = [
      this.buildSingleMetricChart('Densité', 'density', 'hab/km2'),
      this.buildSingleMetricChart('Croissance urbaine', 'urbanGrowth', '%'),
      this.buildSingleMetricChart('% population urbaine', 'urbanPopulationPct', '%')
    ];
    this.timeChart = this.buildTimeSeriesChart();
  }

  formatNumber(value?: number): string {
    if (value === undefined || value === null || !Number.isFinite(value)) return 'n/a';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
  }

  private initialize(): void {
    this.isLoading.set(false);
    this.buildIndexes();
    this.restoreSelectionFromQuery();
    if (this.selectedCities().length === 0) {
      this.restoreSelectionFromStorage();
    }
    if (this.selectedCities().length === 0) {
      const defaultCities = this.dataService.getCities().slice(0, 2);
      this.selectedCities.set(defaultCities);
    }
    this.persistSelection();
    this.buildCharts();
  }

  private buildIndexes(): void {
    this.indicators = new Map(this.dataService.getIndicators().map(item => [item.cityName ?? '', item]));
    this.indicatorMap.set(this.indicators);
    this.annualRows = this.dataService.getAnnualData();

    const pollutionData = this.dataService.getPollutionData();
    const minMax: Record<PollutantType, { min: number; max: number }> = {
      pm25: { min: Infinity, max: -Infinity },
      pm10: { min: Infinity, max: -Infinity },
      no2: { min: Infinity, max: -Infinity },
      o3: { min: Infinity, max: -Infinity },
      so2: { min: Infinity, max: -Infinity },
      co: { min: Infinity, max: -Infinity }
    };

    pollutionData.forEach(item => {
      const cityMap = this.pollutionIndex.get(item.cityName) ?? new Map<PollutantType, number>();
      cityMap.set(item.parameter, item.valueMean);
      this.pollutionIndex.set(item.cityName, cityMap);
      const range = minMax[item.parameter];
      range.min = Math.min(range.min, item.valueMean);
      range.max = Math.max(range.max, item.valueMean);
    });

    (Object.keys(minMax) as PollutantType[]).forEach(key => this.minMaxByPollutant.set(key, minMax[key]));
  }

  private restoreSelectionFromQuery(): void {
    const query = this.route.snapshot.queryParamMap.get('cities');
    if (!query) return;
    const names = query.split(',').map(item => item.trim()).filter(Boolean);
    const cities = this.dataService.getCities().filter(city => names.includes(city.cityName)).slice(0, 4);
    this.selectedCities.set(cities);
  }

  private restoreSelectionFromStorage(): void {
    const stored = localStorage.getItem('comparisonCities');
    if (!stored) return;
    try {
      const names = JSON.parse(stored) as string[];
      const cities = this.dataService.getCities().filter(city => names.includes(city.cityName)).slice(0, 4);
      this.selectedCities.set(cities);
    } catch {
      // Ignore invalid storage content
    }
  }

  private persistSelection(): void {
    const names = this.selectedCities().map(city => city.cityName);
    localStorage.setItem('comparisonCities', JSON.stringify(names));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cities: names.join(',') },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private buildRadarChart(): ChartBlock {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#1f2937';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(148, 163, 184, 0.3)';

    const labels = ['PM2.5', 'PM10', 'NO2', 'O3', 'SO2', 'CO'];
    const pollutants: PollutantType[] = ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'];
    const palette = isDark
      ? ['#60a5fa', '#fb923c', '#4ade80', '#c084fc']
      : ['#2563eb', '#f97316', '#22c55e', '#8b5cf6'];

    const datasets: RadarDataset[] = this.selectedCities().map((city, index) => {
      const data = pollutants.map(pollutant => this.normalizePollutant(city.cityName, pollutant));
      const rawValues = pollutants.map(pollutant => this.getPollutionValue(city.cityName, pollutant));
      const baseColor = palette[index % palette.length];
      return {
        label: city.cityName,
        data,
        rawValues,
        borderColor: baseColor,
        backgroundColor: `${baseColor}${isDark ? '77' : '33'}`,
        pointRadius: 4,
        pointHoverRadius: 5,
        pointBackgroundColor: baseColor,
        pointBorderColor: isDark ? '#e2e8f0' : '#ffffff',
        borderWidth: 2.5
      };
    });

    return {
      title: 'Radar pollution',
      description: 'Normalisation 0-100',
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, color: textColor, backdropColor: 'transparent', font: { size: 12 } },
            grid: { color: gridColor, lineWidth: 1.6 },
            angleLines: { color: gridColor, lineWidth: 1.6 },
            pointLabels: { color: textColor, font: { size: 13, weight: 600 } }
          }
        },
        plugins: {
          legend: {
            labels: { color: textColor, boxWidth: 10, boxHeight: 10, font: { weight: 600 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const dataset = context.dataset as RadarDataset;
                const raw = dataset.rawValues?.[context.dataIndex];
                const pollutant = labels[context.dataIndex];
                const unit = POLLUTANT_INFO[pollutants[context.dataIndex]].unit;
                if (Number.isFinite(raw)) {
                  return `${pollutant}: ${raw.toFixed(2)} ${unit}`;
                }
                return `${pollutant}: n/a`;
              }
            }
          }
        }
      }
    };
  }

  private buildSingleMetricChart(
    title: string,
    key: keyof Indicator,
    unit: string,
    transform?: (value: number) => number
  ): ChartBlock {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#1f2937';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.2)';
    const palette = isDark
      ? ['#60a5fa', '#fb923c', '#4ade80', '#c084fc']
      : ['#2563eb', '#f97316', '#22c55e', '#8b5cf6'];

    const labels = this.selectedCities().map(city => city.cityName);
    const rawValues = this.selectedCities().map(city => {
      const value = this.indicators.get(city.cityName)?.[key] as number | undefined;
      return Number.isFinite(value) ? Number(value) : null;
    });

    const data = rawValues.map(value => {
      if (value === null) return null;
      return transform ? transform(value) : value;
    });

    return {
      title,
      description: '',
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: title,
            data,
            rawValues,
            backgroundColor: labels.map((_, idx) => `${palette[idx % palette.length]}99`)
          } as BarDataset
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
            title: { display: true, text: unit, color: textColor }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const dataset = context.dataset as BarDataset;
                const raw = dataset.rawValues?.[context.dataIndex] ?? null;
                const label = labels[context.dataIndex] ?? '';
                if (raw === null || !Number.isFinite(raw)) {
                  return `${label}: n/a`;
                }
                const value = transform ? transform(raw) : raw;
                return `${label}: ${value.toFixed(2)} ${unit}`;
              }
            }
          }
        }
      }
    };
  }

  private buildTimeSeriesChart(): ChartBlock {
    const pollutant = this.timePollutant();
    const years = ['2019', '2020', '2021', '2022', '2023'];
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#1f2937';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.2)';
    const palette = isDark
      ? ['#60a5fa', '#fb923c', '#4ade80', '#c084fc']
      : ['#2563eb', '#f97316', '#22c55e', '#8b5cf6'];

    const datasets = this.selectedCities().map((city, index) => {
      const values = years.map(year => this.getAnnualValue(city.cityName, pollutant, year));
      return {
        label: city.cityName,
        data: values,
        borderColor: palette[index % palette.length],
        backgroundColor: `${palette[index % palette.length]}44`,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBackgroundColor: palette[index % palette.length],
        pointBorderColor: isDark ? '#e2e8f0' : '#ffffff'
      };
    });

    return {
      title: 'Évolution temporelle',
      description: '',
      type: 'line',
      data: { labels: years, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 10, boxHeight: 10, font: { weight: 600 } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
            title: {
              display: true,
              text: `${POLLUTANT_INFO[pollutant].name} (${POLLUTANT_INFO[pollutant].unit})`,
              color: textColor
            }
          }
        }
      }
    };
  }

  private normalizePollutant(cityName: string, pollutant: PollutantType): number {
    const value = this.getPollutionValue(cityName, pollutant);
    const range = this.minMaxByPollutant.get(pollutant);
    if (!range || !Number.isFinite(value)) return 0;
    const span = range.max - range.min;
    if (span <= 0) return 50;
    return ((value - range.min) / span) * 100;
  }

  private getPollutionValue(cityName: string, pollutant: PollutantType): number {
    return this.pollutionIndex.get(cityName)?.get(pollutant) ?? 0;
  }

  private getAnnualValue(cityName: string, pollutant: PollutantType, year: string): number | null {
    const row = this.annualRows.find(item => {
      const city = String(item['city_ascii_wc'] ?? '');
      const param = String(item['parameter'] ?? '').toLowerCase();
      const rowYear = String(item['year'] ?? '');
      return city === cityName && param === pollutant && rowYear === year;
    });
    if (!row) return null;
    const value = Number(row['value_mean'] ?? 0);
    return Number.isFinite(value) ? value : null;
  }

  private isValidPollutant(value: string): value is PollutantType {
    return ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(value);
  }

  private emptyChart(type: ChartType): ChartBlock {
    return {
      title: '',
      description: '',
      type,
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }
}
