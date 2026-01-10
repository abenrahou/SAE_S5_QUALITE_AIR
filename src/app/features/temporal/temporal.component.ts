import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
  effect,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartDataset, ChartType, Plugin } from 'chart.js';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService, DatasetRow } from '../../core/services/data.service';
import { City, PollutantType, POLLUTANT_INFO } from '../../core/models';

interface ChartBlock {
  type: ChartType;
  data: ChartConfiguration['data'];
  options: ChartConfiguration['options'];
  plugins: Plugin[];
}

@Component({
  selector: 'app-temporal',
  imports: [CommonModule, BaseChartDirective, LoadingSpinnerComponent],
  templateUrl: './temporal.component.html',
  styleUrls: ['./temporal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemporalComponent implements OnInit, OnDestroy {
  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isLoading = signal(true);

  readonly selectedPollutant = signal<PollutantType>('pm25');
  readonly selectedCountry = signal('All');
  readonly selectedCities = signal<City[]>([]);
  readonly activeCityName = signal<string | null>(null);
  readonly showCovid = signal(true);
  readonly focusYear = signal(2020);
  readonly isPlaying = signal(false);

  readonly pollutantOptions = computed(() => {
    const available = this.getAvailablePollutants();
    return Object.entries(POLLUTANT_INFO)
      .filter(([key]) => available.length === 0 || available.includes(key as PollutantType))
      .map(([key, info]) => ({
        value: key as PollutantType,
        label: info.name,
        unit: info.unit
      }));
  });
  readonly pollutantInfo = computed(() => POLLUTANT_INFO[this.selectedPollutant()]);

  readonly countries = computed(() => this.dataService.getUniqueCountries());
  readonly filteredCityNames = computed(() => {
    const country = this.selectedCountry();
    const pollutant = this.selectedPollutant();
    return this.dataService
      .getCities()
      .filter(city => this.matchesCountry(city, country))
      .filter(city => this.hasPollutant(city.cityName, pollutant))
      .map(city => city.cityName)
      .sort();
  });

  private annualIndex = new Map<string, Map<PollutantType, Map<number, number>>>();
  lineChart: ChartBlock = this.emptyChart('line');
  variationChart: ChartBlock = this.emptyChart('bar');
  readonly covidStats = signal({ before: null as number | null, during: null as number | null, after: null as number | null });

  readonly analysisTitle = signal('');
  readonly analysisLines = signal<string[]>([]);
  readonly analysisSummary = signal('');
  readonly analysisMissing = signal('');
  readonly covidHypothesis = computed(() => {
    const { before, during, after } = this.covidStats();
    const lines: string[] = [];
    if (!Number.isFinite(before) || !Number.isFinite(during)) {
      return { title: 'Données insuffisantes pour evaluer 2020.', lines: [] };
    }
    const beforeVal = before as number;
    const duringVal = during as number;
    const deltaDuring = beforeVal !== 0 ? ((duringVal - beforeVal) / beforeVal) * 100 : 0;
    const directionDuring = deltaDuring >= 0 ? 'hausse' : 'baisse';
    lines.push(`2020 vs 2019: ${directionDuring} de ${Math.abs(deltaDuring).toFixed(1)}%.`);
    if (Number.isFinite(after)) {
      const afterVal = after as number;
      const deltaAfter = duringVal !== 0 ? ((afterVal - duringVal) / duringVal) * 100 : 0;
      const directionAfter = deltaAfter >= 0 ? 'rebond' : 'recul';
      lines.push(`2021-2023 vs 2020: ${directionAfter} de ${Math.abs(deltaAfter).toFixed(1)}%.`);
    } else {
      lines.push('2021-2023: données insuffisantes pour comparer.');
    }
    lines.push('Hypothèse: restrictions 2020 ont modifie temporairement les emissions.');
    return { title: `Lecture rapide pour ${this.pollutantInfo().name}`, lines };
  });

  private readonly updateEffect = effect(() => {
    if (!this.annualIndex.size) return;
    this.buildCharts();
    this.buildAnalysis();
  });

  private readonly filterSyncEffect = effect(() => {
    if (!this.annualIndex.size) return;
    const available = this.pollutantOptions();
    if (available.length === 0) return;
    const current = this.selectedPollutant();
    if (!available.find(option => option.value === current)) {
      this.selectedPollutant.set(available[0].value);
    }
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPlay());
    if (this.dataService.isLoaded()) {
      this.initialize();
      this.isLoading.set(false);
    } else {
      this.dataService.isLoaded$.subscribe(isLoaded => {
        if (isLoaded) {
          this.initialize();
          this.isLoading.set(false);
        }
      });
    }
  }

  onPollutantChange(event: Event): void {
    this.changePollutant(this.getSelectValue(event));
  }

  onCountryChange(event: Event): void {
    this.changeCountry(this.getSelectValue(event));
  }

  onCovidToggle(event: Event): void {
    this.toggleCovid(this.getCheckboxValue(event));
  }

  onFocusYearInput(event: Event): void {
    this.changeFocusYear(this.getInputValue(event));
  }

  changePollutant(value: string): void {
    if (this.isValidPollutant(value)) {
      this.selectedPollutant.set(value as PollutantType);
      const pollutant = value as PollutantType;
      this.selectedCities.update(current => current.filter(city => this.hasPollutant(city.cityName, pollutant)));
      this.syncFocusYear();
    }
  }

  changeCountry(value: string): void {
    this.selectedCountry.set(value);
    if (value !== 'All') {
      const pollutant = this.selectedPollutant();
      this.selectedCities.update(current =>
        current.filter(city => this.matchesCountry(city, value) && this.hasPollutant(city.cityName, pollutant))
      );
      if (this.selectedCities().length === 0) {
        const availableNames = this.filteredCityNames();
        if (availableNames.length > 0) {
          this.addCity(availableNames[0]);
        }
      }
      this.syncFocusYear();
    }
  }

  addCity(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const country = this.selectedCountry();
    const normalized = trimmed.toLowerCase();
    const candidates = this.dataService.getCities().filter(city => this.matchesCountry(city, country));
    const city = candidates.find(c =>
      c.cityName.toLowerCase() === normalized ||
      c.cityNameAscii.toLowerCase() === normalized
    );
    if (!city) return;
    if (this.selectedCities().find(item => item.cityName === city.cityName)) return;
    this.selectedCities.update(current => [...current, city]);
    this.activeCityName.set(city.cityName);
    this.syncFocusYear();
  }

  removeCity(name: string): void {
    this.selectedCities.update(current => current.filter(city => city.cityName !== name));
    if (this.activeCityName() === name) {
      const remaining = this.selectedCities();
      this.activeCityName.set(remaining.length ? remaining[remaining.length - 1].cityName : null);
    }
  }

  resetCities(): void {
    this.selectedCities.set([]);
    this.activeCityName.set(null);
  }

  toggleCovid(value: boolean): void {
    this.showCovid.set(value);
  }

  changeFocusYear(value: string): void {
    const year = Number(value);
    if (Number.isFinite(year)) {
      this.focusYear.set(year);
    }
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.stopPlay();
      return;
    }
    this.syncFocusYear();
    this.isPlaying.set(true);
    this.playInterval = setInterval(() => {
      const years = [2019, 2020, 2021, 2022, 2023];
      const currentIndex = years.indexOf(this.focusYear());
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % years.length;
      this.focusYear.set(years[nextIndex]);
    }, 1200);
  }

  ngOnDestroy(): void {
    this.stopPlay();
  }

  private initialize(): void {
    this.buildAnnualIndex(this.dataService.getAnnualData());
    this.ensureDefaultCity();
    this.buildCharts();
    this.buildAnalysis();
  }

  private ensureDefaultCity(): void {
    if (this.selectedCities().length > 0) return;
    const candidates = this.filteredCityNames();
    if (candidates.length === 0) return;
    this.addCity(candidates[0]);
  }

  private buildAnnualIndex(rows: DatasetRow[]): void {
    this.annualIndex.clear();
    rows.forEach(row => {
      const city = String(row['city_ascii_wc'] ?? '');
      const param = String(row['parameter'] ?? '').toLowerCase() as PollutantType;
      const year = Number(row['year'] ?? 0);
      const value = Number(row['value_mean'] ?? 0);
      if (!city || !this.isValidPollutant(param) || !Number.isFinite(year)) return;
      const cityMap = this.annualIndex.get(city) ?? new Map<PollutantType, Map<number, number>>();
      const pollutantMap = cityMap.get(param) ?? new Map<number, number>();
      pollutantMap.set(year, value);
      cityMap.set(param, pollutantMap);
      this.annualIndex.set(city, cityMap);
    });
  }

  private buildCharts(): void {
    const pollutant = this.selectedPollutant();
    const years = [2019, 2020, 2021, 2022, 2023];
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#1f2937';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.2)';
    const palette = isDark
      ? ['#60a5fa', '#fb923c', '#4ade80', '#c084fc']
      : ['#2563eb', '#f97316', '#22c55e', '#8b5cf6'];

    const cities = this.selectedCities();
    const activeCity = this.activeCityName();
    const cityForMissing = activeCity ?? cities[0]?.cityName ?? null;
    const availability = cityForMissing ? this.getAvailabilityRange(cityForMissing, pollutant) : null;
    const datasets: Array<ChartDataset<'line', Array<number | null>>> = [];
    cities.forEach((city, index) => {
      const focus = this.focusYear();
      const values = years.map(year => {
        const value = this.getAnnualValue(city.cityName, pollutant, year);
        return year <= focus ? value : null;
      });
      const fullValues = years.map(year => this.getAnnualValue(city.cityName, pollutant, year));
      const color = palette[index % palette.length];
      datasets.push({
        label: `${city.cityName} (global)`,
        data: fullValues,
        borderColor: `${color}55`,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.35,
        borderDash: [6, 4],
        order: 0
      });

      datasets.push({
        label: city.cityName,
        data: values,
        borderColor: color,
        backgroundColor: `${color}44`,
        tension: 0.45,
        borderWidth: 2.5,
        pointRadius: years.map(year => (year === focus ? 5 : 3)),
        pointHoverRadius: 4,
        pointBackgroundColor: color,
        pointBorderColor: isDark ? '#e2e8f0' : '#ffffff'
      });
    });

    const covidPlugin: Plugin = {
      id: 'covidHighlight',
      beforeDraw: (chart) => {
        if (!this.showCovid()) return;
        const labels = chart.data.labels as string[] | undefined;
        if (!labels || labels.length < 2) return;
        const index = labels.indexOf('2020');
        if (index === -1) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data[index]) return;
        const center = meta.data[index].x;
        const prev = meta.data[index - 1]?.x ?? center - 20;
        const next = meta.data[index + 1]?.x ?? center + 20;
        const halfWidth = Math.min(Math.abs(center - prev), Math.abs(next - center)) / 2;
        const left = center - halfWidth;
        const right = center + halfWidth;
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.12)';
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.restore();
      }
    };

    const missingPlugin: Plugin = {
      id: 'missingYears',
      beforeDraw: (chart) => {
        if (!availability) return;
        const xScale = chart.scales['x'];
        if (!xScale) return;
        const labels = chart.data.labels as string[] | undefined;
        if (!labels) return;
        const { top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        const getBounds = (index: number) => {
          const center = xScale.getPixelForValue(index);
          const prev = index > 0 ? xScale.getPixelForValue(index - 1) : center - 20;
          const next = index < labels.length - 1 ? xScale.getPixelForValue(index + 1) : center + 20;
          const halfWidth = Math.min(Math.abs(center - prev), Math.abs(next - center)) / 2;
          return { left: center - halfWidth, right: center + halfWidth };
        };
        const firstIndex = labels.indexOf(String(years[0]));
        const lastIndex = labels.indexOf(String(years[years.length - 1]));
        if (firstIndex === -1 || lastIndex === -1) return;
        const startIndex = labels.indexOf(String(availability.start));
        const endIndex = labels.indexOf(String(availability.end));
        if (startIndex === -1 || endIndex === -1) return;
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.25)';
        if (startIndex > firstIndex) {
          const left = getBounds(firstIndex).left;
          const right = getBounds(startIndex).left;
          ctx.fillRect(left, top, right - left, bottom - top);
        }
        if (endIndex < lastIndex) {
          const left = getBounds(endIndex).right;
          const right = getBounds(lastIndex).right;
          ctx.fillRect(left, top, right - left, bottom - top);
        }
        ctx.restore();
      }
    };

    this.lineChart = {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets
      },
      plugins: [covidPlugin, missingPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: { weight: 600 },
              filter: (legendItem, chartData) => {
                if (legendItem.datasetIndex === undefined) return true;
                const label = chartData.datasets[legendItem.datasetIndex]?.label ?? '';
                return typeof label === 'string' && !label.includes('(global)');
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = typeof context.parsed.y === 'number' ? context.parsed.y.toFixed(2) : 'n/a';
                return `${context.dataset.label}: ${value} ${this.pollutantInfo().unit}`;
              }
            }
          }
        },
        animation: {
          duration: 700,
          easing: 'easeOutQuart'
        },
        animations: {
          x: { duration: 700, easing: 'easeOutQuart' },
          y: { duration: 700, easing: 'easeOutQuart' }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: `${this.pollutantInfo().name} (${this.pollutantInfo().unit})`, color: textColor }
          }
        }
      }
    };

    const series = years.map(year => this.getAverageValue(cities, pollutant, year));
    const variation = years.map((year, idx) => {
      if (idx === 0) return null;
      const prev = series[idx - 1];
      const current = series[idx];
      if (prev === null || current === null) return null;
      if (!Number.isFinite(prev) || !Number.isFinite(current) || prev === 0) return null;
      return ((current - prev) / prev) * 100;
    });

    const barColors = variation.map((val, idx) => {
      if (val === null) return 'rgba(148, 163, 184, 0.4)';
      if (this.showCovid() && years[idx] === 2020) return 'rgba(59, 130, 246, 0.7)';
      return val < 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
    });

    this.variationChart = {
      type: 'bar',
      data: {
        labels: years.map(String).slice(1),
        datasets: [
          {
            label: 'Variation %',
            data: variation.slice(1),
            backgroundColor: barColors.slice(1)
          }
        ]
      },
      plugins: [missingPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.parsed.y === null) return 'n/a';
                return `${context.parsed.y.toFixed(1)}%`;
              }
            }
          }
        },
        animation: {
          duration: 650,
          easing: 'easeOutQuart'
        },
        animations: {
          x: { duration: 650, easing: 'easeOutQuart' },
          y: { duration: 650, easing: 'easeOutQuart' }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, title: { display: true, text: '%', color: textColor } }
        }
      }
    };

    const before = this.getAverageValue(cities, pollutant, 2019);
    const during = this.getAverageValue(cities, pollutant, 2020);
    const afterValues = [2021, 2022, 2023]
      .map(year => this.getAverageValue(cities, pollutant, year))
      .filter(val => Number.isFinite(val)) as number[];
    const after = afterValues.length
      ? afterValues.reduce((sum, val) => sum + val, 0) / afterValues.length
      : null;
    this.covidStats.set({ before, during, after });
  }

  private buildAnalysis(): void {
    const pollutant = this.selectedPollutant();
    const activeCity = this.activeCityName();
    const city = activeCity
      ? this.selectedCities().find(item => item.cityName === activeCity)
      : this.selectedCities()[0];
    const years = [2019, 2020, 2021, 2022, 2023];
    if (!city) {
      this.analysisTitle.set('Sélectionnez au moins une ville.');
      this.analysisLines.set([]);
      this.analysisSummary.set('');
      this.analysisMissing.set('');
      return;
    }

    const values = years.map(year => this.getAnnualValue(city.cityName, pollutant, year));
    const missingYears = years.filter((year, index) => values[index] === null);
    const lines: string[] = [];
    for (let i = 1; i < years.length; i++) {
      const prev = values[i - 1];
      const current = values[i];
      if (prev === null || current === null) continue;
      if (!Number.isFinite(prev) || !Number.isFinite(current) || prev === 0) continue;
      const delta = ((current - prev) / prev) * 100;
      const tag = this.showCovid() && years[i] === 2020 ? ' (COVID)' : '';
      lines.push(`${years[i - 1]} -> ${years[i]}: ${delta.toFixed(1)}%${tag}`);
    }

    const firstValue = values.find(value => value !== null) ?? null;
    const lastValue = [...values].reverse().find(value => value !== null) ?? null;
    const overall = firstValue && lastValue && firstValue !== 0
      ? ((lastValue - firstValue) / firstValue) * 100
      : 0;

    this.analysisTitle.set(`${city.cityName} - ${this.pollutantInfo().name}`);
    this.analysisLines.set(lines);
    this.analysisSummary.set(`Tendance 2019-2023: ${overall.toFixed(1)}%.`);
    this.analysisMissing.set(
      missingYears.length > 0
        ? `Annees manquantes: ${missingYears.join(', ')}.`
        : 'Serie complete 2019-2023.'
    );
  }

  private getAverageValue(cities: City[], pollutant: PollutantType, year: number): number | null {
    const values = cities
      .map(city => this.getAnnualValue(city.cityName, pollutant, year))
      .filter(val => Number.isFinite(val)) as number[];
    if (!values.length) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getAnnualValue(cityName: string, pollutant: PollutantType, year: number): number | null {
    const cityMap = this.annualIndex.get(cityName);
    const pollutantMap = cityMap?.get(pollutant);
    const value = pollutantMap?.get(year);
    return Number.isFinite(value) ? value as number : null;
  }

  private matchesCountry(city: City, country: string): boolean {
    if (country === 'All') return true;
    const normalized = country.toLowerCase();
    return city.countryCode.toLowerCase() === normalized || city.countryName.toLowerCase() === normalized;
  }

  private hasPollutant(cityName: string, pollutant: PollutantType): boolean {
    const cityMap = this.annualIndex.get(cityName);
    return Boolean(cityMap?.get(pollutant));
  }

  private getAvailablePollutants(): PollutantType[] {
    const selected = this.selectedCities();
    const country = this.selectedCountry();
    const cities = selected.length
      ? selected
      : this.dataService.getCities().filter(city => this.matchesCountry(city, country));
    const available = new Set<PollutantType>();
    cities.forEach(city => {
      const cityMap = this.annualIndex.get(city.cityName);
      if (!cityMap) return;
      Array.from(cityMap.keys()).forEach(param => available.add(param));
    });
    return Array.from(available.values());
  }

  private getEarliestAvailableYear(cities: City[], pollutant: PollutantType): number | null {
    const years = [2019, 2020, 2021, 2022, 2023];
    let earliest: number | null = null;
    cities.forEach(city => {
      for (const year of years) {
        const value = this.getAnnualValue(city.cityName, pollutant, year);
        if (value === null) continue;
        if (earliest === null || year < earliest) {
          earliest = year;
        }
        break;
      }
    });
    return earliest;
  }

  private syncFocusYear(): void {
    const activeCity = this.activeCityName();
    const fallbackCity = this.selectedCities()[0]?.cityName ?? null;
    const cityName = activeCity ?? fallbackCity;
    if (!cityName) return;
    const pollutant = this.selectedPollutant();
    const firstYear = this.getFirstAvailableYear(cityName, pollutant);
    if (firstYear !== null && this.focusYear() !== firstYear) {
      this.focusYear.set(firstYear);
    }
  }

  private getFirstAvailableYear(cityName: string, pollutant: PollutantType): number | null {
    const years = [2019, 2020, 2021, 2022, 2023];
    for (const year of years) {
      const value = this.getAnnualValue(cityName, pollutant, year);
      if (value !== null) return year;
    }
    return null;
  }

  private getAvailabilityRange(cityName: string, pollutant: PollutantType): { start: number; end: number } | null {
    const years = [2019, 2020, 2021, 2022, 2023];
    const available = years.filter(year => this.getAnnualValue(cityName, pollutant, year) !== null);
    if (!available.length) return null;
    return { start: available[0], end: available[available.length - 1] };
  }

  formatValue(value: number | null): string {
    return Number.isFinite(value) ? (value as number).toFixed(2) : 'n/a';
  }

  private isValidPollutant(value: string): value is PollutantType {
    return ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(value);
  }

  private getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private getSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  private getCheckboxValue(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  private stopPlay(): void {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.isPlaying.set(false);
  }

  private emptyChart(type: ChartType): ChartBlock {
    return {
      type,
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false },
      plugins: []
    };
  }

  private playInterval: ReturnType<typeof setInterval> | null = null;
}
