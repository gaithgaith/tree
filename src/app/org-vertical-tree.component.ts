import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { OrgTreeNode } from './org-tree.model';

@Component({
  selector: 'app-org-vertical-tree',
  templateUrl: './org-vertical-tree.component.html',
  styleUrls: ['./org-vertical-tree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgVerticalTreeComponent {
  @Input() nodes: OrgTreeNode[] = [];
  @Input() selectedKey: string | null = null;
  @Input() highlightedNodeIds: ReadonlySet<string> = new Set<string>();
  @Input() loadingNodeIds: ReadonlySet<string> = new Set<string>();
  @Input() depth = 0;

  @Output() nodeSelected = new EventEmitter<OrgTreeNode>();
  @Output() nodeExpanded = new EventEmitter<OrgTreeNode>();
  @Output() nodeCollapsed = new EventEmitter<OrgTreeNode>();

  trackByNode(_index: number, node: OrgTreeNode): string {
    return node.key;
  }

  isHighlighted(node: OrgTreeNode): boolean {
    return this.highlightedNodeIds.has(node.key);
  }

  isLoading(node: OrgTreeNode): boolean {
    return this.loadingNodeIds.has(node.key);
  }

  toggleNode(event: MouseEvent, node: OrgTreeNode): void {
    event.stopPropagation();

    node.expanded = !node.expanded;

    if (node.expanded) {
      this.nodeExpanded.emit(node);
      return;
    }

    this.nodeCollapsed.emit(node);
  }
}
