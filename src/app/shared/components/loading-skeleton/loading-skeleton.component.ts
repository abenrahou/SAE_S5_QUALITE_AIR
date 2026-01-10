import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  imports: [CommonModule],
  templateUrl: './loading-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSkeletonComponent {
  readonly type = input<'card' | 'text' | 'chart' | 'table'>('card');
}
