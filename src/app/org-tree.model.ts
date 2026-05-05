import { TreeNode } from 'primeng/api';

export type OrgNodeType = 'organization' | 'department' | 'manager' | 'employee';
export type OrgTreeGroupMode = 'department' | 'manager';

export interface OrgDirectoryRecord {
  manager: string;
  sAMAccountName: string;
  displayName: string;
  department: string;
}

export interface OrgDirectoryNode {
  id: string;
  name: string;
  type: OrgNodeType;
  children: OrgDirectoryNode[];
  distinguishedName?: string;
  objectClass?: 'domainDNS' | 'organizationalUnit' | 'user';
  description?: string;
  mail?: string;
  phone?: string;
  title?: string;
  department?: string;
  managerId?: string;
  managerAccountName?: string;
  employeeId?: string;
  sAMAccountName?: string;
  userPrincipalName?: string;
}

export interface OrgTreeNode extends TreeNode<OrgDirectoryNode> {
  key: string;
  label: string;
  data: OrgDirectoryNode;
  icon: string;
  hasChildren: boolean;
  childrenLoaded: boolean;
  depth: number;
  leaf: boolean;
  expanded: boolean;
  children?: OrgTreeNode[];
}

export interface OrgNodeSelectEvent {
  originalEvent: Event;
  node: OrgTreeNode;
}

export interface OrgDetailRow {
  label: string;
  value: string;
}

export interface OrgSearchResult {
  node: OrgDirectoryNode;
  path: OrgDirectoryNode[];
  context: string;
}

export type OrgChartViewMode = 'org-chart' | 'tree';
