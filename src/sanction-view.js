import { escapeHtml, legalBlockClass, splitArticleBlocks } from "./law-utils.js";
import { locatorDomId, locatorKey, scopeArticleBlocks } from "./legal-locators.js";

const TYPE_ORDER = ["criminal", "administrative-fine", "surcharge"];
const TYPE_LABEL = {
  criminal: "벌칙",
  "administrative-fine": "과태료",
  surcharge: "과징금",
};
const TYPE_ICON = {
  criminal: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4v16M7 20h10M6 7h12M8 7l-4 7h8L8 7ZM16 7l-4 7h8l-4-7Z" /></svg>',
  "administrative-fine": '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4 21 19H3L12 4Z" /><path d="M12 9.2v5.1" class="sanction-chip__icon-strong" /><circle cx="12" cy="17" r="1.2" /></svg>',
  surcharge: "₩",
};

export function renderSanctionIndicators(groups = [], selectedRelationId = null) {
  return [...groups]
    .filter((group) => group?.relations?.length && TYPE_LABEL[group.kind])
    .sort((left, right) => TYPE_ORDER.indexOf(left.kind) - TYPE_ORDER.indexOf(right.kind))
    .map((group) => {
      const relation = group.relations[0];
      const groupId = relation.id;
      const token = domToken(groupId);
      const label = TYPE_LABEL[group.kind];
      const result = indicatorResult(group);
      const expanded = group.relations.some(({ id }) => id === selectedRelationId);
      return `<button type="button" class="sanction-chip sanction-chip--${escapeHtml(group.kind)}" id="sanction-chip-${token}" aria-expanded="${expanded}" aria-controls="sanction-detail-${token}" aria-label="${escapeHtml(`${TYPE_LABEL[group.kind]} 상세 열기: ${accessibleResult(group)}`)}" data-sanction-relation-id="${escapeHtml(groupId)}"><span class="sanction-chip__icon" aria-hidden="true">${TYPE_ICON[group.kind]}</span><span class="sanction-chip__label">${escapeHtml(label)}</span><span class="sanction-chip__result">${escapeHtml(result)}</span></button>`;
    }).join("");
}

export function renderSanctionDetail(group, { renderRuleText, renderAttachments, collapsedRuleKeys = new Set() } = {}) {
  if (!group?.relations?.length || !TYPE_LABEL[group.kind]) return "";
  const relation = group.relations[0];
  const groupId = relation.id;
  // A support rule is rendered line by line. Keep that line as the text payload
  // instead of letting the source rule's full text overwrite it.
  const renderText = (text, source = {}) => {
    const cleanText = stripRevisionMarkers(text);
    return renderRuleText?.({ ...source, text: cleanText }) ?? escapeHtml(cleanText);
  };
  const citations = group.relations.map((item) => `<li><strong>인용 범위</strong><span>${escapeHtml(`${locatorLabel(item.target)} ↔ ${locatorLabel(item.source)}`)}</span><strong>조문상 결과</strong><span>${renderText(item.consequenceText, item)}</span><strong>조건·예외</strong><span>${renderText(item.conditionText || "조문에 적힌 요건을 확인해야 합니다.", item)}</span><button type="button" class="sanction-source-link" id="sanction-source-${domToken(item.id)}" data-sanction-source-document-id="${escapeHtml(item.sourceDocumentId)}" data-sanction-source-article-id="${escapeHtml(item.sourceArticleId)}" data-sanction-source-locator="${escapeHtml(JSON.stringify(item.source))}">원문 보기</button></li>`).join("");
  const supporting = [
    ...(group.auxiliaries ?? []),
    ...(group.exclusions ?? []),
    ...(group.procedures ?? []),
  ].filter((rule, index, rules) => rules.findIndex((candidate) => (
    candidate.sourceDocumentId === rule.sourceDocumentId
    && candidate.sourceArticleId === rule.sourceArticleId
  )) === index);
  const support = supporting.length
    ? `<div class="sanction-support"><h4>조건·예외 및 보조 규칙</h4><ul>${supporting.map((rule) => renderSupportRule(rule, renderText, collapsedRuleKeys)).join("")}</ul></div>`
    : "";
  const attachmentSources = [...group.relations, ...supporting].reduce((sources, item) => {
    const key = `${item.sourceDocumentId ?? "privacy-law"}:${item.sourceArticleId ?? ""}`;
    if (item.sourceArticleId && !sources.some((source) => source.key === key)) sources.push({ key, documentId: item.sourceDocumentId ?? "privacy-law", articleId: item.sourceArticleId });
    return sources;
  }, []);
  const attachments = renderAttachments ? attachmentSources.map(renderAttachments).filter(Boolean).join("") : "";
  const attachmentSection = attachments ? `<div class="sanction-attachments"><h4>관련 별표·별지</h4>${attachments}</div>` : "";
  return `<section class="sanction-detail sanction-detail--${escapeHtml(group.kind)}" id="sanction-detail-${domToken(groupId)}" tabindex="-1"><div class="sanction-detail__heading"><h3>관련 제재 조문 · ${escapeHtml(TYPE_LABEL[group.kind])}</h3><button type="button" data-sanction-detail-close aria-label="관련 제재 조문 닫기">닫기</button></div><ol class="sanction-detail__relations">${citations}</ol>${support}${attachmentSection}</section>`;
}

function renderSupportRule(rule = {}, renderText = (text) => escapeHtml(text), collapsedRuleKeys = new Set()) {
  const label = rule.label ? `<strong class="sanction-support__label">${escapeHtml(rule.label)}</strong>` : "";
  const lines = supportRuleLines(rule);
  const childrenByParent = new Map();
  for (const line of lines) {
    if (!line.parentKey) continue;
    const children = childrenByParent.get(line.parentKey) ?? [];
    children.push(line.key);
    childrenByParent.set(line.parentKey, children);
  }
  const parentByKey = new Map(lines.map((line) => [line.key, line.parentKey]));
  const renderedLines = lines.map((line) => {
    const expanded = !collapsedRuleKeys.has(line.key);
    const hasChildren = childrenByParent.has(line.key);
    const hidden = isSanctionLineHidden(line, parentByKey, collapsedRuleKeys);
    const toggle = hasChildren
      ? `<button type="button" class="sanction-rule-toggle" aria-expanded="${expanded}" aria-label="${expanded ? "하위 조문 접기" : "하위 조문 펼치기"}" data-sanction-rule-toggle="${escapeHtml(line.key)}"></button>`
      : "";
    const hiddenAttributes = hidden ? ` data-sanction-rule-hidden="true" hidden` : "";
    return `<p class="sanction-support__line" data-sanction-line-kind="${line.kind}" data-sanction-rule-line="${escapeHtml(line.key)}"${hiddenAttributes}>${toggle}${renderText(line.text, rule)}</p>`;
  }).join("");
  return `<li>${label}<div class="sanction-support__body">${renderedLines}</div></li>`;
}

function supportRuleLines(rule = {}) {
  const text = stripRevisionMarkers(rule.text ?? "");
  const sourceDocumentId = rule.sourceDocumentId ?? "sanction-support";
  const sourceArticleId = rule.sourceArticleId ?? rule.label ?? "rule";
  const parsed = scopeArticleBlocks(
    sourceDocumentId,
    { id: sourceArticleId, number: "support" },
    splitArticleBlocks(text),
  ).blocks.filter((block) => block.kind !== "attachment" && block.text?.trim() && block.text.trim() !== "---");
  const fallbackBlocks = supportRuleParagraphs(text).map((line) => ({ text: line, locator: null }));
  const blocks = parsed.length > 1 || (parsed[0] && sanctionSupportKind(parsed[0]) !== "prose")
    ? parsed
    : fallbackBlocks;
  const lines = blocks.map((block, index) => ({
    key: sanctionRuleKey(rule, block.locator, index),
    text: block.text.trim(),
    kind: sanctionSupportKind(block),
    parentKey: null,
  }));

  let articleKey = null;
  let paragraphKey = null;
  let itemKey = null;
  for (const line of lines) {
    if (line.kind === "article") {
      line.parentKey = null;
      articleKey = line.key;
      paragraphKey = null;
      itemKey = null;
    } else if (line.kind === "paragraph" || line.kind === "prose") {
      line.parentKey = articleKey;
      paragraphKey = line.key;
      itemKey = null;
    } else if (line.kind === "item") {
      line.parentKey = paragraphKey ?? articleKey;
      itemKey = line.key;
    } else if (line.kind === "subitem") {
      line.parentKey = itemKey ?? paragraphKey ?? articleKey;
    }
  }
  return lines;
}

function sanctionSupportKind(block = {}) {
  const className = block.className ?? legalBlockClass(block.text ?? "");
  if (className.includes("legal-article")) return "article";
  if (className.includes("legal-paragraph")) return "paragraph";
  if (className.includes("legal-item")) return "item";
  if (className.includes("legal-subitem")) return "subitem";
  return "prose";
}

function sanctionRuleKey(rule, locator, index) {
  const source = `${rule.sourceDocumentId ?? "sanction-support"}:${rule.sourceArticleId ?? rule.label ?? "rule"}`;
  return `${source}:${locatorKey(locator) ?? "line"}:${index}`;
}

function isSanctionLineHidden(line, parentByKey, collapsedRuleKeys) {
  let parentKey = line.parentKey;
  while (parentKey) {
    if (collapsedRuleKeys.has(parentKey)) return true;
    parentKey = parentByKey.get(parentKey) ?? null;
  }
  return false;
}

function supportRuleParagraphs(text = "") {
  const lines = String(text)
    .replace(/\s+(다만,|이 경우|또한|However,|In this case)\s+/g, "\n$1 ")
    .split(/(?<=[.!?。])\s+|\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return mergeOrphanLegalMarkers(lines);
}

function mergeOrphanLegalMarkers(lines = []) {
  const merged = [];
  for (const line of lines) {
    if (/^(?:\d+(?:의\d+)?|[가-힣])\.$/.test(merged.at(-1) ?? "")) {
      merged[merged.length - 1] = `${merged.at(-1)} ${line}`;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function stripRevisionMarkers(text = "") {
  return String(text)
    .replace(/\s*<\s*(?:개정|신설|삭제|전부개정)[^>]*>/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trimEnd();
}

export function compactCriminalProvisionBlocks(blocks = []) {
  const [heading, consequence, ...rest] = blocks;
  if (!/^제\d+조(?:의\d+)?\(벌칙\)$/.test(heading?.text ?? "")) return blocks;
  const result = criminalPenaltyResult(consequence?.text);
  if (!result) return blocks;
  if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(consequence.text)) {
    return [heading, consequence, ...rest];
  }

  return [{
    ...heading,
    text: `${heading.text} ${consequence.text}`,
  }, ...rest];
}

export function renderScopedSanctionBlocks(blocks, options) {
  const consumed = new Set();
  return blocks.map((block) => {
    if (block.kind === "attachment") return options.renderAttachment?.(block) ?? '<p class="attachment-pdf-unavailable">별표·서식은 공식 원문에서 확인해 주세요.</p>';
    const key = locatorKey(block.locator);
    const firstAtLocator = key && !consumed.has(key);
    const groups = firstAtLocator ? options.groupsForLocator(block.locator) : [];
    if (key) consumed.add(key);
    const selected = groups.find((group) => group.relations.some(({ id }) => id === options.selectedRelationId));
    const detail = options.mobile && selected
      ? (options.renderDetail?.(options.detailForGroup(selected)) ?? renderSanctionDetail(options.detailForGroup(selected)))
      : "";
    const text = options.renderText?.(block) ?? escapeHtml(block.text);
    const idAttribute = firstAtLocator ? ` id="${locatorDomId(block.locator)}"` : "";
    const extraAttributes = options.blockAttributes?.(block) ?? "";
    const beforeText = options.renderBeforeText?.(block) ?? "";
    const className = block.className === "legal-line legal-sanction-summary" ? block.className : legalBlockClass(block.text);
    return `<p class="${className}"${idAttribute}${extraAttributes}>${beforeText}${text}${renderSanctionIndicators(groups, options.selectedRelationId)}</p>${detail}`;
  }).join("");
}

function indicatorResult(group) {
  const consequence = group.relations[0].consequenceText;
  if (group.kind === "surcharge") return surchargeChipResult(consequence);
  if (group.relations.length > 1) return `${group.relations.length}건`;
  if (group.kind === "administrative-fine") return `${amountBefore(consequence, "과태료") || "조문 확인"} 이하`.replace(/이하 이하$/, "이하");
  if (group.kind === "criminal") return criminalChipResult(consequence);
  return briefResult(consequence);
}

function accessibleResult(group) {
  return indicatorResult(group);
}

function briefResult(text = "") {
  return text.replace(/\s*(?:에 처한다|을 부과한다|를 부과한다|을 부과할 수 있다|를 부과할 수 있다)\.?\s*$/, "");
}

function criminalChipResult(text = "") {
  return criminalPenaltyResult(text) || "조문 확인";
}

function criminalPenaltyResult(text = "") {
  const penalties = text.match(/(\d+년)\s*이하(?:의)?\s*징역.*?(\d+[억천백십만]*원)\s*이하(?:의)?\s*벌금/);
  return penalties ? `${penalties[1]} 이하 징역 · ${penalties[2]} 이하 벌금` : "";
}

function surchargeChipResult(text = "") {
  const salesRate = text.match(/매출액(?:의)?\s*100분의\s*(\d+)/)?.[1];
  if (salesRate) return `매출액 ${salesRate}% 이하`;
  const fallbackAmount = text.match(/(\d+\s*억\s*원|\d+억원)\s*을?\s*초과하지 아니하는 범위/)?.[1]?.replace(/\s+/g, "");
  return fallbackAmount ? `${fallbackAmount} 이하` : briefResult(text) || "조문 확인";
}

function amountBefore(text, noun) {
  return text.match(new RegExp(`([0-9천백십억만원의\\s]+)\\s*이하의\\s*${noun}`))?.[1]?.trim() ?? "";
}

function locatorLabel(locator = {}) {
  return `${locator.articleNumber ?? ""}${locator.paragraph ? `제${locator.paragraph}항` : ""}${locator.item ? `제${locator.item}호` : ""}${locator.subitem ? `${locator.subitem}목` : ""}`;
}

function domToken(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-");
}
