# Placement des Fichiers CSV

Placez vos fichiers CSV dans ce dossier :

1. `DATASET_FINAL_5ANS_2019_2023_AVEC_COVID.csv`
2. `DATASET_ANNUEL_2019_2023_AVEC_COVID.csv`

Ces fichiers sont nécessaires pour que l'application charge les données réelles.

## Structure attendue des colonnes

### DATASET_FINAL_5ANS_2019_2023_AVEC_COVID.csv
Colonnes essentielles :
- city_ascii_wc : Nom de la ville
- country_iso3_wc_first : Code pays
- country_name_first : Nom pays
- region_first : Région mondiale
- lat_wc_first, lon_wc_first : Coordonnées
- pm25_mean, pm10_mean, no2_mean, o3_mean, so2_mean, co_mean : Pollution
- densite_population_mean, pib_par_habitant_mean : Indicateurs
- electricite_charbon_pct_mean, energie_renouvelable_pct_mean : Énergie
- ... (voir data.service.ts pour liste complète)

### DATASET_ANNUEL_2019_2023_AVEC_COVID.csv
Mêmes colonnes + :
- year : Année (2019-2023)
