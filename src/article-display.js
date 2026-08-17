export function isDeletedArticle(article) {
  return !article?.title?.trim() && /(?:^|\s)삭제(?:\s|<|$)/.test(article?.text ?? "");
}

export function articleDisplayTitle(document, article) {
  if (document?.id === "privacy-notice") return `「${article?.title ?? ""}」`;
  if (isDeletedArticle(article)) return `${article.number} (삭제)`;
  return [article?.number, article?.title].filter(Boolean).join(" ");
}

export function articleEffectiveDate(article) {
  const match = String(article?.text ?? "").match(/(?:^|\n)\s*시행일자\s*:\s*(\d{4}[-.]\d{2}[-.]\d{2})/);
  return match?.[1] ?? "";
}

export function articleLabel(document, article) {
  if (document?.id === "privacy-notice") return articleDisplayTitle(document, article);
  return [document?.shortTitle ?? document?.title, articleDisplayTitle(document, article)].filter(Boolean).join(" ");
}
