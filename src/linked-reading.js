export function parseLinkedArticleIds(value = "") {
  return [...new Set(value.split(",").map((articleId) => articleId.trim()).filter(Boolean))];
}

export function restoreLinkedArticleLists(locationState = {}) {
  return {
    linkedDecreeArticleIds: locationState.decreeArticleId ? [locationState.decreeArticleId] : [],
    linkedNoticeArticleIds: locationState.noticeArticleId ? [locationState.noticeArticleId] : [],
  };
}

export function firstValidLinkedArticleId(documentId, articleIds = [], documents = []) {
  const document = documents.find((item) => item.id === documentId);
  return articleIds.find((articleId) => document?.articles?.some((article) => article.id === articleId)) ?? null;
}

export function linkedReadingBlocksForSource(blocks = [], sourceArticleNumber = "", sourceContext = "") {
  const reference = sourceProvisionReference(sourceArticleNumber, sourceContext);
  if (!reference) return blocks;

  const bareReference = reference.replace(/^법/, "");
  const start = blocks.findIndex((block) => {
    const text = normalizeReference(block.text);
    return text.includes(reference) || text.includes(bareReference);
  });
  if (start === -1) return hasDifferentSourceProvision(blocks, sourceArticleNumber, reference) ? [] : blocks;

  const nextParagraph = blocks.findIndex((block, index) => index > start && /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/u.test(block.text));
  return blocks.slice(start, nextParagraph === -1 ? undefined : nextParagraph);
}

export function renderLinkedReadingArticles(label, documentId, articleIds = [], links = [], renderArticle) {
  const validIds = new Set(links.filter((link) => link?.documentId === documentId).map((link) => link.articleId));
  return [...new Set(articleIds)]
    .filter((articleId) => validIds.has(articleId))
    .map((articleId) => renderArticle(label, documentId, articleId, links))
    .filter(Boolean)
    .join("");
}

export function linkedReadingEmptyState(label, articleIds = [], rendered = "") {
  if (!articleIds.length || rendered) return "";
  if (label === "시행령") return "해당 법률에는 연결되는 시행령이 없습니다.";
  if (label === "고시") return "해당 시행령에는 연결되는 고시가 없습니다.";
  return `연결 ${label}을 확인하지 못했습니다.`;
}

function sourceProvisionReference(articleNumber, sourceContext) {
  const article = String(articleNumber).replace(/\s+/g, "");
  const context = String(sourceContext).trim();
  const paragraphMarker = context.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/u)?.[1];
  const paragraphNumber = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳".indexOf(paragraphMarker) + 1;
  const item = context.match(/^(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*)?(\d+)(?:의(\d+))?\.\s*/u);
  if (item) {
    const suffix = item[2] ? `제${item[1]}호의${item[2]}` : `제${item[1]}호`;
    const paragraph = paragraphNumber ? `제${paragraphNumber}항` : "";
    return normalizeReference(`법 ${article}${paragraph}${suffix}`);
  }

  return paragraphNumber ? normalizeReference(`법 ${article}제${paragraphNumber}항`) : "";
}

function normalizeReference(value) {
  return String(value).replace(/[\s"'“”‘’.,:]/g, "");
}

function hasDifferentSourceProvision(blocks, sourceArticleNumber, sourceReference) {
  const article = normalizeReference(String(sourceArticleNumber).replace(/\s+/g, ""));
  const source = sourceReference.replace(/^법/, "");
  const body = normalizeReference(blocks.slice(0, 2).map((block) => block.text).join(" "));
  const articlePattern = escapeRegex(article);
  const sourceItem = source.match(new RegExp(`${articlePattern}(?:제\\d+항)?제(\\d+)호`));
  if (sourceItem) {
    const targetItems = [...body.matchAll(new RegExp(`${articlePattern}(?:제\\d+항)?제(\\d+)호`, "g"))];
    return targetItems.some((match) => match[1] !== sourceItem[1]);
  }

  return false;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
