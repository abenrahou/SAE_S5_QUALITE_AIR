import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { DataService, DatasetRow } from '../../core/services/data.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { City, Indicator, PollutionData, PollutantType, POLLUTANT_INFO } from '../../core/models';

type HeatPoint = [number, number, number];

interface LeafletHeat {
  heatLayer?: (latlngs: HeatPoint[], options?: { radius?: number; blur?: number; maxZoom?: number }) => L.Layer;
}

interface LeafletMarkerCluster {
  markerClusterGroup?: (options?: { showCoverageOnHover?: boolean }) => L.LayerGroup;
}

type LeafletExtended = typeof L & LeafletHeat & LeafletMarkerCluster;

@Component({
  selector: 'app-map',
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly dataService = inject(DataService);
  private readonly router = inject(Router);

  @ViewChild('mapContainer', { static: false })
  private mapContainer?: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private markerLayer?: L.LayerGroup;
  private heatLayer?: L.Layer;
  private pollutionIndex = new Map<string, Map<PollutantType, PollutionData>>();
  private annualData: DatasetRow[] = [];
  private legendControl?: L.Control;

  readonly pollutantOptions = Object.entries(POLLUTANT_INFO).map(([key, info]) => ({
    value: key as PollutantType,
    label: info.name
  }));
  readonly pollutantInfoMap = POLLUTANT_INFO;

  readonly yearOptions = [
    { value: 'avg', label: 'Moyenne 2019-2023' },
    { value: '2019', label: '2019' },
    { value: '2020', label: '2020' },
    { value: '2021', label: '2021' },
    { value: '2022', label: '2022' },
    { value: '2023', label: '2023' }
  ];

  readonly isLoading = signal(true);
  readonly dataReady = signal(false);
  readonly mapReady = signal(false);

  readonly selectedPollutant = signal<PollutantType>('pm25');
  readonly selectedYear = signal<string>('avg');
  readonly selectedRegion = signal<string>('Toutes');
  readonly displayType = signal<'markers' | 'heatmap'>('markers');
  readonly threshold = signal(10);
  readonly showLegend = signal(true);
  readonly showDetailsModal = signal(false);
  readonly activeCity = signal<City | null>(null);

  readonly regions = signal<string[]>([]);
  readonly annualAvailable = signal(false);
  readonly totalCities = signal(0);

  readonly displayedCount = signal(0);
  readonly avgPollution = signal(0);
  readonly aboveThresholdCount = signal(0);
  readonly aboveThresholdPct = signal(0);

  private readonly renderEffect = effect(() => {
    if (!this.dataReady() || !this.mapReady()) return;
    const filteredCities = this.getFilteredCities();
    this.renderLayers(filteredCities);
    this.updateStats(filteredCities);
  });

  private readonly legendEffect = effect(() => {
    if (!this.mapReady()) return;
    const isVisible = this.showLegend();
    const pollutant = this.selectedPollutant();
    if (!isVisible) {
      this.removeLegendControl();
      return;
    }

    this.removeLegendControl();
    this.addLegendControl(pollutant);
  });

  ngOnInit(): void {
    if (this.dataService.isLoaded()) {
      this.initializeData();
    } else {
      this.dataService.isLoaded$.subscribe(isLoaded => {
        if (isLoaded) {
          this.initializeData();
        }
      });
    }
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.removeLegendControl();
    this.map?.remove();
  }

  pollutantInfo(): { name: string; unit: string; whoGuideline: number } {
    return POLLUTANT_INFO[this.selectedPollutant()];
  }

  onPollutantChange(value: string): void {
    if (this.isValidPollutant(value)) {
      this.selectedPollutant.set(value as PollutantType);
    }
  }

  onPollutantSelect(event: Event): void {
    this.onPollutantChange((event.target as HTMLSelectElement).value);
  }

  onYearChange(value: string): void {
    this.selectedYear.set(value);
  }

  onYearSelect(event: Event): void {
    this.onYearChange((event.target as HTMLSelectElement).value);
  }

  onRegionChange(value: string): void {
    this.selectedRegion.set(value);
  }

  onRegionSelect(event: Event): void {
    this.onRegionChange((event.target as HTMLSelectElement).value);
  }

  onDisplayTypeChange(value: 'markers' | 'heatmap'): void {
    this.displayType.set(value);
  }

  onThresholdChange(value: string): void {
    const numeric = Number(value);
    this.threshold.set(Number.isFinite(numeric) ? numeric : 0);
  }

  onThresholdInput(event: Event): void {
    this.onThresholdChange((event.target as HTMLInputElement).value);
  }

  openCityDetails(city: City): void {
    this.activeCity.set(city);
    this.showDetailsModal.set(true);
  }

  closeCityDetails(): void {
    this.showDetailsModal.set(false);
  }

  compareCity(): void {
    const city = this.activeCity();
    if (!city) return;
    this.router.navigate(['/comparison'], {
      queryParams: { cities: city.cityName }
    });
  }

  toggleLegend(): void {
    this.showLegend.update(current => !current);
  }

  resetFilters(): void {
    this.selectedPollutant.set('pm25');
    this.selectedYear.set('avg');
    this.selectedRegion.set('Toutes');
    this.displayType.set('markers');
    this.threshold.set(10);
  }

  private initializeData(): void {
    const cities = this.dataService.getCities();
    const pollutionData = this.dataService.getPollutionData();
    const annualData = this.dataService.getAnnualData();

    this.buildPollutionIndex(pollutionData);
    this.annualData = annualData;
    this.totalCities.set(cities.length);
    this.regions.set(['Toutes', ...this.dataService.getUniqueRegions()]);
    this.annualAvailable.set(annualData.length > 0);
    this.isLoading.set(false);
    this.dataReady.set(true);
  }

  private initializeMap(): void {
    if (!this.mapContainer?.nativeElement) return;
    if (this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: false,
      worldCopyJump: true
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.mapReady.set(true);

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private addLegendControl(pollutant: PollutantType): void {
    if (!this.map || this.legendControl) return;

    const LegendControl = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create('div', 'map-legend');
        const pollutantName = POLLUTANT_INFO[pollutant].name;
        const pollutantUnit = POLLUTANT_INFO[pollutant].unit;
        container.innerHTML = `
          <div class="legend-title">Legende - ${pollutantName}</div>
          <div class="legend-subtitle">Niveaux OMS (${pollutantUnit})</div>
          <div class="legend-row"><span class="legend-dot legend-good"></span><span>Bon: 0 - 12 ${pollutantUnit}</span></div>
          <div class="legend-row"><span class="legend-dot legend-moderate"></span><span>Modere: 12 - 35 ${pollutantUnit}</span></div>
          <div class="legend-row"><span class="legend-dot legend-bad"></span><span>Mauvais: 35 - 55 ${pollutantUnit}</span></div>
          <div class="legend-row"><span class="legend-dot legend-very-bad"></span><span>Tres mauvais: 55+ ${pollutantUnit}</span></div>
        `;
        return container;
      }
    });

    const legendControl = new LegendControl({ position: 'bottomright' });
    legendControl.addTo(this.map);
    this.legendControl = legendControl;
  }

  private removeLegendControl(): void {
    if (!this.map || !this.legendControl) return;
    this.map.removeControl(this.legendControl);
    this.legendControl = undefined;
  }

  private buildPollutionIndex(pollutionData: PollutionData[]): void {
    this.pollutionIndex.clear();
    pollutionData.forEach(entry => {
      const cityMap = this.pollutionIndex.get(entry.cityName) ?? new Map<PollutantType, PollutionData>();
      cityMap.set(entry.parameter, entry);
      this.pollutionIndex.set(entry.cityName, cityMap);
    });
  }

  private getFilteredCities(): City[] {
    const allCities = this.dataService.getCities();
    const selectedRegion = this.selectedRegion();
    const threshold = this.threshold();
    const pollutant = this.selectedPollutant();
    const selectedYear = this.selectedYear();

    return allCities.filter(city => {
      if (!city.latitude || !city.longitude) return false;
      if (selectedRegion !== 'Toutes' && city.region !== selectedRegion) return false;
      const value = this.getPollutionValue(city.cityName, pollutant, selectedYear);
      if (!Number.isFinite(value)) return false;
      return value >= threshold;
    });
  }

  private renderLayers(cities: City[]): void {
    if (!this.map) return;

    this.markerLayer?.remove();
    this.heatLayer?.remove();

    const pollutant = this.selectedPollutant();
    const selectedYear = this.selectedYear();
    const displayType = this.displayType();
    const leaflet = L as unknown as LeafletExtended;

    if (displayType === 'heatmap' && leaflet.heatLayer) {
      const points: HeatPoint[] = cities.map(city => ([
        city.latitude,
        city.longitude,
        this.getPollutionValue(city.cityName, pollutant, selectedYear) || 0
      ]));

      this.heatLayer = leaflet.heatLayer(points, {
        radius: 25,
        blur: 18,
        maxZoom: 6
      }).addTo(this.map);
      return;
    }

    const clusterFactory = leaflet.markerClusterGroup;
    const clusterGroup = clusterFactory ? clusterFactory({ showCoverageOnHover: false }) : L.layerGroup();

    const populations = cities
      .map(city => city.population || 0)
      .filter(value => value > 0);
    const minPop = populations.length ? Math.min(...populations) : 0;
    const maxPop = populations.length ? Math.max(...populations) : 1;

    cities.forEach(city => {
      const value = this.getPollutionValue(city.cityName, pollutant, selectedYear);
      const color = this.getColorForPollution(value);
      const radius = this.getMarkerRadius(city.population || 0, minPop, maxPop);
      const marker = this.createCityMarker(city, value, color, radius);
      marker.addTo(clusterGroup);
    });

    this.markerLayer = clusterGroup.addTo(this.map);
  }

  private createCityMarker(city: City, value: number, color: string, radius: number): L.Marker {
    const size = radius * 2;
    const icon = L.divIcon({
      html: `<div class="marker-dot" style="width:${size}px;height:${size}px;background:${color};"></div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [radius, radius]
    });

    const marker = L.marker([city.latitude, city.longitude], { icon });
    const tooltipContent = this.buildTooltipContent(city, value);
    marker.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -8],
      opacity: 0.95
    });
    marker.on('click', () => this.openCityDetails(city));
    return marker;
  }

  private buildTooltipContent(city: City, value: number): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 12px;">
        <div style="font-weight: 700; margin-bottom: 6px;">
          ${city.cityName}, ${city.countryName}
        </div>
        <div style="margin-bottom: 6px;">
          <strong>${this.pollutantInfo().name}</strong>: ${this.formatValue(value)} ${this.pollutantInfo().unit}
        </div>
        <div style="color: #475569; font-size: 11px;">Cliquez pour details</div>
      </div>
    `;
  }

  private updateStats(cities: City[]): void {
    const pollutant = this.selectedPollutant();
    const threshold = this.threshold();
    const values = cities.map(city => this.getPollutionValue(city.cityName, pollutant, this.selectedYear()));

    const validValues = values.filter(value => Number.isFinite(value));
    const avg = validValues.length
      ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
      : 0;

    const above = validValues.filter(value => value >= threshold).length;
    const pct = validValues.length ? Math.round((above / validValues.length) * 100) : 0;

    this.displayedCount.set(cities.length);
    this.avgPollution.set(Math.round(avg * 10) / 10);
    this.aboveThresholdCount.set(above);
    this.aboveThresholdPct.set(pct);
  }

  private getPollutionValue(cityName: string, pollutant: PollutantType, year?: string): number {
    if (year && year !== 'avg' && this.annualData.length > 0) {
      const annualValue = this.getAnnualPollutionValue(cityName, pollutant, year);
      if (annualValue !== undefined) return annualValue;
    }
    const cityMap = this.pollutionIndex.get(cityName);
    const entry = cityMap?.get(pollutant);
    return entry?.valueMean ?? 0;
  }

  private getAnnualPollutionValue(cityName: string, pollutant: PollutantType, year: string): number | undefined {
    const normalizedYear = String(year);
    const row = this.annualData.find(item => {
      const city = String(item['city_ascii_wc'] ?? item['city'] ?? item['city_name'] ?? '');
      const parameter = String(item['parameter'] ?? item['pollutant'] ?? '').toLowerCase();
      const rowYear = String(item['year'] ?? item['annee'] ?? '');
      return city === cityName && parameter === pollutant && rowYear === normalizedYear;
    });

    if (!row) return undefined;
    const value = Number(
      row['value_mean'] ??
      row['value_mean_mean'] ??
      row['value'] ??
      row[`${pollutant}_mean`] ??
      row['pm25_mean'] ??
      0
    );

    return Number.isFinite(value) ? value : undefined;
  }

  private getColorForPollution(value: number): string {
    if (value <= 12) return '#10b981';
    if (value <= 35) return '#facc15';
    if (value <= 55) return '#f97316';
    return '#ef4444';
  }

  private getMarkerRadius(population: number, minPop: number, maxPop: number): number {
    if (!population || maxPop === minPop) return 6;
    const normalized = (Math.sqrt(population) - Math.sqrt(minPop)) / (Math.sqrt(maxPop) - Math.sqrt(minPop));
    return 5 + normalized * 9;
  }

  formatValue(value?: number): string {
    if (value === undefined || value === null || !Number.isFinite(value)) return 'n/a';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
  }

  private isValidPollutant(value: string): value is PollutantType {
    return ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].includes(value);
  }

  getCityPollution(cityName: string, pollutant: PollutantType): string {
    const value = this.getPollutionValue(cityName, pollutant, this.selectedYear());
    return this.formatValue(value);
  }

  getCityIndicator(cityName: string, key: keyof Indicator): string {
    const indicator = this.dataService.getCityIndicator(cityName);
    const raw = indicator?.[key] as number | undefined;
    return this.formatValue(raw);
  }
}
