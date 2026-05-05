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
    expect(cleanDirectoryLabel('OU=IT Internal Solutions Department')).toBe('IT Internal Solutions Department');
    expect(cleanDirectoryLabel('CN=PWA Admin,OU=Unassigned Department,DC=company,DC=local')).toBe(
      'PWA Admin,Unassigned Department,company,local'
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
        id: 'manager-ho034800',
        name: 'ho034800',
        type: 'manager' as const,
        children: []
      }
    ];

    expect(formatDirectoryPath(path)).toBe('Company Directory / ho034800');
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
          id: 'ou-it-internal-solutions-department',
          name: 'IT Internal Solutions Department',
          type: 'department' as const,
          objectClass: 'organizationalUnit' as const,
          distinguishedName: 'OU=IT Internal Solutions Department,DC=company,DC=local',
          children: [
            {
              id: 'user-002508',
              name: 'Osama Alfuraydi(أسامة خلف الفريدي)',
              type: 'employee' as const,
              objectClass: 'user' as const,
              distinguishedName:
                'CN=Osama Alfuraydi(أسامة خلف الفريدي),OU=IT Internal Solutions Department,DC=company,DC=local',
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
    const department = root.children?.find((node) => node.key === 'ou-it-internal-solutions-department');

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

  it('returns mapped department chart nodes', async () => {
    const nodes = await firstValueFrom(service.getOrgTree());

    expect(nodes.length).toBe(1);
    expect(nodes[0].label).toBe('Company Directory');
    expect(nodes[0].childrenLoaded).toBeTrue();
    expect(nodes[0].children?.length).toBe(2);
  });

  it('builds nested manager reporting hierarchy', async () => {
    const nodes = await firstValueFrom(service.getOrgTree('manager'));
    const topManager = nodes[0].children?.find((node) => node.key === 'manager-ho034800');

    expect(topManager).toBeDefined();
    expect(topManager?.label).toBe('ho034800');
    expect(topManager?.data.type).toBe('manager');

    const directReports = await firstValueFrom(service.getChildren('manager-ho034800', 'manager'));
    const osama = directReports.find((node) => node.key === 'manager-002508');

    expect(osama).toBeDefined();
    expect(osama?.label).toBe('002508');
    expect(osama?.data.type).toBe('manager');

    const osamaReports = await firstValueFrom(service.getChildren('manager-002508', 'manager'));
    expect(osamaReports.length).toBe(1);
    expect(osamaReports[0].label).toBe('SPS181201');
  });

  it('searches manager hierarchy by account and display name', async () => {
    const results = await firstValueFrom(service.searchDirectory('PWA', 'manager'));

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node.id).toBe('user-sps181201');
    expect(formatDirectoryPath(results[0].path)).toBe('Company Directory / ho034800 / 002508 / SPS181201');
  });

  it('uses the new flat AD user export as the static source', () => {
    expect(MOCK_AD_USERS.length).toBe(2);
    expect(MOCK_AD_USERS[0].sAMAccountName).toBe('SPS181201');
  });

  it('loads manager direct reports from one expand action when grouped by manager', async () => {
    const component = new OrgTreeComponent(service);
    component.groupMode = 'manager';
    component.treeNodes = await firstValueFrom(service.getOrgTree('manager'));

    const manager = component.treeNodes[0].children?.find((node) => node.key === 'manager-ho034800');

    expect(manager).toBeDefined();

    if (!manager) {
      fail('Expected manager ho034800 to exist');
      return;
    }

    await (component as unknown as { ensureNodeExpanded(node: OrgTreeNode): Promise<void> }).ensureNodeExpanded(
      manager
    );

    const expandedManager = component.treeNodes[0].children?.find((node) => node.key === 'manager-ho034800');

    expect(expandedManager?.expanded).toBeTrue();
    expect(expandedManager?.childrenLoaded).toBeTrue();
    expect(expandedManager?.children?.[0].key).toBe('manager-002508');
  });
});
