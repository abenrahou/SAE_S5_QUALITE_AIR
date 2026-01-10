import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService } from '../../core/services/data.service';
import { City, Indicator, PollutantType } from '../../core/models';
import { StatsUtils } from '../../shared/utils/stats.utils';

type CategoryKey =
  | 'pollution'
  | 'urbanisation'
  | 'developpement'
  | 'energie'
  | 'transport'
  | 'environnement'
  | 'social';

interface VariableDefinition {
  key: string;
  label: string;
  category: CategoryKey;
  unit?: string;
  accessor: (city: City, indicator: Indicator | undefined, pollution: Map<PollutantType, number>) => number | null;
}

interface HeatmapCell {
  x: VariableDefinition;
  y: VariableDefinition;
  r: number;
  n: number;
}

interface ScatterState {
  x: VariableDefinition;
  y: VariableDefinition;
  points: { x: number; y: number; city: string }[];
  r: number;
  pValue: number;
  r2: number;
}

@Component({
  selector: 'app-correlation',
  imports: [CommonModule, LoadingSpinnerComponent, BaseChartDirective],
  templateUrl: './correlation.component.html',
  styleUrls: ['./correlation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorrelationComponent implements OnInit {
  private readonly dataService = inject(DataService);
  readonly isLoading = signal(true);

  readonly categories: { key: CategoryKey; label: string }[] = [
    { key: 'pollution', label: 'Pollution' },
    { key: 'urbanisation', label: 'Urbanisation' },
    { key: 'developpement', label: 'Développement' },
    { key: 'energie', label: 'Énergie' },
    { key: 'transport', label: 'Transport' },
    { key: 'environnement', label: 'Environnement' },
    { key: 'social', label: 'Social' }
  ];

  readonly categorySelection = signal<Record<CategoryKey, boolean>>({
    pollution: true,
    urbanisation: true,
    developpement: true,
    energie: true,
    transport: true,
    environnement: true,
    social: true
  });

  readonly sortPollutant = signal<PollutantType | 'none'>('none');
  readonly groupByCategory = signal(false);
  readonly totalCityCount = computed(() => this.dataService.getCities().length);

  private readonly variableDefinitions: VariableDefinition[] = [
    {
      key: 'pm25',
      label: 'PM2.5',
      unit: 'ug/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('pm25') ?? null
    },
    {
      key: 'pm10',
      label: 'PM10',
      unit: 'ug/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('pm10') ?? null
    },
    {
      key: 'no2',
      label: 'NO2',
      unit: 'ug/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('no2') ?? null
    },
    {
      key: 'o3',
      label: 'O3',
      unit: 'ug/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('o3') ?? null
    },
    {
      key: 'so2',
      label: 'SO2',
      unit: 'ug/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('so2') ?? null
    },
    {
      key: 'co',
      label: 'CO',
      unit: 'mg/m3',
      category: 'pollution',
      accessor: (_city, _indicator, pollution) => pollution.get('co') ?? null
    },
    {
      key: 'density',
      label: 'Densité population',
      unit: 'hab/km2',
      category: 'urbanisation',
      accessor: (_city, indicator) => indicator?.density ?? null
    },
    {
      key: 'urbanPopulationPct',
      label: 'Population urbaine',
      unit: '%',
      category: 'urbanisation',
      accessor: (_city, indicator) => indicator?.urbanPopulationPct ?? null
    },
    {
      key: 'urbanGrowth',
      label: 'Croissance urbaine',
      unit: '%/an',
      category: 'urbanisation',
      accessor: (_city, indicator) => indicator?.urbanGrowth ?? null
    },
    {
      key: 'totalPopulation',
      label: 'Population totale pays',
      unit: 'hab',
      category: 'urbanisation',
      accessor: (_city, indicator) => indicator?.totalPopulation ?? null
    },
    {
      key: 'surfaceKm2',
      label: 'Superficie',
      unit: 'km2',
      category: 'urbanisation',
      accessor: (_city, indicator) => indicator?.surfaceKm2 ?? null
    },
    {
      key: 'gdpPerCapita',
      label: 'PIB par habitant',
      unit: 'USD',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.gdpPerCapita ?? null
    },
    {
      key: 'gdpTotal',
      label: 'PIB total',
      unit: 'USD',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.gdpTotal ?? null
    },
    {
      key: 'gdpGrowth',
      label: 'Croissance PIB',
      unit: '%',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.gdpGrowth ?? null
    },
    {
      key: 'industryPctGdp',
      label: 'Industrie % PIB',
      unit: '%',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.industryPctGdp ?? null
    },
    {
      key: 'agriculturePctGdp',
      label: 'Agriculture % PIB',
      unit: '%',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.agriculturePctGdp ?? null
    },
    {
      key: 'servicesPctGdp',
      label: 'Services % PIB',
      unit: '%',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.servicesPctGdp ?? null
    },
    {
      key: 'secondarySectorPct',
      label: 'Secteur secondaire %',
      unit: '%',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.secondarySectorPct ?? null
    },
    {
      key: 'privateConsumption',
      label: 'Consommation privee',
      unit: 'USD',
      category: 'developpement',
      accessor: (_city, indicator) => indicator?.privateConsumption ?? null
    },
    {
      key: 'energyPerCapita',
      label: 'Énergie par habitant',
      unit: 'kg eq. petrole',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.energyPerCapita ?? null
    },
    {
      key: 'coalPct',
      label: 'Électricité charbon',
      unit: '%',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.coalPct ?? null
    },
    {
      key: 'renewablePct',
      label: 'Énergies renouvelables',
      unit: '%',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.renewablePct ?? null
    },
    {
      key: 'electricityPerCapita',
      label: 'Électricité par habitant',
      unit: 'kWh',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.electricityPerCapita ?? null
    },
    {
      key: 'electricityLossPct',
      label: 'Pertes electricite',
      unit: '%',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.electricityLossPct ?? null
    },
    {
      key: 'energyIntensity',
      label: 'Intensite energetique',
      unit: 'energie/PIB',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.energyIntensity ?? null
    },
    {
      key: 'coalRenewableRatio',
      label: 'Ratio charbon/renouvelables',
      unit: '',
      category: 'energie',
      accessor: (_city, indicator) => indicator?.coalRenewableRatio ?? null
    },
    {
      key: 'airPassengers',
      label: 'Passagers aeriens',
      unit: 'millions',
      category: 'transport',
      accessor: (_city, indicator) => indicator?.airPassengers ?? null
    },
    {
      key: 'railwaysKm',
      label: 'Voies ferrees',
      unit: 'km',
      category: 'transport',
      accessor: (_city, indicator) => indicator?.railwaysKm ?? null
    },
    {
      key: 'forestPct',
      label: 'Couverture forestiere',
      unit: '%',
      category: 'environnement',
      accessor: (_city, indicator) => indicator?.forestPct ?? null
    },
    {
      key: 'freshwaterKm3',
      label: 'Eau douce',
      unit: 'km3',
      category: 'environnement',
      accessor: (_city, indicator) => indicator?.freshwaterKm3 ?? null
    },
    {
      key: 'lifeExpectancy',
      label: 'Espérance de vie',
      unit: 'ans',
      category: 'social',
      accessor: (_city, indicator) => indicator?.lifeExpectancy ?? null
    },
    {
      key: 'secondaryEnrollmentPct',
      label: 'Scolarisation secondaire',
      unit: '%',
      category: 'social',
      accessor: (_city, indicator) => indicator?.secondaryEnrollmentPct ?? null
    },
    {
      key: 'waterAccessPct',
      label: 'Accès eau potable',
      unit: '%',
      category: 'social',
      accessor: (_city, indicator) => indicator?.waterAccessPct ?? null
    },
    {
      key: 'giniIndex',
      label: 'Indice Gini',
      unit: '',
      category: 'social',
      accessor: (_city, indicator) => indicator?.giniIndex ?? null
    }
  ];

  readonly pollutantSortOptions = this.variableDefinitions
    .filter(variable => variable.category === 'pollution')
    .map(variable => ({ value: variable.key as PollutantType, label: variable.label }));

  readonly selectedVariables = computed(() => {
    const selection = this.categorySelection();
    let vars = this.variableDefinitions.filter(v => selection[v.category]);
    const sortTarget = this.sortPollutant() !== 'none'
      ? this.variableDefinitions.find(v => v.key === this.sortPollutant())
      : undefined;
    const correlationMap = new Map<string, number>();
    if (sortTarget) {
      vars.forEach(variable => {
        correlationMap.set(variable.key, Math.abs(this.computeCorrelation(sortTarget, variable).r));
      });
    }
    if (this.groupByCategory()) {
      const order: CategoryKey[] = ['pollution', 'urbanisation', 'developpement', 'energie', 'transport', 'environnement', 'social'];
      vars = [...vars].sort((a, b) => {
        const delta = order.indexOf(a.category) - order.indexOf(b.category);
        if (delta !== 0) return delta;
        if (sortTarget) {
          const rA = correlationMap.get(a.key) ?? 0;
          const rB = correlationMap.get(b.key) ?? 0;
          return rB - rA;
        }
        return a.label.localeCompare(b.label);
      });
    } else if (sortTarget) {
      vars = [...vars].sort((a, b) => {
        const rA = correlationMap.get(a.key) ?? 0;
        const rB = correlationMap.get(b.key) ?? 0;
        return rB - rA;
      });
    }
    return vars;
  });

  readonly topCorrelations = computed(() => {
    const vars = this.selectedVariables();
    const rows: { key: string; rank: number; left: string; right: string; r: number; n: number }[] = [];
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        const result = this.computeCorrelation(vars[i], vars[j]);
        rows.push({
          key: `${vars[i].key}-${vars[j].key}`,
          rank: 0,
          left: vars[i].label,
          right: vars[j].label,
          r: result.r,
          n: result.n
        });
      }
    }
    rows.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return rows.slice(0, 10).map((item, index) => ({ ...item, rank: index + 1 }));
  });

  readonly scatterState = signal<ScatterState | null>(null);
  readonly infoOpen = signal(false);
  readonly topInfoOpen = signal(false);
  scatterChart: ChartConfiguration<'scatter'> = {
    type: 'scatter',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
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
        x: { grid: { color: 'rgba(148, 163, 184, 0.2)' }, ticks: { color: '#475569' } },
        y: { grid: { color: 'rgba(148, 163, 184, 0.2)' }, ticks: { color: '#475569' } }
      }
    }
  };

  private indicators = new Map<string, Indicator>();
  private pollutionMap = new Map<string, Map<PollutantType, number>>();

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

  toggleCategory(key: CategoryKey): void {
    this.categorySelection.update(selection => ({
      ...selection,
      [key]: !selection[key]
    }));
  }

  toggleGrouping(): void {
    this.groupByCategory.set(!this.groupByCategory());
  }

  setSortPollutant(value: string): void {
    if (value === 'none') {
      this.sortPollutant.set('none');
      return;
    }
    this.sortPollutant.set(value as PollutantType);
  }

  onSortPollutantChange(event: Event): void {
    this.setSortPollutant((event.target as HTMLSelectElement).value);
  }

  getCell(row: VariableDefinition, col: VariableDefinition): HeatmapCell {
    if (row.key === col.key) {
      return { x: row, y: col, r: 1, n: this.dataService.getCities().length };
    }
    return this.computeCorrelation(row, col);
  }

  openScatter(cell: HeatmapCell): void {
    const points = this.collectScatterPoints(cell.x, cell.y);
    const r = cell.r;
    const n = points.length;
    const t = n >= 3 ? StatsUtils.tStatistic(r, n) : 0;
    const p = n >= 3 ? StatsUtils.tTestPValue(t, n - 2) : 1;
    this.scatterState.set({
      x: cell.x,
      y: cell.y,
      points,
      r,
      pValue: p,
      r2: r * r
    });
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)';
    this.scatterChart = {
      type: 'scatter',
      data: {
        datasets: [
          {
            data: points,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: isDark ? '#0b1120' : '#ffffff',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
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
          x: {
            title: { display: true, text: `${cell.x.label} ${cell.x.unit ?? ''}`.trim(), color: textColor },
            grid: { color: gridColor },
            ticks: { color: textColor }
          },
          y: {
            title: { display: true, text: `${cell.y.label} ${cell.y.unit ?? ''}`.trim(), color: textColor },
            grid: { color: gridColor },
            ticks: { color: textColor }
          }
        }
      }
    };
  }

  closeScatter(): void {
    this.scatterState.set(null);
  }

  openInfo(): void {
    this.infoOpen.set(true);
  }

  closeInfo(): void {
    this.infoOpen.set(false);
  }

  openTopInfo(): void {
    this.topInfoOpen.set(true);
  }

  closeTopInfo(): void {
    this.topInfoOpen.set(false);
  }

  formatCorrelation(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
  }

  cellTitle(cell: HeatmapCell): string {
    return `${cell.x.label} vs ${cell.y.label} | r=${this.formatCorrelation(cell.r)} | n=${cell.n}`;
  }

  colorFor(value: number): string {
    const clamped = Math.max(-1, Math.min(1, value));
    const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
    if (clamped < 0) {
      const t = Math.abs(clamped);
      const r = mix(248, 30, t);
      const g = mix(250, 58, t);
      const b = mix(252, 138, t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    const t = clamped;
    const r = mix(248, 185, t);
    const g = mix(250, 28, t);
    const b = mix(252, 28, t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private initialize(): void {
    this.buildCaches();
    this.isLoading.set(false);
  }

  private buildCaches(): void {
    this.indicators.clear();
    this.dataService.getIndicators().forEach(indicator => {
      if (indicator.cityName) {
        this.indicators.set(indicator.cityName, indicator);
      }
    });
    this.pollutionMap.clear();
    this.dataService.getPollutionData().forEach(row => {
      const cityMap = this.pollutionMap.get(row.cityName) ?? new Map<PollutantType, number>();
      cityMap.set(row.parameter, row.valueMean);
      this.pollutionMap.set(row.cityName, cityMap);
    });
  }

  private computeCorrelation(left: VariableDefinition, right: VariableDefinition): HeatmapCell {
    const points = this.collectScatterPoints(left, right);
    const xValues = points.map(point => point.x);
    const yValues = points.map(point => point.y);
    const r = StatsUtils.correlation(xValues, yValues);
    return { x: left, y: right, r, n: points.length };
  }

  private collectScatterPoints(left: VariableDefinition, right: VariableDefinition): { x: number; y: number; city: string }[] {
    const points: { x: number; y: number; city: string }[] = [];
    this.dataService.getCities().forEach(city => {
      const indicator = this.indicators.get(city.cityName);
      const pollution = this.pollutionMap.get(city.cityName) ?? new Map<PollutantType, number>();
      const x = left.accessor(city, indicator, pollution);
      const y = right.accessor(city, indicator, pollution);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      points.push({ x: x as number, y: y as number, city: city.cityName });
    });
    return points;
  }
}
