export function createTocDisclosureState() {
  return {
    documentId: null,
    expandedChapterIds: new Set(),
    manuallyCollapsedIds: new Set(),
    collapsedSectionIds: new Set(),
  };
}

export function reconcileTocDisclosure(state, { documentId, activeChapterId, chapterIds = [] }) {
  const documentChanged = state.documentId !== documentId;
  const expandedChapterIds = documentChanged ? new Set() : new Set(state.expandedChapterIds);
  const manuallyCollapsedIds = documentChanged ? new Set() : new Set(state.manuallyCollapsedIds);
  const collapsedSectionIds = documentChanged ? new Set() : new Set(state.collapsedSectionIds);
  if (documentChanged) chapterIds.forEach((chapterId) => expandedChapterIds.add(chapterId));
  if (activeChapterId && !manuallyCollapsedIds.has(activeChapterId)) expandedChapterIds.add(activeChapterId);
  return { documentId, expandedChapterIds, manuallyCollapsedIds, collapsedSectionIds };
}

export function toggleTocChapter(state, chapterId) {
  const expandedChapterIds = new Set(state.expandedChapterIds);
  const manuallyCollapsedIds = new Set(state.manuallyCollapsedIds);
  if (expandedChapterIds.has(chapterId)) {
    expandedChapterIds.delete(chapterId);
    manuallyCollapsedIds.add(chapterId);
  } else {
    expandedChapterIds.add(chapterId);
    manuallyCollapsedIds.delete(chapterId);
  }
  return { ...state, expandedChapterIds, manuallyCollapsedIds };
}

export function isTocChapterExpanded(state, chapterId) {
  return state.expandedChapterIds.has(chapterId);
}

export function toggleTocSection(state, sectionId) {
  const collapsedSectionIds = new Set(state.collapsedSectionIds);
  if (collapsedSectionIds.has(sectionId)) collapsedSectionIds.delete(sectionId);
  else collapsedSectionIds.add(sectionId);
  return { ...state, collapsedSectionIds };
}

export function isTocSectionExpanded(state, sectionId) {
  return !state.collapsedSectionIds.has(sectionId);
}
