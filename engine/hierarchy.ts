import type {
  CredentialDef,
  CredentialView,
  GroupView,
  HierarchyNodeDef,
  HierarchyView,
} from "./types";

/** Roll a presentation tree against analyzed group views. */
export function rollupHierarchy(
  def: HierarchyNodeDef[],
  groups: GroupView[],
): HierarchyView[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return def.map((node) => rollupNode(node, byId));
}

function rollupNode(node: HierarchyNodeDef, byId: Map<string, GroupView>): HierarchyView {
  if (node.children?.length) {
    const children = node.children.map((c) => rollupNode(c, byId));
    const groupIds = children.flatMap((c) => c.groupIds);
    const need = children.reduce((s, c) => s + c.need, 0);
    const filled = children.reduce((s, c) => s + c.filled, 0);
    const courses = unique(children.flatMap((c) => c.courses));
    return {
      id: node.id,
      label: node.label,
      note: node.note,
      need,
      filled,
      satisfied: children.every((c) => c.satisfied),
      courses,
      groupIds,
      children,
      stillOpenSection: node.stillOpenSection,
    };
  }

  const groupIds = node.groupIds ?? [];
  const leafs = groupIds.map((id) => byId.get(id)).filter((g): g is GroupView => Boolean(g));
  const need = leafs.reduce((s, g) => s + g.need, 0);
  const filled = leafs.reduce((s, g) => s + Math.min(g.courses.length, g.need), 0);
  const courses = unique(leafs.flatMap((g) => g.courses));
  const leafGroupId = groupIds.length === 1 ? groupIds[0] : undefined;
  return {
    id: node.id,
    label: node.label,
    note: node.note ?? leafs.find((g) => g.note)?.note,
    need,
    filled,
    satisfied: leafs.length > 0 && leafs.every((g) => g.satisfied),
    courses,
    groupIds,
    leafGroupId,
    stillOpenSection: node.stillOpenSection,
  };
}

function unique(codes: string[]) {
  return [...new Set(codes)];
}

/** Find hierarchy for a credential def, if any. */
export function hierarchyFor(cred: CredentialDef): HierarchyNodeDef[] | undefined {
  return cred.hierarchy;
}

/**
 * Group open (unsatisfied) leaf groups under calendar section headings for Still open.
 * Groups not in the tree fall under "Other".
 */
export function stillOpenSections(
  cred: CredentialView,
  hierarchy: HierarchyNodeDef[] | undefined,
): { section: string; groups: GroupView[] }[] {
  const open = cred.groups.filter((g) => !g.satisfied);
  if (!hierarchy?.length) {
    return open.length ? [{ section: cred.short, groups: open }] : [];
  }

  const sectionOf = new Map<string, string>();
  const walk = (nodes: HierarchyNodeDef[], inherited?: string) => {
    for (const node of nodes) {
      const section = node.stillOpenSection ?? inherited;
      if (node.groupIds && section) {
        for (const id of node.groupIds) sectionOf.set(id, section);
      }
      if (node.children) walk(node.children, section ?? node.label);
    }
  };
  walk(hierarchy);

  const buckets = new Map<string, GroupView[]>();
  const order: string[] = [];
  for (const g of open) {
    const section = sectionOf.get(g.id) ?? "Other";
    if (!buckets.has(section)) {
      buckets.set(section, []);
      order.push(section);
    }
    buckets.get(section)!.push(g);
  }
  return order.map((section) => ({ section, groups: buckets.get(section)! }));
}

/** Locate a rolled-up node by id. */
export function findHierarchyNode(tree: HierarchyView[], id: string): HierarchyView | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const hit = findHierarchyNode(node.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}
