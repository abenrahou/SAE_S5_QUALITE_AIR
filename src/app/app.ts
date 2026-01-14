import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { DataService } from './core/services/data.service';
import { SidebarStateService } from './core/services/sidebar-state.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private readonly dataService = inject(DataService);
  readonly sidebarState = inject(SidebarStateService);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadData();
  }

  reload(): void {
    this.loadData();
  }

  private loadData(): void {
    console.log('App initialization - starting data load...');
    this.isLoading.set(true);
    this.loadError.set(null);

    this.dataService.loadDatasets().subscribe({
      next: (success: boolean) => {
        console.log('Dataset load success:', success);
        if (success) {
          this.isLoading.set(false);
          this.loadError.set(null);
          console.log('isLoading is now:', this.isLoading());
        }
      },
      error: (error: unknown) => {
        console.error('Error loading datasets:', error);
        this.loadError.set(
          'Erreur lors du chargement des donnFs. VSifiez que les fichiers CSV sont dans srcassets/data/.'
        );
        this.isLoading.set(false);
      },
      complete: () => {
        console.log('Dataset load complete');
      }
    });
  }

}
