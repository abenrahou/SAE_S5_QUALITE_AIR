
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService } from '../../core/services/data.service';
import {
  City,
  Indicator,
  IndicatorMetadata,
  PollutantType,
  POLLUTANT_INFO,
  INDICATOR_METADATA,
  getQualityColor,
  getQualityLevel
} from '../../core/models';
import { StatsUtils } from '../../shared/utils/stats.utils';

type ModelKey = 'linear' | 'knn' | 'forest';
type FeatureScope = 'basic' | 'extended' | 'full';
type FeatureCategory = IndicatorMetadata['category'];

interface FeatureConfig {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}

interface FeatureStat extends FeatureConfig {
  mean: number;
  coverage: number;
  category: IndicatorMetadata['category'];
}

interface DataRow {
  city: City;
  indicator: Indicator | undefined;
  features: number[];
  target: number;
}

interface ModelResult {
  key: ModelKey;
  label: string;
  r2Mean: number;
  r2Std: number;
  maeMean: number;
  maeStd: number;
  rmseMean: number;
  rmseStd: number;
}

interface ModelMetricsSplit {
  r2Train: number;
  r2Test: number;
  maeTrain: number;
  maeTest: number;
  rmseTrain: number;
  rmseTest: number;
}

interface RegressionModel {
  predict: (features: number[]) => number;
  residualStd: number;
}

interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number;
}

@Component({
  selector: 'app-prediction',
  imports: [CommonModule, LoadingSpinnerComponent, BaseChartDirective],
  templateUrl: './prediction.component.html',
  styleUrls: ['./prediction.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PredictionComponent implements OnInit {
  private readonly dataService = inject(DataService);
  readonly isLoading = signal(true);

  readonly infoOpen = signal(false);
  readonly metricsInfoOpen = signal(false);
  readonly importanceInfoOpen = signal(false);

  readonly featureScope = signal<FeatureScope>('extended');
  readonly categoryFilter = signal<FeatureCategory | 'all'>('all');
  readonly featureOverrideKeys = signal<string[] | null>(null);
  readonly featureStats = signal<Record<string, FeatureStat>>({});
  readonly featureConfigs = computed(() => {
    const stats = this.featureStats();
    return this.selectedFeatureKeys()
      .map(key => stats[key])
      .filter((value): value is FeatureStat => Boolean(value));
  });
  readonly featureRelevance = signal<Record<string, number>>({});
  readonly scopeNote = computed(() => {
    const extended = this.featureKeysForScope('extended');
    const full = this.featureKeysForScope('full');
    if (!extended.length) return '';
    if (extended.length === full.length) {
      return 'Étendu et exhaustif sont identiques pour ces données.';
    }
    return '';
  });
  readonly sortedFeatureConfigs = computed(() => {
    const relevance = this.featureRelevance();
    return [...this.featureConfigs()].sort((a, b) => {
      const scoreA = relevance[a.key] ?? 0;
      const scoreB = relevance[b.key] ?? 0;
      if (scoreA === scoreB) return a.label.localeCompare(b.label);
      return scoreB - scoreA;
    });
  });

  readonly featureValues = signal<Record<string, number>>({});

  readonly selectedPollutant = signal<PollutantType>('pm25');
  readonly pollutantOptions = Object.entries(POLLUTANT_INFO).map(([key, info]) => ({
    value: key as PollutantType,
    label: info.name,
    unit: info.unit
  }));
  readonly pollutantInfo = computed(() => POLLUTANT_INFO[this.selectedPollutant()]);

  readonly selectedModel = signal<ModelKey>('forest');
  readonly selectedCity = signal('');
  readonly history = signal<{ id: number; label: string; value: number; unit: string; pollutant: string }[]>([]);
  readonly primaryFeatureKey = signal<string>('coalPct');
  readonly foldCount = signal(0);

  readonly selectedFeatureKeys = computed(() => {
    const override = this.featureOverrideKeys();
    if (override && override.length) return override;
    return this.featureKeysForScope(this.featureScope());
  });

  readonly activeFeatures = computed(() => {
    const model = this.selectedModel();
    switch (model) {
      case 'linear':
        return this.primaryFeatureKey() ? [this.primaryFeatureKey()] : [];
      case 'knn':
      case 'forest':
        return this.selectedFeatureKeys();
      default:
        return [];
    }
  });
  readonly modelNote = computed(() => {
    const features = this.activeFeatures();
    if (!features.length) return '';
    const labels = features
      .map(key => this.featureLabel(key))
      .join(', ');
    if (features.length === 1) {
      return `Seule la variable ${labels} influence ce modèle.`;
    }
    return `Variables actives: ${labels}.`;
  });

  readonly models = signal<ModelResult[]>([]);
  readonly predictionModel = signal<RegressionModel | null>(null);
  readonly modelCatalog = signal<Record<ModelKey, RegressionModel>>({} as Record<ModelKey, RegressionModel>);
  readonly variableImportance = signal<{ label: string; value: number }[]>([]);
  readonly validCityCount = signal(0);
  readonly bestModel = computed(() => {
    const models = this.models();
    if (!models.length) return null;
    return [...models].sort((a, b) => {
      if (a.r2Mean === b.r2Mean) return a.rmseMean - b.rmseMean;
      return b.r2Mean - a.r2Mean;
    })[0];
  });
  readonly lowSampleWarning = computed(() => {
    const count = this.validCityCount();
    return count > 0 && count < 40;
  });
  readonly availableCategories = computed(() => {
    const stats = this.featureStats();
    const categories = new Set<FeatureCategory>();
    Object.values(stats).forEach(stat => categories.add(stat.category));
    return Array.from(categories).sort();
  });
  readonly autoActive = computed(() => {
    const override = this.featureOverrideKeys();
    return Array.isArray(override) && override.length > 0;
  });
  readonly autoFeatureList = computed(() => {
    if (!this.autoActive()) return [];
    const relevance = this.featureRelevance();
    return this.selectedFeatureKeys().map(key => ({
      key,
      label: this.featureLabel(key),
      score: relevance[key] ?? 0
    }));
  });

  readonly featureVector = computed(() => {
    const values = this.featureValues();
    const stats = this.featureStats();
    return this.selectedFeatureKeys().map(key => {
      const value = values[key];
      if (Number.isFinite(value)) return value as number;
      return stats[key]?.mean ?? 0;
    });
  });

  readonly predictedValue = signal(0);
  private readonly predictionEffect = effect(() => {
    const model = this.modelCatalog()[this.selectedModel()];
    const input = this.featureVector();
    this.predictedValue.set(model ? model.predict(input) : 0);
  });

  readonly predictionBadge = computed(() => {
    const value = this.predictedValue();
    const level = getQualityLevel(value, this.selectedPollutant());
    return { label: level, color: getQualityColor(level) };
  });

  readonly qualityLegend = computed(() => {
    const guideline = this.pollutantInfo().whoGuideline;
    const colors: Record<string, string> = {
      Bon: '#10b981',
      Modere: '#f59e0b',
      Mauvais: '#f97316',
      'Tres mauvais': '#ef4444'
    };
    const thresholds = [
      { label: 'Bon', value: guideline * 1.2, isUpper: true },
      { label: 'Modéré', value: guideline * 3.5, isUpper: true },
      { label: 'Mauvais', value: guideline * 5.5, isUpper: true },
      { label: 'Très mauvais', value: guideline * 5.5, isUpper: false }
    ];
    return thresholds.map((item, index) => ({
      label: item.label,
      value: item.value,
      isUpper: item.isUpper,
      color: colors[item.label] ?? '#94a3b8'
    }));
  });

  readonly confidenceInterval = computed(() => {
    const model = this.modelCatalog()[this.selectedModel()];
    const value = this.predictedValue();
    const margin = model ? 1.96 * model.residualStd : 0;
    const low = Math.max(0, value - margin);
    const high = value + margin;
    return { low, high };
  });

  readonly uncertaintyWarning = computed(() => {
    const interval = this.confidenceInterval();
    const span = interval.high - interval.low;
    const guideline = this.pollutantInfo().whoGuideline;
    return span > guideline * 6;
  });

  readonly cityOptions = computed(() => {
    const pollutant = this.selectedPollutant();
    const available = new Set(
      this.dataService
        .getPollutionData()
        .filter(row => row.parameter === pollutant)
        .map(row => row.cityName)
    );
    return this.dataService.getCities().filter(city => available.has(city.cityName));
  });

  readonly cityComparison = computed(() => {
    const city = this.selectedCity();
    if (!city) return null;
    const actual = this.getCityPollutant(city);
    if (!Number.isFinite(actual)) return null;
    const delta = (actual as number) - this.predictedValue();
    return { actual, delta };
  });

  r2Chart: ChartConfiguration<'bar'> = { type: 'bar', data: { labels: [], datasets: [] }, options: {} };
  importanceChart: ChartConfiguration<'bar'> = { type: 'bar', data: { labels: [], datasets: [] }, options: {} };

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

  updateFeature(key: string, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.featureValues.update(current => ({ ...current, [key]: parsed }));
  }

  onFeatureInput(key: string, event: Event): void {
    this.updateFeature(key, this.getInputValue(event));
  }

  onModelChange(event: Event): void {
    this.setModel(this.getSelectValue(event));
  }

  onFeatureScopeChange(event: Event): void {
    this.setFeatureScope(this.getSelectValue(event));
  }

  onCategoryFilterChange(event: Event): void {
    this.setCategoryFilter(this.getSelectValue(event));
  }

  onPollutantChange(event: Event): void {
    this.setPollutant(this.getSelectValue(event));
  }

  onCityChange(event: Event): void {
    this.setCity(this.getSelectValue(event));
  }

  setModel(key: string): void {
    if (['linear', 'knn', 'forest'].includes(key)) {
      this.selectedModel.set(key as ModelKey);
    }
  }

  setFeatureScope(value: string): void {
    if (!['basic', 'extended', 'full'].includes(value)) return;
    this.featureOverrideKeys.set(null);
    this.featureRelevance.set({});
    this.featureScope.set(value as FeatureScope);
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
  }

  setCategoryFilter(value: string): void {
    if (value !== 'all' && !this.availableCategories().includes(value as FeatureCategory)) return;
    this.categoryFilter.set(value as FeatureCategory | 'all');
    this.featureOverrideKeys.set(null);
    this.featureRelevance.set({});
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
  }

  setPollutant(value: string): void {
    if (!Object.prototype.hasOwnProperty.call(POLLUTANT_INFO, value)) return;
    this.selectedPollutant.set(value as PollutantType);
    this.selectedCity.set('');
    this.history.set([]);
    this.featureOverrideKeys.set(null);
    this.featureRelevance.set({});
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
  }

  setCity(name: string): void {
    this.selectedCity.set(name);
  }

  private getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private getSelectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  resetSimulation(): void {
    const stats = this.featureStats();
    const keys = this.selectedFeatureKeys();
    const next: Record<string, number> = {};
    keys.forEach(key => {
      const stat = stats[key];
      if (stat) {
        next[key] = stat.mean;
      }
    });
    this.featureValues.set(next);
  }

  saveSimulation(): void {
    const value = this.predictedValue();
    const pollutant = this.pollutantInfo().name;
    const unit = this.pollutantInfo().unit;
    const label = `${new Date().toLocaleTimeString()} - ${this.selectedModel()} - ${pollutant}`;
    this.history.update(current => [{ id: Date.now(), label, value, unit, pollutant }, ...current].slice(0, 6));
  }

  applyScenario(type: 'green' | 'worst'): void {
    const updates: Record<string, number> = {};
    if (type === 'green') {
      updates['coalPct'] = 5;
      updates['density'] = 2000;
      updates['gdpPerCapita'] = 28000;
      updates['renewablePct'] = 80;
      updates['industryPctGdp'] = 15;
    } else {
      updates['coalPct'] = 90;
      updates['density'] = 15000;
      updates['gdpPerCapita'] = 9000;
      updates['renewablePct'] = 5;
      updates['industryPctGdp'] = 45;
    }
    this.featureValues.update(current => {
      const stats = this.featureStats();
      const next = { ...current };
      Object.entries(updates).forEach(([key, value]) => {
        if (key in current) {
          const stat = stats[key];
          if (stat) {
            next[key] = Math.min(stat.max, Math.max(stat.min, value));
          } else {
            next[key] = value;
          }
        }
      });
      return next;
    });
  }

  formatValue(key: string): string {
    return this.formatRangeValue(this.featureValues()[key] ?? 0);
  }

  isFeatureActive(key: string): boolean {
    return this.activeFeatures().includes(key);
  }

  featureCountLabel(scope: FeatureScope): string {
    return `${this.featureKeysForScope(scope).length} vars`;
  }

  categoryLabel(category: FeatureCategory): string {
    const labels: Record<FeatureCategory, string> = {
      urbanisation: 'Urbanisation',
      developpement: 'Développement',
      energie: 'Énergie',
      transport: 'Transport',
      environnement: 'Environnement',
      social: 'Social'
    };
    return labels[category] ?? category;
  }

  formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  formatRangeValue(value: number): string {
    if (!Number.isFinite(value)) return '-';
    const abs = Math.abs(value);
    if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (abs >= 10000) return `${Math.round(value / 1000)}k`;
    if (abs >= 1000) return value.toFixed(0);
    if (abs >= 100) return value.toFixed(0);
    if (abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  totalFeatureCount(): number {
    return Object.keys(this.featureStats()).length;
  }

  excludedFeatureCount(): number {
    const total = this.totalFeatureCount();
    const selected = this.selectedFeatureKeys().length;
    return Math.max(0, total - selected);
  }

  coverageThresholdLabel(): string {
    if (this.featureScope() === 'basic') return 'Variables fixes';
    const threshold = this.featureScope() === 'extended' ? 0.5 : 0.3;
    return `${Math.round(threshold * 100)}%`;
  }

  autoSelectFeatures(): void {
    const stats = this.featureStats();
    const keys = Object.keys(stats);
    if (!keys.length) return;
    const rows = this.buildRowsForKeys(keys);
    if (!rows.length) return;
    const targets = rows.map(row => row.target);
    const scores = keys.map((key, index) => {
      const column = rows.map(row => row.features[index]);
      const corr = Math.abs(StatsUtils.correlation(column, targets));
      const coverage = stats[key]?.coverage ?? 0;
      return { key, score: corr, coverage };
    });
    const selected = scores
      .filter(item => item.coverage >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.key);
    const relevanceMap = scores.reduce<Record<string, number>>((acc, item) => {
      acc[item.key] = item.score;
      return acc;
    }, {});
    this.featureRelevance.set(relevanceMap);
    this.featureOverrideKeys.set(selected);
    this.categoryFilter.set('all');
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
  }

  resetAuto(): void {
    this.featureOverrideKeys.set(null);
    this.featureRelevance.set({});
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
  }

  private featureKeysForScope(scope: FeatureScope): string[] {
    const stats = this.featureStats();
    const available = Object.keys(stats);
    if (scope === 'basic') {
      return ['coalPct', 'density', 'gdpPerCapita', 'renewablePct', 'industryPctGdp']
        .filter(key => available.includes(key));
    }
    const entries = Object.values(stats);
    const threshold = scope === 'extended' ? 0.5 : 0.3;
    const filtered = entries
      .filter(entry => entry.coverage >= threshold)
      .filter(entry => this.categoryFilter() === 'all' || entry.category === this.categoryFilter())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(entry => entry.key);
    return filtered;
  }

  openInfo(): void {
    this.infoOpen.set(true);
  }

  closeInfo(): void {
    this.infoOpen.set(false);
  }

  openMetricsInfo(): void {
    this.metricsInfoOpen.set(true);
  }

  closeMetricsInfo(): void {
    this.metricsInfoOpen.set(false);
  }

  openImportanceInfo(): void {
    this.importanceInfoOpen.set(true);
  }

  closeImportanceInfo(): void {
    this.importanceInfoOpen.set(false);
  }

  modelVariables(key: ModelKey): string {
    if (key === 'linear') {
      return this.featureLabel(this.primaryFeatureKey()) || 'Variable principale';
    }
    const labels = this.selectedFeatureKeys().map(keyName => this.featureLabel(keyName));
    if (!labels.length) return 'Variables disponibles';
    if (labels.length > 6) {
      return `${labels.slice(0, 6).join(', ')} +${labels.length - 6}`;
    }
    return labels.join(', ');
  }

  private featureLabel(key: string): string {
    return this.featureStats()[key]?.label ?? key;
  }

  private buildFeatureStats(): void {
    const indicators = this.dataService.getIndicators();
    const total = indicators.length || 1;
    const definitions = this.getFeatureDefinitions();
    const stats: Record<string, FeatureStat> = {};

    definitions.forEach(def => {
      const values = indicators
        .map(indicator => this.getIndicatorValue(indicator, def.key))
        .filter(Number.isFinite) as number[];
      if (!values.length) return;
      const sorted = [...values].sort((a, b) => a - b);
      const min = this.quantile(sorted, 0.05);
      const max = this.quantile(sorted, 0.95);
      const safeMin = Number.isFinite(min) ? min : StatsUtils.min(values);
      const safeMax = Number.isFinite(max) ? max : StatsUtils.max(values);
      const finalMin = safeMin === safeMax ? StatsUtils.min(values) : safeMin;
      const finalMax = safeMin === safeMax ? StatsUtils.max(values) : safeMax;
      const mean = StatsUtils.mean(values);
      stats[def.key] = {
        key: def.key,
        label: def.label,
        unit: def.unit,
        category: def.category,
        min: finalMin,
        max: finalMax,
        step: this.computeStep(finalMin, finalMax, def.unit),
        mean,
        coverage: values.length / total
      };
    });

    this.featureStats.set(stats);
    if (!Object.keys(this.featureValues()).length) {
      const defaults: Record<string, number> = {};
      Object.values(stats).forEach(stat => {
        defaults[stat.key] = stat.mean;
      });
      this.featureValues.set(defaults);
    }
  }

  private syncFeatureValues(): void {
    const stats = this.featureStats();
    const keys = this.selectedFeatureKeys();
    if (!keys.length) return;
    const current = this.featureValues();
    const next: Record<string, number> = {};
    keys.forEach(key => {
      const stat = stats[key];
      if (!stat) return;
      const raw = Number.isFinite(current[key]) ? (current[key] as number) : stat.mean;
      const clamped = Math.min(stat.max, Math.max(stat.min, raw));
      next[key] = clamped;
    });
    this.featureValues.set(next);
  }

  private getFeatureDefinitions(): Array<{ key: string; label: string; unit: string; category: FeatureCategory }> {
    const base = INDICATOR_METADATA.map(meta => ({
      key: meta.key as string,
      label: meta.label,
      unit: meta.unit ?? '',
      category: meta.category
    }));
    const extras = [
      { key: 'urbanPopulationPct', label: 'Population urbaine', unit: '%', category: 'urbanisation' },
      { key: 'totalPopulation', label: 'Population totale', unit: 'hab', category: 'urbanisation' },
      { key: 'urbanGrowth', label: 'Croissance urbaine', unit: '%/an', category: 'urbanisation' },
      { key: 'surfaceKm2', label: 'Superficie', unit: 'km2', category: 'urbanisation' },
      { key: 'gdpTotal', label: 'PIB total', unit: 'USD', category: 'developpement' },
      { key: 'gdpGrowth', label: 'Croissance PIB', unit: '%/an', category: 'developpement' },
      { key: 'agriculturePctGdp', label: 'Agriculture % PIB', unit: '% PIB', category: 'developpement' },
      { key: 'secondarySectorPct', label: 'Secteur secondaire', unit: '% PIB', category: 'developpement' },
      { key: 'privateConsumption', label: 'Consommation privée', unit: '% PIB', category: 'developpement' },
      { key: 'electricityPerCapita', label: 'Électricité par habitant', unit: 'kWh', category: 'energie' },
      { key: 'electricityLossPct', label: 'Pertes électricité', unit: '%', category: 'energie' },
      { key: 'energyIntensity', label: 'Intensité énergétique', unit: '', category: 'energie' },
      { key: 'coalRenewableRatio', label: 'Ratio charbon/renouvelables', unit: '', category: 'energie' },
      { key: 'airPassengers', label: 'Passagers aériens', unit: '', category: 'transport' },
      { key: 'railwaysKm', label: 'Voies ferrées', unit: 'km', category: 'transport' },
      { key: 'forestPct', label: 'Couverture forestière', unit: '%', category: 'environnement' },
      { key: 'freshwaterKm3', label: 'Eau douce', unit: 'km3', category: 'environnement' },
      { key: 'secondaryEnrollmentPct', label: 'Scolarisation secondaire', unit: '%', category: 'social' },
      { key: 'waterAccessPct', label: 'Accès eau potable', unit: '%', category: 'social' },
      { key: 'measurementsPerDay', label: 'Mesures par jour', unit: '', category: 'social' },
      { key: 'coefficientOfVariation', label: 'Coefficient de variation', unit: '', category: 'social' }
    ];
    const map = new Map<string, { key: string; label: string; unit: string; category: FeatureCategory }>();
    [...base, ...extras].forEach(item => {
      if (!map.has(item.key)) {
        map.set(item.key, item as { key: string; label: string; unit: string; category: FeatureCategory });
      }
    });
    return Array.from(map.values());
  }

  private selectPrimaryFeature(features: number[][], targets: number[], keys: string[]): string {
    if (!features.length || !keys.length) return 'coalPct';
    let bestIndex = 0;
    let bestScore = 0;
    for (let i = 0; i < keys.length; i++) {
      const column = features.map(row => row[i]);
      const score = Math.abs(StatsUtils.correlation(column, targets));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return keys[bestIndex] ?? 'coalPct';
  }

  private computeFeatureRelevance(features: number[][], targets: number[], keys: string[]): Record<string, number> {
    const relevance: Record<string, number> = {};
    keys.forEach((key, index) => {
      const column = features.map(row => row[index]);
      relevance[key] = Math.abs(StatsUtils.correlation(column, targets));
    });
    return relevance;
  }

  private primaryFeatureIndex(keys: string[]): number {
    const primary = this.primaryFeatureKey();
    const index = keys.indexOf(primary);
    return index >= 0 ? index : 0;
  }

  private quantile(values: number[], q: number): number {
    if (!values.length) return 0;
    const pos = (values.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (values[base + 1] === undefined) return values[base];
    return values[base] + rest * (values[base + 1] - values[base]);
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private computeStep(min: number, max: number, unit: string): number {
    const range = Math.abs(max - min);
    if (unit.includes('%')) return 1;
    if (range <= 20) return 0.5;
    if (range <= 100) return 1;
    if (range <= 500) return 5;
    if (range <= 2000) return 10;
    if (range <= 10000) return 50;
    if (range <= 50000) return 500;
    return 1000;
  }

  private getIndicatorValue(indicator: Indicator | undefined, key: string): number {
    if (!indicator) return Number.NaN;
    const value = (indicator as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
  }

  private initialize(): void {
    this.buildFeatureStats();
    this.syncFeatureValues();
    this.trainModels();
    this.buildCharts();
    this.isLoading.set(false);
  }

  private trainModels(): void {
    const rows = this.buildRows();
    this.validCityCount.set(rows.length);
    if (!rows.length) {
      this.models.set([]);
      this.modelCatalog.set({} as Record<ModelKey, RegressionModel>);
      this.variableImportance.set([]);
      this.featureRelevance.set({});
      this.foldCount.set(0);
      return;
    }
    const featureKeys = this.selectedFeatureKeys();
    this.primaryFeatureKey.set(this.selectPrimaryFeature(rows.map(row => row.features), rows.map(row => row.target), featureKeys));
    const relevance = this.computeFeatureRelevance(rows.map(row => row.features), rows.map(row => row.target), featureKeys);
    if (!this.featureOverrideKeys()) {
      this.featureRelevance.set(relevance);
    }
    const cvResults = this.computeCvResults(rows, featureKeys);
    this.foldCount.set(cvResults.folds);

    this.models.set([
      { ...cvResults.metrics.linear, label: 'Régression linéaire' },
      { ...cvResults.metrics.knn, label: 'k-NN' },
      { ...cvResults.metrics.forest, label: 'Random Forest' }
    ]);

    const fullFeatures = rows.map(row => row.features);
    const fullTargets = rows.map(row => row.target);
    const fullLinear = this.trainLinear(rows, rows, featureKeys);
    const fullKnn = this.trainKnn(fullFeatures, fullTargets, fullFeatures, fullTargets, 5);
    const fullForest = this.trainForest(fullFeatures, fullTargets, fullFeatures, fullTargets);

    const models: Record<ModelKey, RegressionModel> = {
      linear: fullLinear.model,
      knn: fullKnn.model,
      forest: fullForest.model
    };
    this.modelCatalog.set(models);
    this.variableImportance.set(fullForest.importance);
  }

  private buildCharts(): void {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#e2e8f0' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)';
    const models = this.models();
    this.r2Chart = {
      type: 'bar',
      data: {
        labels: models.map(model => model.label),
        datasets: [
          {
            label: 'R2 (moyenne)',
            data: models.map(model => model.r2Mean),
            backgroundColor: '#60a5fa'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, max: 1 }
        }
      }
    };

    const importance = this.variableImportance();
    this.importanceChart = {
      type: 'bar',
      data: {
        labels: importance.map(item => item.label),
        datasets: [
          {
            label: 'Importance',
            data: importance.map(item => item.value),
            backgroundColor: '#f97316'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    };
  }

  private buildRows(): DataRow[] {
    const pollutant = this.selectedPollutant();
    const featureKeys = this.selectedFeatureKeys();
    if (!featureKeys.length) return [];
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

    const rawRows: DataRow[] = [];
    this.dataService.getCities().forEach(city => {
      const indicator = indicators.get(city.cityName);
      const pollution = pollutionMap.get(city.cityName);
      const target = pollution?.get(pollutant) ?? null;
      if (!Number.isFinite(target)) return;
      rawRows.push({
        city,
        indicator,
        features: featureKeys.map(key => this.getIndicatorValue(indicator, key)),
        target: target as number
      });
    });

    const featureCount = rawRows[0]?.features.length ?? 0;
    const means = Array.from({ length: featureCount }, (_, idx) => {
      const values = rawRows.map(row => row.features[idx]).filter(Number.isFinite) as number[];
      return values.length ? StatsUtils.mean(values) : 0;
    });

    return rawRows.map(row => ({
      ...row,
      features: row.features.map((value, index) =>
        Number.isFinite(value) ? (value as number) : means[index]
      )
    }));
  }

  private buildRowsForKeys(featureKeys: string[]): DataRow[] {
    const pollutant = this.selectedPollutant();
    if (!featureKeys.length) return [];
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

    const rawRows: DataRow[] = [];
    this.dataService.getCities().forEach(city => {
      const indicator = indicators.get(city.cityName);
      const pollution = pollutionMap.get(city.cityName);
      const target = pollution?.get(pollutant) ?? null;
      if (!Number.isFinite(target)) return;
      rawRows.push({
        city,
        indicator,
        features: featureKeys.map(key => this.getIndicatorValue(indicator, key)),
        target: target as number
      });
    });

    const featureCount = rawRows[0]?.features.length ?? 0;
    const means = Array.from({ length: featureCount }, (_, idx) => {
      const values = rawRows.map(row => row.features[idx]).filter(Number.isFinite) as number[];
      return values.length ? StatsUtils.mean(values) : 0;
    });

    return rawRows.map(row => ({
      ...row,
      features: row.features.map((value, index) =>
        Number.isFinite(value) ? (value as number) : means[index]
      )
    }));
  }

  private buildFolds(rows: DataRow[], folds: number): DataRow[][] {
    const sorted = [...rows].sort((a, b) => this.hashString(a.city.cityName) - this.hashString(b.city.cityName));
    const buckets = Array.from({ length: folds }, () => [] as DataRow[]);
    sorted.forEach((row, index) => {
      buckets[index % folds].push(row);
    });
    return buckets;
  }

  private trainLinear(trainRows: DataRow[], testRows: DataRow[], featureKeys: string[]): { model: RegressionModel; metrics: ModelMetricsSplit } {
    const index = this.primaryFeatureIndex(featureKeys);
    const xTrain = trainRows.map(row => row.features[index]);
    const yTrain = trainRows.map(row => row.target);
    const regression = StatsUtils.linearRegression(xTrain, yTrain);
    const predict = (features: number[]) => regression.a + regression.b * features[index];
    const trainPredictions = xTrain.map(value => regression.a + regression.b * value);
    const testPredictions = testRows.map(row => predict(row.features));
    const testTargets = testRows.map(row => row.target);
    return {
      model: this.wrapModel(predict, yTrain, trainPredictions),
      metrics: this.buildMetrics('linear', trainPredictions, yTrain, testPredictions, testTargets)
    };
  }

  private trainKnn(
    trainFeatures: number[][],
    trainTargets: number[],
    testFeatures: number[][],
    testTargets: number[],
    k: number
  ): { model: RegressionModel; metrics: ModelMetricsSplit } {
    const normalized = this.normalizeFeatures(trainFeatures);
    const predict = (input: number[]) => {
      const normInput = this.normalizeVector(input, normalized.means, normalized.stds);
      const distances = normalized.data.map((row, index) => ({
        index,
        dist: this.euclidean(row, normInput)
      }));
      distances.sort((a, b) => a.dist - b.dist);
      const neighbors = distances.slice(0, k).map(item => trainTargets[item.index]);
      return StatsUtils.mean(neighbors);
    };
    const trainPredictions = normalized.data.map((row, index) => {
      const distances = normalized.data
        .map((other, otherIndex) => ({
          index: otherIndex,
          dist: this.euclidean(other, row)
        }))
        .filter(item => item.index !== index)
        .sort((a, b) => a.dist - b.dist);
      const neighbors = distances.slice(0, k).map(item => trainTargets[item.index]);
      return StatsUtils.mean(neighbors);
    });
    const testPredictions = testFeatures.map(row => predict(row));
    return {
      model: this.wrapModel(predict, trainTargets, trainPredictions),
      metrics: this.buildMetrics('knn', trainPredictions, trainTargets, testPredictions, testTargets)
    };
  }

  private trainForest(
    trainFeatures: number[][],
    trainTargets: number[],
    testFeatures: number[][],
    testTargets: number[]
  ): { model: RegressionModel; metrics: ModelMetricsSplit; importance: { label: string; value: number }[] } {
    const normalized = this.normalizeFeatures(trainFeatures);
    const rows = normalized.data.map((row, index) => ({ features: row, target: trainTargets[index] }));
    const forest = this.buildForest(rows, 60, 6);
    const predict = (input: number[]) => {
      const normInput = this.normalizeVector(input, normalized.means, normalized.stds);
      const values = forest.trees.map(tree => this.predictTree(tree, normInput));
      return StatsUtils.mean(values);
    };
    const trainPredictions = normalized.data.map(row => {
      const values = forest.trees.map(tree => this.predictTree(tree, row));
      return StatsUtils.mean(values);
    });
    const testPredictions = testFeatures.map(row => predict(row));
    const metrics = this.buildMetrics('forest', trainPredictions, trainTargets, testPredictions, testTargets);
    const totalImportance = forest.importance.reduce((sum, val) => sum + val, 0) || 1;
    const configs = this.featureConfigs();
    const importance = forest.importance.map((value, index) => ({
      label: configs[index]?.label ?? `Var ${index + 1}`,
      value: (value / totalImportance) * 100
    }));
    return { model: this.wrapModel(predict, trainTargets, trainPredictions), metrics, importance };
  }

  private computeCvResults(rows: DataRow[], featureKeys: string[]): { folds: number; metrics: Record<ModelKey, ModelResult> } {
    const k = Math.min(5, rows.length);
    if (k < 2) {
      const empty = {
        linear: this.emptyModelResult('linear'),
        knn: this.emptyModelResult('knn'),
        forest: this.emptyModelResult('forest')
      };
      return { folds: k, metrics: empty };
    }

    const folds = this.buildFolds(rows, k);
    const buckets = {
      linear: [] as ModelMetricsSplit[],
      knn: [] as ModelMetricsSplit[],
      forest: [] as ModelMetricsSplit[]
    };

    folds.forEach((testRows, foldIndex) => {
      const trainRows = folds.filter((_, idx) => idx !== foldIndex).flat();
      if (!trainRows.length || !testRows.length) return;
      const trainFeatures = trainRows.map(row => row.features);
      const trainTargets = trainRows.map(row => row.target);
      const testFeatures = testRows.map(row => row.features);
      const testTargets = testRows.map(row => row.target);

      const linear = this.trainLinear(trainRows, testRows, featureKeys);
      const knn = this.trainKnn(trainFeatures, trainTargets, testFeatures, testTargets, 5);
      const forest = this.trainForest(trainFeatures, trainTargets, testFeatures, testTargets);

      buckets.linear.push(linear.metrics);
      buckets.knn.push(knn.metrics);
      buckets.forest.push(forest.metrics);
    });

    return {
      folds: k,
      metrics: {
        linear: this.aggregateMetrics('linear', buckets.linear),
        knn: this.aggregateMetrics('knn', buckets.knn),
        forest: this.aggregateMetrics('forest', buckets.forest)
      }
    };
  }

  private aggregateMetrics(key: ModelKey, items: ModelMetricsSplit[]): ModelResult {
    if (!items.length) {
      return this.emptyModelResult(key);
    }
    const r2 = items.map(item => item.r2Test);
    const mae = items.map(item => item.maeTest);
    const rmse = items.map(item => item.rmseTest);
    return {
      key,
      label: '',
      r2Mean: StatsUtils.mean(r2),
      r2Std: StatsUtils.std(r2),
      maeMean: StatsUtils.mean(mae),
      maeStd: StatsUtils.std(mae),
      rmseMean: StatsUtils.mean(rmse),
      rmseStd: StatsUtils.std(rmse)
    };
  }

  private emptyModelResult(key: ModelKey): ModelResult {
    return {
      key,
      label: '',
      r2Mean: 0,
      r2Std: 0,
      maeMean: 0,
      maeStd: 0,
      rmseMean: 0,
      rmseStd: 0
    };
  }

  private wrapModel(predict: (features: number[]) => number, targets: number[], predictions: number[]): RegressionModel {
    const residuals = targets.map((value, index) => value - predictions[index]);
    const std = StatsUtils.std(residuals, false);
    return { predict, residualStd: Number.isFinite(std) ? std : 0 };
  }

  private buildMetrics(
    key: ModelKey,
    trainPredictions: number[],
    trainTargets: number[],
    testPredictions: number[],
    testTargets: number[]
  ): ModelMetricsSplit {
    const r2Train = this.r2Score(trainTargets, trainPredictions);
    const r2Test = this.r2Score(testTargets, testPredictions);
    const maeTrain = StatsUtils.mae(trainTargets, trainPredictions);
    const maeTest = StatsUtils.mae(testTargets, testPredictions);
    const rmseTrain = StatsUtils.rmse(trainTargets, trainPredictions);
    const rmseTest = StatsUtils.rmse(testTargets, testPredictions);
    return { r2Train, r2Test, maeTrain, maeTest, rmseTrain, rmseTest };
  }

  private r2Score(actual: number[], predicted: number[]): number {
    const mean = StatsUtils.mean(actual);
    let ssTot = 0;
    let ssRes = 0;
    actual.forEach((value, index) => {
      ssTot += (value - mean) ** 2;
      ssRes += (value - predicted[index]) ** 2;
    });
    if (ssTot === 0) return 0;
    return 1 - ssRes / ssTot;
  }

  private normalizeFeatures(data: number[][]): { data: number[][]; means: number[]; stds: number[] } {
    const cols = data[0].length;
    const means = Array.from({ length: cols }, (_, idx) => StatsUtils.mean(data.map(row => row[idx])));
    const stds = Array.from({ length: cols }, (_, idx) => StatsUtils.std(data.map(row => row[idx])) || 1);
    const normalized = data.map(row => row.map((value, idx) => (value - means[idx]) / stds[idx]));
    return { data: normalized, means, stds };
  }

  private normalizeVector(vector: number[], means: number[], stds: number[]): number[] {
    return vector.map((value, idx) => (value - means[idx]) / stds[idx]);
  }

  private euclidean(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  }

  private buildForest(rows: Array<{ features: number[]; target: number }>, treeCount: number, maxDepth: number): { trees: TreeNode[]; importance: number[] } {
    const featureCount = rows[0].features.length;
    const importance = Array(featureCount).fill(0);
    const trees = Array.from({ length: treeCount }, () => {
      const sample = Array.from({ length: rows.length }, () => rows[Math.floor(Math.random() * rows.length)]);
      return this.buildTree(sample, maxDepth, 0, importance);
    });
    return { trees, importance };
  }

  private buildTree(rows: Array<{ features: number[]; target: number }>, maxDepth: number, depth: number, importance: number[]): TreeNode {
    if (depth >= maxDepth || rows.length < 5) {
      return { value: StatsUtils.mean(rows.map(row => row.target)) };
    }
    const featureCount = rows[0].features.length;
    const featureIndices = this.shuffle(Array.from({ length: featureCount }, (_, idx) => idx))
      .slice(0, Math.max(1, Math.floor(Math.sqrt(featureCount))));
    const parentMse = this.mse(rows);
    let best = { featureIndex: -1, threshold: 0, score: parentMse, left: [] as typeof rows, right: [] as typeof rows };

    featureIndices.forEach(featureIndex => {
      const values = rows.map(row => row.features[featureIndex]).sort((a, b) => a - b);
      const unique = values.filter((value, index) => index === 0 || value !== values[index - 1]);
      const candidates = unique.slice(1).map((value, index) => (value + unique[index]) / 2);
      const step = Math.max(1, Math.floor(candidates.length / 10));
      const thresholds = candidates.filter((_, index) => index % step === 0).slice(0, 12);
      thresholds.forEach(threshold => {
        const left = rows.filter(row => row.features[featureIndex] <= threshold);
        const right = rows.filter(row => row.features[featureIndex] > threshold);
        if (!left.length || !right.length) return;
        const score = this.mse(left) + this.mse(right);
        if (score < best.score) {
          best = { featureIndex, threshold, score, left, right };
        }
      });
    });

    if (best.featureIndex === -1) {
      return { value: StatsUtils.mean(rows.map(row => row.target)) };
    }

    const improvement = Math.max(0, parentMse - best.score);
    importance[best.featureIndex] += improvement;

    return {
      featureIndex: best.featureIndex,
      threshold: best.threshold,
      left: this.buildTree(best.left, maxDepth, depth + 1, importance),
      right: this.buildTree(best.right, maxDepth, depth + 1, importance)
    };
  }

  private predictTree(node: TreeNode, input: number[]): number {
    if (node.value !== undefined) return node.value;
    if (node.featureIndex === undefined || node.threshold === undefined || !node.left || !node.right) {
      return 0;
    }
    return input[node.featureIndex] <= node.threshold
      ? this.predictTree(node.left, input)
      : this.predictTree(node.right, input);
  }

  private mse(rows: Array<{ features: number[]; target: number }>): number {
    const mean = StatsUtils.mean(rows.map(row => row.target));
    return rows.reduce((sum, row) => sum + (row.target - mean) ** 2, 0) / rows.length;
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private getCityPollutant(cityName: string): number | null {
    const pollutant = this.selectedPollutant();
    const row = this.dataService.getPollutionData().find(item => item.cityName === cityName && item.parameter === pollutant);
    return row ? row.valueMean : null;
  }
}
