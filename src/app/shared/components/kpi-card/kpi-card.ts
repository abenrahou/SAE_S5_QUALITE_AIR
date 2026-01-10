import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

type KpiColor = 'blue' | 'green' | 'purple' | 'orange' | 'red';

@Component({
  selector: 'app-kpi-card',
  imports: [CommonModule, IconComponent],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpiCard {
  readonly icon = input('chart-bar');
  readonly value = input<number | string>(0);
  readonly label = input('');
  readonly subtext = input('');
  readonly color = input<KpiColor>('blue');
  readonly animate = input(true);

  readonly displayValue = signal(0);

  readonly containerClass = computed(() => {
    const colors: Record<KpiColor, string> = {
      blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
      purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
      orange: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
      red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
    };
    return colors[this.color()] ?? colors.blue;
  });

  readonly textColorClass = computed(() => {
    const colors: Record<KpiColor, string> = {
      blue: 'text-blue-600 dark:text-blue-400',
      green: 'text-green-600 dark:text-green-400',
      purple: 'text-purple-600 dark:text-purple-400',
      orange: 'text-orange-600 dark:text-orange-400',
      red: 'text-red-600 dark:text-red-400'
    };
    return colors[this.color()] ?? colors.blue;
  });

  readonly displayedValue = computed(() => {
    const value = this.value();
    if (typeof value === 'number') {
      return this.animate() ? this.displayValue() : value;
    }
    return value;
  });

  ngOnInit(): void {
    const value = this.value();
    if (this.animate() && typeof value === 'number') {
      this.animateValue(0, value, 1500);
    } else {
      this.displayValue.set(typeof value === 'number' ? value : 0);
    }
  }

  private animateValue(start: number, end: number, duration: number): void {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        this.displayValue.set(end);
        clearInterval(timer);
      } else {
        this.displayValue.set(Math.floor(current));
      }
    }, 16);
  }
}
