export function createSanctionInteractionController(adapter) {
  let session = null;

  function toggle(next) {
    if (session?.relationId === next.relationId) {
      close();
      return;
    }
    session = {
      ...next,
      relationTab: session?.relationTab ?? adapter.relationTab(),
      inspectorScrollTop: session?.inspectorScrollTop ?? adapter.inspectorScroll(),
    };
    adapter.render(session);
    adapter.focusDetail(session.relationId, adapter.viewport() === "mobile" ? "inline" : "inspector");
  }

  function close() {
    if (!session) return;
    const closed = session;
    session = null;
    adapter.setRelationTab(closed.relationTab);
    adapter.render(null);
    adapter.setInspectorScroll(closed.inspectorScrollTop);
    adapter.focusChip(closed.openerId);
  }

  function viewportChanged() {
    if (!session) return;
    session = sanctionSessionForViewport(session);
    adapter.render(session);
    adapter.focusDetail(session.relationId, adapter.viewport() === "mobile" ? "inline" : "inspector");
  }

  function sourceReturnState(location) {
    if (!session) return {};
    return { sanctionReturn: {
      documentId: location.documentId,
      articleId: location.articleId,
      openerId: session.openerId,
      inspectorScrollTop: session.inspectorScrollTop,
      relationTab: session.relationTab,
    } };
  }

  function restoreReturn(returnState) {
    if (!returnState) return;
    adapter.setRelationTab(returnState.relationTab);
    adapter.setInspectorScroll(returnState.inspectorScrollTop);
    adapter.focusChip(returnState.openerId);
  }

  return {
    toggle,
    close,
    viewportChanged,
    sourceReturnState,
    restoreReturn,
    clear: () => { session = null; },
    current: () => session,
  };
}

export function sanctionSessionForViewport(session) {
  return session ? { ...session } : null;
}
