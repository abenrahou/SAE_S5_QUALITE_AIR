import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'theme-preference';
  readonly isDarkMode = signal(false);

  constructor() {
    this.loadThemePreference();
  }

  /**
   * Initialize theme from localStorage or system preference
   */
  private loadThemePreference(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (stored !== null) {
      // Use stored preference
      this.setDarkMode(stored === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem(this.STORAGE_KEY) === null) {
        this.setDarkMode(e.matches);
      }
    });
  }

  /**
   * Set dark mode
   */
  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);

    // Update DOM
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Save preference
    localStorage.setItem(this.STORAGE_KEY, isDark ? 'dark' : 'light');
  }

  /**
   * Toggle dark mode
   */
  toggleDarkMode(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  /**
   * Reset to system preference
   */
  resetToSystemPreference(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setDarkMode(prefersDark);
  }
}
