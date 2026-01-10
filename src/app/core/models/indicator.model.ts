export type DevelopmentLevel = 'Faible' | 'Moyen-Faible' | 'Moyen-Élevé' | 'Élevé';
export type EnergyMix = 'Fossile' | 'Mixte-Fossile' | 'Mixte-Renouvelable' | 'Renouvelable';

export interface Indicator {
  cityName?: string;
  countryCode: string;

  // Urbanisation (7 indicateurs)
  density?: number; // densite_population_mean
  urbanPopulationPct?: number; // pop_urbaine_pct_mean
  totalPopulation?: number; // population_totale_mean
  urbanGrowth?: number; // croissance_urbaine_mean
  surfaceKm2?: number; // superficie_km2_mean
  urbanizationLevel?: 'Rural' | 'Semi-urbain' | 'Urbain' | 'Très urbain'; // niveau_urbanisation_first
  citySize?: 'Petite' | 'Moyenne' | 'Grande' | 'Mégapole'; // taille_ville_first

  // Développement économique (9 indicateurs)
  gdpPerCapita?: number; // pib_par_habitant_mean
  gdpTotal?: number; // pib_total_mean
  gdpGrowth?: number; // croissance_pib_mean
  industryPctGdp?: number; // industrie_pct_pib_mean
  agriculturePctGdp?: number; // agriculture_pct_pib_mean
  servicesPctGdp?: number; // services_pct_pib_mean
  secondarySectorPct?: number; // secteur_secondaire_pct_mean
  privateConsumption?: number; // consommation_privee_mean
  developmentLevel?: DevelopmentLevel; // niveau_developpement_first

  // Énergie (8 indicateurs - TRÈS IMPORTANTS)
  energyPerCapita?: number; // energie_par_habitant_mean
  coalPct?: number; // electricite_charbon_pct_mean
  renewablePct?: number; // energie_renouvelable_pct_mean
  electricityPerCapita?: number; // electricite_par_habitant_mean
  electricityLossPct?: number; // pertes_electricite_pct_mean
  energyIntensity?: number; // intensite_energetique_mean
  coalRenewableRatio?: number; // ratio_charbon_renouvelables_mean
  energyMix?: EnergyMix; // mix_energetique_first

  // Transport (2 indicateurs)
  airPassengers?: number; // passagers_aeriens_mean
  railwaysKm?: number; // voies_ferrees_km_mean

  // Environnement (2 indicateurs)
  forestPct?: number; // foret_pct_mean
  freshwaterKm3?: number; // eau_douce_km3_mean

  // Social (4 indicateurs)
  lifeExpectancy?: number; // esperance_vie_mean
  secondaryEnrollmentPct?: number; // scolarisation_secondaire_pct_mean
  waterAccessPct?: number; // acces_eau_potable_pct_mean
  giniIndex?: number; // indice_gini_mean

  // Temporel (pour dataset annuel)
  year?: number;
  startYear?: number; // annee_debut
  endYear?: number; // annee_fin
  nbYears?: number; // nb_annees
  includesCovid?: boolean; // inclut_covid

  // Qualité des données
  dataQuality?: 'Faible' | 'Moyenne' | 'Élevée' | 'Excellente'; // qualite_donnees
  measurementsPerDay?: number; // mesures_par_jour
  coefficientOfVariation?: number; // coeff_variation
}

export interface IndicatorMetadata {
  key: keyof Indicator;
  label: string;
  unit?: string;
  category: 'urbanisation' | 'developpement' | 'energie' | 'transport' | 'environnement' | 'social';
  description: string;
}

export const INDICATOR_METADATA: IndicatorMetadata[] = [
  // Urbanisation
  {
    key: 'density',
    label: 'Densité de population',
    unit: 'hab/km²',
    category: 'urbanisation',
    description: 'Nombre d\'habitants par kilomètre carré'
  },
  {
    key: 'urbanPopulationPct',
    label: 'Population urbaine',
    unit: '%',
    category: 'urbanisation',
    description: 'Pourcentage de la population vivant en zone urbaine'
  },
  {
    key: 'urbanGrowth',
    label: 'Croissance urbaine',
    unit: '%/an',
    category: 'urbanisation',
    description: 'Taux de croissance annuel de la population urbaine'
  },
  // Développement
  {
    key: 'gdpPerCapita',
    label: 'PIB par habitant',
    unit: 'USD',
    category: 'developpement',
    description: 'Produit intérieur brut par habitant'
  },
  {
    key: 'industryPctGdp',
    label: 'Part de l\'industrie',
    unit: '% PIB',
    category: 'developpement',
    description: 'Part de l\'industrie dans le PIB'
  },
  {
    key: 'servicesPctGdp',
    label: 'Part des services',
    unit: '% PIB',
    category: 'developpement',
    description: 'Part des services dans le PIB'
  },
  // Énergie
  {
    key: 'coalPct',
    label: 'Électricité au charbon',
    unit: '%',
    category: 'energie',
    description: 'Part du charbon dans la production d\'électricité'
  },
  {
    key: 'renewablePct',
    label: 'Énergies renouvelables',
    unit: '%',
    category: 'energie',
    description: 'Part des énergies renouvelables dans le mix énergétique'
  },
  {
    key: 'energyPerCapita',
    label: 'Consommation d\'énergie',
    unit: 'kg éq. pétrole',
    category: 'energie',
    description: 'Consommation d\'énergie par habitant'
  },
  // Social
  {
    key: 'lifeExpectancy',
    label: 'Espérance de vie',
    unit: 'années',
    category: 'social',
    description: 'Espérance de vie à la naissance'
  },
  {
    key: 'giniIndex',
    label: 'Indice de Gini',
    unit: '',
    category: 'social',
    description: 'Indice de Gini (mesure des inégalités)'
  }
];
