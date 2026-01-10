export type SignificanceLevel = 'Hautement significatif' | 'Significatif' | 'Non significatif';

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  r: number; // Coefficient de corrélation de Pearson
  r2: number; // Coefficient de détermination
  pValue: number; // p-value du test de significativité
  n: number; // Taille de l'échantillon
  significance: SignificanceLevel;
}

export interface RegressionResult {
  equation: string; // Équation sous forme texte (ex: "y = 2.5x + 10")
  coefficients: number[]; // Coefficients [a, b, c...] selon ordre polynomial
  r2: number; // Coefficient de détermination
  predictions: number[]; // Valeurs prédites pour chaque observation
  residuals?: number[]; // Résidus (optionnel)
}

export interface ANOVAResult {
  fStatistic: number; // Statistique F
  pValue: number; // p-value
  groups: ANOVAGroup[]; // Statistiques par groupe
  significant: boolean; // Résultat significatif ou non
  degreesOfFreedomBetween: number; // Degrés de liberté inter-groupes
  degreesOfFreedomWithin: number; // Degrés de liberté intra-groupes
}

export interface ANOVAGroup {
  name: string; // Nom du groupe (ex: "Rural", "Urbain")
  mean: number; // Moyenne du groupe
  std: number; // Écart-type du groupe
  n: number; // Taille du groupe
  min?: number;
  max?: number;
}

export interface PCAResult {
  components: number[][]; // Scores des observations sur chaque composante
  varianceExplained: number[]; // % de variance expliquée par chaque PC
  cumulativeVariance: number[]; // % de variance cumulée
  loadings: { [variable: string]: number[] }; // Contributions des variables
  eigenvalues: number[]; // Valeurs propres
}

export interface PredictionResult {
  value: number; // Valeur prédite
  confidenceInterval: [number, number]; // Intervalle de confiance à 95%
  features: { [key: string]: number }; // Features utilisées pour la prédiction
  model: string; // Nom du modèle utilisé
}

export interface ModelComparison {
  modelName: string;
  r2: number;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  features: string[]; // Variables utilisées
  trainingTime?: number; // Temps d'entraînement (ms)
}

export interface VariableImportance {
  variable: string;
  importance: number; // % d'importance (somme = 100%)
  rank: number; // Rang (1 = plus important)
}

// Fonctions utilitaires pour la classification des résultats

export function getSignificanceLevel(pValue: number): SignificanceLevel {
  if (pValue < 0.001) return 'Hautement significatif';
  if (pValue < 0.05) return 'Significatif';
  return 'Non significatif';
}

export function getCorrelationStrength(r: number): string {
  const absR = Math.abs(r);
  if (absR < 0.2) return 'Très faible';
  if (absR < 0.4) return 'Faible';
  if (absR < 0.6) return 'Modérée';
  if (absR < 0.8) return 'Forte';
  return 'Très forte';
}

export function formatPValue(pValue: number): string {
  if (pValue < 0.001) return 'p < 0.001';
  return `p = ${pValue.toFixed(3)}`;
}

export function formatR2(r2: number): string {
  return `${(r2 * 100).toFixed(1)}%`;
}
