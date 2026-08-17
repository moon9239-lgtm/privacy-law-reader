import { splitArticleBlocks } from "./law-utils.js";

const MAX_SNIPPET_LENGTH = 180;

export function buildSearchModel(
  documents,
  query,
  { sourceFilter = "all", limit = 40 } = {}
) {
  const normalizedQuery = normalizeExact(query);
  const counts = Object.fromEntries([
    ["all", 0],
    ...documents.map((document) => [document.id, 0])
  ]);

  if (!normalizedQuery) {
    return {
      query: "",
      total: 0,
      counts,
      sourceFilter,
      visibleTotal: 0,
      items: [],
      hasMore: false
    };
  }

  const allItems = documents
    .flatMap((document, documentIndex) =>
      document.articles.map((article, articleIndex) => {
        const searchableText = searchTextForArticle(article);
        const match = scoreArticle(article, normalizedQuery, searchableText);
        return match
          ? {
              document,
              article,
              documentIndex,
              articleIndex,
              ...match,
              snippet: createSnippet(searchableText || article.title || "", query)
            }
          : null;
      })
    )
    .filter(Boolean)
    .sort(compareResults);

  counts.all = allItems.length;
  for (const item of allItems) {
    counts[item.document.id] = (counts[item.document.id] ?? 0) + 1;
  }

  const filteredItems = sourceFilter === "all"
    ? allItems
    : allItems.filter((item) => item.document.id === sourceFilter);
  const items = filteredItems.slice(0, limit);

  return {
    query,
    total: allItems.length,
    counts,
    sourceFilter,
    visibleTotal: filteredItems.length,
    items,
    hasMore: filteredItems.length > items.length
  };
}

export function moveSearchSelection(index, direction, length) {
  if (length <= 0) return -1;
  if (index < 0) return 0;
  return (index + direction + length) % length;
}

export function searchAllDocuments(documents, query, limit = 40) {
  const model = buildSearchModel(documents, query, { limit });

  const groups = documents
    .map((document) => ({
      document,
      items: model.items.filter((item) => item.document.id === document.id)
    }))
    .filter((group) => group.items.length > 0);

  return {
    query: model.query,
    total: model.total,
    counts: model.counts,
    groups,
    items: model.items,
    hasMore: model.hasMore
  };
}

function scoreArticle(article, query, searchableText = article.text) {
  const number = normalizeExact(article.number);
  const title = normalizeExact(article.title);
  const text = normalizeExact(searchableText);

  if (number === query) return { score: 1000, matchKind: "exact-number" };
  if (title === query) return { score: 900, matchKind: "exact-title" };
  if (number.includes(query)) return { score: 800, matchKind: "number" };
  if (title.includes(query)) return { score: 700, matchKind: "title" };
  if (text.includes(query)) return { score: 500, matchKind: "body" };

  return null;
}

function compareResults(left, right) {
  return (
    left.documentIndex - right.documentIndex ||
    right.score - left.score ||
    left.articleIndex - right.articleIndex
  );
}

function createSnippet(sourceText, rawQuery) {
  const text = collapseWhitespace(sourceText);
  if (text.length <= MAX_SNIPPET_LENGTH) return text;

  const index = text.toLocaleLowerCase("ko-KR").indexOf(
    String(rawQuery).trim().toLocaleLowerCase("ko-KR")
  );
  if (index < 0) return `${text.slice(0, MAX_SNIPPET_LENGTH - 1).trimEnd()}…`;

  const padding = Math.floor((MAX_SNIPPET_LENGTH - String(rawQuery).length) / 2);
  const start = Math.max(0, index - padding);
  const end = Math.min(text.length, start + MAX_SNIPPET_LENGTH - 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function searchTextForArticle(article) {
  return splitArticleBlocks(article.text || "")
    .blocks
    .filter((block) => block.kind !== "attachment")
    .map((block) => block.text)
    .join("\n");
}

function collapseWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeExact(value) {
  return collapseWhitespace(value).toLocaleLowerCase("ko-KR");
}

function normalize(value) {
  return collapseWhitespace(value)
    .toLocaleLowerCase("ko-KR")
    .replace(/[\sㆍ·,().<>「」『』\[\]{}'"“”‘’]/g, "");
}
