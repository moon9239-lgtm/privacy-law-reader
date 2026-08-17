const CIRCLED_PARAGRAPHS = new Map([
  ["①", "1"], ["②", "2"], ["③", "3"], ["④", "4"], ["⑤", "5"],
  ["⑥", "6"], ["⑦", "7"], ["⑧", "8"], ["⑨", "9"], ["⑩", "10"],
  ["⑪", "11"], ["⑫", "12"], ["⑬", "13"], ["⑭", "14"], ["⑮", "15"],
  ["⑯", "16"], ["⑰", "17"], ["⑱", "18"], ["⑲", "19"], ["⑳", "20"],
]);

const LOCATOR_FIELDS = ["documentId", "articleId", "articleNumber", "paragraph", "item", "subitem"];

export function scopeArticleBlocks(documentId, article, splitResult) {
  const base = {
    documentId,
    articleId: article.id,
    articleNumber: article.number,
    paragraph: null,
    item: null,
    subitem: null,
  };
  let current = { ...base };

  const blocks = splitResult.blocks.map((block) => {
    if (block.kind === "attachment") {
      return { ...block, locator: null };
    }

    const paragraph = CIRCLED_PARAGRAPHS.get(block.text[0]);
    const item = block.text.match(/^(\d+(?:의\d+)?)\.\s/);
    const subitem = block.text.match(/^([가-힣])\.\s/);

    if (/^제\d+조(?:의\d+)?(?:\(|\s|$)/.test(block.text)) {
      current = { ...base };
    } else if (paragraph) {
      current = { ...base, paragraph };
    } else if (item) {
      current = { ...current, item: item[1], subitem: null };
    } else if (subitem) {
      current = { ...current, subitem: subitem[1] };
    }

    return { ...block, locator: { ...current } };
  });

  return { metadata: splitResult.metadata, blocks };
}

export function locatorKey(locator) {
  if (!isLocator(locator)) return null;
  return JSON.stringify(LOCATOR_FIELDS.map((field) => locator[field]));
}

export function locatorDomId(locator) {
  if (!isLocator(locator)) return null;
  const parts = ["legal", safeSegment(locator.documentId), safeSegment(locator.articleId)];
  if (locator.paragraph) parts.push("p", safeSegment(locator.paragraph));
  if (locator.item) parts.push("i", safeSegment(locator.item));
  if (locator.subitem) parts.push("s", safeSegment(locator.subitem));
  return parts.join("-");
}

export function sameLocator(left, right) {
  return isLocator(left)
    && isLocator(right)
    && LOCATOR_FIELDS.every((field) => (left[field] ?? null) === (right[field] ?? null));
}

function isLocator(locator) {
  if (!locator || typeof locator !== "object" || !LOCATOR_FIELDS.every((field) => Object.hasOwn(locator, field))) {
    return false;
  }
  if (![locator.documentId, locator.articleId, locator.articleNumber].every(isNonEmptyString)) {
    return false;
  }
  return [locator.paragraph, locator.item, locator.subitem]
    .every((value) => value === null || isNonEmptyString(value));
}

function safeSegment(value) {
  return `u${Array.from(value, (character) => character.codePointAt(0).toString(16)).join("_")}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
