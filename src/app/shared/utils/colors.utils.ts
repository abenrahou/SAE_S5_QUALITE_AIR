/**
 * Color utilities for consistent color palettes across charts
 */

export class ColorsUtils {
  // Palette for regions
  static readonly REGION_COLORS: { [key: string]: string } = {
    'Europe & Central Asia': '#3b82f6',
    'East Asia & Pacific': '#ef4444',
    'North America': '#10b981',
    'Latin America & Caribbean': '#f59e0b',
    'South Asia': '#8b5cf6',
    'Middle East & North Africa': '#ec4899',
    'Sub-Saharan Africa': '#14b8a6'
  };

  // Palette for quality levels (pollution)
  static readonly QUALITY_COLORS = {
    'Bon': '#10b981',
    'Modéré': '#f59e0b',
    'Mauvais': '#f97316',
    'Très mauvais': '#ef4444'
  };

  // Gradient for heatmaps (blue to red)
  static readonly HEATMAP_GRADIENT = [
    '#3b82f6', // Blue (low)
    '#60a5fa',
    '#93c5fd',
    '#dbeafe',
    '#ffffff', // White (medium)
    '#fecaca',
    '#fca5a5',
    '#f87171',
    '#ef4444'  // Red (high)
  ];

  // Diverging palette for correlations
  static readonly CORRELATION_GRADIENT = [
    '#1e3a8a', // Dark blue (strong negative)
    '#3b82f6', // Blue
    '#93c5fd', // Light blue
    '#dbeafe',
    '#ffffff', // White (no correlation)
    '#fecaca',
    '#fca5a5',
    '#ef4444', // Red
    '#991b1b'  // Dark red (strong positive)
  ];

  // Sequential palette for charts
  static readonly CHART_COLORS = [
    '#3b82f6', // Primary blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Orange
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange-red
    '#06b6d4', // Cyan
    '#84cc16'  // Lime
  ];

  /**
   * Get color for a specific region
   */
  static getRegionColor(region: string): string {
    return this.REGION_COLORS[region] || '#6b7280';
  }

  /**
   * Get color for pollution quality level
   */
  static getQualityColor(level: string): string {
    const colors = this.QUALITY_COLORS as { [key: string]: string };
    return colors[level] || '#6b7280';
  }

  /**
   * Get color for correlation value (-1 to 1)
   */
  static getCorrelationColor(r: number): string {
    // Map r from [-1, 1] to [0, 8] (9 colors)
    const index = Math.floor(((r + 1) / 2) * 8);
    const clampedIndex = Math.max(0, Math.min(8, index));
    return this.CORRELATION_GRADIENT[clampedIndex];
  }

  /**
   * Get color from chart palette by index
   */
  static getChartColor(index: number): string {
    return this.CHART_COLORS[index % this.CHART_COLORS.length];
  }

  /**
   * Generate array of colors for n items
   */
  static getColorArray(n: number): string[] {
    const colors: string[] = [];
    for (let i = 0; i < n; i++) {
      colors.push(this.getChartColor(i));
    }
    return colors;
  }

  /**
   * Get gradient color based on value in range
   */
  static getGradientColor(value: number, min: number, max: number): string {
    if (max === min) return this.HEATMAP_GRADIENT[4]; // Middle color

    // Normalize value to 0-1
    const normalized = (value - min) / (max - min);

    // Map to gradient index
    const index = Math.floor(normalized * (this.HEATMAP_GRADIENT.length - 1));
    const clampedIndex = Math.max(0, Math.min(this.HEATMAP_GRADIENT.length - 1, index));

    return this.HEATMAP_GRADIENT[clampedIndex];
  }

  /**
   * Convert hex color to RGB
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Add alpha channel to hex color
   */
  static addAlpha(hex: string, alpha: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
}
