/**
 * Statistical utility functions for data analysis
 */

export class StatsUtils {
  /**
   * Calculate mean (average) of an array
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate median of an array
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate standard deviation
   */
  static std(values: number[], sample: boolean = true): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    const divisor = sample ? values.length - 1 : values.length;
    return Math.sqrt(this.mean(squareDiffs) * values.length / divisor);
  }

  /**
   * Calculate variance
   */
  static variance(values: number[], sample: boolean = true): number {
    return Math.pow(this.std(values, sample), 2);
  }

  /**
   * Calculate sum of an array
   */
  static sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Get minimum value
   */
  static min(values: number[]): number {
    return Math.min(...values);
  }

  /**
   * Get maximum value
   */
  static max(values: number[]): number {
    return Math.max(...values);
  }

  /**
   * Calculate quartiles (Q1, Q2/median, Q3)
   */
  static quartiles(values: number[]): { q1: number; q2: number; q3: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const q2 = this.median(sorted);
    const mid = Math.floor(sorted.length / 2);
    const lowerHalf = sorted.length % 2 === 0 ? sorted.slice(0, mid) : sorted.slice(0, mid);
    const upperHalf = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

    return {
      q1: this.median(lowerHalf),
      q2,
      q3: this.median(upperHalf)
    };
  }

  /**
   * Calculate Pearson correlation coefficient between two variables
   */
  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let sumSquareX = 0;
    let sumSquareY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      sumSquareX += diffX * diffX;
      sumSquareY += diffY * diffY;
    }

    const denominator = Math.sqrt(sumSquareX * sumSquareY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate covariance between two variables
   */
  static covariance(x: number[], y: number[], sample: boolean = true): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let cov = 0;
    for (let i = 0; i < n; i++) {
      cov += (x[i] - meanX) * (y[i] - meanY);
    }

    const divisor = sample ? n - 1 : n;
    return cov / divisor;
  }

  /**
   * Perform linear regression: y = a + bx
   * Returns { a, b, r2, predictions }
   */
  static linearRegression(x: number[], y: number[]): {
    a: number;
    b: number;
    r2: number;
    predictions: number[];
  } {
    if (x.length !== y.length || x.length === 0) {
      return { a: 0, b: 0, r2: 0, predictions: [] };
    }

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += (x[i] - meanX) * (x[i] - meanX);
    }

    const b = denominator === 0 ? 0 : numerator / denominator;
    const a = meanY - b * meanX;

    const predictions = x.map(xi => a + b * xi);
    const r = this.correlation(x, y);
    const r2 = r * r;

    return { a, b, r2, predictions };
  }

  /**
   * Perform polynomial regression of degree n
   */
  static polynomialRegression(
    x: number[],
    y: number[],
    degree: number
  ): {
    coefficients: number[];
    r2: number;
    predictions: number[];
  } {
    if (x.length !== y.length || x.length === 0) {
      return { coefficients: [], r2: 0, predictions: [] };
    }

    // Use matrix approach for polynomial regression
    // This is a simplified implementation
    // For degree 2: y = a + bx + cx²

    if (degree === 2) {
      // Quadratic regression
      const n = x.length;
      let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
      let sumXY = 0, sumX2Y = 0;

      for (let i = 0; i < n; i++) {
        const xi = x[i];
        const yi = y[i];
        const xi2 = xi * xi;
        const xi3 = xi2 * xi;
        const xi4 = xi2 * xi2;

        sumX += xi;
        sumY += yi;
        sumX2 += xi2;
        sumX3 += xi3;
        sumX4 += xi4;
        sumXY += xi * yi;
        sumX2Y += xi2 * yi;
      }

      // Solve system of equations (simplified)
      // This is an approximation - for production, use a proper matrix library
      const meanY = sumY / n;
      const meanX = sumX / n;
      const meanX2 = sumX2 / n;

      // Approximate coefficients
      const b = (sumXY - n * meanX * meanY) / (sumX2 - n * meanX * meanX);
      const c = (sumX2Y - meanY * sumX2 - b * sumX3) / (sumX4 - meanX2 * sumX2);
      const a = meanY - b * meanX - c * meanX2;

      const coefficients = [a, b, c];
      const predictions = x.map(xi => a + b * xi + c * xi * xi);

      // Calculate R²
      const yMean = this.mean(y);
      const ssRes = predictions.reduce((sum, pred, i) => sum + Math.pow(y[i] - pred, 2), 0);
      const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
      const r2 = 1 - (ssRes / ssTot);

      return { coefficients, r2, predictions };
    }

    // Fallback to linear for other degrees
    const linear = this.linearRegression(x, y);
    return {
      coefficients: [linear.a, linear.b],
      r2: linear.r2,
      predictions: linear.predictions
    };
  }

  /**
   * Calculate t-statistic for correlation significance test
   */
  static tStatistic(r: number, n: number): number {
    if (n <= 2) return 0;
    return r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  }

  /**
   * Calculate p-value from t-statistic (approximation)
   * For proper implementation, use a statistical library
   */
  static tTestPValue(t: number, df: number): number {
    // This is a rough approximation
    // For production, use a proper t-distribution library
    const absT = Math.abs(t);
    if (absT > 3) return 0.001;
    if (absT > 2.5) return 0.01;
    if (absT > 2) return 0.05;
    if (absT > 1.5) return 0.1;
    return 0.2;
  }

  /**
   * Calculate coefficient of variation (CV)
   */
  static coefficientOfVariation(values: number[]): number {
    const avg = this.mean(values);
    if (avg === 0) return 0;
    return (this.std(values) / avg) * 100;
  }

  /**
   * Calculate z-score for normalization
   */
  static zScore(values: number[]): number[] {
    const avg = this.mean(values);
    const stdDev = this.std(values);
    if (stdDev === 0) return values.map(() => 0);
    return values.map(val => (val - avg) / stdDev);
  }

  /**
   * Normalize values to 0-1 range
   */
  static normalize(values: number[]): number[] {
    const min = this.min(values);
    const max = this.max(values);
    const range = max - min;
    if (range === 0) return values.map(() => 0.5);
    return values.map(val => (val - min) / range);
  }

  /**
   * Calculate Mean Absolute Error (MAE)
   */
  static mae(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    const errors = actual.map((val, i) => Math.abs(val - predicted[i]));
    return this.mean(errors);
  }

  /**
   * Calculate Root Mean Squared Error (RMSE)
   */
  static rmse(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    const squaredErrors = actual.map((val, i) => Math.pow(val - predicted[i], 2));
    return Math.sqrt(this.mean(squaredErrors));
  }

  /**
   * Perform ANOVA (Analysis of Variance) between groups
   */
  static anova(groups: number[][]): {
    fStatistic: number;
    pValue: number;
    dfBetween: number;
    dfWithin: number;
  } {
    if (groups.length < 2) {
      return { fStatistic: 0, pValue: 1, dfBetween: 0, dfWithin: 0 };
    }

    const k = groups.length; // number of groups
    const n = groups.reduce((sum, group) => sum + group.length, 0); // total observations

    // Grand mean
    const allValues = groups.flat();
    const grandMean = this.mean(allValues);

    // Between-group sum of squares (SSB)
    let ssb = 0;
    groups.forEach(group => {
      const groupMean = this.mean(group);
      ssb += group.length * Math.pow(groupMean - grandMean, 2);
    });

    // Within-group sum of squares (SSW)
    let ssw = 0;
    groups.forEach(group => {
      const groupMean = this.mean(group);
      group.forEach(value => {
        ssw += Math.pow(value - groupMean, 2);
      });
    });

    // Degrees of freedom
    const dfBetween = k - 1;
    const dfWithin = n - k;

    // Mean squares
    const msb = ssb / dfBetween;
    const msw = dfWithin > 0 ? ssw / dfWithin : 0;

    // F-statistic
    const fStatistic = msw > 0 ? msb / msw : 0;

    // Approximate p-value
    let pValue = 0.05;
    if (fStatistic > 10) pValue = 0.001;
    else if (fStatistic > 5) pValue = 0.01;
    else if (fStatistic > 3) pValue = 0.05;
    else pValue = 0.1;

    return { fStatistic, pValue, dfBetween, dfWithin };
  }
}
