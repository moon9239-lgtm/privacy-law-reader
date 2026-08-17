const DELEGATION_PATTERNS = {
  decree: /대통령령으로\s*정하는\s*바|대통령령으로\s*정하는\s*기준|대통령령으로\s*정하는|대통령령으로\s*정한|대통령령으로/,
  notice: /(?:보호)?위원회가\s*(?:정하여\s*)?고시(?:로\s*정하는|하는|한|한다)?|정하여\s*고시한다|고시로\s*정하는|고시로\s*정한|고시하는\s*바에\s*따라|고시하는|고시한다/,
};

const MARK_PATTERNS = [
  { kind: "decree", pattern: new RegExp(DELEGATION_PATTERNS.decree.source, "g") },
  { kind: "notice", pattern: new RegExp(DELEGATION_PATTERNS.notice.source, "g") },
];

export function delegationTargetsForLine(line, links = {}) {
  const targets = [];

  if (DELEGATION_PATTERNS.decree.test(line) && links.decrees?.length) {
    targets.push(...selectDelegationLinks(line, links.decrees).map((link) => toDelegationTarget(link, "decree")));
  }

  if (DELEGATION_PATTERNS.notice.test(line) && links.notices?.length) {
    targets.push(...selectDelegationLinks(line, links.notices).map((link) => toDelegationTarget(link, "notice")));
  }

  return targets;
}

function selectDelegationLinks(line, links) {
  const normalizedLine = normalizeForMatch(line);
  const ranked = links
    .map((link, index) => ({
      link,
      index,
      score: (link.score ?? 0) + titleMatchScore(normalizedLine, link.article.title),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const bestScore = ranked[0]?.score ?? 0;
  const threshold = bestScore * 0.82;

  return ranked.filter((item) => item.score >= threshold).map((item) => item.link);
}

function titleMatchScore(normalizedLine, title) {
  const ignored = new Set(["개인정보", "개인정보의", "기준", "사항", "조치", "등에", "관한"]);
  return title
    .split(/[^0-9A-Za-z가-힣]+/)
    .filter((token) => token.length >= 2 && !ignored.has(token))
    .reduce((score, token) => score + (normalizedLine.includes(normalizeForMatch(token)) ? 500 : 0), 0);
}

function normalizeForMatch(value) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

export function markDelegationPhrases(html) {
  return MARK_PATTERNS.reduce(
    (marked, { kind, pattern }) =>
      marked.replace(pattern, (match) => `<span class="delegation-phrase is-${kind}">${match}</span>`),
    html,
  );
}

function toDelegationTarget(link, kind) {
  const isNotice = link.document.id === "privacy-notice";
  return {
    kind,
    documentId: link.document.id,
    articleId: link.article.id,
    articleNumber: link.article.number,
    articleTitle: link.article.title,
    confidence: link.confidence,
    label: isNotice ? `고시 ${link.article.title} 열기` : `대통령령 ${link.article.number} 열기`,
  };
}
