import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, timeout } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import * as Papa from 'papaparse';
import { City, PollutionData, Indicator, PollutantType } from '../models';

export interface DatasetRow {
  [key: string]: string | number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  // Observable streams for data
  private datasetsLoaded$ = new BehaviorSubject<boolean>(false);
  private cities$ = new BehaviorSubject<City[]>([]);
  private pollutionData$ = new BehaviorSubject<PollutionData[]>([]);
  private indicators$ = new BehaviorSubject<Indicator[]>([]);
  private annualData$ = new BehaviorSubject<DatasetRow[]>([]);
  private loading$ = new BehaviorSubject<boolean>(false);
  private errorSubject$ = new BehaviorSubject<string | null>(null);

  // Raw data storage
  private rawFinalData: DatasetRow[] = [];
  private rawAnnualData: DatasetRow[] = [];

  /**
   * Load all datasets from CSV files
   */
  loadDatasets(): Observable<boolean> {
    this.loading$.next(true);
    this.errorSubject$.next(null);

    return forkJoin({
      final: this.loadCSV('assets/data/DATASET_FINAL_5ANS_2019_2023_AVEC_COVID.csv'),
      annual: this.loadCSV('assets/data/DATASET_ANNUEL_2019_2023_AVEC_COVID.csv')
    }).pipe(
      timeout(10000),
      map(({ final, annual }) => {
        this.rawFinalData = final;
        this.rawAnnualData = annual;

        this.processCities(final);
        this.processPollutionData(final);
        this.processIndicators(final);
        this.annualData$.next(annual);

        this.datasetsLoaded$.next(true);
        this.loading$.next(false);
        return true;
      }),
      catchError(error => {
        console.warn('Error loading CSV files, using mock data:', error);
        this.errorSubject$.next('CSV non trouvés - utilisation de données factices');

        this.loadMockData();
        this.datasetsLoaded$.next(true);
        this.loading$.next(false);
        return of(true);
      })
    );
  }

  /**
   * Load a single CSV file
   */
  private loadCSV(path: string): Observable<DatasetRow[]> {
    const url = new URL(path, this.document.baseURI).toString();
    return this.http.get(url, { responseType: 'text' }).pipe(
      map(csvText => {
        const result = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });
        return result.data as DatasetRow[];
      })
    );
  }

  /**
   * Process cities from raw data
   */
  private processCities(data: DatasetRow[]): void {
    const cityMap = new Map<string, City>();

    data.forEach(row => {
      const cityName = String(row['city_ascii_wc'] || row['city'] || '');
      if (!cityName || cityMap.has(cityName)) return;

      const city: City = {
        cityName: cityName,
        cityNameAscii: cityName,
        countryCode: String(row['country_iso3_wc_first'] || row['country_code'] || ''),
        countryName: String(row['country_name_first'] || row['country'] || ''),
        region: String(row['region_first'] || row['region'] || ''),
        latitude: Number(row['lat_wc_first'] || row['lat'] || 0),
        longitude: Number(row['lon_wc_first'] || row['lon'] || 0),
        population: Number(row['population_wc_first'] || row['population'] || 0),
        density: Number(row['densite_population_mean'] || 0),
        urbanizationLevel: this.parseUrbanizationLevel(String(row['niveau_urbanisation_first'] || '')),
        citySize: this.parseCitySize(String(row['taille_ville_first'] || ''))
      };

      cityMap.set(cityName, city);
    });

    this.cities$.next(Array.from(cityMap.values()));
  }
  /**
   * Process pollution data from raw data
   */
  private processPollutionData(data: DatasetRow[]): void {
    const pollutionData: PollutionData[] = [];

    data.forEach(row => {
      const cityName = String(row['city_ascii_wc'] || row['city'] || '');
      const parameter = String(row['parameter'] || '').toLowerCase();

      if (!cityName || !this.isValidPollutant(parameter)) return;

      const pollution: PollutionData = {
        cityName: cityName,
        parameter: parameter as PollutantType,
        valueMean: Number(row['value_mean_mean'] || 0),
        valueMedian: Number(row['value_median_median'] || 0),
        valueStd: Number(row['value_std_mean'] || 0),
        valueMin: Number(row['value_min_min'] || 0),
        valueMax: Number(row['value_max_max'] || 0),
        valueCount: Number(row['value_count_sum'] || 0)
      };

      pollutionData.push(pollution);
    });

    this.pollutionData$.next(pollutionData);
  }

  /**
   * Process indicators from raw data
   */
  private processIndicators(data: DatasetRow[]): void {
    const indicatorMap = new Map<string, Indicator>();

    data.forEach(row => {
      const cityName = String(row['city_ascii_wc'] || row['city'] || '');
      if (!cityName || indicatorMap.has(cityName)) return;

      const indicator: Indicator = {
        cityName: cityName,
        countryCode: String(row['country_iso3_wc_first'] || ''),

        // Urbanisation
        density: Number(row['densite_population_mean']) || undefined,
        urbanPopulationPct: Number(row['pop_urbaine_pct_mean']) || undefined,
        totalPopulation: Number(row['population_totale_mean']) || undefined,
        urbanGrowth: Number(row['croissance_urbaine_mean']) || undefined,
        surfaceKm2: Number(row['superficie_km2_mean']) || undefined,
        urbanizationLevel: this.parseUrbanizationLevel(String(row['niveau_urbanisation_first'] || '')) as Indicator['urbanizationLevel'],
        citySize: this.parseCitySize(String(row['taille_ville_first'] || '')) as Indicator['citySize'],

        // Développement
        gdpPerCapita: Number(row['pib_par_habitant_mean']) || undefined,
        gdpTotal: Number(row['pib_total_mean']) || undefined,
        gdpGrowth: Number(row['croissance_pib_mean']) || undefined,
        industryPctGdp: Number(row['industrie_pct_pib_mean']) || undefined,
        agriculturePctGdp: Number(row['agriculture_pct_pib_mean']) || undefined,
        servicesPctGdp: Number(row['services_pct_pib_mean']) || undefined,
        secondarySectorPct: Number(row['secteur_secondaire_pct_mean']) || undefined,
        privateConsumption: Number(row['consommation_privee_mean']) || undefined,
        developmentLevel: this.parseDevelopmentLevel(String(row['niveau_developpement_first'] || '')),

        // Énergie (IMPORTANT)
        energyPerCapita: Number(row['energie_par_habitant_mean']) || undefined,
        coalPct: Number(row['electricite_charbon_pct_mean']) || undefined,
        renewablePct: Number(row['energie_renouvelable_pct_mean']) || undefined,
        electricityPerCapita: Number(row['electricite_par_habitant_mean']) || undefined,
        electricityLossPct: Number(row['pertes_electricite_pct_mean']) || undefined,
        energyIntensity: Number(row['intensite_energetique_mean']) || undefined,
        coalRenewableRatio: Number(row['ratio_charbon_renouvelables_mean']) || undefined,
        energyMix: this.parseEnergyMix(String(row['mix_energetique_first'] || '')),

        // Transport
        airPassengers: Number(row['passagers_aeriens_mean']) || undefined,
        railwaysKm: Number(row['voies_ferrees_km_mean']) || undefined,

        // Environnement
        forestPct: Number(row['foret_pct_mean']) || undefined,
        freshwaterKm3: Number(row['eau_douce_km3_mean']) || undefined,

        // Social
        lifeExpectancy: Number(row['esperance_vie_mean']) || undefined,
        secondaryEnrollmentPct: Number(row['scolarisation_secondaire_pct_mean']) || undefined,
        waterAccessPct: Number(row['acces_eau_potable_pct_mean']) || undefined,
        giniIndex: Number(row['indice_gini_mean']) || undefined
      };

      indicatorMap.set(cityName, indicator);
    });

    this.indicators$.next(Array.from(indicatorMap.values()));
  }

  /**
   * Helper: Parse urbanization level
   */
  private parseUrbanizationLevel(value: string): City['urbanizationLevel'] {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (normalized.includes('rural')) return 'Rural';
    if (normalized.includes('semi')) return 'Semi-urbain';
    if (normalized.includes('tres')) return 'Tres urbain' as City['urbanizationLevel'];
    if (normalized.includes('urbain')) return 'Urbain';
    return undefined;
  }

  /**
   * Helper: Parse city size
   */
  private parseCitySize(value: string): City['citySize'] {
    const normalized = value.toLowerCase().trim();
    if (normalized.includes('petite')) return 'Petite';
    if (normalized.includes('moyenne')) return 'Moyenne';
    if (normalized.includes('grande')) return 'Grande';
    if (normalized.includes('méga')) return 'Mégapole';
    return undefined;
  }

  /**
   * Helper: Parse development level
   */
  private parseDevelopmentLevel(value: string): Indicator['developmentLevel'] {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (normalized.includes('moyen') && normalized.includes('faible')) {
      return 'Moyen-Faible';
    }
    if (normalized.includes('moyen') && normalized.includes('elev')) {
      return 'Moyen-Eleve' as Indicator['developmentLevel'];
    }
    if (normalized.includes('faible')) return 'Faible';
    if (normalized.includes('elev')) return 'Eleve' as Indicator['developmentLevel'];
    return undefined;
  }

  /**
   * Helper: Parse energy mix
   */
  private parseEnergyMix(value: string): Indicator['energyMix'] {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (normalized.includes('mixte') && normalized.includes('renouvelable')) return 'Mixte-Renouvelable';
    if (normalized.includes('mixte') && normalized.includes('fossile')) return 'Mixte-Fossile';
    if (normalized.includes('fossile')) return 'Fossile';
    if (normalized.includes('renouvelable')) return 'Renouvelable';
    return undefined;
  }


  /**
   * Helper: Check if parameter is valid pollutant
   */
  private isValidPollutant(param: string): boolean {
    return ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(param.toLowerCase());
  }

  // ========== PUBLIC GETTERS ==========

  get isLoaded$(): Observable<boolean> {
    return this.datasetsLoaded$.asObservable();
  }

  isLoaded(): boolean {
    return this.datasetsLoaded$.value;
  }

  get isLoading$(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  get error$(): Observable<string | null> {
    return this.errorSubject$.asObservable();
  }

  getCities(): City[] {
    return this.cities$.value;
  }

  getCities$(): Observable<City[]> {
    return this.cities$.asObservable();
  }

  getPollutionData(): PollutionData[] {
    return this.pollutionData$.value;
  }

  getIndicators(): Indicator[] {
    return this.indicators$.value;
  }

  getAnnualData(): DatasetRow[] {
    return this.annualData$.value;
  }

  getFinalData(): DatasetRow[] {
    return this.rawFinalData;
  }

  /**
   * Get pollution data for specific city
   */
  getCityPollution(cityName: string): PollutionData[] {
    return this.pollutionData$.value.filter(p => p.cityName === cityName);
  }

  /**
   * Get indicator data for specific city
   */
  getCityIndicator(cityName: string): Indicator | undefined {
    return this.indicators$.value.find(i => i.cityName === cityName);
  }

  /**
   * Filter cities by criteria
   */
  filterCities(filters: {
    region?: string;
    minPopulation?: number;
    maxPopulation?: number;
    urbanizationLevel?: City['urbanizationLevel'];
  }): City[] {
    let filtered = this.cities$.value;

    if (filters.region) {
      filtered = filtered.filter(c => c.region === filters.region);
    }

    if (filters.minPopulation !== undefined) {
      filtered = filtered.filter(c => (c.population || 0) >= filters.minPopulation!);
    }

    if (filters.maxPopulation !== undefined) {
      filtered = filtered.filter(c => (c.population || 0) <= filters.maxPopulation!);
    }

    if (filters.urbanizationLevel) {
      filtered = filtered.filter(c => c.urbanizationLevel === filters.urbanizationLevel);
    }

    return filtered;
  }

  /**
   * Search cities by name
   */
  searchCities(query: string): City[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.cities$.value;

    return this.cities$.value.filter(city =>
      city.cityName.toLowerCase().includes(lowerQuery) ||
      city.countryName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get unique regions
   */
  getUniqueRegions(): string[] {
    const regions = new Set(this.cities$.value.map(c => c.region));
    return Array.from(regions).sort();
  }

  /**
   * Get unique countries
   */
  getUniqueCountries(): { code: string; name: string }[] {
    const countryMap = new Map<string, string>();
    this.cities$.value.forEach(city => {
      if (!countryMap.has(city.countryCode)) {
        countryMap.set(city.countryCode, city.countryName);
      }
    });

    return Array.from(countryMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get statistics summary
   */
  getStatsSummary(): {
    totalCities: number;
    totalCountries: number;
    totalRegions: number;
    avgPM25: number;
    minPM25City: string;
    maxPM25City: string;
  } {
    const cities = this.cities$.value;
    const pollution = this.pollutionData$.value.filter(p => p.parameter === 'pm25');

    const pm25Values = pollution.map(p => p.valueMean);
    const avgPM25 = pm25Values.length > 0
      ? pm25Values.reduce((sum, val) => sum + val, 0) / pm25Values.length
      : 0;

    const minPollution = pollution.reduce((min, p) =>
      p.valueMean < min.valueMean ? p : min
    , pollution[0] || { valueMean: 0, cityName: '' });

    const maxPollution = pollution.reduce((max, p) =>
      p.valueMean > max.valueMean ? p : max
    , pollution[0] || { valueMean: 0, cityName: '' });

    return {
      totalCities: cities.length,
      totalCountries: this.getUniqueCountries().length,
      totalRegions: this.getUniqueRegions().length,
      avgPM25,
      minPM25City: minPollution.cityName,
      maxPM25City: maxPollution.cityName
    };
  }

  /**
   * Load mock data when CSV files are not available
   */
  private loadMockData(): void {
    console.log('Loading mock data...');

    // Mock cities
    const mockCities: City[] = [
      { cityName: 'Paris', cityNameAscii: 'Paris', countryCode: 'FRA', countryName: 'France', region: 'Europe', latitude: 48.8566, longitude: 2.3522, population: 2161000, density: 21000 },
      { cityName: 'London', cityNameAscii: 'London', countryCode: 'GBR', countryName: 'United Kingdom', region: 'Europe', latitude: 51.5074, longitude: -0.1278, population: 8982000, density: 5590 },
      { cityName: 'New York', cityNameAscii: 'New York', countryCode: 'USA', countryName: 'United States', region: 'North America', latitude: 40.7128, longitude: -74.0060, population: 8419000, density: 10715 }
    ];

    // Mock pollution data
    const mockPollution: PollutionData[] = [
      { cityName: 'Paris', parameter: 'pm25', valueMean: 15.2, valueMedian: 14.5, valueStd: 5.1, valueMin: 3.2, valueMax: 45.8, valueCount: 1825 },
      { cityName: 'London', parameter: 'pm25', valueMean: 12.8, valueMedian: 11.9, valueStd: 4.6, valueMin: 2.8, valueMax: 38.5, valueCount: 1825 },
      { cityName: 'New York', parameter: 'pm25', valueMean: 18.5, valueMedian: 17.2, valueStd: 6.2, valueMin: 4.1, valueMax: 52.3, valueCount: 1825 }
    ];

    // Mock indicators
    const mockIndicators: Indicator[] = [
      { cityName: 'Paris', countryCode: 'FRA', density: 21000, gdpPerCapita: 56000, coalPct: 2.5, renewablePct: 25.3, urbanPopulationPct: 87.5 },
      { cityName: 'London', countryCode: 'GBR', density: 5590, gdpPerCapita: 48000, coalPct: 1.8, renewablePct: 32.1, urbanPopulationPct: 92.3 },
      { cityName: 'New York', countryCode: 'USA', density: 10715, gdpPerCapita: 72000, coalPct: 15.2, renewablePct: 18.5, urbanPopulationPct: 88.7 }
    ];

    this.cities$.next(mockCities);
    this.pollutionData$.next(mockPollution);
    this.indicators$.next(mockIndicators);

    console.log('Mock data loaded:', { cities: mockCities.length, pollution: mockPollution.length, indicators: mockIndicators.length });
  }
}
