export interface City {
  cityName: string;
  cityNameAscii: string;
  countryCode: string;
  countryName: string;
  region: string;
  latitude: number;
  longitude: number;
  population?: number;
  density?: number;
  urbanizationLevel?: 'Rural' | 'Semi-urbain' | 'Urbain' | 'Très urbain';
  citySize?: 'Petite' | 'Moyenne' | 'Grande' | 'Mégapole';
}
