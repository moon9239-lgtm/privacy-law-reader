const DOCUMENT_ALIASES = {
  "privacy-law": ["법", "개인정보 보호법"],
  "privacy-decree": ["영", "시행령", "개인정보 보호법 시행령"],
};

const LAW_DECREE_OVERRIDES = {
  // 제2조 제6호나목·제7호·제7호의2의 위임은 시행령 제2조·제3조가 직접 집행한다.
  // 다른 시행령 조문에 일반적으로 등장하는 「법 제2조」 인용은 이 연결에 포함하지 않는다.
  "law-2": ["decree-2", "decree-3"],
  "law-50": ["decree-57"],
};

export function buildArticleLinks(documents, sourceDocument, sourceArticle) {
  const links = {
    laws: [],
    decrees: [],
    notices: [],
  };

  if (!sourceDocument || !sourceArticle) {
    return links;
  }

  const law = documents.find((document) => document.id === "privacy-law");
  const decree = documents.find((document) => document.id === "privacy-decree");
  const notice = documents.find((document) => document.id === "privacy-notice");

  if (sourceDocument.id === "privacy-law") {
    const referencedDecrees = findReferencingArticles(decree, "privacy-law", sourceArticle.number)
      .map((item) => withReason(item, `${sourceArticle.number}의 대통령령 위임/인용`));
    const delegatedDecrees = overrideLinks(decree, LAW_DECREE_OVERRIDES[sourceArticle.id])
      .map((item) => withReason(item, `${sourceArticle.number}의 조정절차 위임`));
    const candidateDecrees = uniqueLinks([...referencedDecrees, ...delegatedDecrees]);
    links.decrees = LAW_DECREE_OVERRIDES[sourceArticle.id]
      ? candidateDecrees.filter((item) => LAW_DECREE_OVERRIDES[sourceArticle.id].includes(item.article.id))
      : candidateDecrees;

    const directNotices = findReferencingArticles(notice, "privacy-law", sourceArticle.number)
      .map((item) => withReason(item, `${sourceArticle.number}를 직접 근거로 둔 고시`));
    const viaDecreeNotices = directNotices.length
      ? links.decrees.flatMap((decreeLink) =>
        findReferencingArticles(notice, "privacy-decree", decreeLink.article.number)
          .map((item) => withReason(item, `${decreeLink.article.number}에서 이어지는 고시`, decreeLink.article)),
      )
      : [];
    links.notices = uniqueLinks([...directNotices, ...viaDecreeNotices]);
  }

  if (sourceDocument.id === "privacy-decree") {
    links.laws = findReferencedParents(law, sourceDocument.id, sourceArticle.text)
      .map((item) => withReason(item, `${sourceArticle.number} 본문에서 인용한 법률 조문`));
    links.notices = findReferencingArticles(notice, "privacy-decree", sourceArticle.number)
      .map((item) => withReason(item, `${sourceArticle.number}의 고시 위임/인용`));
  }

  if (sourceDocument.id === "privacy-notice") {
    links.laws = findReferencedParents(law, "privacy-law", sourceArticle.text)
      .map((item) => withReason(item, "이 고시 본문에서 인용한 법률 조문"));
    links.decrees = findReferencedParents(decree, "privacy-decree", sourceArticle.text)
      .map((item) => withReason(item, "이 고시 본문에서 인용한 시행령 조문"));
  }

  return links;
}

function overrideLinks(document, articleIds = []) {
  if (!document?.articles?.length) return [];
  return articleIds.flatMap((articleId, order) => {
    const article = document.articles.find((item) => item.id === articleId);
    return article ? [{ document, article, order, score: 1000 }] : [];
  });
}

function findReferencingArticles(document, targetDocumentId, articleNumber) {
  if (!document?.articles?.length) {
    return [];
  }

  return document.articles
    .filter((article) => referencesArticle(article.text, targetDocumentId, articleNumber))
    .map((article, order) => ({
      document,
      article,
      order,
      score: referenceScore(article.text, targetDocumentId, articleNumber),
    }))
    .sort(compareLinks);
}

function findReferencedParents(document, targetDocumentId, text) {
  if (!document?.articles?.length) {
    return [];
  }

  return document.articles
    .filter((article) => referencesArticle(text, targetDocumentId, article.number))
    .map((article, order) => ({
      document,
      article,
      order,
      score: referenceScore(text, targetDocumentId, article.number),
    }))
    .sort(compareLinks);
}

function referencesArticle(text, targetDocumentId, articleNumber) {
  if (!text || !articleNumber) {
    return false;
  }

  const numberPattern = articleNumberPattern(articleNumber);
  const aliases = DOCUMENT_ALIASES[targetDocumentId] ?? [];
  if (aliases.some((alias) => new RegExp(`${escapeRegExp(alias)}\\s*${numberPattern}`).test(text))) {
    return true;
  }

  if (targetDocumentId === "privacy-decree") {
    return referencesDecreeArticle(text, numberPattern);
  }

  if (targetDocumentId === "privacy-law") {
    return referencesLawArticle(text, numberPattern);
  }

  return false;
}

function referencesLawArticle(text, numberPattern) {
  const direct = new RegExp(`법\\s*${numberPattern}`);
  const named = new RegExp(`개인정보\\s*보호법[\\s\\S]{0,80}${numberPattern}`);
  return direct.test(text) || named.test(text);
}

function referencesDecreeArticle(text, numberPattern) {
  const direct = new RegExp(`(?:영|시행령)\\s*${numberPattern}`);
  const nearby = new RegExp(`(?:영|시행령)[\\s\\S]{0,140}${numberPattern}`);
  return direct.test(text) || nearby.test(text);
}

function articleNumberPattern(articleNumber) {
  const escaped = escapeRegExp(articleNumber);
  return articleNumber.includes("의") ? escaped : `${escaped}(?!의\\d)`;
}

function referenceScore(text, targetDocumentId, articleNumber) {
  const numberPattern = articleNumberPattern(articleNumber);
  const aliases = DOCUMENT_ALIASES[targetDocumentId] ?? [];
  const patterns = [
    ...aliases.map((alias) => `${escapeRegExp(alias)}\\s*${numberPattern}`),
    numberPattern,
  ];
  let best = -1;

  for (const pattern of patterns) {
    const match = new RegExp(pattern).exec(text);
    if (!match) {
      continue;
    }
    const index = match.index;
    const before = text.slice(Math.max(0, index - 90), index);
    const after = text.slice(index, index + 100);
    let score = Math.max(0, 1000 - index);
    if (index < 240) score += 1000;
    if (/에 따라|따른|정하는|위임/.test(after)) score += 220;
    if (/"\s*$/.test(before) || /이 경우[^.]{0,80}$/.test(before)) score -= 900;
    best = Math.max(best, score);
  }

  return best;
}

function compareLinks(a, b) {
  return b.score - a.score || a.order - b.order;
}

function withReason(link, reason, via = null) {
  return {
    ...link,
    reason,
    via,
    confidence: linkConfidence(link, reason, via),
  };
}

function linkConfidence(link, reason, via) {
  if (via) {
    return {
      level: "via",
      label: "시행령 경유",
      description: "선택한 조문에서 연결된 시행령을 거쳐 이어지는 고시입니다.",
    };
  }

  if (/직접 근거/.test(reason)) {
    return {
      level: "direct",
      label: "직접 근거",
      description: "본문에서 선택한 조문을 직접 근거로 둔 연결입니다.",
    };
  }

  if (/위임\/인용|본문에서 인용/.test(reason) || link.score >= 1000) {
    return {
      level: "explicit",
      label: "명시 인용",
      description: "본문에서 해당 조문 번호 또는 위임 문구가 확인된 연결입니다.",
    };
  }

  return {
    level: "candidate",
    label: "수동 확인",
    description: "원문 근거를 확인하세요.",
  };
}

function uniqueLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.document.id}:${link.article.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
