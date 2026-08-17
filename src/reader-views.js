import { escapeHtml, highlightText } from "./law-utils.js";
import { articleDisplayTitle, articleLabel } from "./article-display.js";

const SOURCE_FILTERS = [
  ["all", "all", "전체"],
  ["law", "privacy-law", "법률"],
  ["decree", "privacy-decree", "시행령"],
  ["notice", "privacy-notice", "고시"],
];

export function renderSearchPanel(model, { activeIndex = -1, discovery } = {}) {
  const filters = SOURCE_FILTERS.map(([filter, documentId, label]) => {
    const count = model.counts?.[documentId] ?? 0;
    const current = model.sourceFilter === filter;
    return `<button type="button" data-source-filter="${filter}" aria-pressed="${current}">${label} ${count}</button>`;
  }).join("");
  const shown = model.items?.length ?? 0;
  const totalForFilter = model.sourceFilter === "all" ? model.total : model.visibleTotal;
  const summary = model.query.trim()
    ? `<p class="search-summary">검색 결과 ${totalForFilter}건${shown && totalForFilter ? ` · 1-${shown} / ${totalForFilter}` : ""}</p>`
    : "";
  const results = `<div id="searchResultsListbox" class="search-options" role="listbox" aria-label="검색 결과">${(model.items ?? []).map((item, index) => renderSearchOption(item, index, activeIndex, model.query)).join("")}</div>${model.query && !model.items?.length ? `<p class="empty-state">검색 결과가 없습니다. 출처 필터를 해제하거나, 띄어쓰기를 바꾸거나, 더 넓은 검색어를 사용해 보세요.</p>` : ""}`;
  const discoveryHtml = !model.query.trim() && discovery ? renderDiscovery(discovery) : "";
  return `<div class="search-filters" aria-label="검색 출처">${filters}</div>${summary}${results}${discoveryHtml}`;
}

export function renderCurrentPath(relationView) {
  if (!relationView?.path?.length) return "";
  return `<nav class="relation-path" aria-label="현재 연결 경로">${relationView.path.map((item) => `<span${item.documentId === "privacy-notice" ? ' class="notice-title"' : ""}>${escape(item.label)}</span>`).join("<span aria-hidden=\"true\">›</span>")}</nav>`;
}

export function renderRelationTabs(relationView, { activeTab = "decree" } = {}) {
  const decreeActive = activeTab === "decree";
  return `<div class="relation-tabs" role="tablist" aria-label="연결 근거 종류">
    <button type="button" role="tab" id="relation-tab-decree" data-relation-tab="decree" aria-selected="${decreeActive}" aria-controls="relation-panel-decree">시행령</button>
    <button type="button" role="tab" id="relation-tab-notice" data-relation-tab="notice" aria-selected="${!decreeActive}" aria-controls="relation-panel-notice">고시</button>
  </div>
  ${renderRelationPanel("decree", "시행령", relationView.decrees ?? [], decreeActive, relationView.officialSource)}
  ${renderRelationPanel("notice", "고시", relationView.notices ?? [], !decreeActive, relationView.officialSource)}`;
}

function renderSearchOption(item, index, activeIndex, query) {
  const snippet = item.document.id === "privacy-notice" ? stripNoticeMetadata(item.snippet) : item.snippet;
  return `<button type="button" id="search-result-${index}" role="option" aria-selected="${index === activeIndex}" data-search-index="${index}" data-search-document-id="${escape(item.document.id)}" data-search-article-id="${escape(item.article.id)}">
    <span class="search-source">${escape(item.document.shortTitle ?? item.document.title ?? "")}</span>
    <strong${item.document.id === "privacy-notice" ? ' class="notice-title"' : ""}>${highlightText(articleDisplayTitle(item.document, item.article), query)}</strong>
    <span class="search-snippet">${highlightText(snippet ?? "", query)}</span>
  </button>`;
}

function stripNoticeMetadata(text = "") {
  return text.replace(/^행정규칙ID:[\s\S]*?소관부처:[^\n]*(?:\n|$)/, "").trimStart();
}

function renderDiscovery(discovery) {
  const sections = [
    renderDiscoveryArticles("빠른 시작", discovery.quickStarts ?? [], (item) => ({
      label: item.label,
      documentId: item.document.id,
      articleId: item.article.id,
    })),
    renderDiscoveryQueries(discovery.recentSearches ?? []),
    renderDiscoveryArticles("자주 본 조문", discovery.frequentArticles ?? [], (item) => ({
      label: `${item.number ?? ""} ${item.title ?? ""}`.trim(),
      documentId: item.documentId,
      articleId: item.articleId,
    })),
  ].filter(Boolean);
  return sections.length ? `<div class="search-discovery">${sections.join("")}</div>` : "";
}

function renderDiscoveryQueries(items) {
  if (!items.length) return "";
  return `<section><h2>최근 검색어</h2>${items.map((item) => `<button type="button" data-discovery-query="${escape(item.query)}">${escape(item.query)}</button>`).join("")}</section>`;
}

function renderDiscoveryArticles(label, items, normalize) {
  if (!items.length) return "";
  return `<section><h2>${label}</h2>${items.map((item) => {
    const value = normalize(item);
    return `<button type="button" data-discovery-article="${escape(`${value.documentId}:${value.articleId}`)}" data-document-id="${escape(value.documentId)}" data-article-id="${escape(value.articleId)}">${escape(value.label)}</button>`;
  }).join("")}</section>`;
}

function renderRelationPanel(tab, label, items, active, officialSource = "") {
  const content = items.length
    ? `<ul>${items.map((item) => {
      const linkedIds = [...new Set(items.filter(({ documentId }) => documentId === item.documentId).map(({ articleId }) => articleId))].join(",");
      return `<li><button type="button" class="relation-link" data-link-document-id="${escape(item.documentId)}" data-link-article-id="${escape(item.articleId)}" data-link-article-ids="${escape(linkedIds)}"><strong${item.documentId === "privacy-notice" ? ' class="notice-title"' : ""}>${escape(item.label)}</strong>${item.reason ? `<span>${escape(item.reason)}</span>` : ""}</button></li>`;
    }).join("")}</ul>`
    : `<p class="empty-state">연결된 하위 근거를 찾지 못했습니다.</p>${officialSource}`;
  return `<section class="relation-panel" id="relation-panel-${tab}" role="tabpanel" aria-labelledby="relation-tab-${tab}" data-relation-panel="${tab}"${active ? "" : " hidden"}>${content}</section>`;
}

export function articleCopyText(document, article) {
  return articleLabel(document, article) + `\n\n${article.text ?? ""}`;
}

export function articleCopyWithPath(document, article, path = []) {
  const base = articleCopyText(document, article);
  const visiblePath = path.map(({ label }) => label).filter(Boolean).join(" > ");
  return visiblePath ? `${base}\n\n연결 경로: ${visiblePath}` : base;
}

export function officialSourceDetail(document) {
  if (typeof document?.officialUrl !== "string" || !/^https:\/\//.test(document.officialUrl)) return "";
  return `<a class="official-source-link" href="${escape(document.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 원문</a>`;
}

function escape(value) {
  return escapeHtml(String(value ?? ""));
}
