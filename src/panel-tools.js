function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizePanelFocus(focusedDocumentId, visibleDocumentIds) {
  return visibleDocumentIds.includes(focusedDocumentId) ? focusedDocumentId : null;
}

export function panelFocusDocumentIds(primaryDocumentId) {
  if (primaryDocumentId === "privacy-notice") return ["privacy-notice"];
  if (primaryDocumentId === "privacy-decree") return ["privacy-decree", "privacy-notice"];
  return ["privacy-law", "privacy-decree", "privacy-notice"];
}

export function renderPanelTools({ documentId, label, focused = false, canFocus = true, officialUrl = "", canCopy = false }) {
  if (!canFocus) return "";
  const escapedDocumentId = escapeHtml(documentId);
  const escapedLabel = escapeHtml(label);
  const action = focused
    ? `<button type="button" data-panel-action="compare" aria-label="${escapedLabel} 비교 보기로 돌아가기">원래대로</button>`
    : `<button type="button" data-panel-action="focus" aria-label="${escapedLabel} 넓게보기">넓게보기</button>`;

  return `<div class="panel-tools" data-panel-document-id="${escapedDocumentId}" aria-label="${escapedLabel} 보기 도구">${action}</div>`;
}
