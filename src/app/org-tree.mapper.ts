import { OrgDirectoryNode, OrgTreeNode } from './org-tree.model';
import { ORG_NODE_ICON_MAP, getOrgNodeDisplayName } from './org-tree.utils';

export interface OrgTreeMapOptions {
  depth?: number;
  preloadDepth?: number;
}

export function mapOrgNodesToTreeNodes(nodes: OrgDirectoryNode[], options: OrgTreeMapOptions = {}): OrgTreeNode[] {
  return nodes.map((node) => mapOrgNodeToTreeNode(node, options));
}

export function mapOrgNodeToTreeNode(node: OrgDirectoryNode, options: OrgTreeMapOptions = {}): OrgTreeNode {
  const depth = options.depth ?? 0;
  const preloadDepth = options.preloadDepth ?? 0;
  const hasChildren = node.children.length > 0;
  const shouldPreloadChildren = hasChildren && depth < preloadDepth;
  const children = shouldPreloadChildren
    ? node.children.map((child) => mapOrgNodeToTreeNode(child, { depth: depth + 1, preloadDepth }))
    : undefined;

  return {
    key: node.id,
    label: getOrgNodeDisplayName(node),
    data: node,
    icon: ORG_NODE_ICON_MAP[node.type],
    expanded: depth === 0 && shouldPreloadChildren,
    hasChildren,
    childrenLoaded: shouldPreloadChildren || !hasChildren,
    depth,
    leaf: !hasChildren,
    children,
    styleClass: `org-tree-node org-tree-node--${node.type}`
  };
}
