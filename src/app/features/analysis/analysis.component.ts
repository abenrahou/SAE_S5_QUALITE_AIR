import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { KpiCard } from '../../shared/components/kpi-card/kpi-card';
import { IconComponent } from '../../shared/components/icon/icon.component';

type TabId =
  | 'temporal'
  | 'urbanisation'
  | 'developpement'
  | 'transport'
  | 'energie'
  | 'environnement'
  | 'multivariee'
  | 'modeles'
  | 'plan'
  | 'transparence'
  | 'limites';

interface KpiItem {
  icon: string;
  value: string;
  label: string;
  subtext: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

interface ChartItem {
  title: string;
  description: string;
  footer: string;
  imageSrc: string;
  imageAlt: string;
}

interface TabSection {
  id: TabId;
  label: string;
  icon: string;
  accent: string;
  question: string;
  hypothesis: string;
  summary: string;
  kpis: KpiItem[];
  charts: ChartItem[];
  insights: string[];
  interpretation: string;
}

interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

@Component({
  selector: 'app-analysis',
  imports: [CommonModule, KpiCard, IconComponent],
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly selectedTab = signal<TabId>('temporal');

  readonly tabs = signal<TabSection[]>([
    {
      id: 'temporal',
      label: 'Temporal & COVID',
      icon: 'calendar',
      accent: '#0ea5e9',
      question: 'Comment evoluent les polluants entre 2019 et 2023 ?',
      hypothesis: 'Les polluants n evoluent pas de la meme maniere et COVID cree un choc visible.',
      summary: 'PM2.5 baisse en 2020 puis revient, NO2 disperse, O3 augmente pendant COVID.',
      kpis: [
        { icon: 'sparkles', value: '5 ans', label: 'Periode', subtext: '2019 a 2023', color: 'blue' },
        { icon: 'arrow-path', value: 'COVID', label: 'Choc', subtext: 'Effet visible 2020', color: 'orange' },
        { icon: 'chart-bar', value: '6', label: 'Polluants', subtext: 'Comparaison complete', color: 'purple' }
      ],
      charts: [
        {
          title: 'Evolution 2019-2023',
          description: 'Tendances PM2.5, NO2, O3',
          footer: 'Lecture temporelle avec repere COVID.',
          imageSrc: '/assets/graphs/1_evolution_temporelle_2019_2023.png',
          imageAlt: 'Evolution temporelle 2019-2023'
        },
        {
          title: 'Impact COVID',
          description: 'Avant / pendant / apres',
          footer: 'Baisse PM2.5, O3 en hausse pendant COVID.',
          imageSrc: '/assets/graphs/2_impact_covid_analyse_complete.png',
          imageAlt: 'Impact COVID sur les polluants'
        },
        {
          title: 'Matrice de correlations',
          description: 'Relations entre polluants',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/1_matrice_correlations_polluants.png',
          imageAlt: 'Matrice des correlations des polluants'
        }
      ],
      insights: [
        'PM2.5: 30.6 -> 27.1 pendant COVID, retour ensuite.',
        'NO2: baisse faible (~3%) puis reprise.',
        'O3: hausse pendant COVID (effet photochimique).' 
      ],
      interpretation: 'COVID agit comme experience naturelle et montre des comportements differencies par polluant.'
    },
    {
      id: 'urbanisation',
      label: 'Urbanisation',
      icon: 'building-office-2',
      accent: '#22c55e',
      question: 'La dynamique urbaine explique-t-elle la pollution ?',
      hypothesis: 'La croissance urbaine pese plus que la taille fixe des villes.',
      summary: 'Correlation positive forte entre croissance urbaine et PM2.5.',
      kpis: [
        { icon: 'chart-bar', value: '0.51', label: 'Correlation', subtext: 'Croissance vs PM2.5', color: 'green' },
        { icon: 'sparkles', value: '22.6', label: 'Petites villes', subtext: 'PM2.5 moyen', color: 'blue' },
        { icon: 'sparkles', value: '27.3', label: 'Villes moyennes', subtext: 'PM2.5 moyen', color: 'orange' }
      ],
      charts: [
        {
          title: 'Croissance urbaine',
          description: 'Relation PM2.5 / croissance urbaine',
          footer: 'Slide axe 1.',
          imageSrc: '/assets/graphs/axe1_q3_croissance.png',
          imageAlt: 'Croissance urbaine et PM2.5'
        },
        {
          title: 'Taille de ville',
          description: 'PM2.5 selon la taille',
          footer: 'Effet secondaire.',
          imageSrc: '/assets/graphs/axe1_taille_ville.png',
          imageAlt: 'PM2.5 par taille de ville'
        }
      ],
      insights: [
        'Villes en croissance rapide concentrent les PM2.5 eleves.',
        'La taille seule explique peu les ecarts.',
        'Le contexte economique et politique compte fortement.'
      ],
      interpretation: 'Le rythme de croissance est un signal plus fort que la taille brute de la ville.'
    },
    {
      id: 'developpement',
      label: 'Developpement',
      icon: 'currency-dollar',
      accent: '#6366f1',
      question: 'Le niveau de developpement protege-t-il la qualite de l air ?',
      hypothesis: 'On observe une relation negative entre PIB et pollution.',
      summary: 'Gradient fort: PIB eleve = PM2.5 plus faibles.',
      kpis: [
        { icon: 'chart-bar', value: '-0.50', label: 'Correlation', subtext: 'PIB vs PM2.5', color: 'purple' },
        { icon: 'chart-bar', value: '-0.52', label: 'Correlation', subtext: 'Services vs PM2.5', color: 'blue' },
        { icon: 'sparkles', value: '10-15', label: 'PM2.5', subtext: 'Villes a PIB eleve', color: 'green' }
      ],
      charts: [
        {
          title: 'PIB par habitant',
          description: 'Lecture type Kuznets',
          footer: 'Slide axe 2.',
          imageSrc: '/assets/graphs/axe2_kuznets_pib.png',
          imageAlt: 'PIB par habitant et PM2.5'
        },
        {
          title: 'Tertiarisation',
          description: 'Part des services dans le PIB',
          footer: 'Effet protecteur.',
          imageSrc: '/assets/graphs/axe2_q4_services.png',
          imageAlt: 'Part des services et PM2.5'
        },
        {
          title: 'Heatmap developpement',
          description: 'Analyse croisee',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/chi2_developpement_heatmap.png',
          imageAlt: 'Heatmap developpement'
        }
      ],
      insights: [
        'Les pays a faible PIB concentrent les PM2.5 extremes.',
        'La tertiarisation reduit l exposition urbaine.',
        'Le developpement structure durablement la pollution.'
      ],
      interpretation: 'Le niveau de developpement est un determinant majeur des particules fines.'
    },
    {
      id: 'transport',
      label: 'Transport',
      icon: 'scale',
      accent: '#f97316',
      question: 'Le transport explique-t-il les differences de NO2 ?',
      hypothesis: 'Les infrastructures ferrees reduisent le NO2 urbain.',
      summary: 'Grand reseau ferre = -70% NO2 vs reseau moyen.',
      kpis: [
        { icon: 'chart-bar', value: '-70%', label: 'NO2', subtext: 'Reseau ferre developpe', color: 'orange' },
        { icon: 'chart-pie', value: '79.8', label: 'Reseau moyen', subtext: 'NO2 moyen', color: 'red' },
        { icon: 'chart-pie', value: '23.4', label: 'Grand reseau', subtext: 'NO2 moyen', color: 'green' }
      ],
      charts: [
        {
          title: 'Reseau ferre',
          description: 'Comparaison par categories',
          footer: 'Slide axe 3.',
          imageSrc: '/assets/graphs/axe3_reseau_ferre.png',
          imageAlt: 'Reseau ferre et polluants'
        },
        {
          title: 'Trafic aerien',
          description: 'Proxy mobilite',
          footer: 'Effet faible.',
          imageSrc: '/assets/graphs/4_transport_no2_vs_pm25.png',
          imageAlt: 'Trafic aerien, PM2.5 et NO2'
        }
      ],
      insights: [
        'Le NO2 est tres sensible aux infrastructures locales.',
        'Le trafic aerien n explique pas l exposition urbaine.',
        'Le transport public est un levier prioritaire.'
      ],
      interpretation: 'Le NO2 depend fortement des choix de mobilite urbaine.'
    },
    {
      id: 'energie',
      label: 'Energie',
      icon: 'fire',
      accent: '#ef4444',
      question: 'Le charbon explique-t-il la pollution urbaine ?',
      hypothesis: 'Charbon associe au SO2, pas aux PM2.5 urbains.',
      summary: 'SO2 suit le charbon, PM2.5 decouple, NO2 faible lien.',
      kpis: [
        { icon: 'sparkles', value: 'SO2', label: 'Lien fort', subtext: 'Charbon', color: 'red' },
        { icon: 'sparkles', value: 'PM2.5', label: 'Lien faible', subtext: 'Decouplage', color: 'orange' },
        { icon: 'sparkles', value: 'NO2', label: 'Lien faible', subtext: 'Mobilite locale', color: 'blue' }
      ],
      charts: [
        {
          title: 'Charbon vs SO2',
          description: 'Lien direct',
          footer: 'Slide axe 4.',
          imageSrc: '/assets/graphs/11_charbon_so2.png',
          imageAlt: 'Part du charbon et SO2'
        },
        {
          title: 'Charbon vs PM2.5',
          description: 'Decouplage majeur',
          footer: 'Slide axe 4.',
          imageSrc: '/assets/graphs/Part du charbon et niveaux de PM2.5 - 13 janvier 2026.png',
          imageAlt: 'Part du charbon et PM2.5'
        },
        {
          title: 'Impacts differencies',
          description: 'PM2.5, SO2, NO2',
          footer: 'Slide axe 4.',
          imageSrc: '/assets/graphs/6_energie_impacts_differencies.png',
          imageAlt: 'Impacts differencies du charbon'
        }
      ],
      insights: [
        'SO2 depend directement de la combustion du charbon.',
        'PM2.5 urbaines sont multi-sources.',
        'Le charbon ne suffit pas a expliquer la pollution fine.'
      ],
      interpretation: 'Sortir du charbon est essentiel pour le SO2, insuffisant pour PM2.5.'
    },
    {
      id: 'environnement',
      label: 'Environnement',
      icon: 'sparkles',
      accent: '#0ea5e9',
      question: 'La foret compense-t-elle l intensite d activite ?',
      hypothesis: 'La foret aide, mais ne suffit pas quand l intensite est forte.',
      summary: 'Effet protecteur limite de la couverture forestiere.',
      kpis: [
        { icon: 'chart-bar', value: 'PM2.5', label: 'Plus bas', subtext: 'Foret elevee + intensite faible', color: 'green' },
        { icon: 'scale', value: 'Levier', label: 'Complementaire', subtext: 'Pas principal', color: 'blue' },
        { icon: 'sparkles', value: 'Proxy', label: 'Prelevements eau', subtext: 'Intensite', color: 'orange' }
      ],
      charts: [
        {
          title: 'Foret vs intensite',
          description: 'Effet croise',
          footer: 'Slide axe 5.',
          imageSrc: '/assets/graphs/axe5_forets_industrie_croise.png',
          imageAlt: 'Forets et intensite d activite'
        }
      ],
      insights: [
        'Foret elevee baisse les PM2.5 a intensite faible.',
        'Intensite elevee neutralise en partie l effet.',
        'Levier utile mais secondaire.'
      ],
      interpretation: 'La foret est un facteur d attenuation, pas une solution principale.'
    },
    {
      id: 'multivariee',
      label: 'ACP',
      icon: 'beaker',
      accent: '#14b8a6',
      question: 'Quelle structure globale relie les indicateurs ?',
      hypothesis: 'Deux composantes structurent le systeme.',
      summary: 'PC1 (developpement) + PC2 (energie/env) = 60.5% variance.',
      kpis: [
        { icon: 'chart-bar', value: '39.6%', label: 'PC1', subtext: 'Developpement', color: 'blue' },
        { icon: 'chart-bar', value: '20.8%', label: 'PC2', subtext: 'Energie/env', color: 'green' },
        { icon: 'sparkles', value: '60.5%', label: 'Total', subtext: 'Variance expliquee', color: 'purple' }
      ],
      charts: [
        {
          title: 'ACP simplifiee',
          description: 'Lecture soutenance',
          footer: 'Slide ACP.',
          imageSrc: '/assets/graphs/7_acp_simplifiee_oral.png',
          imageAlt: 'ACP simplifiee'
        },
        {
          title: 'Cercle de correlation',
          description: 'Lecture detaillee',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/acp_cercle_correlation_biplot.png',
          imageAlt: 'ACP cercle de correlation'
        }
      ],
      insights: [
        'PC1 oppose pays developpes vs urbanisation rapide.',
        'PC2 oppose charbon/industrie vs renouvelables/foret.',
        'Structure coherente des determinants.'
      ],
      interpretation: 'Les determinants se combinent en deux axes majeurs.'
    },
    {
      id: 'modeles',
      label: 'Modeles',
      icon: 'cpu-chip',
      accent: '#f59e0b',
      question: 'Quelle capacite predictive des facteurs ?',
      hypothesis: 'PM2.5 est bien predite, NO2 plus local.',
      summary: 'PM2.5 R2 0.868, NO2 faible, O3 intermediaire.',
      kpis: [
        { icon: 'chart-bar', value: '0.868', label: 'PM2.5', subtext: 'Random Forest', color: 'green' },
        { icon: 'chart-bar', value: '0.33', label: 'NO2', subtext: 'Faible', color: 'orange' },
        { icon: 'chart-bar', value: '0.45', label: 'O3', subtext: 'Intermediaire', color: 'purple' }
      ],
      charts: [
        {
          title: 'R2 comparatif',
          description: 'Jeu de test',
          footer: 'Slide modeles.',
          imageSrc: '/assets/graphs/8_modeles_r2_comparaison_oral.png',
          imageAlt: 'Comparaison des R2'
        },
        {
          title: 'Modeles multi-polluants',
          description: 'Comparatif global',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/3_modeles_comparatifs_multipolluants.png',
          imageAlt: 'Modeles comparatifs multi-polluants'
        },
        {
          title: 'Importance des variables',
          description: 'Poids relatif',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/model_regression_importance.png',
          imageAlt: 'Importance des variables'
        },
        {
          title: 'Predictions',
          description: 'Observations vs predictions',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/model_regression_predictions.png',
          imageAlt: 'Predictions des modeles'
        }
      ],
      insights: [
        'PM2.5 structurees par contexte socio-economique.',
        'NO2 depend de facteurs locaux non observes.',
        'O3 sensible a la photochimie et a la meteo.'
      ],
      interpretation: 'Les determinants varient fortement selon le polluant.'
    },
    {
      id: 'plan',
      label: 'Plan d action',
      icon: 'chart-pie',
      accent: '#0ea5e9',
      question: 'Quels leviers prioriser ?',
      hypothesis: 'Cibler d abord les villes en forte croissance.',
      summary: 'Priorites: croissance urbaine, developpement inclusif, actions specifques.',
      kpis: [
        { icon: 'sparkles', value: 'Priorite 1', label: 'Croissance', subtext: 'Infrastructures', color: 'red' },
        { icon: 'sparkles', value: 'Priorite 2', label: 'Developpement', subtext: 'Education, PIB', color: 'blue' },
        { icon: 'sparkles', value: 'Priorite 3', label: 'Cible', subtext: 'Par polluant', color: 'green' }
      ],
      charts: [
        {
          title: 'Plan d action',
          description: 'Hierarchisation',
          footer: 'Slide plan d action.',
          imageSrc: '/assets/graphs/5_choix_indicateurs_plan_action.png',
          imageAlt: 'Plan d action'
        }
      ],
      insights: [
        'SO2: priorite charbon.',
        'NO2: priorite mobilite propre.',
        'PM2.5: multi-sources locales.'
      ],
      interpretation: 'Les leviers doivent etre differencies par polluant.'
    },
    {
      id: 'transparence',
      label: 'Transparence',
      icon: 'information-circle',
      accent: '#64748b',
      question: 'Quelles variables ont ete ecartees ?',
      hypothesis: 'La transparence renforce la robustesse.',
      summary: 'Variables testees puis retirees (Gini, pertes elec, etc.).',
      kpis: [
        { icon: 'chart-bar', value: '3 criteres', label: 'Selection', subtext: 'Couverture, pertinence, signal', color: 'blue' },
        { icon: 'sparkles', value: 'QA', label: 'Controle', subtext: 'Cohérence + valeurs manquantes', color: 'orange' },
        { icon: 'sparkles', value: 'Trace', label: 'Transparence', subtext: 'Variables testees documentees', color: 'purple' }
      ],
      charts: [
        {
          title: 'Tentatives non abouties',
          description: 'Variables explorees',
          footer: 'Slide transparence.',
          imageSrc: '/assets/graphs/3_tentatives_non_abouties.png',
          imageAlt: 'Tentatives non abouties'
        },
        {
          title: 'Heatmap developpement',
          description: 'Analyse croisee',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/chi2_developpement_heatmap.png',
          imageAlt: 'Heatmap developpement'
        }
      ],
      insights: [
        'Couverture minimale imposee.',
        'Variables redondantes retirees.',
        'Signal statistique requis.'
      ],
      interpretation: 'La selection stricte evite les biais et renforce la lecture.'
    },
    {
      id: 'limites',
      label: 'Limites',
      icon: 'chart-bar',
      accent: '#94a3b8',
      question: 'Quelles limites et message final ?',
      hypothesis: 'Une lecture prudente sur la causalite est necessaire.',
      summary: 'Variables nationales, facteurs locaux manquants, effet COVID.',
      kpis: [
        { icon: 'scale', value: 'National', label: 'Echelle', subtext: 'Contexte pays', color: 'blue' },
        { icon: 'sparkles', value: 'Local', label: 'Manquant', subtext: 'Meteo, topographie', color: 'orange' },
        { icon: 'sparkles', value: 'COVID', label: 'Atypique', subtext: '2019-2023', color: 'purple' }
      ],
      charts: [
        {
          title: 'Profils multi-polluants',
          description: 'Comparaison des villes',
          footer: 'Graphique de rapport.',
          imageSrc: '/assets/graphs/5_profils_multipolluants_villes.png',
          imageAlt: 'Profils multi-polluants'
        },
        
      ],
      insights: [
        'SO2: priorite energie/charbon.',
        'NO2: priorite transport local.',
        'PM2.5: multi-sources + contexte macro.'
      ],
      interpretation: 'La dynamique urbaine et le developpement structurent la pollution.'
    }
  ]);

  readonly activeTab = computed(() => this.tabs().find((tab) => tab.id === this.selectedTab()) || null);

  lightboxImage: LightboxImage | null = null;
  zoomLevel = 1;
  magnifyActive = false;

  ngOnInit(): void {
    this.setTabFromRoute();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.setTabFromRoute());
  }

  selectTab(id: TabId): void {
    this.selectedTab.set(id);
    const route = this.routeForTab(id);
    if (route) {
      this.router.navigate([route]);
    }
  }

  openLightbox(src: string, alt: string, caption?: string): void {
    this.lightboxImage = { src, alt, caption };
    this.zoomLevel = 1;
    this.magnifyActive = false;
  }

  closeLightbox(): void {
    this.lightboxImage = null;
    this.zoomLevel = 1;
    this.magnifyActive = false;
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(3, this.zoomLevel + 0.25);
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(0.75, this.zoomLevel - 0.25);
  }

  resetZoom(): void {
    this.zoomLevel = 1;
  }

  onLightboxMove(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    target.style.setProperty('--zoom-x', `${x}%`);
    target.style.setProperty('--zoom-y', `${y}%`);
    this.magnifyActive = true;
  }

  onLightboxLeave(): void {
    this.magnifyActive = false;
  }

  private setTabFromRoute(): void {
    const path = this.route.snapshot.routeConfig?.path ?? '';
    const segment = path.split('/')[1];
    const tab = this.tabFromSegment(segment);
    if (tab) {
      this.selectedTab.set(tab);
    }
  }

  private tabFromSegment(segment?: string): TabId | null {
    switch (segment) {
      case 'temporal':
        return 'temporal';
      case 'urbanization':
        return 'urbanisation';
      case 'development':
        return 'developpement';
      case 'transport':
        return 'transport';
      case 'energy':
        return 'energie';
      case 'environment':
        return 'environnement';
      case 'multivariate':
        return 'multivariee';
      case 'models':
        return 'modeles';
      case 'plan':
        return 'plan';
      case 'transparency':
        return 'transparence';
      case 'limits':
        return 'limites';
      default:
        return null;
    }
  }

  private routeForTab(id: TabId): string | null {
    switch (id) {
      case 'temporal':
        return '/analysis/temporal';
      case 'urbanisation':
        return '/analysis/urbanization';
      case 'developpement':
        return '/analysis/development';
      case 'transport':
        return '/analysis/transport';
      case 'energie':
        return '/analysis/energy';
      case 'environnement':
        return '/analysis/environment';
      case 'multivariee':
        return '/analysis/multivariate';
      case 'modeles':
        return '/analysis/models';
      case 'plan':
        return '/analysis/plan';
      case 'transparence':
        return '/analysis/transparency';
      case 'limites':
        return '/analysis/limits';
      default:
        return null;
    }
  }
}

