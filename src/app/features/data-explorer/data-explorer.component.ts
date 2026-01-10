import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DataService, DatasetRow } from '../../core/services/data.service';
import { StatsUtils } from '../../shared/utils/stats.utils';

type DatasetMode = 'final' | 'annual';

interface ColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number';
}

interface TableRow extends DatasetRow {
  __id: string;
}

@Component({
  selector: 'app-data-explorer',
  imports: [CommonModule, LoadingSpinnerComponent, BaseChartDirective],
  templateUrl: './data-explorer.component.html',
  styleUrls: ['./data-explorer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataExplorerComponent implements OnInit {
  private readonly dataService = inject(DataService);
  readonly isLoading = signal(true);
  readonly datasetMode = signal<DatasetMode>('final');
  readonly searchTerm = signal('');
  readonly filterColumnKey = signal('');
  readonly filterText = signal('');
  readonly filterMin = signal('');
  readonly filterMax = signal('');
  readonly sortKey = signal('');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly pageSize = signal(25);
  readonly pageIndex = signal(0);
  readonly selectedColumns = signal<string[]>([]);
  readonly selectedRowIds = signal<string[]>([]);
  readonly selectedColumnKey = signal('');
  histogram: ChartConfiguration<'bar'> = { type: 'bar', data: { labels: [], datasets: [] }, options: {} };

  @ViewChild('histogramChart', { static: false }) histogramChartRef?: BaseChartDirective;

  ngOnInit(): void {
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

  private readonly syncEffect = effect(() => {
    this.datasetMode();
    this.resetPaging();
    this.syncColumns();
    this.syncSelectedColumn();
  });

  private readonly histogramEffect = effect(() => {
    this.filteredRows();
    this.selectedColumnKey();
    this.buildHistogram();
  });

  readonly rows = computed<TableRow[]>(() => {
    const mode = this.datasetMode();
    const raw = mode === 'final' ? this.dataService.getFinalData() : this.dataService.getAnnualData();
    return raw.map((row, index) => ({ __id: `${mode}-${index}`, ...row }));
  });

  readonly columns = computed<ColumnDef[]>(() => {
    const rows = this.rows();
    const sample = rows[0] ?? { __id: '' };
    const keys = Object.keys(sample).filter(key => key !== '__id');
    return keys.map(key => ({
      key,
      label: this.formatLabel(key),
      type: this.guessType(rows, key)
    }));
  });

  readonly visibleColumns = computed(() => {
    const selected = new Set(this.selectedColumns());
    return this.columns().filter(col => selected.has(col.key));
  });

  readonly numericColumns = computed(() => this.columns().filter(col => col.type === 'number'));

  readonly filteredRows = computed(() => {
    let rows = this.rows();
    const search = this.searchTerm().trim().toLowerCase();
    if (search) {
      rows = rows.filter(row =>
        Object.entries(row).some(([key, value]) => {
          if (key === '__id') return false;
          return String(value ?? '').toLowerCase().includes(search);
        })
      );
    }
    const filterKey = this.filterColumnKey();
    if (filterKey) {
      const column = this.columns().find(col => col.key === filterKey);
      if (column?.type === 'number') {
        const min = Number(this.filterMin());
        const max = Number(this.filterMax());
        rows = rows.filter(row => {
          const value = Number(row[filterKey]);
          if (!Number.isFinite(value)) return false;
          if (Number.isFinite(min) && value < min) return false;
          if (Number.isFinite(max) && value > max) return false;
          return true;
        });
      } else if (column?.type === 'string') {
        const text = this.filterText().trim().toLowerCase();
        if (text) {
          rows = rows.filter(row => String(row[filterKey] ?? '').toLowerCase().includes(text));
        }
      }
    }
    const sortKey = this.sortKey();
    if (sortKey) {
      const column = this.columns().find(col => col.key === sortKey);
      const dir = this.sortDir();
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (column?.type === 'number') {
          const diff = (Number(aVal) || 0) - (Number(bVal) || 0);
          return dir === 'asc' ? diff : -diff;
        }
        const aStr = String(aVal ?? '');
        const bStr = String(bVal ?? '');
        return dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    return rows;
  });

  readonly pageCount = computed(() => {
    const size = this.pageSize();
    const total = this.filteredRows().length;
    if (size <= 0) return 1;
    return Math.max(1, Math.ceil(total / size));
  });

  readonly pagedRows = computed(() => {
    const size = this.pageSize();
    if (size <= 0) return this.filteredRows();
    const start = this.pageIndex() * size;
    return this.filteredRows().slice(start, start + size);
  });

  readonly stats = computed(() => {
    const key = this.selectedColumnKey();
    if (!key) return null;
    const values = this.filteredRows()
      .map(row => Number(row[key]))
      .filter(Number.isFinite) as number[];
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      mean: StatsUtils.mean(values),
      median: StatsUtils.median(values),
      std: StatsUtils.std(values),
      min: StatsUtils.min(values),
      max: StatsUtils.max(values),
      q1: this.quantile(sorted, 0.25),
      q3: this.quantile(sorted, 0.75)
    };
  });

  setMode(mode: DatasetMode): void {
    this.datasetMode.set(mode);
  }

  onSearchInput(event: Event): void {
    this.setSearch(this.getInputValue(event));
  }

  onFilterColumnChange(event: Event): void {
    this.setFilterColumn(this.getSelectValue(event));
  }

  onFilterTextInput(event: Event): void {
    this.setFilterText(this.getInputValue(event));
  }

  onFilterMinInput(event: Event): void {
    this.setFilterMin(this.getInputValue(event));
  }

  onFilterMaxInput(event: Event): void {
    this.setFilterMax(this.getInputValue(event));
  }

  onSortKeyChange(event: Event): void {
    this.setSortKey(this.getSelectValue(event));
  }

  onPageSizeChange(event: Event): void {
    this.setPageSize(this.getSelectValue(event));
  }

  onToggleSelectPage(event: Event): void {
    this.toggleSelectPage(this.getCheckboxValue(event));
  }

  onSelectedColumnChange(event: Event): void {
    this.setSelectedColumn(this.getSelectValue(event));
  }

  setSearch(value: string): void {
    this.searchTerm.set(value);
    this.resetPaging();
  }

  setFilterColumn(value: string): void {
    this.filterColumnKey.set(value);
    this.filterText.set('');
    this.filterMin.set('');
    this.filterMax.set('');
    this.resetPaging();
  }

  setFilterText(value: string): void {
    this.filterText.set(value);
    this.resetPaging();
  }

  setFilterMin(value: string): void {
    this.filterMin.set(value);
    this.resetPaging();
  }

  setFilterMax(value: string): void {
    this.filterMax.set(value);
    this.resetPaging();
  }

  setSortKey(value: string): void {
    this.sortKey.set(value);
  }

  toggleSortDir(): void {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
  }

  setPageSize(value: string): void {
    const size = Number(value);
    this.pageSize.set(Number.isFinite(size) ? size : 25);
    this.resetPaging();
  }

  prevPage(): void {
    this.pageIndex.update(current => Math.max(0, current - 1));
  }

  nextPage(): void {
    const max = this.pageCount() - 1;
    this.pageIndex.update(current => Math.min(max, current + 1));
  }

  toggleColumn(key: string): void {
    this.selectedColumns.update(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    );
  }

  selectAllColumns(): void {
    this.selectedColumns.set(this.columns().map(col => col.key));
  }

  clearColumns(): void {
    this.selectedColumns.set([]);
  }

  toggleRow(id: string): void {
    this.selectedRowIds.update(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  }

  toggleSelectPage(checked: boolean): void {
    const ids = this.pagedRows().map(row => row.__id);
    if (checked) {
      this.selectedRowIds.update(current => Array.from(new Set([...current, ...ids])));
    } else {
      this.selectedRowIds.update(current => current.filter(id => !ids.includes(id)));
    }
  }

  isSelected(id: string): boolean {
    return this.selectedRowIds().includes(id);
  }

  pageAllSelected(): boolean {
    const ids = this.pagedRows().map(row => row.__id);
    if (!ids.length) return false;
    return ids.every(id => this.selectedRowIds().includes(id));
  }

  filterColumnType(): 'number' | 'string' | null {
    const key = this.filterColumnKey();
    if (!key) return null;
    return this.columns().find(col => col.key === key)?.type ?? null;
  }

  setSelectedColumn(value: string): void {
    this.selectedColumnKey.set(value);
    this.buildHistogram();
  }

  exportCsv(mode: 'full' | 'filtered' | 'selected' | 'all'): void {
    const today = new Date();
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    if (mode === 'all') {
      const finalRows = this.dataService.getFinalData().map((row, index) => ({ __dataset: 'final', __id: `final-${index}`, ...row }));
      const annualRows = this.dataService.getAnnualData().map((row, index) => ({ __dataset: 'annual', __id: `annual-${index}`, ...row }));
      const rows = [...finalRows, ...annualRows];
      const columns = Object.keys(rows[0] ?? {}).filter(key => key !== '__id');
      this.downloadCsv(rows, columns, `qualite_air_complet_${stamp}.csv`);
      return;
    }
    const rows = mode === 'full'
      ? this.rows()
      : mode === 'filtered'
        ? this.filteredRows()
        : this.rows().filter(row => this.selectedRowIds().includes(row.__id));
    const columns = mode === 'full' ? this.columns().map(col => col.key) : this.selectedColumns();
    this.downloadCsv(rows, columns, `qualite_air_${mode}_${stamp}.csv`);
  }

  async exportPdf(): Promise<void> {
    const element = document.getElementById('data-export-report');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.save(`rapport_donnees_${Date.now()}.pdf`);
  }

  exportPng(): void {
    const canvas = this.histogramChartRef?.chart?.canvas;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      saveAs(blob, `histogramme_${Date.now()}.png`);
    });
  }

  formatCell(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'n/a';
    if (typeof value === 'number') return value.toFixed(2);
    const numeric = Number(value);
    if (Number.isFinite(numeric) && String(value).trim() !== '') return numeric.toFixed(2);
    return String(value);
  }

  private initialize(): void {
    this.syncColumns();
    this.syncSelectedColumn();
    this.buildHistogram();
  }

  private syncColumns(): void {
    const cols = this.columns().map(col => col.key);
    this.selectedColumns.set(cols);
  }

  private syncSelectedColumn(): void {
    const numeric = this.numericColumns();
    if (!numeric.length) return;
    if (!numeric.find(col => col.key === this.selectedColumnKey())) {
      this.selectedColumnKey.set(numeric[0].key);
    }
  }

  private resetPaging(): void {
    this.pageIndex.set(0);
  }

  private buildHistogram(): void {
    const key = this.selectedColumnKey();
    const values = this.filteredRows()
      .map(row => Number(row[key]))
      .filter(Number.isFinite) as number[];
    if (!values.length) {
      this.histogram = { type: 'bar', data: { labels: [], datasets: [] }, options: {} };
      return;
    }
    const bins = 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = span / bins;
    const counts = Array.from({ length: bins }, () => 0);
    values.forEach(value => {
      const idx = Math.min(bins - 1, Math.floor((value - min) / step));
      counts[idx] += 1;
    });
    const labels = counts.map((_, index) => {
      const start = min + index * step;
      const end = start + step;
      return `${start.toFixed(1)}-${end.toFixed(1)}`;
    });
    this.histogram = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Distribution',
            data: counts,
            backgroundColor: '#60a5fa'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#475569' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
          y: { ticks: { color: '#475569' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } }
        }
      }
    };
  }

  private quantile(values: number[], q: number): number {
    if (!values.length) return 0;
    const pos = (values.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (values[base + 1] === undefined) return values[base];
    return values[base] + rest * (values[base + 1] - values[base]);
  }

  private guessType(rows: TableRow[], key: string): 'number' | 'string' {
    for (const row of rows) {
      const value = row[key];
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'number') return 'number';
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return 'number';
      return 'string';
    }
    return 'string';
  }

  private formatLabel(key: string): string {
    const map: Record<string, string> = {
      city_ascii_wc: 'Ville',
      country_name: 'Pays',
      country_name_first: 'Pays',
      country_iso3_wc_first: 'Code pays',
      region_first: 'Région',
      parameter: 'Polluant',
      value_mean: 'Valeur moyenne',
      value_mean_mean: 'Valeur moyenne',
      year: 'Année',
      pm25: 'PM2.5',
      pm10: 'PM10',
      no2: 'NO2',
      o3: 'O3',
      so2: 'SO2',
      co: 'CO'
    };
    return map[key] ?? key;
  }

  private downloadCsv(rows: Array<Record<string, unknown>>, columns: string[], filename: string): void {
    const header = columns.join(',');
    const body = rows.map(row => {
      return columns.map(col => {
        const value = row[col];
        const text = value === null || value === undefined ? '' : String(value);
        const escaped = text.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',');
    });
    const csv = [header, ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, filename);
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
}
