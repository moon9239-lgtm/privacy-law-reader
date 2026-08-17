import { buildArticleLinks } from "./link-utils.js";
import { articleLabel } from "./article-display.js";

const EMPTY_LINKS = Object.freeze({ laws: [], decrees: [], notices: [] });

export function createRelationResolver(documents, buildLinks = buildArticleLinks) {
  const cache = new Map();
  const articleCache = new Map();
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  function getArticle(documentId, articleId) {
    const key = `${documentId}:${articleId}`;
    if (articleCache.has(key)) return articleCache.get(key);
    const article = documentsById.get(documentId)?.articles?.find((item) => item.id === articleId) ?? null;
    articleCache.set(key, article);
    return article;
  }

  function getOrBuild(documentId, articleId) {
    const key = `${documentId}:${articleId}`;
    if (cache.has(key)) return cache.get(key);

    const document = documentsById.get(documentId);
    const article = getArticle(documentId, articleId);
    if (!document || !article) {
      cache.set(key, EMPTY_LINKS);
      return EMPTY_LINKS;
    }

    const built = buildLinks(documents, document, article) ?? EMPTY_LINKS;
    const links = {
      laws: publicLinks(built.laws),
      decrees: publicLinks(built.decrees),
      notices: publicLinks(built.notices),
    };
    cache.set(key, links);
    return links;
  }

  function countsFor(documentId, articleId) {
    const links = getOrBuild(documentId, articleId);
    return {
      laws: links.laws.length,
      decrees: links.decrees.length,
      notices: links.notices.length,
    };
  }

  function viewFor(state) {
    const primaryDocumentId = state.primaryDocumentId ?? "privacy-law";
    const primaryArticleId = state.primaryArticleId ?? selectedIdFor(primaryDocumentId, state);
    const mode = primaryDocumentId === "privacy-law" ? "linked" : "standalone";
    const primary = nodeFor(primaryDocumentId, primaryArticleId, documentsById, getArticle);
    if (!primary) return { mode, path: [], parents: [], decrees: [], notices: [] };

    const links = getOrBuild(primaryDocumentId, primaryArticleId);
    if (mode === "standalone") {
      return {
        mode,
        path: [primary],
        parents: cloneItems([...links.laws, ...links.decrees]),
        decrees: cloneItems(links.decrees),
        notices: cloneItems(links.notices),
      };
    }

    const path = [primary];
    const decree = links.decrees.find((item) => item.articleId === state.decreeArticleId);
    if (decree) path.push(asPathNode(decree));
    const notice = links.notices.find((item) => item.articleId === state.noticeArticleId);
    if (notice) path.push(asPathNode(notice));
    return {
      mode,
      path,
      parents: [],
      decrees: cloneItems(links.decrees),
      notices: cloneItems(links.notices),
    };
  }

  return {
    linksFor(documentId, articleId) {
      return cloneLinks(getOrBuild(documentId, articleId));
    },
    countsFor,
    viewFor,
  };
}

function publicLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    const documentId = link?.document?.id;
    const articleId = link?.article?.id;
    if (!documentId || !articleId) return [];
    return [{
      documentId,
      articleId,
      label: articleLabel(link.document, link.article),
      reason: typeof link.reason === "string" ? link.reason : "",
    }];
  });
}

function nodeFor(documentId, articleId, documentsById, getArticle) {
  const document = documentsById.get(documentId);
  const article = getArticle(documentId, articleId);
  if (!article) return null;
  return { documentId, articleId, label: articleLabel(document, article) };
}

function cloneLinks(links) {
  return {
    laws: cloneItems(links.laws),
    decrees: cloneItems(links.decrees),
    notices: cloneItems(links.notices),
  };
}

function cloneItems(items) {
  return items.map((item) => ({ ...item }));
}

function asPathNode(link) {
  return { documentId: link.documentId, articleId: link.articleId, label: link.label };
}

function selectedIdFor(documentId, state) {
  if (documentId === "privacy-law") return state.lawArticleId;
  if (documentId === "privacy-decree") return state.decreeArticleId;
  if (documentId === "privacy-notice") return state.noticeArticleId;
  return null;
}
