const METADATA_LABELS = [
  "행정규칙ID",
  "행정규칙일련번호",
  "법제처 표시명",
  "발령번호",
  "발령일자",
  "시행일자",
  "소관부처",
];

export function findDocumentById(documents, id) {
  return documents.find((document) => document.id === id) ?? documents[0];
}

export function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

export function searchArticles(document, query) {
  if (!document?.articles?.length) return [];
  const normalized = normalizeQuery(query);
  if (!normalized) return document.articles;

  return document.articles.filter((article) =>
    [article.number, article.title, article.text].join(" ").toLowerCase().includes(normalized),
  );
}

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(text, query) {
  const source = String(text);
  const characters = normalizeQuery(query)
    .replace(/[\sㆍ·,().<>「」『』\[\]{}'"“”‘’]/g, "")
    .split("");
  if (!characters.length) return escapeHtml(source);

  const ignorable = `[\\sㆍ·,().<>「」『』\\[\\]{}'"“”‘’]*`;
  const pattern = characters.map(escapeRegExp).join(ignorable);
  const matches = source.matchAll(new RegExp(pattern, "gi"));
  let cursor = 0;
  let highlighted = "";

  for (const match of matches) {
    highlighted += escapeHtml(source.slice(cursor, match.index));
    highlighted += `<mark>${escapeHtml(match[0])}</mark>`;
    cursor = match.index + match[0].length;
  }

  return highlighted + escapeHtml(source.slice(cursor));
}

export function splitArticleLines(text) {
  const lines = text.split(/\n+/).flatMap(splitInlineArticleHeading).map(normalizeLegalLine).filter(Boolean);
  const blocks = [];

  for (const line of lines) {
    if (!blocks.length || startsLegalBlock(line)) {
      blocks.push(line);
    } else if (canMergeWithPrevious(blocks[blocks.length - 1])) {
      blocks[blocks.length - 1] = `${blocks[blocks.length - 1]} ${line}`;
    } else {
      blocks.push(line);
    }
  }

  return blocks;
}

function normalizeLegalLine(line) {
  return line.trim().replace(/^([\u2460-\u2473])(?=\S)/u, "$1 ");
}

export function splitArticleBlocks(text) {
  const { metadata, bodyText } = extractLeadingMetadata(text);
  const rawLines = bodyText.split(/\n/);
  const attachmentIndex = rawLines.findIndex(isAttachmentStart);
  const legalText = attachmentIndex === -1 ? bodyText : rawLines.slice(0, attachmentIndex).join("\n");
  const attachmentText = attachmentIndex === -1 ? "" : normalizeAttachmentText(rawLines.slice(attachmentIndex).join("\n"));
  const blocks = splitArticleLines(legalText).map((line) => ({
    kind: "line",
    text: line,
    className: legalBlockClass(line),
  }));

  if (attachmentText) {
    blocks.push({
      kind: "attachment",
      text: attachmentText,
    });
  }

  return {
    metadata,
    blocks,
  };
}

export function normalizeAttachmentText(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/\s+$/g, ""));
  const normalized = [];
  let pendingBlank = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      const previous = lastNonBlank(normalized);
      const next = nextNonBlank(lines, index + 1);
      if (next && (isTableLine(next) || (previous && isTableLine(previous) && isTableLine(next)))) {
        continue;
      }
      pendingBlank = normalized.length > 0;
      continue;
    }

    if (pendingBlank) {
      normalized.push("");
      pendingBlank = false;
    }
    normalized.push(line);
  }

  return normalized.join("\n").trim();
}

function extractLeadingMetadata(text) {
  const metadata = [];
  const lines = text.split(/\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line && metadata.length === 0) {
      index += 1;
      continue;
    }

    const pairs = parseMetadataPairs(line);
    if (!pairs.length) {
      break;
    }

    metadata.push(...pairs);
    index += 1;
  }

  return {
    metadata,
    bodyText: lines.slice(index).join("\n").replace(/^\n+/, ""),
  };
}

function parseMetadataPairs(line) {
  const labelPattern = METADATA_LABELS.map(escapeRegExp).join("|");
  if (!new RegExp(`^(?:${labelPattern})[:：]`).test(line)) {
    return [];
  }

  return [...line.matchAll(new RegExp(`(${labelPattern})[:：]\\s*([\\s\\S]*?)(?=\\s+(?:${labelPattern})[:：]|$)`, "g"))]
    .map((match) => ({
      label: match[1],
      value: match[2].trim(),
    }))
    .filter((item) => item.value);
}

function splitInlineArticleHeading(line) {
  const match = line.match(/^(제\d+조(?:의\d+)?\([^)]*\))\s*(.+)$/);
  if (!match) {
    return [line];
  }
  return [match[1], match[2]];
}

function canMergeWithPrevious(line) {
  return !/^제\d+조(?:의\d+)?\([^)]*\)$/.test(line)
    && !/^<개정\s+\d{4}\.\d{1,2}\.\d{1,2}>$/.test(line);
}

export function legalBlockClass(line) {
  if (/^제\d+장/.test(line)) return "legal-line legal-chapter";
  if (/^제\d+조(?:의\d+)?(?:\(|\s)/.test(line)) return "legal-line legal-article";
  if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(line)) return "legal-line legal-paragraph";
  if (/^\d+(?:의\d+)?\.\s/.test(line)) return "legal-line legal-item";
  if (/^[가-힣]\.\s/.test(line)) return "legal-line legal-subitem";
  if (/^---/.test(line)) return "legal-line legal-divider";
  if (isTableLine(line)) return "legal-line legal-table";
  return "legal-line legal-prose";
}

function startsLegalBlock(line) {
  return [
    /^제\d+장/,
    /^제\d+조(?:의\d+)?(?:\(|\s)/,
    /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/,
    /^\d+(?:의\d+)?\.(?:\s|$)/,
    /^[가-힣]\.(?:\s|$)/,
    /^<개정\s+\d{4}\.\d{1,2}\.\d{1,2}>$/,
    /^---/,
    /^부칙$/,
    /^별표$/,
    /^\[(?:별표|별지|별첨)/,
    /^■\s*(?:별표|별지|별첨)/,
    isTableLine,
  ].some((pattern) => (typeof pattern === "function" ? pattern(line) : pattern.test(line)));
}

function isAttachmentStart(line) {
  const trimmed = line.trim();
  return /^(?:별표|별지|별첨)$/.test(trimmed)
    || /^\[(?:별표|별지|별첨)/.test(trimmed)
    || /^■\s*(?:별표|별지|별첨)/.test(trimmed)
    || /^---\s*(?:별표|별지|별첨)(?:\s|$)/.test(trimmed);
}

function isMetadataLabel(label) {
  return METADATA_LABELS.includes(label);
}

function isTableLine(line) {
  return /^[┌┬┐├┼┤└┴┘│┏┯┓┣┿┫┗┷┛┃┠┨┡┩┢┪┝┥┞┦┟┧┰┸━─]/.test(line);
}

function lastNonBlank(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim()) {
      return lines[index];
    }
  }
  return "";
}

function nextNonBlank(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim()) {
      return lines[index];
    }
  }
  return "";
}
