import { defaultDocumentId, documents } from "./law-data.js";
import { buildDocumentToc, findArticleTocContext } from "./law-toc.js";
import { quickStartArticles } from "./reader-insights.js";
import {
  frequentArticles,
  readDiscoveryState,
  recordArticleVisit,
  recordSearch,
  writeDiscoveryState,
} from "./reader-personal.js";
import { readViewPreferences, writeViewPreferences } from "./reader-preferences.js";
import { createRelationResolver } from "./reader-relations.js";
import { renderDelegationCues } from "./delegation-view.js";
import { firstValidLinkedArticleId, linkedReadingBlocksForSource, linkedReadingEmptyState, parseLinkedArticleIds, renderLinkedReadingArticles, restoreLinkedArticleLists } from "./linked-reading.js";
import { buildSearchModel, moveSearchSelection } from "./reader-search.js";
import {
  readReaderLocation,
  selectSearchResult as selectSearchResultState,
  toReaderSearchParams,
  visibleReaderDocuments,
} from "./reader-state.js";
import { officialSourceDetail, renderCurrentPath, renderRelationTabs, renderSearchPanel } from "./reader-views.js";
import { articleDisplayTitle, articleEffectiveDate, isDeletedArticle } from "./article-display.js";
import { escapeHtml, findDocumentById, highlightText, legalBlockClass, splitArticleBlocks } from "./law-utils.js";
import { buildAttachmentUrl, renderAttachmentReferenceLinks } from "./attachment-links.js";
import { renderFutureAmendmentNotice } from "./future-amendments.js";
import { locatorDomId, locatorKey, scopeArticleBlocks } from "./legal-locators.js";
import { buildSanctionIndex, groupSanctionsForDisplay, sanctionDetailForGroup, sanctionsForScope } from "./sanction-index.js";
import { compactCriminalProvisionBlocks, renderSanctionDetail, renderScopedSanctionBlocks } from "./sanction-view.js";
import { sanctionSessionForViewport } from "./sanction-interactions.js";
import { normalizePanelFocus, panelFocusDocumentIds, renderPanelTools } from "./panel-tools.js";
import {
  createTocDisclosureState,
  isTocChapterExpanded,
  isTocSectionExpanded,
  reconcileTocDisclosure,
  toggleTocChapter,
  toggleTocSection,
} from "./toc-disclosure.js";
import { markOnboardingSeen, onboardingSteps } from "./onboarding.js";

const DESKTOP_MEDIA = "(min-width: 1200px)";
const MOBILE_MEDIA = "(max-width: 767px)";
const desktopMedia = window.matchMedia(DESKTOP_MEDIA);
const mobileMedia = window.matchMedia(MOBILE_MEDIA);
const readerDocuments = visibleReaderDocuments(documents);
const relationResolver = createRelationResolver(documents);
const sanctionIndex = buildSanctionIndex(documents);
const preferences = readViewPreferences(window.localStorage);
let discoveryState = readDiscoveryState(window.sessionStorage);
const restored = readReaderLocation(window.location.search);
const initialDocument = findDocumentById(readerDocuments, restored.primaryDocumentId || defaultDocumentId);
const initialArticle = initialDocument.articles.find(({ id }) => id === restored.primaryArticleId) ?? initialDocument.articles[0];

function showsWholeDocument(documentId, noRestoredArticle = true) {
  return noRestoredArticle && (documentId === "privacy-law" || documentId === "privacy-decree");
}

const state = {
  ...restored,
  documentId: initialDocument.id,
  articleId: initialArticle?.id ?? null,
  searchOpen: Boolean(restored.query),
  relationTab: restored.relationTab ?? "decree",
  noticeSectionIndex: null,
  showAllArticles: showsWholeDocument(initialDocument.id, !restored.primaryArticleId),
  linkedDecreeArticleId: restored.decreeArticleId,
  linkedNoticeArticleId: restored.noticeArticleId,
  linkedDecreeArticleIds: restored.decreeArticleId ? [restored.decreeArticleId] : [],
  linkedDecreeSourceContext: "",
  linkedNoticeArticleIds: restored.noticeArticleId ? [restored.noticeArticleId] : [],
  ...preferences,
};
let openSanction = null;
let drawerOpener = null;
let columnWidthsCustomized = false;
let lastComparisonLayoutKey = "";
let tocDisclosure = createTocDisclosureState();
let focusedPanelDocumentId = null;
let lastSearchQuery = "";
let searchResultsScrollTop = 0;
let tocResizeActive = false;
let futureComparisonResizeActive = false;
let tocCollapsed = false;
let collapsedLawParagraphs = new Set();
let collapsedSanctionRules = new Set();
let onboardingStepIndex = 0;
let onboardingReturnFocus = null;
const SCRAMBLE_CHARACTERS = "0123456789-";

const elements = {
  root: document.querySelector("#readerRoot"),
  header: document.querySelector(".app-header"),
  comparisonPane: document.querySelector("#comparisonPane"),
  search: document.querySelector("#searchInput"),
  searchButton: document.querySelector("#searchButton"),
  clearSearch: document.querySelector("#clearSearchButton"),
  searchResults: document.querySelector("#globalSearchResults"),
  navigationPane: document.querySelector("#navigationPane"),
  articleList: document.querySelector("#articleList"),
  articleBody: document.querySelector("#articleBody"),
  sidePanel: document.querySelector("#sidePanel"),
  noticePanel: document.querySelector("#noticePanel"),
  relationPath: document.querySelector("#currentRelationPath"),
  fontSize: document.querySelector("#fontSizeControl"),
  lineHeight: document.querySelector("#lineHeightControl"),
  fontSizeOutput: document.querySelector("#fontSizeOutput"),
  lineHeightOutput: document.querySelector("#lineHeightOutput"),
  toolsButton: document.querySelector("#toolsMenuButton"),
  toolsMenu: document.querySelector("#toolsMenu"),
  themeChoices: document.querySelectorAll("[data-theme-choice]"),
  documentChoices: document.querySelectorAll("[data-document-choice]"),
  mobileFontControls: document.querySelector(".mobile-font-controls"),
  mobileOnboardingReplay: document.querySelector("#mobileOnboardingReplayButton"),
  columnPresets: document.querySelectorAll("[data-column-preset]"),
  columnResizers: document.querySelectorAll("[data-column-resizer]"),
  mobileNavigation: document.querySelector("#mobileNavigation"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  printButton: document.querySelector("#printButton"),
  futureAmendmentsToggle: document.querySelector("#futureAmendmentsToggle"),
  officialSourceDetail: document.querySelector("#officialSourceDetail"),
  readerStatus: document.querySelector("#readerStatus"),
  onboardingReplay: document.querySelector("#onboardingReplayButton"),
  onboardingTour: document.querySelector("#onboardingTour"),
  onboardingSpotlight: document.querySelector("#onboardingSpotlight"),
  onboardingTip: document.querySelector("#onboardingTip"),
  onboardingProgress: document.querySelector("#onboardingProgress"),
  onboardingTitle: document.querySelector("#onboardingTitle"),
  onboardingDescription: document.querySelector("#onboardingDescription"),
  onboardingSkip: document.querySelector("#onboardingSkipButton"),
  onboardingBack: document.querySelector("#onboardingBackButton"),
  onboardingNext: document.querySelector("#onboardingNextButton"),
};

elements.navigationPane.insertAdjacentHTML("afterbegin", '<button type="button" class="drawer-close" data-reader-drawer-close aria-label="목차 닫기">닫기</button>');
elements.sidePanel.insertAdjacentHTML("afterbegin", '<button type="button" class="drawer-close" data-reader-drawer-close aria-label="연결 근거 닫기">닫기</button>');
elements.noticePanel.insertAdjacentHTML("afterbegin", '<button type="button" class="drawer-close" data-reader-drawer-close aria-label="고시 연결 근거 닫기">닫기</button>');
const tocCollapseButton = document.createElement("button");
tocCollapseButton.type = "button";
tocCollapseButton.className = "toc-collapse-toggle";
tocCollapseButton.setAttribute("aria-controls", "navigationPane");
tocCollapseButton.setAttribute("aria-expanded", "true");
tocCollapseButton.setAttribute("aria-label", "목차 접기");
tocCollapseButton.textContent = "<";
elements.navigationPane.insertAdjacentElement("afterend", tocCollapseButton);
elements.tocCollapseButton = tocCollapseButton;
const tocResizerLine = document.createElement("div");
tocResizerLine.className = "toc-resizer-line";
tocResizerLine.setAttribute("role", "separator");
tocResizerLine.setAttribute("aria-orientation", "vertical");
tocResizerLine.setAttribute("aria-label", "목차 너비 조정");
tocResizerLine.setAttribute("aria-hidden", "true");
elements.navigationPane.insertAdjacentElement("afterend", tocResizerLine);
elements.tocResizerLine = tocResizerLine;
elements.root.insertAdjacentHTML("beforeend", '<button type="button" class="reader-backdrop" data-reader-backdrop aria-label="열린 패널 닫기" hidden></button>');
elements.backdrop = document.querySelector("[data-reader-backdrop]");
elements.relationPath.setAttribute("role", "button");
elements.relationPath.setAttribute("tabindex", "0");
elements.relationPath.setAttribute("aria-label", "연결 근거 열기");
const mobileNavigationItems = [
  { label: "목차열기", action: "toc" },
  { label: "연결규정", action: "relations" },
  { label: "검색", action: "search" },
];
elements.mobileNavigation.querySelectorAll("a").forEach((link, index) => {
  const item = mobileNavigationItems[index];
  if (!item) return;
  link.textContent = item.label;
  link.dataset.mobileAction = item.action;
});

elements.search.value = state.query;
elements.search.setAttribute("aria-controls", "searchResultsListbox");
elements.articleList.setAttribute("tabindex", "-1");

function renderTocResizeHandle(collapsed) {
  elements.tocCollapseButton.textContent = collapsed ? ">" : "<";
}

function syncTocResizeChromePosition() {
  if (!desktopMedia.matches) return;
  if (tocCollapsed) {
    elements.root.style.setProperty("--toc-edge-left", "0px");
    return;
  }
  const rect = elements.navigationPane.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  elements.root.style.setProperty("--toc-edge-left", `${Math.round(rect.right)}px`);
  elements.root.style.setProperty("--toc-toggle-center", `${Math.round(rect.top + rect.height / 2)}px`);
  elements.root.style.setProperty("--toc-resizer-top", `${Math.round(rect.top)}px`);
  elements.root.style.setProperty("--toc-resizer-bottom", `${Math.max(0, Math.round(window.innerHeight - rect.bottom))}px`);
}

function scheduleTocResizeChromePosition() {
  syncTocResizeChromePosition();
  window.requestAnimationFrame(syncTocResizeChromePosition);
}

function scrambleFutureAmendmentText(root) {
  root.querySelectorAll("[data-text-scramble]").forEach((element) => {
    const text = element.dataset.scrambleText || element.textContent || "";
    if (!text || element.dataset.scrambleDone === "true") return;
    element.dataset.scrambleDone = "true";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = text;
      return;
    }
    const duration = 650;
    const speed = 38;
    const steps = Math.max(1, Math.round(duration / speed));
    let step = 0;
    const interval = window.setInterval(() => {
      const progress = step / steps;
      element.textContent = Array.from(text).map((character, index) => {
        if (character === " ") return character;
        return progress * text.length > index
          ? character
          : SCRAMBLE_CHARACTERS[Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length)];
      }).join("");
      step += 1;
      if (step > steps) {
        window.clearInterval(interval);
        element.textContent = text;
      }
    }, speed);
  });
}

function currentDocument() {
  return findDocumentById(readerDocuments, state.documentId);
}

function currentArticle() {
  return currentDocument().articles.find(({ id }) => id === state.articleId) ?? currentDocument().articles[0] ?? null;
}

function articleListDocument() {
  return findDocumentById(readerDocuments, focusedPanelDocumentId ?? state.documentId);
}

function articleListActiveArticle(document) {
  if (document.id === "privacy-notice" && !state.articleId && !state.linkedNoticeArticleId) return null;
  const articleId = document.id === "privacy-decree"
    ? state.linkedDecreeArticleId
    : document.id === "privacy-notice"
      ? (state.linkedNoticeArticleId ?? state.articleId)
      : state.articleId;
  return document.articles.find(({ id }) => id === articleId) ?? document.articles[0] ?? null;
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function attachmentEntries(text) {
  const lines = text.split("\n");
  const starts = lines.reduce((indexes, line, index) => {
    if (/^(?:\[(?:별표|별지|별첨)|■\s*(?:별표|별지|별첨)|【(?:별표|별지|별첨))/.test(line.trim())) indexes.push(index);
    return indexes;
  }, []);
  if (!starts.length) return [{ label: "별표·서식", text }];
  return starts.map((start, index) => {
    const entryText = lines.slice(start, starts[index + 1] ?? lines.length).join("\n").trim();
    const label = entryText.split("\n").find((line) => /^(?:\[|■\s*|【)?(?:별표|별지|별첨)/.test(line.trim()))?.trim() || "별표·서식";
    return { label, text: entryText };
  });
}

function renderDelegationHtml(html, document, links, articleId, sourceLocator = null) {
  let rendered = html;
  const delegationLinks = enrichDelegationLinks(links);
  if (document.id === "privacy-law") {
    rendered = renderDelegationCues(rendered, "decree", delegationLinks.decrees, articleId, sourceLocator);
    rendered = renderDelegationCues(rendered, "notice", delegationLinks.notices, articleId, sourceLocator);
  }
  if (document.id === "privacy-decree") rendered = renderDelegationCues(rendered, "notice", delegationLinks.notices, articleId, sourceLocator);
  const article = document.articles.find(({ id }) => id === articleId);
  return article
    ? renderAttachmentReferenceLinks({ html: rendered, document, article, attachmentManifest })
    : rendered;
}

function enrichDelegationLinks(links = {}) {
  const enrich = (items = []) => items.map((item) => {
    const targetDocument = readerDocuments.find((candidate) => candidate.id === item.documentId);
    const targetArticle = targetDocument?.articles.find((candidate) => candidate.id === item.articleId);
    return targetArticle ? { ...item, articleText: targetArticle.text } : item;
  });

  return {
    ...links,
    decrees: enrich(links.decrees),
    notices: enrich(links.notices),
  };
}

const ATTACHMENT_SOURCES_URL = "./assets/legal-sources/attachments.json";
let attachmentManifest = [];

async function loadAttachmentManifest() {
  const officialSources = await fetchAttachmentManifest(ATTACHMENT_SOURCES_URL);
  if (officialSources.length) {
    attachmentManifest = officialSources;
    render();
  }
}

async function fetchAttachmentManifest(url, timeoutMs = 0) {
  const controller = timeoutMs ? new AbortController() : null;
  const timeout = timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller?.signal });
    if (!response.ok) return [];
    return parseAttachmentManifestPayload(await response.text());
  } catch {
    return [];
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function parseAttachmentManifestPayload(payload) {
  try {
    const parsed = JSON.parse(payload.replace(/^\uFEFF/, ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function attachmentsForArticle(document, article) {
  return attachmentManifest
    .filter((item) => {
      const documentId = item.document_id ?? document.id;
      return documentId === document.id && item.article_id === article.id && buildAttachmentUrl(item);
    })
    .sort((a, b) => Number(a.attachment_index) - Number(b.attachment_index));
}

function attachmentLabelFromEntry(entry, fallback) {
  if (entry.label) return entry.label;
  const fileName = new URLSearchParams(entry.source_url?.split("?")[1] ?? "").get("flNm");
  return fileName ? fileName.replace(/\.pdf$/i, "") : fallback;
}

function attachmentPublicUrl(entry) {
  return buildAttachmentUrl(entry ?? {});
}

function renderAttachmentPdfButtons(document, article, block) {
  const manifestEntries = attachmentsForArticle(document, article);
  const entries = manifestEntries.length
    ? manifestEntries.map((entry, index) => ({ label: attachmentLabelFromEntry(entry, `별표·서식 ${index + 1}`), entry, index }))
    : attachmentEntries(block.text).map(({ label }, index) => ({ label, entry: null, index }));
  return entries.map(({ label, entry, index }) => {
    const url = attachmentPublicUrl(entry);
    return url
      ? `<button type="button" class="attachment-pdf-button" data-attachment-window-url="${escapeHtml(url)}" data-attachment-window-name="attachment-${escapeHtml(document.id)}-${escapeHtml(article.id)}-${index}">${escapeHtml(label)} 내용 <span aria-hidden="true">↗</span></button>`
      : `<p class="attachment-pdf-unavailable">${escapeHtml(label)} 원본 PDF를 준비 중입니다.</p>`;
  }).join("");
}

function renderSanctionDetailContent(detail) {
  const renderRuleText = ({ text, sourceDocumentId, sourceArticleId }) => {
    const document = findDocumentById(readerDocuments, sourceDocumentId);
    const article = document?.articles.find(({ id }) => id === sourceArticleId);
    return document && article
      ? renderAttachmentReferenceLinks({ html: escapeHtml(text), document, article, attachmentManifest })
      : escapeHtml(text);
  };
  const renderAttachments = ({ documentId, articleId }) => {
    const document = findDocumentById(readerDocuments, documentId);
    const article = document?.articles.find(({ id }) => id === articleId);
    if (!document || !article) return "";
    if (attachmentsForArticle(document, article).length) return `<div class="sanction-attachment-source">${renderAttachmentPdfButtons(document, article, { text: "" })}</div>`;
    return "";
  };
  return renderSanctionDetail(detail, { renderRuleText, renderAttachments, collapsedRuleKeys: collapsedSanctionRules });
}

function toggleSanctionRule(button) {
  const key = button.dataset.sanctionRuleToggle;
  if (!key) return;
  if (collapsedSanctionRules.has(key)) collapsedSanctionRules.delete(key);
  else collapsedSanctionRules.add(key);
  renderArticleBody();
  renderSidePanel();
  document.querySelector(`[data-sanction-rule-toggle="${cssEscape(key)}"]`)?.focus();
}

function renderManifestAttachmentSection(document, article, renderedBlocks) {
  if (!attachmentsForArticle(document, article).length || renderedBlocks.includes("attachment-pdf-button")) return "";
  const buttons = renderAttachmentPdfButtons(document, article, { text: "" });
  return buttons ? `<section class="attachment-list">${buttons}</section>` : "";
}

function openAttachmentWindow(button) {
  const popup = window.open("", button.dataset.attachmentWindowName, "popup,width=1100,height=800,resizable=yes,scrollbars=yes");
  if (!popup) {
    window.location.href = button.dataset.attachmentWindowUrl;
    return;
  }
  popup.opener = null;
  popup.location.replace(button.dataset.attachmentWindowUrl);
  popup.focus();
}

function isNoticeLanding() {
  return state.documentId === "privacy-notice" && !state.articleId;
}

function noticeSections(article) {
  if (!article?.text) return [];
  return [...article.text.matchAll(/(?:^|\n)\s*(제\d+조(?:의\d+)?)(?:\(([^)\n]*)\))?/g)].map((match, index) => ({
    index,
    number: match[1],
    title: match[2] || "",
  }));
}

function noticeSectionText(article, sectionIndex) {
  const matches = [...(article?.text || "").matchAll(/(?:^|\n)\s*(제\d+조(?:의\d+)?)(?:\(([^)\n]*)\))?/g)];
  const match = matches[sectionIndex];
  if (!match) return article?.text || "";
  const start = match.index + match[0].lastIndexOf(match[1]);
  const next = matches[sectionIndex + 1];
  const end = next ? next.index + next[0].lastIndexOf(next[1]) : (article.text || "").length;
  return article.text.slice(start, end).trim();
}

function currentSearchModel() {
  const sourceFilter = state.sourceFilter === "all" ? "all" : `privacy-${state.sourceFilter}`;
  // Search is the discovery surface: never hide matching articles behind a UI cap.
  const model = buildSearchModel(readerDocuments, state.query, {
    sourceFilter,
    limit: Number.POSITIVE_INFINITY,
  });
  return { ...model, sourceFilter: state.sourceFilter };
}

function focusArticlePane() {
  const heading = elements.articleBody.querySelector("h1") ?? elements.articleBody;
  heading.focus({ preventScroll: true });
  elements.articleBody.scrollTop = 0;
}

function scrollToSearchMatch() {
  if (!lastSearchQuery.trim()) return;
  const searchModel = currentSearchModel();
  const selected = searchModel.items?.[state.selectedResultIndex];
  const targetRoot = selected?.document.id === "privacy-decree"
    ? elements.sidePanel
    : selected?.document.id === "privacy-notice"
      ? elements.noticePanel
      : elements.articleBody;
  const selectedArticleMark = selected
    ? targetRoot.querySelector(`[data-article-id="${cssEscape(selected.article.id)}"] mark`)
    : null;
  const target = selectedArticleMark
    ?? targetRoot.querySelector(".article-content mark")
    ?? targetRoot.querySelector("mark")
    ?? elements.articleBody.querySelector("mark")
    ?? elements.sidePanel.querySelector("mark")
    ?? elements.noticePanel.querySelector("mark");
  target?.scrollIntoView({ block: "center", behavior: "auto" });
}

function showSearchBackButton() {
  if (!lastSearchQuery || state.searchOpen || elements.articleBody.querySelector("[data-search-back]")) return;
  elements.articleBody.insertAdjacentHTML("afterbegin", '<button type="button" class="search-back-button" data-search-back>검색결과로 돌아가기</button>');
}

function restoreSearchResultsScroll() {
  if (!state.searchOpen) return;
  elements.articleBody.scrollTop = searchResultsScrollTop;
}

function resetSearchState() {
  state.query = "";
  state.selectedResultIndex = -1;
  state.searchOpen = false;
  lastSearchQuery = "";
  searchResultsScrollTop = 0;
  elements.search.value = "";
  elements.searchResults.innerHTML = "";
  elements.searchResults.hidden = true;
  elements.articleBody.querySelector("[data-search-back]")?.remove();
}

function resetSearchAndRender({ focus = true } = {}) {
  resetSearchState();
  render();
  syncLocation();
  if (focus) elements.search.focus();
}

function canonicalReaderStateSnapshot(readerState) {
  return {
    query: readerState.query,
    sourceFilter: readerState.sourceFilter,
    selectedResultIndex: readerState.selectedResultIndex,
    documentId: readerState.documentId,
    articleId: readerState.articleId,
    linkedDecreeArticleId: readerState.linkedDecreeArticleId,
    linkedNoticeArticleId: readerState.linkedNoticeArticleId,
    linkedDecreeArticleIds: readerState.linkedDecreeArticleIds,
    linkedDecreeSourceContext: readerState.linkedDecreeSourceContext,
    linkedNoticeArticleIds: readerState.linkedNoticeArticleIds,
  };
}

function viewportName() {
  if (desktopMedia.matches) return "desktop";
  if (mobileMedia.matches) return "mobile";
  return "medium";
}

function closeDrawers(restoreFocus = false) {
  applyDrawerState(elements, null);
  if (restoreFocus) drawerOpener?.focus();
  if (restoreFocus) drawerOpener = null;
}

function syncMobileTocToggle() {
  const tocLink = elements.mobileNavigation.querySelector('[data-mobile-action="toc"]');
  if (!tocLink) return;
  const isTocOpen = elements.navigationPane.classList.contains("is-drawer-open");
  tocLink.textContent = isTocOpen ? "목차닫기" : "목차열기";
  tocLink.classList.toggle("is-toc-open", isTocOpen);
  tocLink.setAttribute("aria-pressed", String(isTocOpen));
}

function applyDrawerState(drawerElements, pane, options = {}) {
  const focusClose = options.focusClose !== false;
  drawerElements.navigationPane.classList.remove("is-drawer-open");
  drawerElements.sidePanel.classList.remove("is-drawer-open");
  drawerElements.backdrop.hidden = !pane;
  if (pane) pane.classList.add("is-drawer-open");
  if (pane && focusClose) pane.querySelector("[data-reader-drawer-close]")?.focus();
  if (typeof syncMobileTocToggle === "function") syncMobileTocToggle();
}

function openDrawer(pane, options = {}) {
  closeDrawers();
  if (viewportName() === "desktop") return;
  drawerOpener = document.activeElement;
  applyDrawerState(elements, pane, options);
}

function openMobileConnectionSheet() {
  state.searchOpen = false;
  renderSidePanel();
  renderGlobalSearchResults();
  elements.sidePanel.scrollTop = 0;
  openDrawer(elements.sidePanel);
}

function adjustFontSize(step) {
  state.fontSize = Math.min(20, Math.max(15, state.fontSize + step));
  applyReaderSettings();
  writeViewPreferences(localStorage, state);
}

function syncHeaderBlockSize(header, root) {
  const boxHeight = header.getBoundingClientRect().height;
  const candidates = [boxHeight, header.offsetHeight].filter(Number.isFinite);
  const height = Math.ceil(Math.max(...candidates));
  root.style.setProperty("--app-header-block-size", `${height}px`);
  return height;
}

function scheduleHeaderBlockSizeSync() {
  syncHeaderBlockSize(elements.header, elements.root);
  requestAnimationFrame(() => {
    syncHeaderBlockSize(elements.header, elements.root);
    scheduleTocResizeChromePosition();
  });
}

function finishSearchSelection(options) {
  options.state.searchOpen = false;
  options.render();
  options.sync();
  options.close();
  options.focus();
}

function renderViewportLayout() {
  const canonicalState = canonicalReaderStateSnapshot(state);
  elements.root.dataset.viewport = viewportName();
  closeDrawers();
  if (openSanction) {
    openSanction = sanctionSessionForViewport(openSanction);
    renderArticleBody();
    showSearchBackButton();
    renderSidePanel();
  }
  if (JSON.stringify(canonicalReaderStateSnapshot(state)) !== JSON.stringify(canonicalState)) {
    throw new Error("Viewport layout must not mutate reader state");
  }
}

function updateComparisonState() {
  const activeCount = state.documentId === "privacy-law"
    ? 1 + (state.linkedDecreeArticleId ? 1 : 0) + (state.linkedNoticeArticleId ? 1 : 0)
    : state.documentId === "privacy-decree"
      ? 1 + (state.linkedNoticeArticleId ? 1 : 0)
      : 1;
  const comparisonLayoutKey = [
    state.documentId,
    Boolean(state.linkedDecreeArticleId),
    Boolean(state.linkedNoticeArticleId),
  ].join(":");
  if (lastComparisonLayoutKey && lastComparisonLayoutKey !== comparisonLayoutKey) {
    columnWidthsCustomized = false;
  }
  lastComparisonLayoutKey = comparisonLayoutKey;
  elements.root.dataset.primaryDocument = state.documentId;
  elements.root.dataset.comparisonActive = String(activeCount);
  elements.root.dataset.linkedDecree = String(Boolean(state.linkedDecreeArticleId));
  elements.root.dataset.linkedNotice = String(Boolean(state.linkedNoticeArticleId));
  elements.root.dataset.tocCollapsed = String(tocCollapsed);
  elements.root.setAttribute("data-comparison-active", String(activeCount));
  elements.root.setAttribute("data-linked-decree", String(Boolean(state.linkedDecreeArticleId)));
  elements.root.setAttribute("data-linked-notice", String(Boolean(state.linkedNoticeArticleId)));
  renderTocResizeHandle(tocCollapsed);
  elements.tocCollapseButton.setAttribute("aria-label", tocCollapsed ? "목차 열기" : "목차 접기");
  elements.tocCollapseButton.setAttribute("aria-expanded", String(!tocCollapsed));
  focusedPanelDocumentId = normalizePanelFocus(focusedPanelDocumentId, visiblePanelDocumentIds());
  if (focusedPanelDocumentId) elements.root.setAttribute("data-panel-focus", focusedPanelDocumentId);
  else elements.root.removeAttribute("data-panel-focus");
  applyDefaultColumnWeights(activeCount);
  if (desktopMedia.matches) {
    const showLawDecreePanel = state.documentId === "privacy-law" && Boolean(state.linkedDecreeArticleId);
    const showLawNoticePanel = state.documentId === "privacy-law" && Boolean(state.linkedNoticeArticleId);
    elements.sidePanel.hidden = !showLawDecreePanel;
    elements.noticePanel.hidden = state.documentId === "privacy-decree" ? false : !showLawNoticePanel;
  } else {
    elements.sidePanel.hidden = false;
    elements.noticePanel.hidden = false;
  }
  scheduleTocResizeChromePosition();
  elements.documentChoices.forEach((button) => {
    const active = button.dataset.documentChoice === state.documentId;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });
}

function shouldRenderSanctionDetailInline() {
  if (mobileMedia.matches) return true;
  if (desktopMedia.matches && focusedPanelDocumentId === "privacy-law") return true;
  if (desktopMedia.matches && state.documentId === "privacy-law" && !state.linkedDecreeArticleId) return true;
  return false;
}

function visiblePanelDocumentIds() {
  return panelFocusDocumentIds(state.documentId);
}

function applyDefaultColumnWeights(activeCount) {
  if (columnWidthsCustomized) return;
  const weights = state.documentId === "privacy-law" && activeCount === 3
    ? ["4fr", "4fr", "2fr"]
    : state.documentId === "privacy-law" && state.linkedDecreeArticleId
      ? ["4fr", "4fr", "2fr"]
    : state.documentId === "privacy-law" && state.linkedNoticeArticleId && !state.linkedDecreeArticleId
      ? ["7fr", "3fr", "3fr"]
    : state.documentId === "privacy-decree"
      ? ["4fr", "4fr", "2fr"]
      : ["7fr", "3fr", "2fr"];
  elements.root.style.setProperty("--law-column", weights[0]);
  elements.root.style.setProperty("--decree-column", weights[1]);
  elements.root.style.setProperty("--notice-column", weights[2]);
}

function applyColumnPreset(preset) {
  columnWidthsCustomized = preset !== "reset";
  if (preset === "reset") {
    applyDefaultColumnWeights(visiblePanelDocumentIds().length);
    return;
  }
  const visible = visiblePanelDocumentIds();
  const weights = { law: "1fr", decree: "1fr", notice: "1fr" };
  if (preset === "law-wide") {
    if (visible.length === 3) Object.assign(weights, { law: "6fr", decree: "2fr", notice: "2fr" });
    else if (visible.includes("privacy-law")) Object.assign(weights, { law: "7fr", decree: "3fr", notice: "3fr" });
  } else if (preset === "notice-wide") {
    if (visible.length === 3) Object.assign(weights, { law: "2fr", decree: "2fr", notice: "6fr" });
    else if (visible.includes("privacy-notice")) Object.assign(weights, { law: "3fr", decree: "3fr", notice: "7fr" });
  } else if (preset === "balanced") {
    Object.assign(weights, { law: "1fr", decree: "1fr", notice: "1fr" });
  }
  elements.root.style.setProperty("--law-column", weights.law);
  elements.root.style.setProperty("--decree-column", weights.decree);
  elements.root.style.setProperty("--notice-column", weights.notice);
}

function readerUrl() {
  const params = toReaderSearchParams({
    ...state,
    primaryDocumentId: state.documentId,
    primaryArticleId: state.articleId,
    lawArticleId: state.documentId === "privacy-law" ? state.articleId : null,
    decreeArticleId: state.linkedDecreeArticleId,
    noticeArticleId: state.linkedNoticeArticleId,
  });
  return `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
}

function readerHistoryState(additions = {}) {
  return { readerQuery: state.query, linkedDecreeSourceContext: state.linkedDecreeSourceContext, ...additions };
}

function syncLocation(mode = "replace") {
  if (mode === "push") history.pushState(readerHistoryState(), "", readerUrl());
  else history.replaceState(readerHistoryState(), "", readerUrl());
}

function rememberArticle(documentId, articleId) {
  const document = findDocumentById(readerDocuments, documentId);
  const article = document?.articles.find((item) => item.id === articleId);
  if (!article) return;
  discoveryState = recordArticleVisit(discoveryState, {
    key: `${documentId}:${articleId}`,
    documentId,
    articleId,
    number: article.number,
    title: article.title,
  }, new Date().toISOString());
  writeDiscoveryState(sessionStorage, discoveryState);
}

function setArticle(articleId) {
  openSanction = null;
  Object.assign(state, {
    articleId,
    showAllArticles: false,
    noticeSectionIndex: null,
    primaryDocumentId: state.documentId,
    primaryArticleId: articleId,
    lawArticleId: state.documentId === "privacy-law" ? articleId : null,
    linkedDecreeArticleId: null,
    linkedNoticeArticleId: null,
    linkedDecreeArticleIds: [],
    linkedNoticeArticleIds: [],
  });
  rememberArticle(state.documentId, articleId);
  if (mobileMedia.matches) state.searchOpen = false;
  render();
  syncLocation("push");
  focusArticlePane();
}

function selectArticleListArticle(articleId) {
  const listDocument = articleListDocument();
  if (focusedPanelDocumentId && listDocument.id !== state.documentId) {
    openSanction = null;
    state.noticeSectionIndex = null;
    if (listDocument.id === "privacy-decree") setLinkedArticle("privacy-decree", [articleId]);
    else if (listDocument.id === "privacy-notice") setLinkedArticle("privacy-notice", [articleId]);
    return;
  }
  setArticle(articleId);
}

function setPrimaryDocument(documentId) {
  const document = findDocumentById(readerDocuments, documentId);
  const fallbackArticle = document.articles[0]?.id ?? null;
  const articleId = documentId === "privacy-law"
    ? (state.lawArticleId ?? state.articleId ?? fallbackArticle)
    : documentId === "privacy-decree"
      ? (state.linkedDecreeArticleId ?? state.decreeArticleId ?? fallbackArticle)
      : null;
  openSanction = null;
  Object.assign(state, {
    documentId,
    articleId,
    showAllArticles: showsWholeDocument(documentId),
    noticeSectionIndex: null,
    primaryDocumentId: documentId,
    primaryArticleId: articleId,
    lawArticleId: documentId === "privacy-law" ? articleId : null,
    linkedDecreeArticleId: null,
    linkedNoticeArticleId: null,
    linkedDecreeArticleIds: [],
    linkedNoticeArticleIds: [],
    relationTab: documentId === "privacy-law" ? "decree" : documentId === "privacy-decree" ? "notice" : "law",
    searchOpen: false,
  });
  rememberArticle(documentId, articleId);
  render();
  syncLocation("push");
  const focusTarget = isNoticeLanding()
    ? elements.articleBody.querySelector("[data-notice-picker]")
    : state.showAllArticles
      ? elements.articleBody
      : elements.articleBody.querySelector("h1");
  if (mobileMedia.matches) window.scrollTo({ top: 0, behavior: "auto" });
  focusTarget?.focus({ preventScroll: true });
}

function setLinkedArticle(documentId, articleIds, sourceContext = "") {
  const firstValidArticleId = firstValidLinkedArticleId(documentId, articleIds, readerDocuments);
  if (documentId === "privacy-decree") {
    state.linkedDecreeArticleIds = articleIds;
    state.linkedDecreeSourceContext = sourceContext;
    state.linkedDecreeArticleId = firstValidArticleId;
    state.linkedNoticeArticleId = null;
    state.linkedNoticeArticleIds = [];
    state.relationTab = "notice";
  }
  if (documentId === "privacy-notice") {
    state.linkedNoticeArticleIds = articleIds;
    state.linkedNoticeArticleId = firstValidArticleId;
  }
  updateComparisonState();
  renderArticleList();
  renderSidePanel();
  const linkedArticle = elements.comparisonPane.querySelector(`.linked-reading-article[data-linked-document="${documentId}"]`);
  if (mobileMedia.matches) {
    elements.sidePanel.scrollTop = 0;
    openDrawer(elements.sidePanel, { focusClose: false });
    linkedArticle?.focus({ preventScroll: true });
  } else {
    linkedArticle?.focus({ preventScroll: true });
    if (linkedArticle) {
      elements.sidePanel.scrollTop = Math.max(0, linkedArticle.getBoundingClientRect().top - elements.sidePanel.getBoundingClientRect().top + elements.sidePanel.scrollTop);
    }
  }
  syncLocation("push");
}

function openRelationLink(link) {
  const documentId = link.dataset.linkDocumentId;
  const articleIds = parseLinkedArticleIds(link.dataset.linkArticleIds ?? link.dataset.linkArticleId);
  const firstValidArticleId = firstValidLinkedArticleId(documentId, articleIds, readerDocuments);
  if (documentId === "privacy-notice" && firstValidArticleId && mobileMedia.matches) {
    openSanction = null;
    const sourceDocumentId = state.documentId;
    Object.assign(state, {
      documentId: "privacy-notice",
      articleId: firstValidArticleId,
      showAllArticles: false,
      noticeSectionIndex: null,
      primaryDocumentId: "privacy-notice",
      primaryArticleId: firstValidArticleId,
      lawArticleId: null,
      linkedDecreeArticleId: null,
      linkedNoticeArticleId: null,
      linkedDecreeArticleIds: [],
      linkedNoticeArticleIds: [],
      relationTab: "law",
      searchOpen: false,
    });
    rememberArticle(documentId, firstValidArticleId);
    render();
    syncLocation("push");
    closeDrawers(true);
    if (mobileMedia.matches) window.scrollTo({ top: 0, behavior: "auto" });
    elements.articleBody.querySelector("h1")?.focus({ preventScroll: true });
    return;
  }
  adoptDelegationSource(link);
  setLinkedArticle(documentId, articleIds, link.dataset.linkSourceContext);
}

function adoptDelegationSource(link) {
  const sourceArticleId = link?.dataset.sourceArticleId;
  if (state.documentId !== "privacy-law" || !sourceArticleId) return;
  const sourceArticle = currentDocument().articles.find((article) => article.id === sourceArticleId);
  if (!sourceArticle) return;
  state.articleId = sourceArticle.id;
  state.primaryArticleId = sourceArticle.id;
  state.lawArticleId = sourceArticle.id;
}

function selectSearchResult(documentId, articleId, index = state.selectedResultIndex) {
  searchResultsScrollTop = elements.articleBody.scrollTop;
  lastSearchQuery = state.query;
  openSanction = null;
  if (state.query.trim()) {
    discoveryState = recordSearch(discoveryState, state.query, new Date().toISOString());
    writeDiscoveryState(sessionStorage, discoveryState);
  }
  const transitioned = selectSearchResultState(state, { documentId, articleId });
  Object.assign(state, transitioned, {
    selectedResultIndex: index,
    documentId: transitioned.primaryDocumentId,
    articleId: transitioned.primaryArticleId,
    showAllArticles: false,
    noticeSectionIndex: null,
    linkedDecreeArticleId: transitioned.navigationMode === "linked" ? transitioned.decreeArticleId : null,
    linkedNoticeArticleId: transitioned.navigationMode === "linked" ? transitioned.noticeArticleId : null,
    linkedDecreeArticleIds: transitioned.navigationMode === "linked" && transitioned.decreeArticleId ? [transitioned.decreeArticleId] : [],
    linkedNoticeArticleIds: transitioned.navigationMode === "linked" && transitioned.noticeArticleId ? [transitioned.noticeArticleId] : [],
  });
  rememberArticle(documentId, articleId);
  finishSearchSelection({
    mobile: mobileMedia.matches,
    state,
    render,
    sync: () => syncLocation("push"),
    close: closeDrawers,
    focus: focusArticlePane,
  });
  showSearchBackButton();
  scrollToSearchMatch();
}

function renderGlobalSearchResults(searchModel = currentSearchModel()) {
  elements.searchResults.hidden = !state.searchOpen;
  elements.articleList.hidden = false;
  if (!state.searchOpen) {
    elements.searchResults.innerHTML = "";
    elements.search.removeAttribute("aria-activedescendant");
    return;
  }
  const discovery = {
    quickStarts: quickStartArticles(documents),
    recentSearches: discoveryState.recentSearches,
    frequentArticles: frequentArticles(discoveryState),
  };
  elements.searchResults.innerHTML = renderSearchPanel(searchModel, {
    activeIndex: state.selectedResultIndex,
    discovery,
  });
  const active = elements.searchResults.querySelector(`[data-search-index="${state.selectedResultIndex}"]`);
  if (active) elements.search.setAttribute("aria-activedescendant", active.id);
  else elements.search.removeAttribute("aria-activedescendant");
}

function renderArticleList() {
  const document = articleListDocument();
  const active = articleListActiveArticle(document);
  elements.navigationPane.dataset.tocDocument = document.id;
  if (document.id === "privacy-notice" && !active) {
    elements.articleList.innerHTML = "";
    return;
  }
  if (document.id === "privacy-notice" && active) {
    const sections = noticeSections(active);
    const sectionItems = sections.length
      ? sections.map((section) => `<li><button type="button" class="toc-article notice-section-item${state.noticeSectionIndex === section.index ? " is-active" : ""}" data-notice-section-index="${section.index}" aria-current="${state.noticeSectionIndex === section.index ? "location" : "false"}" aria-label="${escapeHtml(`${section.number} ${section.title}`.trim())}"><span class="toc-number">${escapeHtml(section.number)}</span><span class="toc-title">${escapeHtml(section.title || "조문")}</span></button></li>`).join("")
      : `<li><button type="button" class="toc-article is-active" data-article-id="${escapeHtml(active.id)}" aria-current="location" aria-label="${escapeHtml(articleDisplayTitle(document, active))}"><span class="toc-title notice-title">${escapeHtml(articleDisplayTitle(document, active))}</span></button></li>`;
    elements.articleList.innerHTML = `<div class="notice-selected-toc"><h2>고시 조문</h2><ol>${sectionItems}</ol></div>`;
    return;
  }
  const chapters = buildDocumentToc(document);
  const activeContext = findArticleTocContext(document, active);
  const activeChapterIndex = chapters.findIndex((chapter) => (
    chapter.number === activeContext?.chapter?.number && chapter.title === activeContext?.chapter?.title
  ));
  const activeChapterId = activeChapterIndex >= 0 ? tocChapterId(document, activeChapterIndex) : null;
  tocDisclosure = reconcileTocDisclosure(tocDisclosure, {
    documentId: document.id,
    activeChapterId,
    chapterIds: chapters.map((_, chapterIndex) => tocChapterId(document, chapterIndex)),
  });
  elements.articleList.innerHTML = chapters.map((chapter, chapterIndex) => {
    const chapterId = tocChapterId(document, chapterIndex);
    const bodyId = `toc-chapter-body-${chapterId}`;
    const expanded = isTocChapterExpanded(tocDisclosure, chapterId);
    const sections = chapter.sections.map((section, sectionIndex) => {
      const sectionId = `${chapterId}-section-${sectionIndex + 1}`;
      const bodyId = `toc-section-body-${sectionId}`;
      const sectionExpanded = isTocSectionExpanded(tocDisclosure, sectionId);
      return `<li class="toc-section"><h3><button type="button" class="toc-section-toggle" data-toc-section-toggle="${sectionId}" aria-expanded="${sectionExpanded}" aria-controls="${bodyId}"><span class="toc-disclosure-icon" aria-hidden="true">${sectionExpanded ? "−" : "+"}</span><span>${escapeHtml(`${section.number} ${section.title}`.trim())}</span></button></h3><div id="${bodyId}" class="toc-section-body${sectionExpanded ? "" : " is-collapsed"}">${renderTocArticles(section.articles, active, document)}</div></li>`;
    }).join("");
    return `<section class="toc-chapter" data-toc-chapter="${chapterId}"><h2><button type="button" class="toc-chapter-toggle" data-toc-chapter-toggle="${chapterId}" aria-expanded="${expanded}" aria-controls="${bodyId}"><span class="toc-disclosure-icon" aria-hidden="true">${expanded ? "−" : "+"}</span><span>${escapeHtml(`${chapter.number} ${chapter.title}`.trim())}</span></button></h2><div id="${bodyId}" class="toc-chapter-body"${expanded ? "" : " hidden"}>${renderTocArticles(chapter.articles, active, document)}${sections ? `<ol class="toc-sections">${sections}</ol>` : ""}</div></section>`;
  }).join("");
  syncActiveTocItem();
}

function tocChapterId(document, chapterIndex) {
  return `${document.id.replace(/^privacy-/, "")}-chapter-${chapterIndex + 1}`;
}

function syncActiveTocItem() {
  if (mobileMedia.matches) return;
  elements.articleList.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "nearest" });
}

function renderTocArticles(articles, active, document) {
  if (!articles.length) return "";
  return `<ol>${articles.map((article) => {
    const accessibleTitle = articleDisplayTitle(document, article);
    const title = document.id === "privacy-notice"
      ? `<span class="toc-title notice-title">${escapeHtml(articleDisplayTitle(document, article))}</span>`
      : `<span class="toc-number">${escapeHtml(article.number)}</span><span class="toc-title">${escapeHtml(isDeletedArticle(article) ? "(삭제)" : article.title)}</span>`;
    return `<li><button type="button" class="toc-article${article.id === active?.id ? " is-active" : ""}" data-article-id="${escapeHtml(article.id)}" aria-current="${article.id === active?.id ? "location" : "false"}" aria-label="${escapeHtml(accessibleTitle)}">${title}</button></li>`;
  }).join("")}</ol>`;
}

function createLawParagraphCollapseOptions(documentId, blocks) {
  if (documentId !== "privacy-law") return {};

  const parentBlocks = new Map();
  const childParentByKey = new Map();
  const articleProseAnchorByParentKey = new Map();

  for (const block of blocks) {
    if (block.kind === "attachment") continue;
    const className = block.className === "legal-line legal-sanction-summary" ? block.className : legalBlockClass(block.text);
    const blockKey = locatorKey(block.locator);
    const ownKey = lawCollapseKey(block.locator, className);
    const parentKey = lawCollapseParentKey(block.locator, className);
    if (ownKey) parentBlocks.set(ownKey, parentBlocks.get(ownKey) ?? false);
    if (className.includes("legal-prose")) {
      const articleKey = articleCollapseKey(block.locator);
      if (articleKey && !articleProseAnchorByParentKey.has(articleKey)) articleProseAnchorByParentKey.set(articleKey, block);
    }
    if (!parentKey || !blockKey) continue;
    parentBlocks.set(parentKey, true);
    childParentByKey.set(blockKey, parentKey);
  }

  const toggleKeyByAnchorBlock = new WeakMap();
  const proseAnchoredParentKeys = new Set();
  articleProseAnchorByParentKey.forEach((block, parentKey) => {
    if (!parentBlocks.get(parentKey)) return;
    toggleKeyByAnchorBlock.set(block, parentKey);
    proseAnchoredParentKeys.add(parentKey);
  });

  const isHiddenByCollapsedParent = (blockKey) => {
    let parentKey = childParentByKey.get(blockKey);
    while (parentKey) {
      if (collapsedLawParagraphs.has(parentKey)) return true;
      parentKey = childParentByKey.get(parentKey);
    }
    return false;
  };

  return {
    blockAttributes: (block) => {
      const blockKey = locatorKey(block.locator);
      const parentKey = childParentByKey.get(blockKey);
      if (!parentKey) return "";
      const hidden = isHiddenByCollapsedParent(blockKey);
      return ` data-law-child-of="${escapeHtml(parentKey)}"${hidden ? ' data-law-child-hidden="true" hidden' : ""}`;
    },
    renderBeforeText: (block) => {
      const className = block.className === "legal-line legal-sanction-summary" ? block.className : legalBlockClass(block.text);
      const key = toggleKeyByAnchorBlock.get(block) ?? lawCollapseKey(block.locator, className);
      if (proseAnchoredParentKeys.has(key) && !toggleKeyByAnchorBlock.has(block)) return "";
      if (!key || !parentBlocks.get(key)) return "";
      const expanded = !collapsedLawParagraphs.has(key);
      const label = expanded ? "하위 조문 접기" : "하위 조문 펼치기";
      return `<button type="button" class="law-paragraph-toggle" aria-expanded="${expanded}" aria-label="${escapeHtml(label)}" data-law-paragraph-toggle="${escapeHtml(key)}"></button>`;
    },
  };
}

function lawCollapseKey(locator, className) {
  if (!locator) return null;
  if (className.includes("legal-article")) return locatorKey({ ...locator, paragraph: null, item: null, subitem: null });
  if (className.includes("legal-paragraph") && locator.paragraph) return locatorKey({ ...locator, item: null, subitem: null });
  if (className.includes("legal-item") && locator.item) return locatorKey({ ...locator, subitem: null });
  return null;
}

function articleCollapseKey(locator) {
  if (!locator || locator.paragraph || locator.item || locator.subitem) return null;
  return locatorKey({ ...locator, paragraph: null, item: null, subitem: null });
}

function lawCollapseParentKey(locator, className) {
  if (!locator) return null;
  if (className.includes("legal-item")) {
    return locator.paragraph
      ? locatorKey({ ...locator, item: null, subitem: null })
      : locatorKey({ ...locator, paragraph: null, item: null, subitem: null });
  }
  if (className.includes("legal-subitem") && locator.item) return locatorKey({ ...locator, subitem: null });
  return null;
}

function renderArticleBody() {
  const document = currentDocument();
  if (isNoticeLanding()) {
    const panelTools = renderPanelTools({ documentId: document.id, label: document.shortTitle, focused: focusedPanelDocumentId === document.id, canFocus: false });
    const choices = document.articles.map((article) => {
      const effectiveDate = articleEffectiveDate(article);
      const dateLabel = effectiveDate ? `<span class="notice-picker-date">시행 ${escapeHtml(effectiveDate)}</span>` : "";
      return `<button type="button" class="notice-picker-item" data-notice-article-id="${escapeHtml(article.id)}">${dateLabel}<strong>${escapeHtml(articleDisplayTitle(document, article))}</strong></button>`;
    }).join("");
    elements.articleBody.innerHTML = `<section class="notice-picker" data-notice-picker tabindex="-1"><header class="article-header"><div class="article-header-row"><div><p>${escapeHtml(document.shortTitle)}</p><h1 tabindex="-1">고시 조문 선택</h1></div></div></header><div class="notice-picker-list">${choices}</div></section>`;
    elements.articleBody.querySelector(".article-header-row")?.insertAdjacentHTML("beforeend", panelTools);
    return;
  }
  if (state.showAllArticles) {
    const panelTools = renderPanelTools({ documentId: document.id, label: document.shortTitle, focused: focusedPanelDocumentId === document.id, canFocus: document.id !== "privacy-law" });
    let previousChapterTitle = "";
    const articles = document.articles.map((article) => {
      const links = relationResolver.linksFor(document.id, article.id);
      const scoped = scopeArticleBlocks(document.id, article, splitArticleBlocks(article.text));
      const compactedBlocks = compactCriminalProvisionBlocks(scoped.blocks);
      const blocks = renderScopedSanctionBlocks(compactedBlocks, {
        groupsForLocator: (locator) => groupSanctionsForDisplay(sanctionsForScope(sanctionIndex, locator)),
        detailForGroup: (group) => ({ ...group, ...sanctionDetailForGroup(sanctionIndex, group) }),
        renderDetail: renderSanctionDetailContent,
        selectedRelationId: openSanction?.relationId,
        mobile: shouldRenderSanctionDetailInline(),
        ...createLawParagraphCollapseOptions(document.id, compactedBlocks),
        renderText: (block) => {
          let html = highlightText(stripRevisionMarkers(block.text), state.query);
          return renderDelegationHtml(html, document, links, article.id, block.locator);
        },
        renderAttachment: (block) => renderAttachmentPdfButtons(document, article, block),
      });
      const chapterTitle = tocChapterTitle(findArticleTocContext(document, article));
      const chapterHeading = chapterTitle && chapterTitle !== previousChapterTitle
        ? `<h2 class="article-stream-chapter">${highlightText(chapterTitle, state.query)}</h2>`
        : "";
      if (chapterTitle) previousChapterTitle = chapterTitle;
      const fallbackHeading = chapterTitle ? "" : `<h2>${highlightText(articleDisplayTitle(document, article), state.query)}</h2>`;
      const futureAmendmentNotice = state.showFutureAmendments
        ? renderFutureAmendmentNotice(document.id, article.id, state.query, { includeComparison: !mobileMedia.matches })
        : "";
      return `${chapterHeading}<section class="article-stream-item" data-article-id="${escapeHtml(article.id)}">${fallbackHeading}<div class="legal-reading-area">${blocks}${futureAmendmentNotice}${renderManifestAttachmentSection(document, article, blocks)}</div></section>`;
    }).join("");
    elements.articleBody.innerHTML = `<div class="article-stream"><div class="article-stream-toolbar">${panelTools}</div>${articles}</div>`;
    scrambleFutureAmendmentText(elements.articleBody);
    return;
  }
  const article = currentArticle();
  if (!article) {
    elements.articleBody.innerHTML = `<p class="empty-state">표시할 조문이 없습니다.</p>`;
    return;
  }
  const selectedNoticeSection = document.id === "privacy-notice" && Number.isInteger(state.noticeSectionIndex)
    ? noticeSections(article)[state.noticeSectionIndex]
    : null;
  const displayedArticle = selectedNoticeSection
    ? { ...article, text: noticeSectionText(article, state.noticeSectionIndex) }
    : article;
  const context = findArticleTocContext(document, article);
  const effectiveDateValue = typeof document.effectiveDate === "string" && document.effectiveDate.trim()
    ? document.effectiveDate.trim()
    : articleEffectiveDate(article);
  const headerContext = [document.shortTitle].filter(Boolean);
  if (effectiveDateValue) headerContext.push(`시행 ${effectiveDateValue}`);
  const scoped = scopeArticleBlocks(document.id, displayedArticle, splitArticleBlocks(displayedArticle.text));
  const links = relationResolver.linksFor(document.id, article.id);
  const compactedBlocks = compactCriminalProvisionBlocks(scoped.blocks);
  const renderedBlocks = renderScopedSanctionBlocks(compactedBlocks, {
    groupsForLocator: (locator) => groupSanctionsForDisplay(sanctionsForScope(sanctionIndex, locator)),
    detailForGroup: (group) => ({ ...group, ...sanctionDetailForGroup(sanctionIndex, group) }),
    renderDetail: renderSanctionDetailContent,
    selectedRelationId: openSanction?.relationId,
    mobile: shouldRenderSanctionDetailInline(),
    ...createLawParagraphCollapseOptions(document.id, compactedBlocks),
    renderText: (block) => {
      let html = highlightText(stripRevisionMarkers(block.text), state.query);
      return renderDelegationHtml(html, document, links, article.id, block.locator);
    },
    renderAttachment: (block) => renderAttachmentPdfButtons(document, article, block),
  });
  const blocks = isDeletedArticle(article)
    ? '<p class="deleted-article-state">이 조문은 삭제되었습니다.</p>'
    : renderedBlocks;
  const titleClass = document.id === "privacy-notice" ? ' class="notice-title"' : "";
  const comparisonActive = document.id === "privacy-law" && (state.linkedDecreeArticleId || state.linkedNoticeArticleId);
  const threeColumnLawComparison = document.id === "privacy-law" && state.linkedDecreeArticleId && state.linkedNoticeArticleId;
  const panelTools = renderPanelTools({
    documentId: document.id,
    label: document.shortTitle,
    focused: focusedPanelDocumentId === document.id,
    canFocus: document.id === "privacy-law" ? threeColumnLawComparison : document.id !== "privacy-notice",
  });
  const articleTitle = articleDisplayTitle(document, article);
  const chapterTitle = tocChapterTitle(context);
  const headerTitle = document.id === "privacy-notice" ? articleTitle : chapterTitle || articleTitle;
  const comparisonHeading = comparisonActive
    ? `<div class="comparison-heading comparison-heading--law"><div><h2>법률</h2><p class="comparison-relation-summary">「${escapeHtml(articleTitle)}」에서 연결</p></div>${panelTools}</div>`
    : "";
  const noticeBackButton = document.id === "privacy-notice"
    ? '<button type="button" class="notice-picker-back" data-notice-picker-back>고시 선택으로 돌아가기</button>'
    : "";
  const articleHeader = comparisonActive
    ? ""
    : `<header class="article-header"><div class="article-header-row"><div><p>${escapeHtml(headerContext.join(" · "))}</p><h1${titleClass} tabindex="-1">${highlightText(headerTitle, state.query)}</h1></div><div class="article-header-actions">${noticeBackButton}${panelTools}</div></div></header>`;
  const futureAmendmentNotice = state.showFutureAmendments
    ? renderFutureAmendmentNotice(document.id, article.id, state.query, { includeComparison: !mobileMedia.matches })
    : "";
  const manifestAttachmentSection = selectedNoticeSection ? "" : renderManifestAttachmentSection(document, article, blocks);
  const articleBodyWithoutFutureNotice = `${blocks}${manifestAttachmentSection}`;
  const articleBodyWithFutureNotice = futureAmendmentNotice ? `${blocks}${futureAmendmentNotice}${manifestAttachmentSection}` : articleBodyWithoutFutureNotice;
  elements.articleBody.innerHTML = `${comparisonHeading}${articleHeader}<div class="article-content legal-reading-area">${articleBodyWithFutureNotice}</div>`;
  scrambleFutureAmendmentText(elements.articleBody);
}

function tocChapterTitle(context) {
  return [context?.chapter?.number, context?.chapter?.title].filter(Boolean).join(" ").trim();
}

function stripRevisionMarkers(text = "") {
  return text.replace(/\s*<\s*(?:개정|신설|삭제|전문개정)[^>]*>/g, "").replace(/[ \t]{2,}/g, " ").trimEnd();
}

function renderSidePanel() {
  if (openSanction && !shouldRenderSanctionDetailInline()) {
    const closeButton = '<button type="button" class="drawer-close" data-reader-drawer-close aria-label="관련 제재 조문 닫기">닫기</button>';
    elements.sidePanel.innerHTML = `${closeButton}${renderSanctionDetailContent(openSanction.detail)}`;
    elements.noticePanel.innerHTML = '<p class="empty-state">제재 상세를 닫으면 고시 연결을 다시 볼 수 있습니다.</p>';
    return;
  }
  const document = currentDocument();
  const article = currentArticle();
  const links = relationResolver.linksFor(document.id, article.id);
  const relationView = relationResolver.viewFor({
    ...state,
    primaryDocumentId: state.documentId,
    primaryArticleId: state.articleId,
    decreeArticleId: state.linkedDecreeArticleId,
    noticeArticleId: state.linkedNoticeArticleId,
  });
  elements.relationPath.innerHTML = renderCurrentPath(relationView);
  const closeButton = '<button type="button" class="drawer-close" data-reader-drawer-close aria-label="연결 근거 닫기">닫기</button>';
  const relationTabs = renderRelationTabs({ ...relationView, decrees: links.decrees, notices: links.notices, officialSource: officialSourceDetail(document) }, { activeTab: state.relationTab });
  const selectedDecreeLinks = state.linkedDecreeArticleId
    ? relationResolver.linksFor("privacy-decree", state.linkedDecreeArticleId)
    : null;
  const noticeLinks = selectedDecreeLinks?.notices?.length ? selectedDecreeLinks.notices : links.notices;
  const noticeTabs = renderRelationTabs({ ...relationView, decrees: [], notices: noticeLinks, officialSource: "" }, { activeTab: "notice" });
  const decreeArticles = renderLinkedReadingArticles("시행령", "privacy-decree", state.linkedDecreeArticleIds, links.decrees, renderLinkedReadingArticle);
  const noticeArticles = renderLinkedReadingArticles("고시", "privacy-notice", state.linkedNoticeArticleIds, noticeLinks, renderLinkedReadingArticle);
  const decreeRequested = state.linkedDecreeArticleIds.length > 0;
  const noticeRequested = state.linkedNoticeArticleIds.length > 0;
  const sideTitle = document.id === "privacy-decree" ? "고시 연결" : "시행령";
  const noticeTitle = document.id === "privacy-law" ? "고시" : "연결 고시";
  const sideContent = decreeArticles
    ? `${decreeArticles}${state.linkedNoticeArticleId || desktopMedia.matches ? "" : `<div class="linked-next-column"><h3>연결 고시</h3>${noticeTabs}</div>`}`
    : decreeRequested ? `<p class="empty-state">${linkedReadingEmptyState("시행령", state.linkedDecreeArticleIds, decreeArticles)}</p>` : relationTabs;
  const noticeFallback = state.linkedDecreeArticleId || document.id === "privacy-decree"
    ? noticeTabs
    : '<p class="empty-state">시행령 또는 고시를 선택하면 이 칸에 원문이 열립니다.</p>';
  const noticeContent = noticeArticles || (noticeRequested ? `<p class="empty-state">${linkedReadingEmptyState("고시", state.linkedNoticeArticleIds, noticeArticles)}</p>` : noticeFallback);
  const decreeDocument = findDocumentById(readerDocuments, "privacy-decree");
  const noticeDocument = findDocumentById(readerDocuments, "privacy-notice");
  const decreeTools = renderPanelTools({ documentId: "privacy-decree", label: "시행령", focused: focusedPanelDocumentId === "privacy-decree" });
  const noticeTools = renderPanelTools({ documentId: "privacy-notice", label: "고시", focused: focusedPanelDocumentId === "privacy-notice" });
  const decreeClose = state.linkedDecreeArticleId
    ? '<button type="button" class="panel-close" data-panel-close="privacy-decree" aria-label="시행령 연결 닫기">닫기</button>'
    : "";
  const noticeClose = state.linkedNoticeArticleId
    ? '<button type="button" class="panel-close" data-panel-close="privacy-notice" aria-label="고시 연결 닫기">닫기</button>'
    : "";
  const lawTitle = document.id === "privacy-law" ? articleDisplayTitle(document, article) : "현재 조문";
  const decreeSummary = document.id === "privacy-law" && decreeArticles
    ? `<p class="comparison-relation-summary">법률 「${escapeHtml(lawTitle)}」에서 연결</p>`
    : "";
  const noticeSummary = (decreeArticles || noticeArticles) && (document.id === "privacy-law" || document.id === "privacy-decree")
    ? `<p class="comparison-relation-summary">${decreeArticles ? "시행령" : "법률"}에서 연결된 고시</p>`
    : "";
  elements.sidePanel.innerHTML = `${closeButton}<div class="comparison-column comparison-column--decree"><div class="comparison-heading"><div><h2>${escapeHtml(sideTitle)}</h2>${decreeSummary}</div><div class="panel-header-actions">${decreeTools}${decreeClose}</div></div>${sideContent}</div>`;
  elements.noticePanel.innerHTML = `<div class="comparison-column comparison-column--notice"><div class="comparison-heading"><div><h2>${escapeHtml(noticeTitle)}</h2>${noticeSummary}</div><div class="panel-header-actions">${noticeTools}${noticeClose}</div></div><div class="linked-reading-flow">${noticeContent}</div></div>`;
  updateComparisonState();
}

function closeLinkedPanel(documentId) {
  if (documentId === "privacy-decree") {
    state.linkedDecreeArticleId = null;
    state.linkedDecreeArticleIds = [];
    state.linkedDecreeSourceContext = "";
    state.linkedNoticeArticleId = null;
    state.linkedNoticeArticleIds = [];
    state.relationTab = "decree";
  } else if (documentId === "privacy-notice") {
    state.linkedNoticeArticleId = null;
    state.linkedNoticeArticleIds = [];
    state.relationTab = "notice";
  } else {
    return;
  }
  focusedPanelDocumentId = null;
  render();
  syncLocation("push");
}

async function handlePanelAction(button) {
  const toolbar = button.closest("[data-panel-document-id]");
  const documentId = toolbar?.dataset.panelDocumentId;
  if (!documentId) return;
  if (button.dataset.panelAction === "focus") focusedPanelDocumentId = documentId;
  else if (button.dataset.panelAction === "compare") focusedPanelDocumentId = null;
  else if (button.dataset.panelAction === "more") {
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    toolbar.classList.toggle("is-more-open", expanded);
    return;
  }
  updateComparisonState();
  renderArticleList();
  renderArticleBody();
  renderSidePanel();
}

function openSanctionDetail(button) {
  const relationId = button.dataset.sanctionRelationId;
  if (openSanction?.relationId === relationId) {
    closeSanctionDetail();
    return;
  }
  let block = button.closest("p") ?? button.previousElementSibling;
  while (block && !block.matches("p")) block = block.previousElementSibling;
  const locator = block ? locatorFromDomId(block.id) : null;
  const group = locator && groupSanctionsForDisplay(sanctionsForScope(sanctionIndex, locator)).find((item) => item.relations.some(({ id }) => id === relationId));
  if (!group) return;
  openSanction = {
    relationId,
    openerId: button.id,
    inspectorScrollTop: elements.sidePanel.scrollTop,
    relationTab: state.relationTab,
    detail: { ...group, ...sanctionDetailForGroup(sanctionIndex, group) },
  };
  renderArticleBody();
  renderSidePanel();
  if (!shouldRenderSanctionDetailInline()) {
    openDrawer(elements.sidePanel, { focusClose: false });
    elements.sidePanel.querySelector(".sanction-detail")?.focus();
  } else {
    elements.articleBody.querySelector(`#sanction-detail-${button.id.replace("sanction-chip-", "")}`)?.focus();
  }
}

function closeSanctionDetail() {
  if (!openSanction) return;
  const { openerId, inspectorScrollTop, relationTab } = openSanction;
  openSanction = null;
  state.relationTab = relationTab;
  renderArticleBody();
  renderSidePanel();
  elements.sidePanel.scrollTop = inspectorScrollTop;
  elements.articleBody.querySelector(`#${CSS.escape(openerId)}`)?.focus();
}

function locatorFromDomId(id) {
  const document = currentDocument();
  const block = document.articles
    .flatMap((article) => scopeArticleBlocks(document.id, article, splitArticleBlocks(article.text)).blocks)
    .find((item) => item.locator && locatorDomId(item.locator) === id);
  return block?.locator ?? null;
}

function openSanctionSource(button) {
  const sourceDocumentId = button.dataset.sanctionSourceDocumentId;
  const sourceArticleId = button.dataset.sanctionSourceArticleId;
  const locator = JSON.parse(button.dataset.sanctionSourceLocator);
  const sourceDocument = findDocumentById(readerDocuments, sourceDocumentId);
  if (!sourceDocument?.articles.some(({ id }) => id === sourceArticleId)) return;
  history.replaceState(readerHistoryState({ sanctionReturn: {
    documentId: state.documentId,
    articleId: state.articleId,
    openerId: openSanction?.openerId,
    inspectorScrollTop: openSanction?.inspectorScrollTop ?? elements.sidePanel.scrollTop,
    relationTab: openSanction?.relationTab ?? state.relationTab,
  } }), "", readerUrl());
  openSanction = null;
  Object.assign(state, {
    documentId: sourceDocumentId,
    articleId: sourceArticleId,
    primaryDocumentId: sourceDocumentId,
    primaryArticleId: sourceArticleId,
    lawArticleId: sourceDocumentId === "privacy-law" ? sourceArticleId : null,
    linkedDecreeArticleId: null,
    linkedNoticeArticleId: null,
    linkedDecreeArticleIds: [],
    linkedNoticeArticleIds: [],
    searchOpen: false,
  });
  rememberArticle(sourceDocumentId, sourceArticleId);
  render();
  syncLocation("push");
  const source = elements.articleBody.querySelector(`#${CSS.escape(locatorDomId(locator))}`);
  source?.setAttribute("tabindex", "-1");
  source?.focus({ preventScroll: true });
  source?.scrollIntoView({ block: "center" });
}

function renderLinkedReadingArticle(label, documentId, articleId, choices) {
  if (!articleId) return "";
  const document = findDocumentById(readerDocuments, documentId);
  const article = document?.articles.find((item) => item.id === articleId);
  if (!article) return "";
  const reason = choices.find((item) => item.articleId === articleId)?.reason;
  const sourceArticleNumber = documentId === "privacy-decree" && state.documentId === "privacy-law" ? currentArticle()?.number : "";
  const linkedBlocks = documentId === "privacy-decree"
    ? linkedReadingBlocksForSource(splitArticleBlocks(article.text).blocks, sourceArticleNumber, state.linkedDecreeSourceContext)
    : splitArticleBlocks(article.text).blocks;
  if (documentId === "privacy-decree" && sourceArticleNumber && state.linkedDecreeSourceContext && !linkedBlocks.length) return "";
  const blocks = linkedBlocks.map((block) => block.kind === "attachment"
    ? renderAttachmentPdfButtons(document, article, block)
    : `<p class="${legalBlockClass(block.text)}">${renderDelegationHtml(highlightText(stripRevisionMarkers(block.text), state.query), document, relationResolver.linksFor(document.id, article.id), article.id)}</p>`).join("");
  const titleClass = documentId === "privacy-notice" ? ' class="notice-title"' : "";
  return `<section class="linked-reading-article" data-linked-document="${escapeHtml(documentId)}" tabindex="-1"><p class="linked-reading-reason">${escapeHtml(reason || `${label} 연결 조문`)}</p><h2${titleClass}>${highlightText(articleDisplayTitle(document, article), state.query)}</h2><div class="legal-reading-area">${blocks}</div></section>`;
}

function applyReaderSettings() {
  elements.root.dataset.theme = state.theme;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.setProperty("--reader-font-size", `${state.fontSize}px`);
  document.documentElement.style.setProperty("--reader-line-height", String(state.lineHeight));
  elements.root.style.setProperty("--reader-font-size", `${state.fontSize}px`);
  elements.root.style.setProperty("--reader-line-height", String(state.lineHeight));
  elements.fontSize.value = String(state.fontSize);
  elements.lineHeight.value = String(Math.round(state.lineHeight * 100));
  elements.fontSizeOutput.textContent = `${state.fontSize}px`;
  elements.lineHeightOutput.textContent = state.lineHeight.toFixed(1);
  elements.fontSize.setAttribute("aria-label", `글자 크기 ${state.fontSize}px`);
  elements.lineHeight.setAttribute("aria-label", `행간 ${state.lineHeight.toFixed(1)}`);
  elements.futureAmendmentsToggle.checked = state.showFutureAmendments;
  elements.officialSourceDetail.innerHTML = officialSourceDetail(currentDocument());
  elements.themeChoices.forEach((button) => {
    const active = button.dataset.themeChoice === state.theme;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("is-active", active);
  });
  updateComparisonState();
}

function render({ updateHistory = false } = {}) {
  try {
    applyReaderSettings();
    const searchModel = currentSearchModel();
    renderArticleList();
    if (state.searchOpen) {
      elements.articleList.innerHTML = `<div class="search-title-list"><h2>검색 조문</h2>${searchModel.items.map((item, index) => `<button type="button" data-search-index="${index}" data-search-document-id="${escapeHtml(item.document.id)}" data-search-article-id="${escapeHtml(item.article.id)}"><span>${escapeHtml(item.document.shortTitle ?? item.document.title ?? "")}</span><strong>${escapeHtml(articleDisplayTitle(item.document, item.article))}</strong></button>`).join("")}</div>`;
    }
    renderArticleBody();
    showSearchBackButton();
    renderSidePanel();
    renderGlobalSearchResults(searchModel);
    if (state.searchOpen) {
      elements.articleBody.innerHTML = `<div class="search-results-main">${elements.searchResults.innerHTML}</div>`;
      restoreSearchResultsScroll();
    }
    if (updateHistory) syncLocation();
    scheduleHeaderBlockSizeSync();
  } catch {
    elements.articleBody.innerHTML = '<p class="empty-state">내용을 불러오지 못했습니다.</p><button type="button" data-reader-retry>다시 불러오기</button>';
  }
}

function toggleMenu(button, menu) {
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function closeMenus(returnFocus = false) {
  const openButton = !elements.toolsMenu.hidden ? elements.toolsButton : null;
  elements.toolsMenu.hidden = true;
  elements.toolsButton.setAttribute("aria-expanded", "false");
  if (returnFocus) openButton?.focus();
}

function onboardingFocusables() {
  return [elements.onboardingSkip, elements.onboardingBack, elements.onboardingNext].filter((item) => !item.hidden && !item.disabled);
}

function activeOnboardingSteps() {
  return onboardingSteps(mobileMedia.matches);
}

function closeOnboardingComparisonDialogs() {
  elements.articleBody.querySelectorAll(".future-comparison-dialog[open]").forEach((dialog) => {
    if (typeof HTMLDialogElement === "function" && dialog instanceof HTMLDialogElement && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    dialog.classList.remove("onboarding-preview");
  });
}

function showOnboardingDemoArticle(articleId) {
  if (state.documentId === "privacy-law" && state.articleId === articleId && !state.showAllArticles && state.showFutureAmendments) return;
  openSanction = null;
  Object.assign(state, {
    documentId: "privacy-law",
    articleId,
    showAllArticles: false,
    noticeSectionIndex: null,
    primaryDocumentId: "privacy-law",
    primaryArticleId: articleId,
    lawArticleId: articleId,
    linkedDecreeArticleId: null,
    linkedNoticeArticleId: null,
    linkedDecreeArticleIds: [],
    linkedNoticeArticleIds: [],
    showFutureAmendments: true,
  });
  render();
  elements.articleBody.scrollTop = 0;
}

function applyOnboardingStepDemo(step) {
  closeOnboardingComparisonDialogs();
  if (step.demo === "sanction") {
    showOnboardingDemoArticle("law-70");
    return;
  }
  if (step.demo !== "future-amendment" && step.demo !== "future-comparison") return;

  showOnboardingDemoArticle("law-25");
  const notice = elements.articleBody.querySelector(".future-amendment-notice");
  if (notice) elements.articleBody.scrollTop = Math.max(0, notice.offsetTop - 18);
  if (step.demo !== "future-comparison") return;

  const button = notice?.querySelector("[data-future-comparison-open]");
  const dialog = button ? document.getElementById(button.dataset.futureComparisonOpen) : null;
  if (typeof HTMLDialogElement === "function" && dialog instanceof HTMLDialogElement && typeof dialog.show === "function") {
    dialog.classList.add("onboarding-preview");
    dialog.show();
  } else {
    dialog?.classList.add("onboarding-preview");
    dialog?.setAttribute("open", "");
  }
  requestAnimationFrame(() => elements.onboardingNext.focus());
}

function positionOnboarding() {
  if (elements.onboardingTour.hidden) return;
  const step = activeOnboardingSteps()[onboardingStepIndex];
  const target = document.querySelector(step?.target);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const inset = 8;
  const spotlightLeft = Math.max(8, rect.left - inset);
  const spotlightTop = Math.max(8, rect.top - inset);
  const spotlightWidth = Math.min(window.innerWidth - spotlightLeft - 8, rect.width + inset * 2);
  const spotlightHeight = Math.min(window.innerHeight - spotlightTop - 8, rect.height + inset * 2);
  Object.assign(elements.onboardingSpotlight.style, {
    left: `${spotlightLeft}px`, top: `${spotlightTop}px`, width: `${spotlightWidth}px`, height: `${spotlightHeight}px`,
  });

  if (window.innerWidth < 768) {
    Object.assign(elements.onboardingTip.style, { left: "12px", right: "12px", top: "auto", bottom: "calc(70px + env(safe-area-inset-bottom))" });
    return;
  }

  const tipRect = elements.onboardingTip.getBoundingClientRect();
  const gap = 20;
  let left = rect.right + gap;
  if (left + tipRect.width > window.innerWidth - 16) left = rect.left - tipRect.width - gap;
  if (left < 16) left = Math.min(Math.max(16, rect.left + rect.width / 2 - tipRect.width / 2), window.innerWidth - tipRect.width - 16);
  const top = Math.min(Math.max(16, rect.top), window.innerHeight - tipRect.height - 16);
  Object.assign(elements.onboardingTip.style, { left: `${left}px`, right: "auto", top: `${top}px`, bottom: "auto" });
}

function renderOnboarding() {
  const steps = activeOnboardingSteps();
  onboardingStepIndex = Math.min(onboardingStepIndex, steps.length - 1);
  const step = steps[onboardingStepIndex];
  applyOnboardingStepDemo(step);
  elements.onboardingProgress.textContent = `${onboardingStepIndex + 1} / ${steps.length}`;
  elements.onboardingTitle.textContent = step.title;
  elements.onboardingDescription.textContent = step.description;
  elements.onboardingBack.hidden = onboardingStepIndex === 0;
  elements.onboardingNext.textContent = onboardingStepIndex === steps.length - 1 ? "시작하기" : "다음";
  positionOnboarding();
}

function finishOnboarding({ restoreFocus = false } = {}) {
  closeOnboardingComparisonDialogs();
  markOnboardingSeen(window.localStorage);
  elements.onboardingTour.hidden = true;
  delete elements.root.dataset.onboardingActive;
  if (restoreFocus) onboardingReturnFocus?.focus();
  onboardingReturnFocus = null;
}

function openOnboarding({ opener = null } = {}) {
  closeMenus();
  closeDrawers();
  onboardingReturnFocus = opener instanceof HTMLElement ? opener : document.activeElement instanceof HTMLElement ? document.activeElement : null;
  onboardingStepIndex = 0;
  elements.onboardingTour.hidden = false;
  elements.root.dataset.onboardingActive = "true";
  requestAnimationFrame(() => {
    renderOnboarding();
    elements.onboardingNext.focus();
  });
}

function setupOnboarding() {
  elements.onboardingReplay.addEventListener("click", () => openOnboarding({ opener: elements.onboardingReplay }));
  elements.mobileOnboardingReplay.addEventListener("click", () => openOnboarding({ opener: elements.mobileOnboardingReplay }));
  elements.onboardingSkip.addEventListener("click", () => finishOnboarding({ restoreFocus: true }));
  elements.onboardingBack.addEventListener("click", () => {
    onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
    renderOnboarding();
  });
  elements.onboardingNext.addEventListener("click", () => {
    if (onboardingStepIndex === activeOnboardingSteps().length - 1) {
      finishOnboarding({ restoreFocus: true });
      return;
    }
    onboardingStepIndex += 1;
    renderOnboarding();
  });
  window.addEventListener("resize", () => {
    if (!elements.onboardingTour.hidden) renderOnboarding();
  });
  document.addEventListener("scroll", positionOnboarding, true);
  // Keep the first screen clean for real users and automated previews. The full
  // tour remains available from the explicit "도움말 다시 보기" controls.
}

function searchModalFocusables(searchInput, searchResults) {
  return [searchInput, ...searchResults.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled && !item.hidden);
}

function closeSearchSheet(restoreFocus = false) {
  state.searchOpen = false;
  renderGlobalSearchResults();
  if (restoreFocus) elements.search.focus();
}

function currentRelationView() {
  return relationResolver.viewFor({ ...state, primaryDocumentId: state.documentId, primaryArticleId: state.articleId, decreeArticleId: state.linkedDecreeArticleId, noticeArticleId: state.linkedNoticeArticleId });
}

function setupMenuProximity() {
  const controls = [...document.querySelectorAll(".theme-segments button, #toolsMenuButton")];
  const finePointer = window.matchMedia("(pointer: fine)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reset = () => controls.forEach((button) => button.style.setProperty("--menu-proximity-scale", "1"));
  elements.header.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reduced.matches) { reset(); return; }
    controls.forEach((button) => {
      const rect = button.getBoundingClientRect();
      const distance = Math.abs(event.clientX - (rect.left + rect.width / 2));
      const scale = 1 + Math.max(0, 1 - distance / 150) * 0.16;
      button.style.setProperty("--menu-proximity-scale", scale.toFixed(3));
    });
  });
  elements.header.addEventListener("pointerleave", reset);
  controls.forEach((button) => {
    button.addEventListener("focus", () => button.style.setProperty("--menu-proximity-scale", reduced.matches ? "1" : "1.16"));
    button.addEventListener("blur", reset);
  });
}

function setupColumnResizers() {
  const fallbackMinimum = 280;
  const minimumForColumn = (element, boundary) => {
    if (element === elements.noticePanel) return boundary === "law-decree" ? 300 : 260;
    if (element === elements.sidePanel) {
      return boundary === "law-decree" && getComputedStyle(elements.noticePanel).display === "none" ? 300 : 320;
    }
    if (element === elements.articleBody) {
      if (
        boundary === "decree-notice" ||
        getComputedStyle(elements.sidePanel).display === "none" ||
        (boundary === "law-decree" && getComputedStyle(elements.noticePanel).display === "none")
      ) return 520;
      return 320;
    }
    return fallbackMinimum;
  };
  elements.columnResizers.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      if (!desktopMedia.matches) return;
      event.preventDefault();
      const boundary = handle.dataset.columnResizer;
      const decreePanel = getComputedStyle(elements.sidePanel).display !== "none"
        ? elements.sidePanel
        : elements.articleBody;
      const left = boundary === "law-decree" ? elements.articleBody : decreePanel;
      const right = boundary === "law-decree" && getComputedStyle(elements.sidePanel).display !== "none"
        ? elements.sidePanel
        : elements.noticePanel;
      const startX = event.clientX;
      const leftStart = left.getBoundingClientRect().width;
      const rightStart = right.getBoundingClientRect().width;
      const totalWidth = leftStart + rightStart;
      const leftMinimum = Math.min(minimumForColumn(left, boundary), totalWidth);
      const rightMinimum = Math.min(minimumForColumn(right, boundary), Math.max(0, totalWidth - leftMinimum));
      handle.setPointerCapture(event.pointerId);
      const move = (moveEvent) => {
        columnWidthsCustomized = true;
        const delta = moveEvent.clientX - startX;
        const maxLeft = Math.max(leftMinimum, totalWidth - rightMinimum);
        const nextLeft = Math.min(maxLeft, Math.max(leftMinimum, leftStart + delta));
        const nextRight = totalWidth - nextLeft;
        if (boundary === "law-decree") {
          elements.root.style.setProperty("--law-column", `${nextLeft}px`);
          elements.root.style.setProperty(right === elements.noticePanel ? "--notice-column" : "--decree-column", `${nextRight}px`);
        } else {
          elements.root.style.setProperty("--decree-column", `${nextLeft}px`);
          elements.root.style.setProperty("--notice-column", `${nextRight}px`);
        }
      };
      const stop = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    });
  });
}

function setupTocResizer() {
  const minimum = 208;
  const maximum = 420;
  const edgeSize = 18;
  let startX = 0;
  let startWidth = 0;
  let pointerId = null;
  const clearResizeReady = () => {
    if (!tocResizeActive) elements.tocResizerLine.classList.remove("is-toc-resize-ready");
  };
  elements.tocResizerLine.addEventListener("pointermove", () => {
    if (!desktopMedia.matches || tocCollapsed || pointerId !== null) return;
    elements.tocResizerLine.classList.add("is-toc-resize-ready");
  });
  elements.tocResizerLine.addEventListener("pointerleave", clearResizeReady);
  elements.tocResizerLine.addEventListener("pointerdown", (event) => {
    if (!desktopMedia.matches || tocCollapsed) return;
    const rect = elements.navigationPane.getBoundingClientRect();
    if (Math.abs(rect.right - event.clientX) > edgeSize) return;
    event.preventDefault();
    startX = event.clientX;
    startWidth = rect.width;
    pointerId = event.pointerId;
    tocResizeActive = true;
    elements.tocResizerLine.classList.add("is-toc-resizing");
    elements.tocResizerLine.setPointerCapture(event.pointerId);
  });
  elements.tocResizerLine.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId || tocCollapsed) return;
    const delta = event.clientX - startX;
    event.preventDefault();
    const width = Math.min(maximum, Math.max(minimum, startWidth + delta));
    elements.root.style.setProperty("--toc-column", `${width}px`);
    scheduleTocResizeChromePosition();
  });
  const stop = (event) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    elements.tocResizerLine.classList.remove("is-toc-resizing", "is-toc-resize-ready");
    scheduleTocResizeChromePosition();
    window.setTimeout(() => { tocResizeActive = false; }, 0);
  };
  elements.tocResizerLine.addEventListener("pointerup", stop);
  elements.tocResizerLine.addEventListener("pointercancel", stop);
}

function setupFutureComparisonResizer() {
  const state = {
    pointerId: null,
    direction: "",
    dialog: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
  };
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const minimumDialogWidth = () => Math.min(760, Math.max(320, window.innerWidth - 36));
  const minimumDialogHeight = () => Math.min(420, Math.max(260, window.innerHeight - 36));
  const maximumDialogWidth = () => Math.max(minimumDialogWidth(), window.innerWidth - 24);
  const maximumDialogHeight = () => Math.max(minimumDialogHeight(), window.innerHeight - 24);
  const start = (event) => {
    const handle = event.target.closest("[data-future-comparison-resize]");
    if (!handle || mobileMedia.matches) return;
    const dialog = handle.closest(".future-comparison-dialog");
    if (!dialog) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = dialog.getBoundingClientRect();
    state.pointerId = event.pointerId;
    state.direction = handle.dataset.futureComparisonResize;
    state.dialog = dialog;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.startLeft = rect.left;
    state.startTop = rect.top;
    state.startWidth = rect.width;
    state.startHeight = rect.height;
    futureComparisonResizeActive = true;
    dialog.classList.add("is-resizing", "is-positioned");
    dialog.style.left = `${rect.left}px`;
    dialog.style.top = `${rect.top}px`;
    dialog.style.width = `${rect.width}px`;
    dialog.style.height = `${rect.height}px`;
    handle.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (event.pointerId !== state.pointerId || !state.dialog) return;
    event.preventDefault();
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    const direction = state.direction;
    let width = state.startWidth;
    let height = state.startHeight;
    let left = state.startLeft;
    let top = state.startTop;
    if (direction.includes("e")) width = state.startWidth + deltaX;
    if (direction.includes("s")) height = state.startHeight + deltaY;
    if (direction.includes("w")) {
      width = state.startWidth - deltaX;
      left = state.startLeft + deltaX;
    }
    if (direction.includes("n")) {
      height = state.startHeight - deltaY;
      top = state.startTop + deltaY;
    }
    const minWidth = minimumDialogWidth();
    const minHeight = minimumDialogHeight();
    const maxWidth = maximumDialogWidth();
    const maxHeight = maximumDialogHeight();
    const clampedWidth = clamp(width, minWidth, maxWidth);
    const clampedHeight = clamp(height, minHeight, maxHeight);
    if (direction.includes("w")) left = state.startLeft + state.startWidth - clampedWidth;
    if (direction.includes("n")) top = state.startTop + state.startHeight - clampedHeight;
    left = clamp(left, 12, window.innerWidth - clampedWidth - 12);
    top = clamp(top, 12, window.innerHeight - clampedHeight - 12);
    state.dialog.style.left = `${left}px`;
    state.dialog.style.top = `${top}px`;
    state.dialog.style.width = `${clampedWidth}px`;
    state.dialog.style.height = `${clampedHeight}px`;
  };
  const stop = (event) => {
    if (event.pointerId !== state.pointerId) return;
    state.dialog?.classList.remove("is-resizing");
    state.pointerId = null;
    state.direction = "";
    state.dialog = null;
    window.setTimeout(() => { futureComparisonResizeActive = false; }, 0);
  };
  elements.articleBody.addEventListener("pointerdown", start);
  elements.articleBody.addEventListener("pointermove", move);
  elements.articleBody.addEventListener("pointerup", stop);
  elements.articleBody.addEventListener("pointercancel", stop);
}

elements.search.addEventListener("focus", () => {
  if (viewportName() === "medium") openDrawer(elements.navigationPane, { focusClose: false });
});
elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selectedResultIndex = -1;
  if (!state.query.trim()) {
    resetSearchAndRender({ focus: false });
    return;
  }
});
elements.searchButton.addEventListener("click", () => {
  state.searchOpen = true;
  state.selectedResultIndex = -1;
  render();
  syncLocation();
  elements.search.focus();
});
elements.search.addEventListener("keydown", (event) => {
  const model = currentSearchModel();
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    state.selectedResultIndex = moveSearchSelection(state.selectedResultIndex, event.key === "ArrowDown" ? 1 : -1, model.items.length);
    renderGlobalSearchResults(model);
    elements.searchResults.querySelector(`[data-search-index="${state.selectedResultIndex}"]`)?.scrollIntoView({ block: "nearest" });
    syncLocation();
  } else if (event.key === "Enter") {
    event.preventDefault();
    elements.searchButton.click();
  } else if (event.key === "Escape") {
    state.searchOpen = false;
    renderGlobalSearchResults(model);
  }
});
elements.clearSearch.addEventListener("click", () => {
  resetSearchAndRender();
});
elements.searchResults.addEventListener("click", (event) => {
  const filter = event.target.closest("[data-source-filter]");
  if (filter) {
    state.sourceFilter = filter.dataset.sourceFilter;
    state.selectedResultIndex = -1;
    renderGlobalSearchResults();
    syncLocation();
    return;
  }
  const result = event.target.closest("[data-search-index]");
  if (result) {
    selectSearchResult(result.dataset.searchDocumentId, result.dataset.searchArticleId, Number(result.dataset.searchIndex));
    return;
  }
  const query = event.target.closest("[data-discovery-query]");
  if (query) {
    state.query = query.dataset.discoveryQuery;
    elements.search.value = state.query;
    renderGlobalSearchResults();
    syncLocation();
    return;
  }
  const article = event.target.closest("[data-discovery-article]");
  if (article) selectSearchResult(article.dataset.documentId, article.dataset.articleId);
});
elements.articleBody.addEventListener("click", (event) => {
  const comparisonOpen = event.target.closest("[data-future-comparison-open]");
  if (comparisonOpen) {
    const dialog = document.getElementById(comparisonOpen.dataset.futureComparisonOpen);
    if (typeof HTMLDialogElement === "function" && dialog instanceof HTMLDialogElement && typeof dialog.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
    return;
  }
  if (event.target.closest("[data-future-comparison-close]")) {
    const dialog = event.target.closest(".future-comparison-dialog");
    if (typeof HTMLDialogElement === "function" && dialog instanceof HTMLDialogElement && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    return;
  }
  if (event.target.matches(".future-comparison-dialog") && !futureComparisonResizeActive) {
    if (typeof HTMLDialogElement === "function" && event.target instanceof HTMLDialogElement && typeof event.target.close === "function") event.target.close();
    else event.target.removeAttribute("open");
    return;
  }
  const noticeArticle = event.target.closest("[data-notice-article-id]");
  if (noticeArticle) {
    setArticle(noticeArticle.dataset.noticeArticleId);
    return;
  }
  if (event.target.closest("[data-notice-picker-back]")) {
    setPrimaryDocument("privacy-notice");
    return;
  }
  if (event.target.closest("[data-search-back]")) {
    state.searchOpen = true;
    render();
    elements.search.focus();
    return;
  }
  const result = event.target.closest("[data-search-index]");
  if (result) selectSearchResult(result.dataset.searchDocumentId, result.dataset.searchArticleId, Number(result.dataset.searchIndex));
});
elements.articleList.addEventListener("click", (event) => {
  const noticeSection = event.target.closest("[data-notice-section-index]");
  if (noticeSection && state.documentId === "privacy-notice") {
    state.noticeSectionIndex = Number(noticeSection.dataset.noticeSectionIndex);
    render();
    syncLocation("push");
    focusArticlePane();
    return;
  }
  const searchResult = event.target.closest("[data-search-index]");
  if (state.searchOpen && searchResult) {
    selectSearchResult(searchResult.dataset.searchDocumentId, searchResult.dataset.searchArticleId, Number(searchResult.dataset.searchIndex));
    return;
  }
  const sectionToggle = event.target.closest("[data-toc-section-toggle]");
  if (sectionToggle) {
    tocDisclosure = toggleTocSection(tocDisclosure, sectionToggle.dataset.tocSectionToggle);
    renderArticleList();
    elements.articleList.querySelector(`[data-toc-section-toggle="${sectionToggle.dataset.tocSectionToggle}"]`)?.focus();
    return;
  }
  const chapterToggle = event.target.closest("[data-toc-chapter-toggle]");
  if (chapterToggle) {
    tocDisclosure = toggleTocChapter(tocDisclosure, chapterToggle.dataset.tocChapterToggle);
    renderArticleList();
    elements.articleList.querySelector(`[data-toc-chapter-toggle="${chapterToggle.dataset.tocChapterToggle}"]`)?.focus();
    return;
  }
  const button = event.target.closest("[data-article-id]");
  if (button) selectArticleListArticle(button.dataset.articleId);
});
elements.comparisonPane.addEventListener("click", (event) => {
  const attachment = event.target.closest("[data-attachment-window-url]");
  if (attachment) {
    openAttachmentWindow(attachment);
    return;
  }
  const panelClose = event.target.closest("[data-panel-close]");
  if (panelClose) {
    closeLinkedPanel(panelClose.dataset.panelClose);
    return;
  }
  const panelAction = event.target.closest("[data-panel-action]");
  if (panelAction) {
    handlePanelAction(panelAction).catch(() => {
      elements.readerStatus.textContent = "요청한 보기 도구를 실행하지 못했습니다.";
    });
  }
});
elements.articleBody.addEventListener("click", (event) => {
  const sanctionRuleToggle = event.target.closest("[data-sanction-rule-toggle]");
  if (sanctionRuleToggle) {
    toggleSanctionRule(sanctionRuleToggle);
    return;
  }
  const paragraphToggle = event.target.closest("[data-law-paragraph-toggle]");
  if (paragraphToggle) {
    const key = paragraphToggle.dataset.lawParagraphToggle;
    if (collapsedLawParagraphs.has(key)) collapsedLawParagraphs.delete(key);
    else collapsedLawParagraphs.add(key);
    renderArticleBody();
    elements.articleBody.querySelector(`[data-law-paragraph-toggle="${cssEscape(key)}"]`)?.focus();
    return;
  }
  const chip = event.target.closest("[data-sanction-relation-id]");
  if (chip) { openSanctionDetail(chip); return; }
  if (event.target.closest("[data-sanction-detail-close]")) { closeSanctionDetail(); return; }
  const source = event.target.closest("[data-sanction-source-article-id]");
  if (source) { openSanctionSource(source); return; }
  const link = event.target.closest("[data-link-document-id]");
  if (link) { adoptDelegationSource(link); setLinkedArticle(link.dataset.linkDocumentId, parseLinkedArticleIds(link.dataset.linkArticleIds ?? link.dataset.linkArticleId), link.dataset.linkSourceContext); }
});
elements.sidePanel.addEventListener("click", (event) => {
  const sanctionRuleToggle = event.target.closest("[data-sanction-rule-toggle]");
  if (sanctionRuleToggle) {
    toggleSanctionRule(sanctionRuleToggle);
    return;
  }
  if (event.target.closest("[data-sanction-detail-close]")) { closeSanctionDetail(); return; }
  const sanctionSource = event.target.closest("[data-sanction-source-article-id]");
  if (sanctionSource) { openSanctionSource(sanctionSource); return; }
  if (openSanction && event.target.closest("[data-reader-drawer-close]")) { closeSanctionDetail(); return; }
  if (event.target.closest("[data-reader-drawer-close]")) { closeDrawers(true); return; }
  const tab = event.target.closest("[data-relation-tab]");
  if (tab) {
    state.relationTab = tab.dataset.relationTab;
    renderSidePanel();
    elements.sidePanel.querySelector(`#relation-tab-${state.relationTab}`)?.focus();
    return;
  }
  const link = event.target.closest("[data-link-document-id]");
  if (link) { openRelationLink(link); }
});
elements.noticePanel.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link-document-id]");
  if (link) { openRelationLink(link); }
});
elements.navigationPane.addEventListener("click", (event) => {
  if (event.target.closest("[data-reader-drawer-close]")) closeDrawers(true);
});
tocCollapseButton.addEventListener("click", () => {
  if (tocResizeActive) return;
  tocCollapsed = !tocCollapsed;
  updateComparisonState();
});
elements.backdrop.addEventListener("click", () => closeDrawers(true));
elements.relationPath.addEventListener("click", () => openDrawer(elements.sidePanel));
elements.relationPath.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(elements.sidePanel); }
});
elements.mobileNavigation.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  event.preventDefault();
  const action = link.dataset.mobileAction;
  if (action === "search") {
    closeDrawers();
    state.searchOpen = true;
    renderGlobalSearchResults();
    elements.search.focus();
  } else if (action === "relations") {
    openMobileConnectionSheet();
  } else if (action === "toc") {
    if (elements.navigationPane.classList.contains("is-drawer-open")) {
      closeDrawers(true);
    } else {
      closeDrawers(true);
      openDrawer(elements.navigationPane, { focusClose: false });
    }
  }
});
elements.mobileFontControls.addEventListener("click", (event) => {
  const button = event.target.closest("[data-font-size-step]");
  if (!button) return;
  adjustFontSize(Number(button.dataset.fontSizeStep));
});
document.addEventListener("keydown", (event) => {
  if (!elements.onboardingTour.hidden) {
    if (event.key === "Escape") { finishOnboarding({ restoreFocus: true }); return; }
    if (event.key === "Tab") {
      const focusable = onboardingFocusables();
      const current = focusable.indexOf(document.activeElement);
      event.preventDefault();
      focusable[(current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
      return;
    }
  }
  if (event.key === "Escape") {
    if (focusedPanelDocumentId) {
      focusedPanelDocumentId = null;
      renderArticleList();
      renderArticleBody();
      renderSidePanel();
      return;
    }
    closeMenus(true);
    if (viewportName() !== "desktop" && state.searchOpen) closeSearchSheet(true);
    closeDrawers(true);
  }
  if (event.key === "Tab" && viewportName() !== "desktop") {
    const modal = state.searchOpen ? elements.searchResults : [elements.navigationPane, elements.sidePanel].find((pane) => pane.classList.contains("is-drawer-open"));
    if (modal) {
      const focusable = modal === elements.searchResults ? searchModalFocusables(elements.search, elements.searchResults) : [...modal.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((item) => !item.disabled);
      const first = focusable[0]; const last = focusable.at(-1);
      if (modal === elements.searchResults) {
        const current = Math.max(0, focusable.indexOf(document.activeElement));
        event.preventDefault();
        focusable[(current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
      } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
});
desktopMedia.addEventListener("change", renderViewportLayout);
mobileMedia.addEventListener("change", renderViewportLayout);
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    scheduleHeaderBlockSizeSync();
    scheduleTocResizeChromePosition();
  }).observe(elements.header);
} else {
  window.addEventListener("resize", () => {
    scheduleHeaderBlockSizeSync();
    scheduleTocResizeChromePosition();
  });
}
window.addEventListener("resize", scheduleTocResizeChromePosition);
elements.toolsButton.addEventListener("click", () => toggleMenu(elements.toolsButton, elements.toolsMenu));
document.addEventListener("click", (event) => {
  if (!event.target.closest("#toolsMenu, #toolsMenuButton")) closeMenus();
  if (event.target.closest("[data-reader-retry]")) render();
});
elements.fontSize.addEventListener("input", (event) => { state.fontSize = Number(event.target.value); applyReaderSettings(); writeViewPreferences(localStorage, state); });
elements.lineHeight.addEventListener("input", (event) => { state.lineHeight = Number(event.target.value) / 100; applyReaderSettings(); writeViewPreferences(localStorage, state); });
elements.futureAmendmentsToggle.addEventListener("change", (event) => {
  state.showFutureAmendments = event.target.checked;
  writeViewPreferences(localStorage, state);
  render();
});
elements.themeChoices.forEach((button) => button.addEventListener("click", () => {
  state.theme = button.dataset.themeChoice;
  applyReaderSettings();
  writeViewPreferences(localStorage, state);
}));
elements.documentChoices.forEach((button) => button.addEventListener("click", () => setPrimaryDocument(button.dataset.documentChoice)));
elements.columnPresets.forEach((button) => button.addEventListener("click", () => {
  applyColumnPreset(button.dataset.columnPreset);
}));
elements.fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen !== "function") throw new Error("fullscreen-exit-unsupported");
      await document.exitFullscreen();
      return;
    }
    if (typeof elements.root.requestFullscreen !== "function") throw new Error("fullscreen-unsupported");
    await elements.root.requestFullscreen();
  } catch {
    elements.readerStatus.textContent = "현재 브라우저 설정에서는 전체 화면을 사용할 수 없습니다.";
  }
});
document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement);
  elements.fullscreenButton.textContent = active ? "전체 화면 종료" : "전체 화면";
  elements.fullscreenButton.setAttribute("aria-pressed", String(active));
});
elements.printButton.addEventListener("click", () => window.print());
window.addEventListener("popstate", (event) => {
  openSanction = null;
  const locationState = readReaderLocation(location.search);
  locationState.query = typeof event.state?.readerQuery === "string" ? event.state.readerQuery : "";
  const document = findDocumentById(readerDocuments, locationState.primaryDocumentId);
  Object.assign(state, locationState, {
    documentId: document.id,
    articleId: document.articles.find((item) => item.id === locationState.primaryArticleId)?.id ?? document.articles[0]?.id ?? null,
    searchOpen: Boolean(locationState.query),
    linkedDecreeArticleId: locationState.decreeArticleId,
    linkedNoticeArticleId: locationState.noticeArticleId,
    linkedDecreeSourceContext: typeof event.state?.linkedDecreeSourceContext === "string" ? event.state.linkedDecreeSourceContext : "",
    ...restoreLinkedArticleLists(locationState),
  });
  const sanctionReturn = event.state?.sanctionReturn;
  if (sanctionReturn?.documentId === state.documentId && sanctionReturn.articleId === state.articleId) {
    state.relationTab = sanctionReturn.relationTab;
  }
  elements.search.value = state.query;
  render();
  if (sanctionReturn?.documentId === state.documentId && sanctionReturn.articleId === state.articleId) {
    elements.sidePanel.scrollTop = sanctionReturn.inspectorScrollTop;
    elements.articleBody.querySelector(`#${CSS.escape(sanctionReturn.openerId)}`)?.focus({ preventScroll: true });
    return;
  }
  const selected = elements.searchResults.querySelector(`[data-search-index="${state.selectedResultIndex}"]`);
  (selected ?? elements.articleBody.querySelector("h1"))?.focus({ preventScroll: true });
});

syncLocation("replace");
render();
loadAttachmentManifest();
setupMenuProximity();
setupColumnResizers();
setupTocResizer();
setupFutureComparisonResizer();
setupOnboarding();
scheduleHeaderBlockSizeSync();
renderViewportLayout();
rememberArticle(state.documentId, state.articleId);
