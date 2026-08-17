const PHRASE_SOURCES = {
  decree: "대통령령으로(?:\\s*정(?:하는|한다|한)(?:\\s+(?:바|사항|기준|기관|장치|경우|방법|절차|범위|직))?)?",
  notice: "(?:보호)?위원회가\\s*(?:정하여\\s*)?고시(?:하여야\\s*한다|로\\s*정하는|하는|한다|한)?(?:\\s*(?:바|사항|기준|방법|자))?|정하여\\s*고시한다|고시로\\s*정(?:하는|한)(?:\\s*(?:바|사항|기준|방법))?|고시하는\\s*바에\\s*따라|고시하여야\\s*한다|고시한다",
};

const KIND_CONFIG = {
  decree: { documentId: "privacy-decree", unresolvedLabel: "연결 시행령 없음" },
  notice: { documentId: "privacy-notice", unresolvedLabel: "연결 고시 없음" },
};

export function renderDelegationCues(html, kind, targets = [], sourceArticleId = "", sourceLocator = null) {
  const config = KIND_CONFIG[kind];
  if (!config) return html;

  const matches = phraseMatches(visibleText(html), kind);
  if (!matches.length) return html;
  const validTargets = targets.filter((target) => target?.documentId === config.documentId && target?.articleId);
  const sourceContext = sourceContextForLocator(html, sourceLocator);
  const offsets = visibleOffsets(html);

  return matches.reverse().reduce((rendered, match) => {
    const matchedTargets = selectTargetsForPhrase(match[0], validTargets);
    const targetIds = [...new Set(matchedTargets.map((target) => target.articleId))];
    const documentId = matchedTargets[0]?.documentId ?? config.documentId;
    const start = includeOpeningTags(rendered, offsets[match.index]);
    const end = offsets[match.index + match[0].length - 1] + 1;
    const phrase = rendered.slice(start, end);
    const cue = `<span class="delegation-cue delegation-cue--${kind}">${phrase}</span>`;
    const action = targetIds.length
      ? `<button type="button" class="delegation-action" data-link-document-id="${escapeAttribute(documentId)}" data-link-article-ids="${escapeAttribute(targetIds.join(","))}" data-link-source-context="${escapeAttribute(sourceContext)}"${sourceArticleId ? ` data-source-article-id="${escapeAttribute(sourceArticleId)}"` : ""} aria-label="${escapeAttribute(`${match[0]} 연결 조문 열기`)}">${cue}</button>`
      : `<span class="delegation-action delegation-action--unresolved" title="${escapeAttribute(config.unresolvedLabel)}" aria-label="${escapeAttribute(config.unresolvedLabel)}">${cue}<span class="delegation-unresolved" role="status">${config.unresolvedLabel}</span></span>`;
    return `${rendered.slice(0, start)}${action}${rendered.slice(end)}`;
  }, html);
}

function selectTargetsForPhrase(phrase, targets) {
  if (targets.length < 2) return targets;
  const normalizedPhrase = normalizeDelegationText(phrase);
  if (!normalizedPhrase) return targets;

  const phraseMatches = targets.filter((target) => {
    const targetText = target.articleText ?? target.article?.text ?? "";
    return normalizeDelegationText(targetText).includes(normalizedPhrase);
  });
  return phraseMatches.length ? phraseMatches : targets;
}

function normalizeDelegationText(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[「」『』"'“”‘’.,。，ㆍ·:]/g, "");
}

function sourceContextForLocator(html, locator) {
  const text = visibleText(html);
  const marker = locator?.paragraph ? "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"[Number(locator.paragraph) - 1] ?? "" : "";
  if (locator?.item) return `${marker ? `${marker} ` : ""}${locator.item}. ${text}`;
  if (marker) return `${marker} ${text}`;
  return text;
}

export function delegationAudit(documents, resolver) {
  const law = documents.find((document) => document.id === "privacy-law");
  if (!law) return [];

  return law.articles.flatMap((article) => {
    const links = resolver?.linksFor?.(law.id, article.id) ?? {};
    return Object.keys(KIND_CONFIG).flatMap((kind) => {
      const targetIds = [...new Set((links[`${kind}s`] ?? []).map((link) => link.articleId).filter(Boolean))];
      return phraseMatches(article.text ?? "", kind).map((match) => ({
        articleId: article.id,
        kind,
        phrase: match[0],
        targetIds: [...targetIds],
        status: targetIds.length ? "resolved" : "unresolved",
      }));
    });
  });
}

function includeOpeningTags(html, start) {
  const prefix = html.slice(0, start);
  const tags = prefix.match(/(?:<[^/!][^>]*>)+$/);
  return tags ? start - tags[0].length : start;
}

function phraseMatches(text, kind) {
  return [...text.matchAll(new RegExp(PHRASE_SOURCES[kind], "g"))];
}

function visibleText(html) {
  let text = "";
  let insideTag = false;
  for (const character of html) {
    if (character === "<") insideTag = true;
    if (!insideTag) text += character;
    if (character === ">") insideTag = false;
  }
  return text;
}

function visibleOffsets(html) {
  const offsets = [];
  let insideTag = false;
  for (let index = 0; index < html.length; index += 1) {
    if (html[index] === "<") insideTag = true;
    if (!insideTag) offsets.push(index);
    if (html[index] === ">") insideTag = false;
  }
  return offsets;
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
