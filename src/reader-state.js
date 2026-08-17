export function visibleReaderDocuments(documents) {
  return documents;
}

const DEFAULT_READER_STATE = Object.freeze({
  query: "",
  sourceFilter: "all",
  selectedResultIndex: -1,
  primaryDocumentId: "privacy-law",
  primaryArticleId: null,
  lawArticleId: null,
  decreeArticleId: null,
  noticeArticleId: null,
  navigationMode: "linked",
  relationTab: "decree",
  relationScrollTop: 0,
  relationReturnTab: null,
  relationReturnScrollTop: null,
  selectedSanctionRelationId: null,
  searchOpen: false,
  navigationOpen: false,
  relationOpen: false,
  toolsMenuOpen: false,
});

const DOCUMENT_KINDS = Object.freeze({
  "privacy-law": "law",
  "privacy-decree": "decree",
  "privacy-notice": "notice",
});
const SOURCE_FILTERS = new Set(["all", "law", "decree", "notice"]);

export function createReaderState(overrides = {}) {
  return { ...DEFAULT_READER_STATE, ...overrides };
}

export function selectSearchResult(state, result) {
  const { documentId, articleId } = result;
  const selectedResultIndex = Number.isInteger(result.index)
    ? result.index
    : state.selectedResultIndex;

  if (documentId === "privacy-law") {
    return {
      ...state,
      selectedResultIndex,
      primaryDocumentId: documentId,
      primaryArticleId: articleId,
      lawArticleId: articleId,
      decreeArticleId: null,
      noticeArticleId: null,
      navigationMode: "linked",
    };
  }

  if (documentId === "privacy-decree" || documentId === "privacy-notice") {
    return {
      ...state,
      selectedResultIndex,
      primaryDocumentId: documentId,
      primaryArticleId: articleId,
      lawArticleId: null,
      decreeArticleId: documentId === "privacy-decree" ? articleId : null,
      noticeArticleId: documentId === "privacy-notice" ? articleId : null,
      navigationMode: "standalone",
    };
  }

  return state;
}

export function openSanctionDetail(state, relationId, panelScrollTop) {
  return {
    ...state,
    selectedSanctionRelationId: relationId,
    relationOpen: true,
    relationReturnTab: state.relationTab,
    relationReturnScrollTop: panelScrollTop,
  };
}

export function closeSanctionDetail(state) {
  return {
    ...state,
    relationTab: state.relationReturnTab ?? state.relationTab,
    relationScrollTop: state.relationReturnScrollTop ?? state.relationScrollTop,
    relationReturnTab: null,
    relationReturnScrollTop: null,
    selectedSanctionRelationId: null,
    relationOpen: false,
  };
}

export function readReaderLocation(search = "") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requestedDocumentId = params.get("document") || "privacy-law";
  const primaryDocumentId = DOCUMENT_KINDS[requestedDocumentId]
    ? requestedDocumentId
    : "privacy-law";
  const primaryKind = DOCUMENT_KINDS[primaryDocumentId];
  const primaryArticleId = readArticleId(params, "article", primaryKind);
  const selectedResultIndex = parseResultIndex(params.get("result"));
  const navigationMode = primaryDocumentId === "privacy-law" ? "linked" : "standalone";
  const requestedSource = params.get("source") || "all";

  const linkedDecreeArticleId = readArticleId(params, "decree", "decree");
  const linkedNoticeArticleId = readArticleId(params, "notice", "notice");

  return createReaderState({
    sourceFilter: SOURCE_FILTERS.has(requestedSource) ? requestedSource : "all",
    selectedResultIndex,
    primaryDocumentId,
    primaryArticleId,
    lawArticleId: primaryDocumentId === "privacy-law" ? primaryArticleId : null,
    decreeArticleId: primaryDocumentId === "privacy-decree"
      ? primaryArticleId
      : (navigationMode === "linked" ? linkedDecreeArticleId : null),
    noticeArticleId: primaryDocumentId === "privacy-notice"
      ? primaryArticleId
      : (navigationMode === "linked" ? linkedNoticeArticleId : null),
    navigationMode,
  });
}

export function toReaderSearchParams(state) {
  const params = new URLSearchParams();
  if (SOURCE_FILTERS.has(state.sourceFilter) && state.sourceFilter !== "all") {
    params.set("source", state.sourceFilter);
  }
  if (Number.isSafeInteger(state.selectedResultIndex) && state.selectedResultIndex >= 0) {
    params.set("result", String(state.selectedResultIndex));
  }
  const primaryDocumentId = DOCUMENT_KINDS[state.primaryDocumentId]
    ? state.primaryDocumentId
    : "privacy-law";
  const primaryKind = DOCUMENT_KINDS[primaryDocumentId];
  const primaryArticleId = normalizeArticleId(state.primaryArticleId, primaryKind);
  if (primaryDocumentId !== "privacy-law") {
    params.set("document", state.primaryDocumentId);
  }
  if (primaryArticleId) params.set("article", primaryArticleId);
  if (primaryDocumentId === "privacy-law") {
    const decreeArticleId = normalizeArticleId(state.decreeArticleId, "decree");
    const noticeArticleId = normalizeArticleId(state.noticeArticleId, "notice");
    if (decreeArticleId) params.set("decree", decreeArticleId);
    if (noticeArticleId) params.set("notice", noticeArticleId);
  } else if (primaryDocumentId === "privacy-decree" && primaryArticleId) {
    params.set("decree", primaryArticleId);
  } else if (primaryDocumentId === "privacy-notice" && primaryArticleId) {
    params.set("notice", primaryArticleId);
  }
  return params;
}

function parseResultIndex(value) {
  if (value === null || !/^\d+$/.test(value)) return -1;
  const resultIndex = Number(value);
  return Number.isSafeInteger(resultIndex) ? resultIndex : -1;
}

function readArticleId(params, name, kind) {
  return normalizeArticleId(params.get(name), kind);
}

function normalizeArticleId(value, kind) {
  if (typeof value !== "string") return null;
  return new RegExp(`^${kind}-[A-Za-z0-9._~-]+$`).test(value) ? value : null;
}

export function resolveCurrentArticle(document, articles, articleId, query) {
  if (!document) {
    return null;
  }

  if (query.trim() && articles.length === 0) {
    return null;
  }

  return (
    document.articles.find((article) => article.id === articleId)
    ?? articles[0]
    ?? document.articles[0]
    ?? null
  );
}

export function applyLinkedSelection(state, documentId, articleId) {
  if (documentId === "privacy-decree") {
    return {
      ...state,
      linkedDecreeArticleId: articleId,
      linkedNoticeArticleId: null,
    };
  }

  if (documentId === "privacy-notice") {
    return {
      ...state,
      linkedNoticeArticleId: articleId,
    };
  }

  if (documentId === "privacy-law") {
    return {
      ...state,
      documentId,
      articleId,
      linkedDecreeArticleId: null,
      linkedNoticeArticleId: null,
    };
  }

  return state;
}

export function clearLinkedSelection(state) {
  return {
    ...state,
    linkedDecreeArticleId: null,
    linkedNoticeArticleId: null,
  };
}

export function toggleReaderTheme(currentTheme) {
  return currentTheme === "dark" ? "light" : "dark";
}
