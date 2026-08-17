const QUICK_STARTS = [
  ["수집ㆍ이용", "privacy-law", "제15조"],
  ["동의", "privacy-law", "제22조"],
  ["안전조치", "privacy-law", "제29조"],
  ["처리방침", "privacy-law", "제30조"],
  ["국외이전", "privacy-law", "제28조의8"],
  ["개인정보 보호책임자", "privacy-law", "제31조"],
  ["영향평가", "privacy-law", "제33조"],
  ["유출 통지", "privacy-law", "제34조"],
  ["열람 요구", "privacy-law", "제35조"],
  ["과징금", "privacy-law", "제64조의2"],
];

export function buildReaderMetrics(documents) {
  const articleCount = documents.reduce((sum, document) => sum + document.articles.length, 0);
  const notice = documents.find((document) => document.id === "privacy-notice");
  const checkedAt = documents
    .map((document) => document.checkedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";

  return {
    documentCount: documents.length,
    articleCount,
    noticeCount: notice?.articles.length ?? 0,
    checkedAt,
  };
}

export function findArticleByCitation(document, query) {
  const citation = normalizeCitation(query);
  if (!citation) {
    return null;
  }

  return document?.articles?.find((article) => normalizeCitation(article.number) === citation) ?? null;
}

export function formatArticleCitation(document, article) {
  if (!document || !article) {
    return "";
  }

  if (document.id === "privacy-notice") {
    return article.title;
  }

  return `${document.title} ${article.number}(${article.title})`;
}

export function quickStartArticles(documents) {
  return QUICK_STARTS
    .map(([label, documentId, articleNumber]) => {
      const document = documents.find((item) => item.id === documentId);
      const article = document?.articles.find((item) => item.number === articleNumber);
      return article ? { label, document, article } : null;
    })
    .filter(Boolean);
}

function normalizeCitation(value) {
  const match = value?.replace(/\s+/g, "").match(/제\d+조(?:의\d+)?/);
  return match?.[0] ?? "";
}
