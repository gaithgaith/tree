import { OrgDirectoryRecord } from './org-tree.model';

export const MOCK_AD_USERS: OrgDirectoryRecord[] = [
  {
    manager: '002508',
    sAMAccountName: 'SPS181201',
    displayName: 'PWA Admin',
    department: ''
  },
  {
    manager: 'ho034800',
    sAMAccountName: '002508',
    displayName: 'Osama Alfuraydi(أسامة خلف الفريدي)',
    department: 'IT Internal Solutions Department'
  }
];
