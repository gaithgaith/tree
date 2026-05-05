import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output
} from '@angular/core';

import { OrgTreeNode } from './org-tree.model';
import { getOrgNodeInitials, getOrgNodeSubtitle, getOrgNodeTypeLabel } from './org-tree.utils';

export type OrgNodeCardVariant = 'chart' | 'list';

@Component({
  selector: 'app-org-node-card',
  templateUrl: './org-node-card.component.html',
  styleUrls: ['./org-node-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgNodeCardComponent implements OnDestroy {
  @Input() node!: OrgTreeNode;
  @Input() selected = false;
  @Input() highlighted = false;
  @Input() loading = false;
  @Input() variant: OrgNodeCardVariant = 'chart';

  @Output() cardClick = new EventEmitter<OrgTreeNode>();

  pressed = false;
  private feedbackTimer?: number;

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    if (this.feedbackTimer) {
      window.clearTimeout(this.feedbackTimer);
    }
  }

  get typeLabel(): string {
    return getOrgNodeTypeLabel(this.node.data.type);
  }

  get subtitle(): string {
    return getOrgNodeSubtitle(this.node.data);
  }

  get initials(): string {
    return getOrgNodeInitials(this.node.data);
  }

  get childCountLabel(): string {
    const count = this.node.data.children.length;
    return `${count} ${count === 1 ? 'child' : 'children'}`;
  }

  handleClick(): void {
    this.pressed = true;
    this.cardClick.emit(this.node);

    if (this.feedbackTimer) {
      window.clearTimeout(this.feedbackTimer);
    }

    this.feedbackTimer = window.setTimeout(() => {
      this.pressed = false;
      this.changeDetectorRef.markForCheck();
    }, 260);
  }
}
