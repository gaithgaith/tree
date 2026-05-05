import { Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';

import { MOCK_AD_USERS } from './mock-org-data';
import { mapOrgNodesToTreeNodes } from './org-tree.mapper';
import {
  OrgDirectoryNode,
  OrgDirectoryRecord,
  OrgSearchResult,
  OrgTreeGroupMode,
  OrgTreeNode
} from './org-tree.model';
import { formatDirectoryPath, getOrgNodeDisplayName, getOrgNodeSubtitle } from './org-tree.utils';

@Injectable({
  providedIn: 'root'
})
export class OrgService {
  private readonly orgDirectories: Record<OrgTreeGroupMode, OrgDirectoryNode[]> = {
    department: this.buildDepartmentDirectory(MOCK_AD_USERS),
    manager: this.buildManagerDirectory(MOCK_AD_USERS)
  };

  getOrgTree(groupMode: OrgTreeGroupMode = 'department'): Observable<OrgTreeNode[]> {
    return this.getOrgTreeData(groupMode).pipe(
      map((nodes) => mapOrgNodesToTreeNodes(nodes, { preloadDepth: 1 })),
      delay(180)
    );
  }

  getChildren(parentId: string, groupMode: OrgTreeGroupMode = 'department'): Observable<OrgTreeNode[]> {
    const parent = this.findNodeById(parentId, groupMode);

    return of(parent ? mapOrgNodesToTreeNodes(parent.children, { preloadDepth: 0 }) : []).pipe(delay(220));
  }

  searchDirectory(query: string, groupMode: OrgTreeGroupMode = 'department'): Observable<OrgSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return of([]);
    }

    const results = this.flattenDirectory(groupMode)
      .filter(({ node }) => this.getSearchText(node).includes(normalizedQuery))
      .slice(0, 8)
      .map(({ node, path }) => ({
        node,
        path,
        context: node.type === 'employee' ? node.mail ?? node.title ?? formatDirectoryPath(path) : getOrgNodeSubtitle(node)
      }));

    return of(results).pipe(delay(140));
  }

  getPathToNode(nodeId: string, groupMode: OrgTreeGroupMode = 'department'): OrgDirectoryNode[] {
    return this.findPathById(nodeId, groupMode) ?? [];
  }

  getNodeById(nodeId: string, groupMode: OrgTreeGroupMode = 'department'): OrgDirectoryNode | null {
    return this.findNodeById(nodeId, groupMode);
  }

  getDirectoryStats(groupMode: OrgTreeGroupMode = 'department'): {
    organizations: number;
    departments: number;
    managers: number;
    employees: number;
    total: number;
  } {
    const stats = {
      organizations: 0,
      departments: 0,
      managers: 0,
      employees: 0,
      total: 0
    };

    this.flattenDirectory(groupMode).forEach(({ node }) => {
      stats.total += 1;

      if (node.type === 'organization') {
        stats.organizations += 1;
      }

      if (node.type === 'department') {
        stats.departments += 1;
      }

      if (node.type === 'manager') {
        stats.managers += 1;
      }

      if (node.type === 'employee') {
        stats.employees += 1;
      }
    });

    return stats;
  }

  private getOrgTreeData(groupMode: OrgTreeGroupMode): Observable<OrgDirectoryNode[]> {
    return of(this.orgDirectories[groupMode]);

    // Future API switch:
    // return this.http.get<OrgDirectoryRecord[]>('/api/org-users').pipe(
    //   map((records) =>
    //     groupMode === 'manager' ? this.buildManagerDirectory(records) : this.buildDepartmentDirectory(records)
    //   )
    // );
  }

  private findNodeById(nodeId: string, groupMode: OrgTreeGroupMode): OrgDirectoryNode | null {
    return this.flattenDirectory(groupMode).find(({ node }) => node.id === nodeId)?.node ?? null;
  }

  private findPathById(nodeId: string, groupMode: OrgTreeGroupMode): OrgDirectoryNode[] | null {
    return this.flattenDirectory(groupMode).find(({ node }) => node.id === nodeId)?.path ?? null;
  }

  private flattenDirectory(groupMode: OrgTreeGroupMode): Array<{ node: OrgDirectoryNode; path: OrgDirectoryNode[] }> {
    const flattened: Array<{ node: OrgDirectoryNode; path: OrgDirectoryNode[] }> = [];

    const visit = (nodes: OrgDirectoryNode[], ancestors: OrgDirectoryNode[]): void => {
      nodes.forEach((node) => {
        const path = [...ancestors, node];
        flattened.push({ node, path });
        visit(node.children, path);
      });
    };

    visit(this.orgDirectories[groupMode], []);

    return flattened;
  }

  private getSearchText(node: OrgDirectoryNode): string {
    return [
      getOrgNodeDisplayName(node),
      node.title,
      node.department,
      node.mail,
      node.userPrincipalName,
      node.description,
      node.employeeId,
      node.sAMAccountName,
      node.managerAccountName
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();
  }

  private buildDepartmentDirectory(records: OrgDirectoryRecord[]): OrgDirectoryNode[] {
    const rootDomain = 'company.local';
    const departments = new Map<string, OrgDirectoryNode>();
    const rootNode: OrgDirectoryNode = {
      id: 'dc-company',
      name: 'Company Directory',
      type: 'organization',
      objectClass: 'domainDNS',
      distinguishedName: 'DC=company,DC=local',
      description: 'Active Directory user export grouped by department',
      children: []
    };

    records.forEach((record) => {
      const departmentName = record.department.trim() || 'Unassigned Department';
      const departmentNode = this.getOrCreateDepartmentNode(departments, departmentName, rootDomain);

      departmentNode.children.push(this.createEmployeeNode(record, departmentName, rootDomain));
    });

    rootNode.children = Array.from(departments.values()).sort((first, second) => first.name.localeCompare(second.name));
    rootNode.children.forEach((department) => {
      department.children.sort((first, second) => first.name.localeCompare(second.name));
    });

    return [rootNode];
  }

  private buildManagerDirectory(records: OrgDirectoryRecord[]): OrgDirectoryNode[] {
    const rootDomain = 'company.local';
    const managers = new Map<string, OrgDirectoryNode>();
    const rootNode: OrgDirectoryNode = {
      id: 'dc-company',
      name: 'Company Directory',
      type: 'organization',
      objectClass: 'domainDNS',
      distinguishedName: 'DC=company,DC=local',
      description: 'Active Directory user export grouped by manager',
      children: []
    };

    records.forEach((record) => {
      const managerAccountName = record.manager.trim() || 'Unassigned Manager';
      const managerNode = this.getOrCreateManagerNode(managers, managerAccountName, rootDomain);
      const departmentName = record.department.trim() || 'Unassigned Department';

      managerNode.children.push(this.createEmployeeNode(record, departmentName, rootDomain));
    });

    rootNode.children = Array.from(managers.values()).sort((first, second) => first.name.localeCompare(second.name));
    rootNode.children.forEach((manager) => {
      manager.children.sort((first, second) => first.name.localeCompare(second.name));
    });

    return [rootNode];
  }

  private getOrCreateDepartmentNode(
    departments: Map<string, OrgDirectoryNode>,
    departmentName: string,
    rootDomain: string
  ): OrgDirectoryNode {
    const departmentId = this.createStableId('ou', departmentName);
    const existingDepartment = departments.get(departmentId);

    if (existingDepartment) {
      return existingDepartment;
    }

    const departmentNode: OrgDirectoryNode = {
      id: departmentId,
      name: departmentName,
      type: 'department',
      objectClass: 'organizationalUnit',
      distinguishedName: `OU=${departmentName},DC=company,DC=local`,
      description: `Department organizational unit in ${rootDomain}`,
      department: departmentName,
      children: []
    };

    departments.set(departmentId, departmentNode);

    return departmentNode;
  }

  private getOrCreateManagerNode(
    managers: Map<string, OrgDirectoryNode>,
    managerAccountName: string,
    rootDomain: string
  ): OrgDirectoryNode {
    const managerId = this.createStableId('manager', managerAccountName);
    const existingManager = managers.get(managerId);

    if (existingManager) {
      return existingManager;
    }

    const managerNode: OrgDirectoryNode = {
      id: managerId,
      name: managerAccountName,
      type: 'manager',
      objectClass: 'organizationalUnit',
      distinguishedName: `CN=${managerAccountName},OU=Managers,DC=company,DC=local`,
      description: `Manager grouping in ${rootDomain}`,
      managerAccountName,
      children: []
    };

    managers.set(managerId, managerNode);

    return managerNode;
  }

  private createEmployeeNode(
    record: OrgDirectoryRecord,
    departmentName: string,
    rootDomain: string
  ): OrgDirectoryNode {
    return {
      id: this.createStableId('user', record.sAMAccountName),
      name: record.displayName,
      type: 'employee',
      objectClass: 'user',
      distinguishedName: `CN=${record.displayName},OU=${departmentName},DC=company,DC=local`,
      department: departmentName,
      managerId: this.createStableId('manager', record.manager || 'Unassigned Manager'),
      managerAccountName: record.manager,
      employeeId: record.sAMAccountName,
      sAMAccountName: record.sAMAccountName,
      userPrincipalName: `${record.sAMAccountName}@${rootDomain}`,
      children: []
    };
  }

  private createStableId(prefix: string, value: string): string {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${prefix}-${normalizedValue || 'unknown'}`;
  }
}
