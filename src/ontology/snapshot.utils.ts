export type SnapshotPayload = {
  oClasses: any[];
  subclassEdges: Array<{ childId: string; parentId: string }>;
  seedVersion: string | null;
};

type SnapshotLike = {
  oClasses?: any[];
  subclassEdges?: any[];
  seedVersions?: string[] | string | null;
  seedVersion?: string | null;
};

export const normalizeFacet = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
};

export const resolveSeedVersion = (snapshot: SnapshotLike): string | null => {
  const seedVersions = snapshot?.seedVersions ?? null;
  if (Array.isArray(seedVersions)) {
    return seedVersions[0] ?? null;
  }
  if (typeof seedVersions === 'string' && seedVersions.trim().length) {
    return seedVersions.trim();
  }

  const seedVersion = snapshot?.seedVersion ?? null;
  if (typeof seedVersion === 'string' && seedVersion.trim().length) {
    return seedVersion.trim();
  }

  const oClasses = Array.isArray(snapshot?.oClasses) ? snapshot.oClasses : [];
  const versions = new Set<string>();
  for (const cls of oClasses) {
    const value = cls?.seedVersion;
    if (typeof value === 'string' && value.length > 0) {
      versions.add(value);
    }
  }
  return Array.from(versions)[0] ?? null;
};

export const buildSnapshotPayload = (
  snapshot: SnapshotLike,
  facets?: string[],
): SnapshotPayload => {
  const rawClasses = Array.isArray(snapshot?.oClasses) ? snapshot.oClasses : [];
  const facetSet =
    Array.isArray(facets) && facets.length
      ? new Set(
          facets
            .map((facet) => normalizeFacet(facet))
            .filter((facet): facet is string => !!facet),
        )
      : null;
  const filteredClasses = facetSet
    ? rawClasses.filter((c) => {
        const facet = normalizeFacet(c?.facet);
        return facet && facetSet.has(facet);
      })
    : rawClasses;

  const idSet = new Set(
    filteredClasses.map((c) => c?.id).filter((id): id is string => !!id),
  );

  const rawEdges = Array.isArray(snapshot?.subclassEdges)
    ? snapshot.subclassEdges
    : [];
  const subclassEdges = rawEdges
    .map((edge: any) => ({
      childId: edge.child ?? edge.childId,
      parentId: edge.parent ?? edge.parentId,
    }))
    .filter(
      (edge: any) => idSet.has(edge.childId) && idSet.has(edge.parentId),
    );

  const seedVersion = resolveSeedVersion({
    ...snapshot,
    oClasses: filteredClasses,
  });

  return {
    oClasses: filteredClasses,
    subclassEdges,
    seedVersion,
  };
};
