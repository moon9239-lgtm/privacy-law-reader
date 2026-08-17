export function articleStorageKey(documentId, articleId) {
  return `${documentId}:${articleId}`;
}

export function toggleBookmark(bookmarks, key) {
  return bookmarks.includes(key)
    ? bookmarks.filter((bookmark) => bookmark !== key)
    : [key, ...bookmarks];
}

export function addRecentArticle(history, item, limit = 8) {
  return [
    item,
    ...history.filter((historyItem) => historyItem.key !== item.key),
  ].slice(0, limit);
}

export function saveArticleNote(notes, key, value) {
  const next = { ...notes };
  const text = value.trim();

  if (text) {
    next[key] = text;
  } else {
    delete next[key];
  }

  return next;
}

export function readPersonalState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem("privacy-reader-personal") ?? "{}");
    return {
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  } catch {
    return { bookmarks: [], recent: [], notes: {} };
  }
}

export function writePersonalState(storage, personalState) {
  storage.setItem("privacy-reader-personal", JSON.stringify(personalState));
}

const DISCOVERY_STORAGE_KEY = "privacy-reader-discovery-v1";

function emptyDiscoveryState() {
  return { recentSearches: [], articleVisits: {} };
}

export function readDiscoveryState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(DISCOVERY_STORAGE_KEY) ?? "{}");
    return {
      recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
      articleVisits:
        parsed.articleVisits
        && typeof parsed.articleVisits === "object"
        && !Array.isArray(parsed.articleVisits)
          ? parsed.articleVisits
          : {},
    };
  } catch {
    return emptyDiscoveryState();
  }
}

export function writeDiscoveryState(storage, state) {
  try {
    storage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Discovery history is optional when storage is unavailable.
  }
}

export function recordSearch(state, query, usedAt) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) return state;

  return {
    ...state,
    recentSearches: [
      { query: normalizedQuery, lastUsedAt: usedAt },
      ...state.recentSearches.filter(({ query: existingQuery }) => existingQuery !== normalizedQuery),
    ].slice(0, 6),
  };
}

export function recordArticleVisit(state, article, visitedAt) {
  const previous = state.articleVisits[article.key];
  return {
    ...state,
    articleVisits: {
      ...state.articleVisits,
      [article.key]: {
        key: article.key,
        documentId: article.documentId,
        articleId: article.articleId,
        number: article.number,
        title: article.title,
        count: (previous?.count ?? 0) + 1,
        lastVisitedAt: visitedAt,
      },
    },
  };
}

export function frequentArticles(state, limit = 6) {
  return Object.values(state.articleVisits)
    .toSorted((left, right) => (
      right.count - left.count
      || String(right.lastVisitedAt).localeCompare(String(left.lastVisitedAt))
      || left.key.localeCompare(right.key)
    ))
    .slice(0, limit);
}
