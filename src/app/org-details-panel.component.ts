import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { OrgDetailRow, OrgDirectoryNode, OrgTreeNode } from './org-tree.model';
import {
  formatDirectoryPath,
  getOrgNodeInitials,
  getOrgNodeSubtitle,
  getOrgNodeTypeLabel
} from './org-tree.utils';

@Component({
  selector: 'app-org-details-panel',
  templateUrl: './org-details-panel.component.html',
  styleUrls: ['./org-details-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrgDetailsPanelComponent {
  @Input() selectedNode: OrgTreeNode | null = null;
  @Input() details: OrgDetailRow[] = [];
  @Input() path: OrgDirectoryNode[] = [];
  @Input() collapsed = false;

  @Output() collapsedChange = new EventEmitter<boolean>();

  get typeLabel(): string {
    return this.selectedNode ? getOrgNodeTypeLabel(this.selectedNode.data.type) : 'Selection';
  }

  get initials(): string {
    return this.selectedNode ? getOrgNodeInitials(this.selectedNode.data) : '';
  }

  get subtitle(): string {
    return this.selectedNode ? getOrgNodeSubtitle(this.selectedNode.data) : '';
  }

  get directoryPath(): string {
    return formatDirectoryPath(this.path);
  }

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }
}
