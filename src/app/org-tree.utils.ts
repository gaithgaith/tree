import { OrgDirectoryNode, OrgNodeType } from './org-tree.model';

export const ORG_NODE_TYPE_LABELS: Record<OrgNodeType, string> = {
  organization: 'Organization',
  department: 'Department',
  manager: 'Manager',
  employee: 'Employee'
};

export const ORG_NODE_ICON_MAP: Record<OrgNodeType, string> = {
  organization: 'pi pi-building',
  department: 'pi pi-sitemap',
  manager: 'pi pi-id-card',
  employee: 'pi pi-user'
};

export function cleanDirectoryLabel(value?: string): string {
  if (!value) {
    return 'Unnamed';
  }

  return value
    .replace(/(^|,)\s*(OU|CN|DC)=/gi, '$1')
    .replace(/\\/g, '')
    .trim();
}

export function getOrgNodeDisplayName(node: OrgDirectoryNode): string {
  return cleanDirectoryLabel(node.name);
}

export function getOrgNodeTypeLabel(type: OrgNodeType): string {
  return ORG_NODE_TYPE_LABELS[type];
}

export function getOrgNodeSubtitle(node: OrgDirectoryNode): string {
  if (node.type === 'employee') {
    return node.title ?? node.mail ?? node.userPrincipalName ?? 'Employee account';
  }

  if (node.type === 'manager') {
    return `${node.children.length} direct ${node.children.length === 1 ? 'report' : 'reports'}`;
  }

  return node.description ?? `${node.children.length} child ${node.children.length === 1 ? 'unit' : 'units'}`;
}

export function getOrgNodeInitials(node: OrgDirectoryNode): string {
  const words = getOrgNodeDisplayName(node)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word.charAt(0).toUpperCase()).join('') || 'AD';
}

export function formatDirectoryPath(path: OrgDirectoryNode[]): string {
  return path.map(getOrgNodeDisplayName).join(' / ');
}
