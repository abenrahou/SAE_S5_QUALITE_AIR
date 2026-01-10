import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DataService } from '../../core/services/data.service';

interface MetricCard {
  label: string;
  value: string;
  detail?: string;
}

interface CoverageItem {
  label: string;
  value: number;
}

interface DictionaryGroup {
  title: string;
  items: Array<{ key: string; label: string }>;
}

@Component({
  selector: 'app-about',
  imports: [CommonModule, RouterModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutComponent implements OnInit {
  private readonly dataService = inject(DataService);
  readonly isLoading = signal(true);
  readonly activeTab = signal<'apropos' | 'methodologie'>('apropos');
  readonly summaryCards = signal<MetricCard[]>([]);
  readonly qualityCards = signal<MetricCard[]>([]);
  readonly coverage = signal<CoverageItem[]>([]);
  readonly periodLabel = computed(() => '2019-2023');

  readonly methods = [
    'Corrélations de Pearson',
    'Statistiques descriptives',
    'ACP (Analyse en composantes principales)',
    'k-NN',
    'Régression linéaire',
    'Random Forest'
  ];

  readonly pipelineSteps = [
    { index: 1, title: 'Extraction', text: 'OpenAQ, World Cities et World Bank.' },
    { index: 2, title: 'Nettoyage', text: 'Harmonisation des villes et valeurs manquantes.' },
    { index: 3, title: 'Sélection', text: 'Choix des indicateurs pertinents.' },
    { index: 4, title: 'Intégration', text: 'Dataset final 2019-2023 + annuel.' },
    { index: 5, title: 'Analyse', text: 'Corrélations, ACP, modèles prédictifs.' },
    { index: 6, title: 'Visualisation', text: 'Tableaux de bord interactifs.' }
  ];

  readonly dictionary: DictionaryGroup[] = [
    {
      title: 'Ville / Pays',
      items: [
        { key: 'city_name', label: 'Nom de la ville' },
        { key: 'country_code', label: 'Code ISO3 du pays' },
        { key: 'region', label: 'Region World Bank' },
        { key: 'latitude', label: 'Latitude de la ville' },
        { key: 'longitude', label: 'Longitude de la ville' }
      ]
    },
    {
      title: 'Pollution',
      items: [
        { key: 'pm25_mean', label: 'PM2.5 moyen (ug/m3)' },
        { key: 'pm10_mean', label: 'PM10 moyen (ug/m3)' },
        { key: 'no2_mean', label: 'NO2 moyen (ug/m3)' },
        { key: 'o3_mean', label: 'O3 moyen (ug/m3)' },
        { key: 'so2_mean', label: 'SO2 moyen (ug/m3)' },
        { key: 'co_mean', label: 'CO moyen (mg/m3)' }
      ]
    },
    {
      title: 'Urbain / Socio-eco',
      items: [
        { key: 'densite_population', label: 'Densité population (hab/km2)' },
        { key: 'population_urbaine_pct', label: 'Population urbaine (%)' },
        { key: 'pib_par_habitant_usd', label: 'PIB par habitant (USD)' },
        { key: 'electricite_charbon_pct', label: 'Électricité charbon (%)' },
        { key: 'energies_renouvelables_pct', label: 'Énergies renouvelables (%)' },
        { key: 'indice_gini', label: 'Indice de Gini' }
      ]
    }
  ];

  ngOnInit(): void {
    if (this.dataService.isLoaded()) {
      this.buildMetrics();
      this.isLoading.set(false);
    } else {
      this.dataService.isLoaded$.subscribe(isLoaded => {
        if (isLoaded) {
          this.buildMetrics();
          this.isLoading.set(false);
        }
      });
    }
  }

  private buildMetrics(): void {
    const cities = this.dataService.getCities();
    const countries = this.dataService.getUniqueCountries();
    const pollution = this.dataService.getPollutionData();
    const annual = this.dataService.getAnnualData();
    const finalRows = this.dataService.getFinalData();
    const pollutants = new Set(pollution.map(item => item.parameter));
    const years = new Set(annual.map(row => Number(row['year'])).filter(Number.isFinite));
    const yearValues = Array.from(years);
    const periodLabel = yearValues.length
      ? `${Math.min(...yearValues)}-${Math.max(...yearValues)}`
      : '2019-2023';

    this.summaryCards.set([
      { label: 'Villes', value: String(cities.length), detail: 'Analyse mondiale' },
      { label: 'Pays', value: String(countries.length), detail: 'Couverture internationale' },
      { label: 'Polluants', value: String(pollutants.size), detail: 'PM2.5, PM10, NO2, O3, SO2, CO' },
      { label: 'Periode', value: periodLabel, detail: 'Serie annuelle' }
    ]);

    this.qualityCards.set([
      { label: 'Lignes dataset final', value: String(finalRows.length) },
      { label: 'Lignes dataset annuel', value: String(annual.length) },
      { label: 'Observations pollution', value: String(pollution.length) },
      { label: 'Indicateurs disponibles', value: '40+' }
    ]);

    const indicators = this.dataService.getIndicators();
    const keyIndicators: Array<{ key: keyof typeof indicators[0]; label: string }> = [
      { key: 'density', label: 'Densité population' },
      { key: 'gdpPerCapita', label: 'PIB par habitant' },
      { key: 'coalPct', label: 'Électricité charbon' },
      { key: 'renewablePct', label: 'Énergies renouvelables' },
        { key: 'lifeExpectancy', label: 'Espérance de vie' }
    ];
    const coverage = keyIndicators.map(item => {
      const total = indicators.length || 1;
      const present = indicators.filter(indicator => {
        const value = indicator[item.key];
        return typeof value === 'number' && Number.isFinite(value);
      }).length;
      return { label: item.label, value: Math.round((present / total) * 100) };
    });
    this.coverage.set(coverage);
  }

  setActiveTab(tab: 'apropos' | 'methodologie'): void {
    this.activeTab.set(tab);
  }
}
