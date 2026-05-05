import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { MOCK_AD_USERS } from './mock-org-data';
import { mapOrgNodesToTreeNodes } from './org-tree.mapper';
import { OrgTreeComponent } from './org-tree.component';
import { OrgTreeNode } from './org-tree.model';
import { OrgService } from './org.service';
import { cleanDirectoryLabel, formatDirectoryPath } from './org-tree.utils';

describe('organization tree utilities', () => {
  it('removes Active Directory prefixes from display labels', () => {
    expect(cleanDirectoryLabel('OU=Engineering')).toBe('Engineering');
    expect(cleanDirectoryLabel('CN=Sophia Rivera,OU=Applications,DC=northwind,DC=local')).toBe(
      'Sophia Rivera,Applications,northwind,local'
    );
  });

  it('formats breadcrumb paths with clean names', () => {
    const path = [
      {
        id: 'dc-company',
        name: 'Company Directory',
        type: 'organization' as const,
        children: []
      },
      {
        id: 'ou-service-channel-center',
        name: 'إدارة مركز قنوات الخدمة',
        type: 'department' as const,
        children: []
      }
    ];

    expect(formatDirectoryPath(path)).toBe('Company Directory / إدارة مركز قنوات الخدمة');
  });
});

describe('organization tree mapper', () => {
  const mapperFixture = [
    {
      id: 'dc-company',
      name: 'Company Directory',
      type: 'organization' as const,
      objectClass: 'domainDNS' as const,
      distinguishedName: 'DC=company,DC=local',
      children: [
        {
          id: 'ou-service-center',
          name: 'إدارة مركز قنوات الخدمة',
          type: 'department' as const,
          objectClass: 'organizationalUnit' as const,
          distinguishedName: 'OU=إدارة مركز قنوات الخدمة,DC=company,DC=local',
          children: [
            {
              id: 'user-cl260146',
              name: 'khaled s. Alotaibi (خالد العتيبي)',
              type: 'employee' as const,
              objectClass: 'user' as const,
              distinguishedName:
                'CN=khaled s. Alotaibi (خالد العتيبي),OU=إدارة مركز قنوات الخدمة,DC=company,DC=local',
              children: []
            }
          ]
        }
      ]
    }
  ];

  it('maps raw directory nodes into UI nodes without exposing raw prefixes', () => {
    const [root] = mapOrgNodesToTreeNodes(mapperFixture, { preloadDepth: 1 });

    expect(root.label).toBe('Company Directory');
    expect(root.icon).toBe('pi pi-building');
    expect(root.hasChildren).toBeTrue();
    expect(root.expanded).toBeTrue();
    expect(root.children?.length).toBeGreaterThan(0);
  });

  it('keeps deeper child nodes unloaded until expanded', () => {
    const [root] = mapOrgNodesToTreeNodes(mapperFixture, { preloadDepth: 1 });
    const department = root.children?.find((node) => node.key === 'ou-service-center');

    expect(department).toBeDefined();
    expect(department?.hasChildren).toBeTrue();
    expect(department?.childrenLoaded).toBeFalse();
    expect(department?.children).toBeUndefined();
  });
});

describe('OrgService', () => {
  let service: OrgService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrgService);
  });

  it('returns mapped organization chart nodes', async () => {
    const nodes = await firstValueFrom(service.getOrgTree());

    expect(nodes.length).toBe(1);
    expect(nodes[0].label).toBe('Company Directory');
    expect(nodes[0].childrenLoaded).toBeTrue();
    expect(nodes[0].children?.length).toBe(5);
  });

  it('can group the organization chart by manager', async () => {
    const nodes = await firstValueFrom(service.getOrgTree('manager'));
    const managerNode = nodes[0].children?.find((node) => node.key === 'manager-059181');

    expect(nodes[0].label).toBe('Company Directory');
    expect(nodes[0].children?.length).toBe(5);
    expect(managerNode?.data.type).toBe('manager');
    expect(managerNode?.label).toBe('059181');
  });

  it('searches employees and returns a breadcrumb path', async () => {
    const results = await firstValueFrom(service.searchDirectory('Shahad'));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.id).toBe('user-tr260105');
    expect(formatDirectoryPath(results[0].path)).toContain('IT Audit Department');
  });

  it('uses the new flat AD user export as the static source', () => {
    expect(MOCK_AD_USERS.length).toBe(10);
    expect(MOCK_AD_USERS[0].sAMAccountName).toBe('CL260146');
  });

  it('loads lazy children from a single expand action', async () => {
    const component = new OrgTreeComponent(service);
    component.treeNodes = await firstValueFrom(service.getOrgTree());

    const serviceChannelsDepartment = component.treeNodes[0].children?.find(
      (node) => node.data.name === 'إدارة مركز قنوات الخدمة'
    );

    expect(serviceChannelsDepartment).toBeDefined();

    if (!serviceChannelsDepartment) {
      fail('Expected service channels department to exist');
      return;
    }

    await (component as unknown as { ensureNodeExpanded(node: OrgTreeNode): Promise<void> }).ensureNodeExpanded(
      serviceChannelsDepartment
    );

    const expandedDepartment = component.treeNodes[0].children?.find(
      (node) => node.data.name === 'إدارة مركز قنوات الخدمة'
    );

    expect(expandedDepartment?.expanded).toBeTrue();
    expect(expandedDepartment?.childrenLoaded).toBeTrue();
    expect(expandedDepartment?.children?.length).toBe(4);
  });

  it('loads manager direct reports from one expand action when grouped by manager', async () => {
    const component = new OrgTreeComponent(service);
    component.groupMode = 'manager';
    component.treeNodes = await firstValueFrom(service.getOrgTree('manager'));

    const manager = component.treeNodes[0].children?.find((node) => node.key === 'manager-059181');

    expect(manager).toBeDefined();

    if (!manager) {
      fail('Expected manager 059181 to exist');
      return;
    }

    await (component as unknown as { ensureNodeExpanded(node: OrgTreeNode): Promise<void> }).ensureNodeExpanded(
      manager
    );

    const expandedManager = component.treeNodes[0].children?.find((node) => node.key === 'manager-059181');

    expect(expandedManager?.expanded).toBeTrue();
    expect(expandedManager?.childrenLoaded).toBeTrue();
    expect(expandedManager?.children?.length).toBe(4);
  });
});
