import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  of,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';

import {
  OrgChartViewMode,
  OrgDetailRow,
  OrgDirectoryNode,
  OrgNodeSelectEvent,
  OrgNodeType,
  OrgSearchResult,
  OrgTreeGroupMode,
  OrgTreeNode
} from './org-tree.model';
import { OrgService } from './org.service';
import { formatDirectoryPath, getOrgNodeDisplayName, getOrgNodeTypeLabel } from './org-tree.utils';

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

interface DirectoryStats {
  organizations: number;
  departments: number;
  managers: number;
  employees: number;
  total: number;
}

@Component({
  selector: 'app-org-tree',
  templateUrl: './org-tree.component.html',
  styleUrls: ['./org-tree.component.scss']
})
export class OrgTreeComponent implements OnInit, OnDestroy {
  @ViewChild('chartViewport') private chartViewport?: ElementRef<HTMLElement>;

  treeNodes: OrgTreeNode[] = [];
  selectedNode: OrgTreeNode | null = null;
  selectedDetails: OrgDetailRow[] = [];
  selectedPath: OrgDirectoryNode[] = [];
  visibleNodes: OrgTreeNode[] = [];

  directoryStats: DirectoryStats = {
    organizations: 0,
    departments: 0,
    managers: 0,
    employees: 0,
    total: 0
  };

  loading = false;
  errorMessage = '';

  searchTerm = '';
  searchResults: OrgSearchResult[] = [];
  searchLoading = false;
  highlightedNodeIds = new Set<string>();

  loadingNodeIds = new Set<string>();

  viewMode: OrgChartViewMode = 'org-chart';
  groupMode: OrgTreeGroupMode = 'department';
  detailsCollapsed = false;

  zoomLevel = 1;
  readonly minZoomLevel = 0.65;
  readonly maxZoomLevel = 1.45;
  readonly zoomStep = 0.1;

  isPanning = false;

  private panState?: PanState;
  private readonly destroy$ = new Subject<void>();
  private readonly searchTerms$ = new Subject<string>();
  private searchRevealId = 0;

  constructor(private readonly orgService: OrgService) {}

  ngOnInit(): void {
    this.directoryStats = this.orgService.getDirectoryStats(this.groupMode);
    this.detailsCollapsed = window.matchMedia('(max-width: 980px)').matches;
    this.viewMode = window.matchMedia('(max-width: 760px)').matches ? 'tree' : 'org-chart';
    this.bindSearch();
    this.loadOrgTree();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrgTree(): void {
    this.loading = true;
    this.errorMessage = '';
    this.searchRevealId += 1;
    this.loadingNodeIds = new Set<string>();

    this.orgService
      .getOrgTree(this.groupMode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (nodes) => {
          this.treeNodes = nodes;
          this.refreshVisibleNodes();
          this.setSelectedNode(nodes[0] ?? null);
        },
        error: (error: unknown) => {
          console.error('Failed to load organization tree', error);
          this.treeNodes = [];
          this.refreshVisibleNodes();
          this.setSelectedNode(null);
          this.errorMessage = 'Organization data could not be loaded.';
        }
      });
  }

  onNodeSelect(event: OrgNodeSelectEvent): void {
    this.setSelectedNode(event.node);
  }

  onNodeUnselect(): void {
    this.setSelectedNode(null);
  }

  onNodeExpand(event: OrgNodeSelectEvent): void {
    void this.ensureNodeExpanded(event.node);
  }

  onNodeCollapse(event: OrgNodeSelectEvent): void {
    this.handleNodeCollapsed(event.node);
  }

  onVerticalNodeSelected(node: OrgTreeNode): void {
    this.setSelectedNode(node);
  }

  onVerticalNodeExpanded(node: OrgTreeNode): void {
    void this.ensureNodeExpanded(node);
  }

  onVerticalNodeCollapsed(node: OrgTreeNode): void {
    this.handleNodeCollapsed(node);
  }

  onSearchInput(event: Event): void {
    const target = event.target;
    const value = target instanceof HTMLInputElement ? target.value : '';

    this.searchTerm = value;
    this.searchTerms$.next(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchResults = [];
    this.highlightedNodeIds = new Set<string>();
    this.searchLoading = false;
    this.searchRevealId += 1;
    this.searchTerms$.next('');
  }

  selectSearchResult(result: OrgSearchResult): void {
    this.searchTerm = getOrgNodeDisplayName(result.node);
    void this.revealPath(result.path, true, true);
  }

  selectBreadcrumb(node: OrgDirectoryNode): void {
    void this.selectNodeById(node.id, true);
  }

  setGroupMode(mode: OrgTreeGroupMode): void {
    if (this.groupMode === mode) {
      return;
    }

    this.groupMode = mode;
    this.directoryStats = this.orgService.getDirectoryStats(mode);
    this.clearSearch();
    this.loadOrgTree();
  }

  setViewMode(mode: OrgChartViewMode): void {
    this.viewMode = mode;

    if (mode === 'tree') {
      this.zoomLevel = Math.max(this.zoomLevel, 0.9);
    }

    this.queueCenterOnSelected();
  }

  zoomIn(): void {
    this.setZoomLevel(this.zoomLevel + this.zoomStep);
  }

  zoomOut(): void {
    this.setZoomLevel(this.zoomLevel - this.zoomStep);
  }

  resetZoom(): void {
    this.setZoomLevel(1);
  }

  centerOnSelectedNode(): void {
    const viewport = this.chartViewport?.nativeElement;

    if (!viewport || !this.selectedNode) {
      return;
    }

    const selectedElement = viewport.querySelector<HTMLElement>(
      '.p-organizationchart-node-content.p-highlight, .node-card--selected'
    );

    selectedElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  }

  onViewportPointerDown(event: PointerEvent): void {
    const viewport = this.chartViewport?.nativeElement;
    const target = event.target;

    if (!viewport || !(target instanceof HTMLElement) || target.closest('button, a, input, .p-node-toggler')) {
      return;
    }

    this.isPanning = true;
    this.panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    viewport.setPointerCapture(event.pointerId);
  }

  onViewportPointerMove(event: PointerEvent): void {
    const viewport = this.chartViewport?.nativeElement;

    if (!viewport || !this.isPanning || !this.panState || this.panState.pointerId !== event.pointerId) {
      return;
    }

    viewport.scrollLeft = this.panState.scrollLeft - (event.clientX - this.panState.startX);
    viewport.scrollTop = this.panState.scrollTop - (event.clientY - this.panState.startY);
  }

  onViewportPointerUp(event: PointerEvent): void {
    const viewport = this.chartViewport?.nativeElement;

    if (viewport && this.panState?.pointerId === event.pointerId) {
      viewport.releasePointerCapture(event.pointerId);
    }

    this.isPanning = false;
    this.panState = undefined;
  }

  isNodeLoading(node: OrgTreeNode): boolean {
    return this.loadingNodeIds.has(node.key);
  }

  isNodeHighlighted(node: OrgTreeNode): boolean {
    return this.highlightedNodeIds.has(node.key);
  }

  getTypeLabel(type: OrgNodeType): string {
    return getOrgNodeTypeLabel(type);
  }

  getResultName(result: OrgSearchResult): string {
    return getOrgNodeDisplayName(result.node);
  }

  getResultSubtitle(result: OrgSearchResult): string {
    return `${getOrgNodeTypeLabel(result.node.type)} - ${result.context}`;
  }

  getResultPath(result: OrgSearchResult): string {
    return formatDirectoryPath(result.path);
  }

  getDirectoryName(node: OrgDirectoryNode): string {
    return getOrgNodeDisplayName(node);
  }

  get zoomPercent(): string {
    return `${Math.round(this.zoomLevel * 100)}%`;
  }

  get groupModeLabel(): string {
    return this.groupMode === 'manager' ? 'manager' : 'department';
  }

  get hasSearchQuery(): boolean {
    return this.searchTerm.trim().length >= 2;
  }

  trackByTreeNode(_index: number, node: OrgTreeNode): string {
    return node.key;
  }

  trackByDirectoryNode(_index: number, node: OrgDirectoryNode): string {
    return node.id;
  }

  trackBySearchResult(_index: number, result: OrgSearchResult): string {
    return result.node.id;
  }

  trackByDetail(_index: number, detail: OrgDetailRow): string {
    return detail.label;
  }

  private bindSearch(): void {
    this.searchTerms$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        tap((term) => {
          const hasQuery = term.trim().length >= 2;
          this.searchLoading = hasQuery;

          if (!hasQuery) {
            this.searchResults = [];
            this.highlightedNodeIds = new Set<string>();
          }
        }),
        switchMap((term) => {
          const query = term.trim();

          if (query.length < 2) {
            return of([]);
          }

          return this.orgService.searchDirectory(query, this.groupMode).pipe(
            finalize(() => {
              this.searchLoading = false;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        const revealId = (this.searchRevealId += 1);
        this.searchResults = results;
        this.highlightedNodeIds = new Set<string>(results.map((result) => result.node.id));

        if (results[0]) {
          void this.revealSearchPreview(results[0], revealId);
        }
      });
  }

  private async revealSearchPreview(result: OrgSearchResult, revealId: number): Promise<void> {
    await this.revealPath(result.path, false, false);

    if (revealId !== this.searchRevealId) {
      return;
    }

    this.refreshTree();
  }

  private async selectNodeById(nodeId: string, center: boolean): Promise<void> {
    const path = this.orgService.getPathToNode(nodeId, this.groupMode);

    if (!path.length) {
      return;
    }

    await this.revealPath(path, true, center);
  }

  private async revealPath(path: OrgDirectoryNode[], selectTarget: boolean, center: boolean): Promise<void> {
    for (let index = 0; index < path.length - 1; index += 1) {
      const branchNode = this.findRenderedNodeById(path[index].id);

      if (!branchNode) {
        return;
      }

      await this.ensureNodeExpanded(branchNode);
    }

    const targetNode = this.findRenderedNodeById(path[path.length - 1].id);

    if (targetNode && selectTarget) {
      this.setSelectedNode(targetNode);
    }

    if (center) {
      this.queueCenterOnSelected();
    }
  }

  private async ensureNodeExpanded(node: OrgTreeNode): Promise<void> {
    if (!node.hasChildren) {
      return;
    }

    this.updateTreeNode(node.key, (currentNode) => ({
      ...currentNode,
      expanded: true
    }));

    const expandedNode = this.findRenderedNodeById(node.key);

    if (!expandedNode) {
      return;
    }

    if (!expandedNode.childrenLoaded) {
      this.setNodeLoading(node.key, true);

      try {
        const children = await firstValueFrom(this.orgService.getChildren(node.key, this.groupMode));

        this.updateTreeNode(node.key, (currentNode) => ({
          ...currentNode,
          children,
          childrenLoaded: true,
          expanded: true,
          leaf: false
        }));
      } catch (error: unknown) {
        console.error('Failed to load child nodes', error);
        this.errorMessage = 'Child nodes could not be loaded.';
      } finally {
        this.setNodeLoading(node.key, false);
      }
      return;
    }

    this.refreshTree();
  }

  private handleNodeCollapsed(node: OrgTreeNode): void {
    this.updateTreeNode(node.key, (currentNode) => this.collapseNodeTree(currentNode));
  }

  private collapseNodeTree(node: OrgTreeNode): OrgTreeNode {
    return {
      ...node,
      expanded: false,
      children: node.children?.map((child) => this.collapseNodeTree(child))
    };
  }

  private setNodeLoading(nodeId: string, loading: boolean): void {
    const nextLoadingNodeIds = new Set<string>(this.loadingNodeIds);

    if (loading) {
      nextLoadingNodeIds.add(nodeId);
    } else {
      nextLoadingNodeIds.delete(nodeId);
    }

    this.loadingNodeIds = nextLoadingNodeIds;
  }

  private setZoomLevel(value: number): void {
    const clampedValue = Math.min(this.maxZoomLevel, Math.max(this.minZoomLevel, value));
    this.zoomLevel = Math.round(clampedValue * 100) / 100;
    this.queueCenterOnSelected();
  }

  private setSelectedNode(node: OrgTreeNode | null): void {
    this.selectedNode = node;
    this.selectedPath = node ? this.orgService.getPathToNode(node.key, this.groupMode) : [];
    this.selectedDetails = node ? this.buildDetails(node.data) : [];
  }

  private buildDetails(node: OrgDirectoryNode): OrgDetailRow[] {
    const manager = node.managerId ? this.orgService.getNodeById(node.managerId, this.groupMode) : null;
    const detailMap: Array<[string, string | undefined]> = [
      ['Title', node.title],
      ['Department', node.department],
      ['Email', node.mail],
      ['Phone', node.phone],
      ['User principal', node.userPrincipalName],
      ['Account', node.sAMAccountName],
      ['Employee ID', node.employeeId],
      ['Manager account', node.managerAccountName],
      ['Manager', manager ? getOrgNodeDisplayName(manager) : undefined],
      ['Description', node.description],
      ['Child entries', node.children.length ? `${node.children.length}` : undefined],
      ['Object type', this.getTypeLabel(node.type)]
    ];

    return detailMap
      .filter((detail): detail is [string, string] => Boolean(detail[1]))
      .map(([label, value]) => ({ label, value }));
  }

  private findRenderedNodeById(nodeId: string, nodes: OrgTreeNode[] = this.treeNodes): OrgTreeNode | null {
    for (const node of nodes) {
      if (node.key === nodeId) {
        return node;
      }

      const childMatch = this.findRenderedNodeById(nodeId, node.children ?? []);

      if (childMatch) {
        return childMatch;
      }
    }

    return null;
  }

  private refreshTree(): void {
    this.treeNodes = [...this.treeNodes];
    this.syncSelectedNodeReference();
    this.refreshVisibleNodes();
  }

  private updateTreeNode(nodeId: string, updater: (node: OrgTreeNode) => OrgTreeNode): void {
    this.treeNodes = this.replaceTreeNode(this.treeNodes, nodeId, updater);
    this.syncSelectedNodeReference();
    this.refreshVisibleNodes();
  }

  private replaceTreeNode(
    nodes: OrgTreeNode[],
    nodeId: string,
    updater: (node: OrgTreeNode) => OrgTreeNode
  ): OrgTreeNode[] {
    return nodes.map((node) => {
      if (node.key === nodeId) {
        return updater(node);
      }

      if (!node.children?.length) {
        return node;
      }

      const nextChildren = this.replaceTreeNode(node.children, nodeId, updater);

      if (nextChildren === node.children) {
        return node;
      }

      return {
        ...node,
        children: nextChildren
      };
    });
  }

  private syncSelectedNodeReference(): void {
    if (!this.selectedNode) {
      return;
    }

    const selectedNode = this.findRenderedNodeById(this.selectedNode.key);

    if (selectedNode) {
      this.selectedNode = selectedNode;
      this.selectedPath = this.orgService.getPathToNode(selectedNode.key, this.groupMode);
      this.selectedDetails = this.buildDetails(selectedNode.data);
    }
  }

  private refreshVisibleNodes(): void {
    this.visibleNodes = this.flattenVisibleNodes(this.treeNodes);
  }

  private flattenVisibleNodes(nodes: OrgTreeNode[]): OrgTreeNode[] {
    return nodes.reduce<OrgTreeNode[]>((visibleNodes, node) => {
      visibleNodes.push(node);

      if (node.expanded && node.children?.length) {
        visibleNodes.push(...this.flattenVisibleNodes(node.children));
      }

      return visibleNodes;
    }, []);
  }

  private queueCenterOnSelected(): void {
    window.setTimeout(() => this.centerOnSelectedNode(), 90);
  }
}
