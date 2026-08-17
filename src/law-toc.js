const DOCUMENT_STRUCTURES = {
  "privacy-law": [
    { number: "제1장", title: "총칙", startsAt: "제1조" },
    { number: "제2장", title: "개인정보 보호정책의 수립 등", startsAt: "제7조" },
    {
      number: "제3장",
      title: "개인정보의 처리",
      startsAt: "제15조",
      sections: [
        { number: "제1절", title: "개인정보의 수집, 이용, 제공 등", startsAt: "제15조" },
        { number: "제2절", title: "개인정보의 처리 제한", startsAt: "제23조" },
        { number: "제3절", title: "가명정보의 처리에 관한 특례", startsAt: "제28조의2" },
        { number: "제4절", title: "개인정보의 국외 이전", startsAt: "제28조의8" },
      ],
    },
    { number: "제4장", title: "개인정보의 안전한 관리", startsAt: "제29조" },
    { number: "제5장", title: "정보주체의 권리 보장", startsAt: "제35조" },
    { number: "제6장", title: "삭제", startsAt: "제39조의3" },
    { number: "제7장", title: "개인정보 분쟁조정위원회", startsAt: "제40조" },
    { number: "제8장", title: "개인정보 단체소송", startsAt: "제51조" },
    { number: "제9장", title: "보칙", startsAt: "제58조" },
    { number: "제10장", title: "벌칙", startsAt: "제70조" },
  ],
  "privacy-decree": [
    { number: "제1장", title: "총칙", startsAt: "제1조" },
    { number: "제2장", title: "개인정보 보호위원회", startsAt: "제4조" },
    { number: "제3장", title: "기본계획 및 시행계획의 수립절차", startsAt: "제11조" },
    { number: "제4장", title: "개인정보의 처리", startsAt: "제14조의2" },
    { number: "제4장의2", title: "가명정보의 처리에 관한 특례", startsAt: "제29조의2" },
    { number: "제4장의3", title: "개인정보의 국외 이전", startsAt: "제29조의7" },
    { number: "제5장", title: "개인정보의 안전한 관리", startsAt: "제30조" },
    { number: "제6장", title: "정보주체의 권리 보장", startsAt: "제41조" },
    { number: "제6장의2", title: "삭제", startsAt: "제48조의2" },
    { number: "제7장", title: "개인정보 분쟁조정", startsAt: "제48조의14" },
    { number: "제8장", title: "보칙 및 벌칙", startsAt: "제58조" },
  ],
};

export function buildDocumentToc(document) {
  const articles = document?.articles ?? [];
  const structure = DOCUMENT_STRUCTURES[document?.id];

  if (!structure?.length) {
    return [{ number: "", title: "", articles: [...articles], sections: [] }];
  }

  const chapters = structure.map((chapter) => ({
    number: chapter.number,
    title: chapter.title,
    startsAt: chapter.startsAt,
    articles: [],
    sections: (chapter.sections ?? []).map((section) => ({
      number: section.number,
      title: section.title,
      startsAt: section.startsAt,
      articles: [],
    })),
  }));

  for (const article of articles) {
    const articleValue = articleOrder(article.number);
    const chapter = lastStartedGroup(chapters, articleValue);
    if (!chapter) continue;

    const section = lastStartedGroup(chapter.sections, articleValue);
    (section?.articles ?? chapter.articles).push(article);
  }

  return chapters.filter((chapter) => (
    chapter.articles.length > 0 || chapter.sections.some((section) => section.articles.length > 0)
  ));
}

export function findArticleTocContext(document, article) {
  if (!article) return null;

  for (const chapter of buildDocumentToc(document)) {
    if (chapter.articles.some((candidate) => candidate.id === article.id)) {
      return { chapter, section: null };
    }
    const section = chapter.sections.find((candidate) => (
      candidate.articles.some((item) => item.id === article.id)
    ));
    if (section) return { chapter, section };
  }

  return null;
}

function lastStartedGroup(groups, articleValue) {
  let active = null;
  for (const group of groups) {
    if (articleOrder(group.startsAt) > articleValue) break;
    active = group;
  }
  return active;
}

function articleOrder(value) {
  const match = /^제(\d+)조(?:의(\d+))?$/.exec(String(value ?? ""));
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 1000 + Number(match[2] ?? 0);
}
