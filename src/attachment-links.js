import { escapeHtml } from "./law-utils.js";

const ATTACHMENT_REFERENCE_PATTERN = /별지[ \t]*(?:제[ \t]*)?\d+(?:[ \t]*의[ \t]*\d+)?[ \t]*(?:호)?[ \t]*(?:서식)?|별표[ \t]*\d*(?:[ \t]*의[ \t]*\d+)?|별표/g;

function attachmentDocumentId(entry, fallbackDocumentId) {
  return entry.document_id ?? fallbackDocumentId;
}

function decodeAttachmentFileName(entry) {
  const query = entry.source_url?.split("?")[1] ?? "";
  return new URLSearchParams(query).get("flNm") ?? entry.label ?? "";
}

function normalizeReference(value = "") {
  const compact = String(value).replace(/\s+/g, "");
  const appendix = compact.match(/별표(\d+(?:의\d+)?)?/);
  if (appendix) return { kind: "별표", number: appendix[1] ?? "" };
  const form = compact.match(/별지(?:제)?(\d+(?:의\d+)?)(?:호)?(?:서식)?/);
  if (form) return { kind: "별지", number: form[1] };
  return null;
}

function referenceKey(reference) {
  return reference ? `${reference.kind}:${reference.number}` : "";
}

function attachmentReferenceLabel(entry, fallback) {
  const fileName = decodeAttachmentFileName(entry);
  const bracketLabel = fileName.match(/\[(별표(?:\s*\d+(?:\s*의\s*\d+)?)?|별지\s*\d+(?:\s*의\s*\d+)?)\]/)?.[1];
  return bracketLabel || entry.label || fallback;
}

export function buildAttachmentUrl(entry) {
  try {
    const url = new URL(entry?.source_url ?? "");
    if (url.protocol !== "https:") return "";
    if (url.hostname !== "law.go.kr" && url.hostname !== "www.law.go.kr") return "";
    return url.href;
  } catch {
    return "";
  }
}

function addReference(map, kindCounts, reference, entry, url, index) {
  const key = referenceKey(reference);
  if (!key || !url || map.has(key)) return;
  const value = {
    index: Number(entry.attachment_index) || index + 1,
    kind: reference.kind,
    number: reference.number,
    url,
  };
  map.set(key, value);
  const kindEntries = kindCounts.get(reference.kind) ?? [];
  kindEntries.push(value);
  kindCounts.set(reference.kind, kindEntries);
}

export function attachmentReferenceMap({ document, article, attachmentManifest }) {
  const references = new Map();
  const kindCounts = new Map();

  for (const [index, entry] of (attachmentManifest ?? []).entries()) {
    if (attachmentDocumentId(entry, document.id) !== document.id || entry.article_id !== article.id) continue;
    const reference = normalizeReference(attachmentReferenceLabel(entry, `별표·서식 ${index + 1}`));
    addReference(references, kindCounts, reference, entry, buildAttachmentUrl(entry), index);
  }

  references.kindCounts = kindCounts;
  return references;
}

function findReference(references, label) {
  const reference = normalizeReference(label);
  if (!reference) return null;

  const exact = references.get(referenceKey(reference));
  if (exact) return exact;

  const unnumbered = references.get(`${reference.kind}:`);
  if (unnumbered) return unnumbered;

  const sameKind = references.kindCounts?.get(reference.kind) ?? [];
  return reference.number ? null : sameKind.length === 1 ? sameKind[0] : null;
}

export function renderAttachmentReferenceLinks({ html, document, article, attachmentManifest }) {
  const references = attachmentReferenceMap({ document, article, attachmentManifest });
  if (!references.size) return html;

  return html.replace(ATTACHMENT_REFERENCE_PATTERN, (label) => {
    const reference = findReference(references, label);
    if (!reference) return label;
    const escapedLabel = escapeHtml(label);
    return `<button type="button" class="attachment-inline-link" data-attachment-window-url="${escapeHtml(reference.url)}" data-attachment-window-name="attachment-${escapeHtml(document.id)}-${escapeHtml(article.id)}-ref-${reference.index}" aria-label="${escapedLabel} PDF 열기">${escapedLabel}</button>`;
  });
}
