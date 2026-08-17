import { splitArticleBlocks } from "./law-utils.js";
import { locatorKey, scopeArticleBlocks } from "./legal-locators.js";

const PRIMARY_SANCTION_SOURCES = {
  "law-64-2": "surcharge", "law-70": "criminal", "law-71": "criminal",
  "law-72": "criminal", "law-73": "criminal", "law-75": "administrative-fine",
};
const AUXILIARY_SANCTION_SOURCES = ["law-74", "law-74-2", "law-76"];
const SANCTION_PROCEDURE_SOURCES = ["decree-60-2", "decree-60-3", "decree-60-4", "decree-60-5", "decree-63", "notice-86676"];
const DISPLAY_ORDER = ["criminal", "administrative-fine", "surcharge"];

export function buildSanctionIndex(documents) {
  const law = documents.find((document) => document.id === "privacy-law");
  const articles = new Map(law?.articles.map((article) => [article.id, article]) ?? []);
  const byTarget = new Map();
  const sources = new Map();

  for (const [sourceArticleId, kind] of Object.entries(PRIMARY_SANCTION_SOURCES)) {
    const article = articles.get(sourceArticleId);
    if (!article) continue;
    sources.set(sourceArticleId, article);
    const blocks = scopeArticleBlocks(law.id, article, splitArticleBlocks(article.text)).blocks;
    let consequenceText = "";
    for (const block of blocks) {
      if (block.kind === "attachment") continue;
      if (isConsequence(block.text)) consequenceText = block.text;
      if (!block.locator?.item) continue;
      const override = sourceOverride(sourceArticleId, block.locator.item, articles);
      const targets = override ?? extractTargets(block.text, articles);
      for (const target of targets) {
        const relation = {
          id: `${sourceArticleId}:${block.locator.paragraph ?? "0"}:${block.locator.item}:${locatorKey(target)}`,
          target,
          source: { ...block.locator },
          kind,
          role: sourceArticleId === "law-64-2" && block.locator.item === "9" ? "conditional" : "direct",
          consequenceText,
          conditionText: conditionText(sourceArticleId, block.text, consequenceText),
          citationText: block.text,
          sourceDocumentId: law.id,
          sourceArticleId,
          auxiliaries: [],
          procedures: [],
        };
        const key = locatorKey(target);
        byTarget.set(key, [...(byTarget.get(key) ?? []), relation]);
      }
    }
  }

  const auxiliaries = collectRules(documents, AUXILIARY_SANCTION_SOURCES);
  const procedures = collectRules(documents, SANCTION_PROCEDURE_SOURCES);
  return { byTarget, sources, auxiliaries, procedures };
}

export function sanctionsForScope(index, locator) {
  return clone(index?.byTarget.get(locatorKey(locator)) ?? []);
}

export function groupSanctionsForDisplay(relations) {
  const groups = new Map();
  for (const relation of relations) {
    const key = `${relation.kind}:${relation.sourceArticleId}`;
    if (!groups.has(key)) groups.set(key, { kind: relation.kind, sourceArticleId: relation.sourceArticleId, relations: [] });
    groups.get(key).relations.push(clone(relation));
  }
  return [...groups.values()].sort((a, b) => DISPLAY_ORDER.indexOf(a.kind) - DISPLAY_ORDER.indexOf(b.kind)
    || sourceNumber(a.sourceArticleId).localeCompare(sourceNumber(b.sourceArticleId), "ko", { numeric: true })
    || sourceNumber(a.relations[0].source.item ?? "").localeCompare(sourceNumber(b.relations[0].source.item ?? ""), "ko", { numeric: true }));
}

export function sanctionDetailForGroup(index, group) {
  const relation = group.relations[0];
  const auxiliaries = relation.kind === "criminal"
    ? index.auxiliaries.filter((rule) => rule.sourceArticleId === "law-74" || (rule.sourceArticleId === "law-74-2" && rule.text.includes(relation.sourceArticleId.replace("law-", "제") + "조")))
    : [];
  const procedures = index.procedures.filter((rule) => relation.kind === "surcharge"
    ? /^decree-60-[2-5]$/.test(rule.sourceArticleId) || rule.sourceArticleId === "notice-86676"
    : relation.kind === "administrative-fine" && rule.sourceArticleId === "decree-63");
  const siblingKinds = new Set(sanctionsForScope(index, relation.target).map((item) => item.kind));
  const exclusions = siblingKinds.has("surcharge") && siblingKinds.has("administrative-fine")
    ? index.auxiliaries.filter((rule) => rule.sourceArticleId === "law-76").map((rule) => ({ ...rule, label: "동일 행위 법정 배제 규정" }))
    : [];
  return clone({ kind: group.kind, sourceArticleId: group.sourceArticleId, consequenceText: relation.consequenceText, conditionText: relation.conditionText, citationText: relation.citationText, auxiliaries, procedures, exclusions });
}

function isConsequence(text) {
  return /(?:징역|벌금|과태료|과징금).*(?:처한다|부과한다|부과할 수 있다)/.test(text);
}

function conditionText(sourceArticleId, citation, consequence) {
  if (sourceArticleId === "law-64-2") {
    const fallback = consequence.match(/다만,.*20억원.*$/)?.[0] ?? "";
    const safeHarbor = citation.match(/\([^)]*제외한다\)/)?.[0] ?? "";
    return [citation, safeHarbor, fallback].filter(Boolean).join(" ");
  }
  return citation.replace(/^\d+(?:의\d+)?\.\s*/, "");
}

function sourceOverride(sourceArticleId, item, articles) {
  if (sourceArticleId === "law-71" && item === "1") return targetIfPresent(articles.get("law-17"), "1", "1");
  if (sourceArticleId === "law-64-2" && item === "9") return targetIfPresent(articles.get("law-29"), null, null);
  return null;
}

function targetIfPresent(article, paragraph, item) {
  return article ? [makeTarget(article, paragraph, item)] : [];
}

function extractTargets(text, articles) {
  const local = text.replace(/\([^)]*준용[^)]*\)/g, "");
  const externalRanges = [...local.matchAll(/「[^」]+」[^제]*(제\d+조(?:의\d+)?(?:제\d+항)?(?:제\d+호)?)/g)].map((match) => match.index + match[0].lastIndexOf(match[1]));
  const targets = [];
  for (const match of local.matchAll(/제(\d+)(?:조의(\d+)|조)(?:제(\d+)항)?(?:제(\d+(?:의\d+)?)호)?/g)) {
    if (externalRanges.includes(match.index)) continue;
    const id = `law-${match[1]}${match[2] ? `-${match[2]}` : ""}`;
    const article = articles.get(id);
    if (!article) continue;
    targets.push(makeTarget(article, match[3] ?? null, match[4] ?? null));
  }
  return targets;
}

function makeTarget(article, paragraph, item) {
  return { documentId: "privacy-law", articleId: article.id, articleNumber: article.number, paragraph, item, subitem: null };
}

function collectRules(documents, ids) {
  const wanted = new Set(ids);
  return documents.flatMap((document) => (document.articles ?? [])
    .filter((article) => wanted.has(article.id))
    .map((article) => ({ sourceDocumentId: document.id, sourceArticleId: article.id, text: article.text })));
}

function sourceNumber(id) { return id.replace(/^[^-]+-/, "").replaceAll("-", "."); }

function clone(value) { return structuredClone(value); }
