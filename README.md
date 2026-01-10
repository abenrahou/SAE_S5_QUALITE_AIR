# SAE S5 - Qualite de l'air (2019-2023)

Projet academique (BUT Informatique) : analyse interactive de la qualite de l'air dans 101 villes mondiales sur 2019-2023, avec indicateurs urbains et socio-economiques.

## Equipe
- Equipe Abrahams (IUT de Montreuil)
- 3e annee de BUT Informatique
- Parcours C (AGED - Administration, gestion et exploitation des donnees)

## Prerequis
Voir `REQUIREMENTS.md`.

## Installation
```bash
npm install
```

## Donnees CSV
Placez les fichiers CSV dans `public/assets/data/` :
- `DATASET_FINAL_5ANS_2019_2023_AVEC_COVID.csv`
- `DATASET_ANNUEL_2019_2023_AVEC_COVID.csv`

## Lancer en local
```bash
npm start
```
Puis ouvrez `http://localhost:4200`.

## Build production
```bash
npm run build
```

## Scripts utiles
- `npm start` : serveur de developpement
- `npm run build` : build production
- `npm test` : tests (si configures)

## Structure (resume)
- `src/app/features/` : pages (dashboard, map, analysis, prediction, ACP, correlations, etc.)
- `src/app/core/` : services et modeles
- `public/assets/data/` : donnees CSV

## Deploiement GitHub Pages
Exemple (a adapter a votre configuration) :
```bash
npm run build
# Publier le dossier dist/ avec GitHub Pages
```

## Support
Contact : `equipeabrahams@gmail.com`
