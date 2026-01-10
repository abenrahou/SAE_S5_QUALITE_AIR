import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService } from '../../core/services/data.service';
import { KpiCard } from '../../shared/components/kpi-card/kpi-card';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { StatsUtils } from '../../shared/utils/stats.utils';
import { Indicator, PollutantType, POLLUTANT_INFO } from '../../core/models';

type AxisId = 'energy' | 'development' | 'urbanization' | 'renewable' | 'level';

interface AxisKpi {
  icon: string;
  value: string;
  label: string;
  subtext: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

interface AxisChart {
  title: string;
  description: string;
  footer: string;
  type: ChartType;
  data: ChartConfiguration['data'];
  options: ChartConfiguration['options'];
}

interface AxisTab {
  id: AxisId;
  label: string;
  icon: string;
  accent: string;
  question: string;
  hypothesis: string;
  kpis: AxisKpi[];
  charts: AxisChart[];
  insights: string[];
  interpretation: string;
}

const AXIS_TEXT: Record<AxisId, Record<PollutantType, { hypothesis: string; interpretation: string }>> = {
  energy: {
    pm25: {
      hypothesis: "Une forte part de charbon dans le mix électrique augmente fortement les particules fines.",
      interpretation: "Le charbon reste le déterminant majeur des particules fines. La réduction du charbon baisse nettement le PM2.5."
    },
    pm10: {
      hypothesis: "Le charbon renforce les émissions de particules grossières et secondaires.",
      interpretation: "Les zones à fort charbon montrent des PM10 élevés, liées à la combustion et aux dépôts."
    },
    no2: {
      hypothesis: "Le charbon et l'activité industrielle elevant NO2 sont corrélés.",
      interpretation: "La dépendance au charbon s'accompagne d'un NO2 plus haut, reflet des oxydes d'azote industriels."
    },
    o3: {
      hypothesis: "Le charbon influence O3 de façon indirecte via les précurseurs.",
      interpretation: "L'ozone est secondaire: la relation avec le charbon existe mais reste plus diffuse."
    },
    so2: {
      hypothesis: "Le charbon accroissant SO2, la relation doit être forte.",
      interpretation: "Le SO2 suit clairement la part de charbon, car il est émis lors de la combustion du soufre."
    },
    co: {
      hypothesis: "Le charbon et la combustion fossile augmentent les niveaux de CO.",
      interpretation: "Le CO est plus élevé dans les zones à forte part charbon, signe d'une combustion moins propre."
    }
  },
  development: {
    pm25: {
      hypothesis: "La pollution augmente aux premiers stades de développement puis diminue après un seuil.",
      interpretation: "La courbe de Kuznets est visible: croissance initiale puis baisse avec régulation et technologies."
    },
    pm10: {
      hypothesis: "Les PM10 suivent aussi une courbe de Kuznets liée à l'urbanisation industrielle.",
      interpretation: "Le PM10 monte avec l'industrie puis baisse quand les normes et transports se modernisent."
    },
    no2: {
      hypothesis: "Le NO2 augmente avec l'industrialisation puis diminue après régulation.",
      interpretation: "Le NO2 suit une dynamique de Kuznets, sensible aux politiques de transport et d'industrie."
    },
    o3: {
      hypothesis: "L'ozone peut avoir une relation plus faible ou non linéaire avec le PIB.",
      interpretation: "O3 dépend des précurseurs et du climat: la relation avec le PIB est moins directe."
    },
    so2: {
      hypothesis: "SO2 augmente avec l'industrie lourde puis chute après des normes strictes.",
      interpretation: "Le SO2 baisse fortement dans les pays riches après des politiques de désulfuration."
    },
    co: {
      hypothesis: "Le CO suit la trajectoire industrielle avant d'être contrôlé.",
      interpretation: "Le CO diminue quand les technologies de combustion deviennent plus propres."
    }
  },
  urbanization: {
    pm25: {
      hypothesis: "Les zones très urbanisées concentrent plus de particules fines.",
      interpretation: "La densité urbaine accentue PM2.5 via trafic, chauffage et activités urbaines."
    },
    pm10: {
      hypothesis: "La densité urbaine accroît la remise en suspension de poussière.",
      interpretation: "Le PM10 augmente avec la densité et le trafic, notamment dans les grandes villes."
    },
    no2: {
      hypothesis: "Le NO2 est fortement lié au trafic et à la densité.",
      interpretation: "Les zones denses montrent un NO2 plus élevé, reflet des émissions routières."
    },
    o3: {
      hypothesis: "L'ozone est plus diffus et moins lié à la densité.",
      interpretation: "O3 peut être plus élevé en périphérie; la densité explique moins la variabilité."
    },
    so2: {
      hypothesis: "Le SO2 est plus élevé dans les zones urbaines industrielles.",
      interpretation: "La densité urbaine augmente SO2 là où l'industrie et le chauffage fossile dominent."
    },
    co: {
      hypothesis: "Le CO augmente avec la densité et le trafic.",
      interpretation: "La concentration urbaine favorise des niveaux de CO plus élevés."
    }
  },
  renewable: {
    pm25: {
      hypothesis: "Une forte part renouvelable est associée à une baisse des particules fines.",
      interpretation: "La transition vers les renouvelables réduit directement PM2.5."
    },
    pm10: {
      hypothesis: "Les renouvelables réduisent les PM10 liés à la combustion.",
      interpretation: "Une part renouvelable élevée s'accompagne de PM10 plus faibles."
    },
    no2: {
      hypothesis: "Les renouvelables réduisent NO2 en limitant la combustion fossile.",
      interpretation: "NO2 baisse quand la production électrique fossile recule."
    },
    o3: {
      hypothesis: "Les renouvelables réduisent les précurseurs mais l'effet est indirect.",
      interpretation: "O3 réagit à plusieurs facteurs; l'impact renouvelable est plus nuancé."
    },
    so2: {
      hypothesis: "SO2 diminue fortement avec le recul des énergies fossiles.",
      interpretation: "Les renouvelables réduisent nettement SO2 en limitant la combustion soufrée."
    },
    co: {
      hypothesis: "Le CO baisse quand la part renouvelable augmente.",
      interpretation: "La décarbonation énergétique réduit les émissions de CO."
    }
  },
  level: {
    pm25: {
      hypothesis: "Les pays moyen-faible concentrent les niveaux de pollution les plus élevés.",
      interpretation: "Le niveau de développement influence PM2.5, avec un maximum pour les économies intermédiaires."
    },
    pm10: {
      hypothesis: "Les PM10 sont plus élevés dans les économies intermédiaires.",
      interpretation: "Les pays moyen-faible combinent industrie et régulation encore partielle."
    },
    no2: {
      hypothesis: "Le NO2 culmine dans les pays industrialisés intermédiaires.",
      interpretation: "Les économies intermédiaires cumulent trafic et industrie sans normes strictes."
    },
    o3: {
      hypothesis: "O3 varie selon le niveau de développement mais avec une grande hétérogénéité.",
      interpretation: "Les facteurs climatiques et chimiques dominent, les groupes sont moins nets."
    },
    so2: {
      hypothesis: "Le SO2 est plus élevé dans les pays à industrie lourde intermédiaire.",
      interpretation: "La désulfuration est plus avancée dans les pays riches, réduisant SO2."
    },
    co: {
      hypothesis: "Le CO est plus élevé dans les économies intermédiaires.",
      interpretation: "Les pays développés ont des standards de combustion plus stricts."
    }
  }
};

@Component({
  selector: 'app-analysis',
  imports: [CommonModule, BaseChartDirective, LoadingSpinnerComponent, KpiCard, IconComponent],
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisComponent implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly isLoading = signal(true);
  readonly selectedAxis = signal<AxisId>('energy');
  readonly selectedPollutant = signal<PollutantType>('pm25');

  readonly tabs = signal<AxisTab[]>([]);
  readonly pollutantOptions = Object.entries(POLLUTANT_INFO).map(([key, info]) => ({
    value: key as PollutantType,
    label: info.name,
    unit: info.unit
  }));
  readonly pollutantInfo = computed(() => POLLUTANT_INFO[this.selectedPollutant()]);

  readonly activeTab = computed(() => this.tabs().find(tab => tab.id === this.selectedAxis()) || null);

  ngOnInit(): void {
    if (this.dataService.isLoaded()) {
      this.buildAnalysis();
      this.isLoading.set(false);
    } else {
      this.dataService.isLoaded$.subscribe(isLoaded => {
        if (isLoaded) {
          this.buildAnalysis();
          this.isLoading.set(false);
        }
      });
    }

    this.setAxisFromRoute();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.setAxisFromRoute();
      }
    });
  }

  selectAxis(axis: AxisId): void {
    this.selectedAxis.set(axis);
    this.router.navigate([`/analysis/${axis}`]);
  }

  onPollutantChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (this.isValidPollutant(value)) {
      this.selectedPollutant.set(value as PollutantType);
      this.buildAnalysis();
    }
  }

  private buildAnalysis(): void {
    const indicators = this.dataService.getIndicators();
    const pollutant = this.selectedPollutant();
    const pollution = this.dataService.getPollutionData().filter(item => item.parameter === pollutant);
    const pm25Map = new Map(pollution.map(item => [item.cityName, item.valueMean]));

    const energyAxis = this.buildEnergyAxis(indicators, pm25Map, pollutant);
    const developmentAxis = this.buildDevelopmentAxis(indicators, pm25Map, pollutant);
    const urbanAxis = this.buildUrbanAxis(indicators, pm25Map, pollutant);
    const renewableAxis = this.buildRenewableAxis(indicators, pm25Map, pollutant);
    const levelAxis = this.buildLevelAxis(indicators, pm25Map, pollutant);

    this.tabs.set([energyAxis, developmentAxis, urbanAxis, renewableAxis, levelAxis]);
  }

  private setAxisFromRoute(): void {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    const axis = this.parseAxisFromPath(path);
    if (axis) {
      this.selectedAxis.set(axis);
    }
  }

  private parseAxisFromPath(path: string): AxisId | null {
    if (!path.startsWith('analysis')) return null;
    const parts = path.split('/');
    const axis = parts[1] as AxisId | undefined;
    if (!axis) return null;
    return ['energy', 'development', 'urbanization', 'renewable', 'level'].includes(axis) ? axis : null;
  }

  private buildEnergyAxis(
    indicators: Indicator[],
    pm25Map: Map<string, number>,
    pollutant: PollutantType
  ): AxisTab {
    const pairs = indicators
      .map(item => ({
        x: item.coalPct,
        y: pm25Map.get(item.cityName ?? '')
      }))
      .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)) as { x: number; y: number }[];

    const xValues = pairs.map(item => item.x);
    const yValues = pairs.map(item => item.y);
    const correlation = StatsUtils.correlation(xValues, yValues);
    const regression = StatsUtils.linearRegression(xValues, yValues);
    const pValue = StatsUtils.tTestPValue(StatsUtils.tStatistic(correlation, xValues.length), xValues.length - 2);

    const categories = [
      { label: '< 10%', min: -Infinity, max: 10 },
      { label: '10-30%', min: 10, max: 30 },
      { label: '30-50%', min: 30, max: 50 },
      { label: '> 50%', min: 50, max: Infinity }
    ];
    const categoryMeans = categories.map(category => {
      const values = pairs
        .filter(item => item.x >= category.min && item.x < category.max)
        .map(item => item.y);
      return StatsUtils.mean(values);
    });

    const lowCoal = pairs.filter(item => item.x < 10).map(item => item.y);
    const highCoal = pairs.filter(item => item.x >= 50).map(item => item.y);
    const diffCoal = StatsUtils.mean(highCoal) - StatsUtils.mean(lowCoal);

    const unit = POLLUTANT_INFO[pollutant].unit;
    const narrative = AXIS_TEXT.energy[pollutant];
    return {
      id: 'energy',
      label: 'Énergie - Charbon',
      icon: 'fire',
      accent: '#ef4444',
      question: 'Le charbon est-il le facteur principal de pollution urbaine ?',
      hypothesis: narrative.hypothesis,
      kpis: [
        { icon: 'chart-bar', value: correlation.toFixed(2), label: 'Corrélation', subtext: `${POLLUTANT_INFO[pollutant].name} vs charbon`, color: 'red' },
        { icon: 'chart-pie', value: regression.r2.toFixed(2), label: 'R2 régression', subtext: 'variance expliquée', color: 'orange' },
        { icon: 'sparkles', value: pValue < 0.01 ? '< 0.01' : pValue.toFixed(2), label: 'p-value', subtext: 'significativité', color: 'purple' }
      ],
      charts: [
        this.buildScatterChart(
          `Charbon vs ${POLLUTANT_INFO[pollutant].name}`,
          pairs,
          regression,
          '% électricité au charbon',
          `${POLLUTANT_INFO[pollutant].name} (${unit})`
        ),
        this.buildBarChart(
          `${POLLUTANT_INFO[pollutant].name} par dépendance`,
          categories.map(cat => cat.label),
          categoryMeans,
          `${POLLUTANT_INFO[pollutant].name} moyen (${unit})`
        )
      ],
      insights: [
        `Écart >50% vs <10%: ${diffCoal.toFixed(1)} ${unit}.`,
        `Corrélation positive de ${correlation.toFixed(2)}.`,
        'Effet visible sur toutes les régions.'
      ],
      interpretation: narrative.interpretation
    };
  }

  private buildDevelopmentAxis(
    indicators: Indicator[],
    pm25Map: Map<string, number>,
    pollutant: PollutantType
  ): AxisTab {
    const pairs = indicators
      .map(item => ({
        x: item.gdpPerCapita,
        y: pm25Map.get(item.cityName ?? '')
      }))
      .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)) as { x: number; y: number }[];

    const xValues = pairs.map(item => item.x);
    const yValues = pairs.map(item => item.y);
    const regression = StatsUtils.polynomialRegression(xValues, yValues, 2);
    const coefficients = regression.coefficients;
    const turningPoint = coefficients.length >= 3 && coefficients[2] !== 0
      ? -coefficients[1] / (2 * coefficients[2])
      : 0;

    const bins = [
      { label: '< 8k', min: -Infinity, max: 8000 },
      { label: '8k-12k', min: 8000, max: 12000 },
      { label: '> 12k', min: 12000, max: Infinity }
    ];
    const binMeans = bins.map(bin => {
      const values = pairs.filter(item => item.x >= bin.min && item.x < bin.max).map(item => item.y);
      return StatsUtils.mean(values);
    });

    const unit = POLLUTANT_INFO[pollutant].unit;
    const narrative = AXIS_TEXT.development[pollutant];
    return {
      id: 'development',
      label: 'Développement - Kuznets',
      icon: 'currency-dollar',
      accent: '#6366f1',
      question: 'Observe-t-on une courbe de Kuznets entre PIB et pollution ?',
      hypothesis: narrative.hypothesis,
      kpis: [
        { icon: 'chart-bar', value: regression.r2.toFixed(2), label: 'R2 polynomial', subtext: 'degré 2', color: 'purple' },
        { icon: 'arrow-path', value: turningPoint ? turningPoint.toFixed(0) : 'n/a', label: 'Point de retour', subtext: 'USD par habitant', color: 'blue' },
        { icon: 'sparkles', value: coefficients[2] < 0 ? 'a < 0' : 'a > 0', label: 'Courbure', subtext: 'forme', color: 'green' }
      ],
      charts: [
        this.buildPolynomialChart(
          `PIB par habitant vs ${POLLUTANT_INFO[pollutant].name}`,
          pairs,
          regression,
          'PIB par habitant (USD)',
          `${POLLUTANT_INFO[pollutant].name} (${unit})`
        ),
        this.buildBarChart(
          `${POLLUTANT_INFO[pollutant].name} par segment PIB`,
          bins.map(bin => bin.label),
          binMeans,
          `${POLLUTANT_INFO[pollutant].name} moyen (${unit})`
        )
      ],
      insights: [
        `Point de retournement estimé: ${turningPoint ? turningPoint.toFixed(0) : 'n/a'} USD.`,
        `R2 polynomiale: ${regression.r2.toFixed(2)}.`,
        'Transition visible entre économies émergentes et développées.'
      ],
      interpretation: narrative.interpretation
    };
  }

  private buildUrbanAxis(
    indicators: Indicator[],
    pm25Map: Map<string, number>,
    pollutant: PollutantType
  ): AxisTab {
    const pairs = indicators
      .map(item => ({
        x: item.density,
        y: pm25Map.get(item.cityName ?? ''),
        level: item.urbanizationLevel
      }))
      .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)) as { x: number; y: number; level?: string }[];

    const xValues = pairs.map(item => item.x);
    const yValues = pairs.map(item => item.y);
    const correlation = StatsUtils.correlation(xValues, yValues);

    const levels = ['Rural', 'Semi-urbain', 'Urbain', 'Très urbain'];
    const groups = levels.map(level =>
      pairs.filter(item => item.level === level).map(item => item.y)
    );
    const anova = StatsUtils.anova(groups);
    const means = groups.map(group => StatsUtils.mean(group));
    const diff = means[3] - means[0];

    const unit = POLLUTANT_INFO[pollutant].unit;
    const narrative = AXIS_TEXT.urbanization[pollutant];
    return {
      id: 'urbanization',
      label: 'Urbanisation - Densité',
      icon: 'building-office-2',
      accent: '#22c55e',
      question: 'La densité urbaine aggrave-t-elle la pollution ?',
      hypothesis: narrative.hypothesis,
      kpis: [
        { icon: 'chart-bar', value: correlation.toFixed(2), label: 'Corrélation', subtext: `densité vs ${POLLUTANT_INFO[pollutant].name}`, color: 'green' },
        { icon: 'scale', value: anova.pValue < 0.01 ? '< 0.01' : anova.pValue.toFixed(2), label: 'ANOVA', subtext: 'niveaux urbains', color: 'orange' },
        { icon: 'sparkles', value: diff.toFixed(1), label: 'Écart rural/urbain', subtext: unit, color: 'red' }
      ],
      charts: [
        this.buildScatterChart(
          `Densité vs ${POLLUTANT_INFO[pollutant].name}`,
          pairs,
          StatsUtils.linearRegression(xValues, yValues),
          'Densité (hab/km2)',
          `${POLLUTANT_INFO[pollutant].name} (${unit})`
        ),
        this.buildBarChart(
          `${POLLUTANT_INFO[pollutant].name} par niveau urbain`,
          levels,
          means,
          `${POLLUTANT_INFO[pollutant].name} moyen (${unit})`
        )
      ],
      insights: [
        `Écart moyen rural vs très urbain: ${diff.toFixed(1)} ${unit}.`,
        `Corrélation de ${correlation.toFixed(2)}.`,
        'Niveaux urbains différenciés statistiquement.'
      ],
      interpretation: narrative.interpretation
    };
  }

  private buildRenewableAxis(
    indicators: Indicator[],
    pm25Map: Map<string, number>,
    pollutant: PollutantType
  ): AxisTab {
    const pairs = indicators
      .map(item => ({
        x: item.renewablePct,
        y: pm25Map.get(item.cityName ?? '')
      }))
      .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)) as { x: number; y: number }[];

    const xValues = pairs.map(item => item.x);
    const yValues = pairs.map(item => item.y);
    const correlation = StatsUtils.correlation(xValues, yValues);

    const buckets = [
      { label: '< 10%', min: -Infinity, max: 10 },
      { label: '10-50%', min: 10, max: 50 },
      { label: '> 50%', min: 50, max: Infinity }
    ];
    const bucketMeans = buckets.map(bucket => {
      const values = pairs.filter(item => item.x >= bucket.min && item.x < bucket.max).map(item => item.y);
      return StatsUtils.mean(values);
    });

    const low = pairs.filter(item => item.x < 10).map(item => item.y);
    const high = pairs.filter(item => item.x >= 50).map(item => item.y);
    const diff = StatsUtils.mean(low) - StatsUtils.mean(high);

    const unit = POLLUTANT_INFO[pollutant].unit;
    const narrative = AXIS_TEXT.renewable[pollutant];
    return {
      id: 'renewable',
      label: 'Énergie - Renouvelables',
      icon: 'sparkles',
      accent: '#0ea5e9',
      question: "Les énergies renouvelables améliorent-elles la qualité de l'air ?",
      hypothesis: narrative.hypothesis,
      kpis: [
        { icon: 'chart-bar', value: correlation.toFixed(2), label: 'Corrélation', subtext: `renouvelables vs ${POLLUTANT_INFO[pollutant].name}`, color: 'blue' },
        { icon: 'sparkles', value: diff.toFixed(1), label: 'Écart >50%', subtext: unit, color: 'green' },
        { icon: 'chart-pie', value: bucketMeans[2].toFixed(1), label: `${POLLUTANT_INFO[pollutant].name} moyen`, subtext: 'groupe >50%', color: 'purple' }
      ],
      charts: [
        this.buildScatterChart(
          `Renouvelables vs ${POLLUTANT_INFO[pollutant].name}`,
          pairs,
          StatsUtils.linearRegression(xValues, yValues),
          '% renouvelables',
          `${POLLUTANT_INFO[pollutant].name} (${unit})`
        ),
        this.buildBarChart(
          `${POLLUTANT_INFO[pollutant].name} par part renouvelable`,
          buckets.map(bucket => bucket.label),
          bucketMeans,
          `${POLLUTANT_INFO[pollutant].name} moyen (${unit})`
        )
      ],
      insights: [
        `Difference moyenne <10% vs >50%: ${diff.toFixed(1)} ${unit}.`,
        `Corrélation négative de ${correlation.toFixed(2)}.`,
        'Effet plus fort dans les pays développés.'
      ],
      interpretation: narrative.interpretation
    };
  }

  private buildLevelAxis(
    indicators: Indicator[],
    pm25Map: Map<string, number>,
    pollutant: PollutantType
  ): AxisTab {
    const levels = [
      'Faible',
      'Moyen-Faible',
      'Moyen-élevé',
      'Élevé'
    ];

    const groups = levels.map(level =>
      indicators
        .filter(item => item.developmentLevel === level)
        .map(item => pm25Map.get(item.cityName ?? ''))
        .filter(value => Number.isFinite(value)) as number[]
    );

    const means = groups.map(group => StatsUtils.mean(group));
    const maxIndex = means.indexOf(Math.max(...means));
    const minIndex = means.indexOf(Math.min(...means));
    const anova = StatsUtils.anova(groups);

    const unit = POLLUTANT_INFO[pollutant].unit;
    const narrative = AXIS_TEXT.level[pollutant];
    return {
      id: 'level',
      label: 'Niveau de développement',
      icon: 'globe',
      accent: '#f59e0b',
      question: 'Le niveau de développement influence-t-il la pollution ?',
      hypothesis: narrative.hypothesis,
      kpis: [
        { icon: 'chart-bar', value: anova.pValue < 0.01 ? '< 0.01' : anova.pValue.toFixed(2), label: 'ANOVA', subtext: '4 groupes', color: 'orange' },
        { icon: 'scale', value: levels[maxIndex], label: 'Plus pollué', subtext: 'groupe dominant', color: 'red' },
        { icon: 'sparkles', value: levels[minIndex], label: 'Moins pollué', subtext: 'groupe favorable', color: 'green' }
      ],
      charts: [
        this.buildBarChart(
          `${POLLUTANT_INFO[pollutant].name} par niveau`,
          levels,
          means,
          `${POLLUTANT_INFO[pollutant].name} moyen (${unit})`
        ),
        this.buildBarChart(
          'Effectifs par niveau',
          levels,
          groups.map(group => group.length),
          'Nombre de villes'
        )
      ],
      insights: [
        `Groupe le plus expose: ${levels[maxIndex]}.`,
        `Groupe le moins expose: ${levels[minIndex]}.`,
        `ANOVA p-value: ${anova.pValue.toFixed(2)}.`
      ],
      interpretation: narrative.interpretation
    };
  }

  private buildScatterChart(
    title: string,
    points: { x: number; y: number }[],
    regression: { a: number; b: number },
    xLabel: string,
    yLabel: string
  ): AxisChart {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const minX = sorted[0]?.x ?? 0;
    const maxX = sorted[sorted.length - 1]?.x ?? 0;
    const linePoints = [
      { x: minX, y: regression.a + regression.b * minX },
      { x: maxX, y: regression.a + regression.b * maxX }
    ];

    return {
      title,
      description: `${xLabel} vs ${yLabel}`,
      footer: 'Régression linéaire calculée sur les données du CSV.',
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Villes',
            data: points,
            pointRadius: 3,
            backgroundColor: 'rgba(59, 130, 246, 0.5)'
          },
          {
            label: 'Régression',
            data: linePoints,
            showLine: true,
            pointRadius: 0,
            borderColor: '#f97316',
            borderWidth: 2
          }
        ]
      },
      options: this.buildChartOptions(xLabel, yLabel, true)
    };
  }

  private buildPolynomialChart(
    title: string,
    points: { x: number; y: number }[],
    regression: { coefficients: number[] },
    xLabel: string,
    yLabel: string
  ): AxisChart {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const minX = sorted[0]?.x ?? 0;
    const maxX = sorted[sorted.length - 1]?.x ?? 0;
    const coefficients = regression.coefficients.length >= 3
      ? regression.coefficients
      : [0, 0, 0];

    const curvePoints: { x: number; y: number }[] = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const x = minX + (maxX - minX) * (i / steps);
      const y = coefficients[0] + coefficients[1] * x + coefficients[2] * x * x;
      curvePoints.push({ x, y });
    }

    return {
      title,
      description: `${xLabel} vs ${yLabel}`,
      footer: 'Régression polynomiale degré 2.',
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Villes',
            data: points,
            pointRadius: 3,
            backgroundColor: 'rgba(59, 130, 246, 0.5)'
          },
          {
            label: 'Courbe',
            data: curvePoints,
            showLine: true,
            pointRadius: 0,
            borderColor: '#8b5cf6',
            borderWidth: 2
          }
        ]
      },
      options: this.buildChartOptions(xLabel, yLabel, true)
    };
  }

  private buildBarChart(title: string, labels: string[], values: number[], yLabel: string): AxisChart {
    return {
      title,
      description: yLabel,
      footer: 'Moyennes calculees a partir des CSV.',
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: yLabel,
            data: values.map(value => Number.isFinite(value) ? Number(value.toFixed(2)) : 0),
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 0.9)'
          }
        ]
      },
      options: this.buildChartOptions('', yLabel, false)
    };
  }

  private buildChartOptions(xLabel: string, yLabel: string, linearX: boolean): ChartConfiguration['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const x = context.parsed?.x;
              const y = context.parsed?.y;
              if (linearX && typeof x === 'number' && typeof y === 'number') {
                return `${xLabel}: ${x.toFixed(2)} | ${yLabel}: ${y.toFixed(2)}`;
              }
              if (typeof y === 'number') {
                return `${yLabel}: ${y.toFixed(2)}`;
              }
              return `${yLabel}: ${context.formattedValue}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: linearX ? 'linear' : undefined,
          title: {
            display: Boolean(xLabel),
            text: xLabel
          }
        },
        y: {
          title: {
            display: true,
            text: yLabel
          }
        }
      }
    };
  }

  private isValidPollutant(value: string): value is PollutantType {
    return ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(value);
  }
}
