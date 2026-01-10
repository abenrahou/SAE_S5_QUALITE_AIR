export type PollutantType = 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co';

export type QualityLevel = 'Bon' | 'Modéré' | 'Mauvais' | 'Très mauvais';

export interface PollutionData {
  cityName: string;
  parameter: PollutantType;
  valueMean: number;
  valueMedian: number;
  valueStd: number;
  valueMin: number;
  valueMax: number;
  valueCount: number;
  year?: number; // Pour dataset annuel
  qualityLevel?: QualityLevel;
}

export interface PollutantInfo {
  name: string;
  unit: string;
  description: string;
  whoGuideline: number; // WHO guideline value
  color: string;
}

export const POLLUTANT_INFO: Record<PollutantType, PollutantInfo> = {
  pm25: {
    name: 'PM2.5',
    unit: 'µg/m³',
    description: 'Particules fines (diamètre < 2.5 µm)',
    whoGuideline: 5,
    color: '#ef4444'
  },
  pm10: {
    name: 'PM10',
    unit: 'µg/m³',
    description: 'Particules (diamètre < 10 µm)',
    whoGuideline: 15,
    color: '#f59e0b'
  },
  no2: {
    name: 'NO₂',
    unit: 'µg/m³',
    description: 'Dioxyde d\'azote',
    whoGuideline: 10,
    color: '#8b5cf6'
  },
  o3: {
    name: 'O₃',
    unit: 'µg/m³',
    description: 'Ozone troposphérique',
    whoGuideline: 60,
    color: '#06b6d4'
  },
  so2: {
    name: 'SO₂',
    unit: 'µg/m³',
    description: 'Dioxyde de soufre',
    whoGuideline: 40,
    color: '#84cc16'
  },
  co: {
    name: 'CO',
    unit: 'mg/m³',
    description: 'Monoxyde de carbone',
    whoGuideline: 4,
    color: '#6366f1'
  }
};

export function getQualityLevel(value: number, pollutant: PollutantType): QualityLevel {
  const guideline = POLLUTANT_INFO[pollutant].whoGuideline;

  if (value <= guideline * 1.2) return 'Bon';
  if (value <= guideline * 3.5) return 'Modéré';
  if (value <= guideline * 5.5) return 'Mauvais';
  return 'Très mauvais';
}

export function getQualityColor(level: QualityLevel): string {
  switch (level) {
    case 'Bon': return '#10b981';
    case 'Modéré': return '#f59e0b';
    case 'Mauvais': return '#f97316';
    case 'Très mauvais': return '#ef4444';
  }
}
