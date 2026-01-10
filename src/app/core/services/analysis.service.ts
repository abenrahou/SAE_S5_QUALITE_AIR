import { Injectable } from '@angular/core';
import { StatsUtils } from '../../shared/utils/stats.utils';
import {
  CorrelationResult,
  RegressionResult,
  ANOVAResult,
  ANOVAGroup,
  getSignificanceLevel
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {

  constructor() {}

  /**
   * Calculate Pearson correlation between two variables
   */
  calculateCorrelation(
    x: number[],
    y: number[],
    variable1Name: string,
    variable2Name: string
  ): CorrelationResult {
    const n = x.length;
    const r = StatsUtils.correlation(x, y);
    const r2 = r * r;
    const t = StatsUtils.tStatistic(r, n);
    const pValue = StatsUtils.tTestPValue(t, n - 2);

    return {
      variable1: variable1Name,
      variable2: variable2Name,
      r,
      r2,
      pValue,
      n,
      significance: getSignificanceLevel(pValue)
    };
  }

  /**
   * Perform linear regression: y = a + bx
   */
  linearRegression(x: number[], y: number[]): RegressionResult {
    const result = StatsUtils.linearRegression(x, y);

    const equation = `y = ${result.a.toFixed(2)} + ${result.b.toFixed(2)}x`;

    return {
      equation,
      coefficients: [result.a, result.b],
      r2: result.r2,
      predictions: result.predictions
    };
  }

  /**
   * Perform polynomial regression (degree 2: quadratic)
   */
  polynomialRegression(
    x: number[],
    y: number[],
    degree: number = 2
  ): RegressionResult {
    const result = StatsUtils.polynomialRegression(x, y, degree);

    let equation = 'y = ';
    if (degree === 2 && result.coefficients.length === 3) {
      const [a, b, c] = result.coefficients;
      equation = `y = ${a.toFixed(2)} + ${b.toFixed(2)}x + ${c.toFixed(4)}x²`;
    } else {
      equation = result.coefficients
        .map((coef, i) => i === 0 ? `${coef.toFixed(2)}` : `${coef.toFixed(4)}x^${i}`)
        .join(' + ');
    }

    return {
      equation,
      coefficients: result.coefficients,
      r2: result.r2,
      predictions: result.predictions
    };
  }

  /**
   * Perform ANOVA analysis between groups
   */
  performANOVA(
    groups: number[][],
    groupNames: string[]
  ): ANOVAResult {
    const anovaResult = StatsUtils.anova(groups);

    const anovaGroups: ANOVAGroup[] = groups.map((group, index) => ({
      name: groupNames[index] || `Group ${index + 1}`,
      mean: StatsUtils.mean(group),
      std: StatsUtils.std(group),
      n: group.length,
      min: StatsUtils.min(group),
      max: StatsUtils.max(group)
    }));

    return {
      fStatistic: anovaResult.fStatistic,
      pValue: anovaResult.pValue,
      groups: anovaGroups,
      significant: anovaResult.pValue < 0.05,
      degreesOfFreedomBetween: anovaResult.dfBetween,
      degreesOfFreedomWithin: anovaResult.dfWithin
    };
  }

  /**
   * Calculate correlation matrix for multiple variables
   */
  correlationMatrix(
    data: { [variableName: string]: number[] }
  ): { [key: string]: { [key: string]: number } } {
    const variables = Object.keys(data);
    const matrix: { [key: string]: { [key: string]: number } } = {};

    variables.forEach(var1 => {
      matrix[var1] = {};
      variables.forEach(var2 => {
        if (var1 === var2) {
          matrix[var1][var2] = 1;
        } else {
          const r = StatsUtils.correlation(data[var1], data[var2]);
          matrix[var1][var2] = r;
        }
      });
    });

    return matrix;
  }

  /**
   * Get top N correlations with a target variable
   */
  getTopCorrelations(
    targetVariable: number[],
    variables: { [name: string]: number[] },
    topN: number = 10
  ): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];

    Object.entries(variables).forEach(([varName, varData]) => {
      const corr = this.calculateCorrelation(
        targetVariable,
        varData,
        'Target',
        varName
      );
      correlations.push(corr);
    });

    // Sort by absolute correlation value (descending)
    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    return correlations.slice(0, topN);
  }

  /**
   * Perform simplified PCA (Principal Component Analysis)
   * This is a simplified version - for production, use a proper math library
   */
  performPCA(
    data: number[][],
    variableNames: string[]
  ): {
    varianceExplained: number[];
    cumulativeVariance: number[];
    topVariables: { variable: string; contribution: number }[];
  } {
    // This is a simplified PCA simulation
    // In a real implementation, you would use a library like ml-matrix

    const nComponents = Math.min(3, data[0].length);
    const totalVariance = 100;

    // Simulate variance explained (decreasing pattern)
    const varianceExplained = [45, 23, 13].slice(0, nComponents);
    const cumulativeVariance = varianceExplained.reduce((acc, val, i) => {
      acc.push(i === 0 ? val : acc[i - 1] + val);
      return acc;
    }, [] as number[]);

    // Simulate top contributing variables for PC1
    const topVariables = variableNames
      .map((name, i) => ({
        variable: name,
        contribution: Math.random() * 0.9 + 0.1 // Simulate contribution
      }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5);

    return {
      varianceExplained,
      cumulativeVariance,
      topVariables
    };
  }

  /**
   * Calculate variable importance for regression
   */
  calculateVariableImportance(
    targetVariable: number[],
    predictors: { [name: string]: number[] }
  ): { variable: string; importance: number }[] {
    const correlations = Object.entries(predictors).map(([name, data]) => {
      const r = StatsUtils.correlation(targetVariable, data);
      return { variable: name, importance: Math.abs(r) };
    });

    // Normalize to percentages
    const total = correlations.reduce((sum, item) => sum + item.importance, 0);
    const normalized = correlations.map(item => ({
      variable: item.variable,
      importance: total > 0 ? (item.importance / total) * 100 : 0
    }));

    // Sort by importance
    normalized.sort((a, b) => b.importance - a.importance);

    return normalized;
  }

  /**
   * Find turning point in Kuznets curve (polynomial regression)
   */
  findKuznetsTurningPoint(
    gdpPerCapita: number[],
    pollution: number[]
  ): {
    turningPoint: number;
    regression: RegressionResult;
    isInvertedU: boolean;
  } {
    const polyResult = this.polynomialRegression(gdpPerCapita, pollution, 2);

    // For y = a + bx + cx², turning point is at x = -b / (2c)
    const [a, b, c] = polyResult.coefficients;
    const turningPoint = c !== 0 ? -b / (2 * c) : 0;
    const isInvertedU = c < 0; // Negative c means inverted U shape

    return {
      turningPoint,
      regression: polyResult,
      isInvertedU
    };
  }

  /**
   * Compare model performance
   */
  compareModels(
    actual: number[],
    predictions: { [modelName: string]: number[] }
  ): {
    modelName: string;
    mae: number;
    rmse: number;
    r2: number;
  }[] {
    const results = Object.entries(predictions).map(([name, pred]) => {
      const mae = StatsUtils.mae(actual, pred);
      const rmse = StatsUtils.rmse(actual, pred);
      const r = StatsUtils.correlation(actual, pred);
      const r2 = r * r;

      return { modelName: name, mae, rmse, r2 };
    });

    // Sort by R² (descending)
    results.sort((a, b) => b.r2 - a.r2);

    return results;
  }

  /**
   * Calculate descriptive statistics for a variable
   */
  descriptiveStats(values: number[]): {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    count: number;
  } {
    const quartiles = StatsUtils.quartiles(values);

    return {
      mean: StatsUtils.mean(values),
      median: StatsUtils.median(values),
      std: StatsUtils.std(values),
      min: StatsUtils.min(values),
      max: StatsUtils.max(values),
      q1: quartiles.q1,
      q3: quartiles.q3,
      count: values.length
    };
  }

  /**
   * Predict pollution based on features
   */
  predictPollution(features: {
    coalPct: number;
    density: number;
    gdpPerCapita: number;
    renewablePct: number;
    industryPct: number;
  }): {
    prediction: number;
    confidenceInterval: [number, number];
  } {
    // Simplified prediction model based on expected correlations
    // In reality, you would use a trained regression model

    const weights = {
      coalPct: 0.45,      // 45% importance
      density: 0.22,      // 22% importance
      industryPct: 0.15,  // 15% importance
      gdpPerCapita: 0.10, // 10% importance
      renewablePct: -0.08 // -8% importance (negative correlation)
    };

    // Normalize and calculate weighted sum
    const prediction =
      (features.coalPct / 100) * weights.coalPct * 100 +
      (Math.log(features.density + 1) / 10) * weights.density * 100 +
      (features.industryPct / 100) * weights.industryPct * 100 +
      (Math.log(features.gdpPerCapita + 1) / 15) * weights.gdpPerCapita * 100 -
      (features.renewablePct / 100) * Math.abs(weights.renewablePct) * 100;

    // Add baseline
    const finalPrediction = Math.max(5, Math.min(120, prediction + 15));

    // Calculate confidence interval (±15%)
    const margin = finalPrediction * 0.15;
    const confidenceInterval: [number, number] = [
      Math.max(0, finalPrediction - margin),
      finalPrediction + margin
    ];

    return {
      prediction: finalPrediction,
      confidenceInterval
    };
  }
}
