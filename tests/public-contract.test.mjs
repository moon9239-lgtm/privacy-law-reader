import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const bannedPaths = [
  "assets/legal-pdfs",
  "tmp",
  ".codex",
  ".openai",
  ".superpowers",
  "supabase",
  "tools",
  "brand_atomic_system",
];

const publicDocuments = [
  "README.md",
  "docs/architecture.md",
  "docs/getting-started.md",
  "docs/adapting-your-service.md",
  "NOTICE.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".env.example",
  ".github/workflows/ci.yml",
];

test("private paths are absent", () => {
  for (const path of bannedPaths) {
    assert.equal(existsSync(path), false, `${path} must not exist`);
  }
});

test("public repository documents exist", () => {
  for (const path of publicDocuments) {
    assert.equal(existsSync(path), true, `${path} must exist`);
  }
});

test("local deployment and environment files are ignored", async () => {
  const gitignore = await readFile(".gitignore", "utf8");

  assert.match(gitignore, /^\.vercel\/$/m);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^dist\/$/m);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\*\.local$/m);
  assert.match(gitignore, /^\.tmp\/$/m);
  assert.doesNotMatch(gitignore, /^!/m);
});

test("public docs replace placeholders with required beginner guidance", async () => {
  const readme = await readFile("README.md", "utf8");
  const gettingStarted = await readFile("docs/getting-started.md", "utf8");
  const architecture = await readFile("docs/architecture.md", "utf8");
  const adapting = await readFile("docs/adapting-your-service.md", "utf8");

  for (const content of [readme, gettingStarted, architecture, adapting]) {
    assert.doesNotMatch(content, /Placeholder|Task 3 will replace/i);
  }

  assert.match(readme, /npm\.cmd test/);
  assert.match(readme, /npm\.cmd run build/);
  assert.match(readme, /npx serve dist/);
  assert.match(readme, /공식 출처에서 현재 유효한 원문과 최신 개정 여부를 확인/);

  assert.match(gettingStarted, /Node\.js 22/);
  assert.match(gettingStarted, /Build Command: `npm run build`/);
  assert.match(gettingStarted, /Output Directory: `dist`/);
  assert.match(gettingStarted, /프로젝트 ID.*배포 URL.*커밋하지/);

  assert.match(architecture, /```mermaid/);
  assert.match(architecture, /사용자/);
  assert.match(architecture, /보-편 리더/);
  assert.match(architecture, /저장소의 조문 데이터와 공식 출처 목록/);
  assert.match(architecture, /법령정보센터 원문/);
  assert.match(architecture, /법령 MCP 또는 공식 API/);
  assert.match(architecture, /개정 확인 작업/);
  assert.match(architecture, /선택적인 갱신 시점 도구/);

  assert.match(adapting, /다른 분야의 데이터/);
  assert.match(adapting, /MCP 또는 API/);
  assert.match(adapting, /PDF 파일 자체를 저장소에 넣지 않습니다/);
  assert.match(adapting, /비공개 확장/);
});

test("license, notice, contribution, and security policies state public boundaries", async () => {
  const license = await readFile("LICENSE", "utf8");
  const notice = await readFile("NOTICE.md", "utf8");
  const contributing = await readFile("CONTRIBUTING.md", "utf8");
  const security = await readFile("SECURITY.md", "utf8");
  const envExample = await readFile(".env.example", "utf8");

  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 moon9239-lgtm/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);

  assert.match(notice, /applies only to this repository's code/);
  assert.match(notice, /does not apply to statute text, official metadata, or linked external documents/);
  assert.match(notice, /check the official original/);

  assert.match(contributing, /official URL/);
  assert.match(contributing, /date you checked/);
  assert.match(contributing, /test result/);

  assert.match(security, /Do not post tokens, personal data/);
  assert.match(security, /exploit instructions/);
  assert.match(security, /GitHub private vulnerability reporting/);

  for (const line of envExample.split(/\r?\n/).filter(Boolean)) {
    assert.match(line, /^#/);
    assert.doesNotMatch(line, /=/);
  }
});

test("vercel and ci stay static, public, and non-mutating", async () => {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  const ci = await readFile(".github/workflows/ci.yml", "utf8");

  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "dist");
  assert.equal("rewrites" in vercel, false);
  assert.equal("env" in vercel, false);
  assert.equal("routes" in vercel, false);
  assert.doesNotMatch(JSON.stringify(vercel), /projectId|orgId|analytics|endpoint|api\//i);

  assert.match(ci, /^on:\r?\n  push:\r?\n  pull_request:/m);
  assert.match(ci, /node-version: 22/);
  assert.match(ci, /run: npm ci/);
  assert.match(ci, /run: npm test/);
  assert.match(ci, /run: npm run build/);
  assert.match(ci, /permissions:\r?\n  contents: read/);
  assert.doesNotMatch(ci, /secrets\./i);
  assert.doesNotMatch(ci, /schedule:/i);
  assert.doesNotMatch(ci, /gh\s+/i);
  assert.doesNotMatch(ci, /deploy/i);
});

test("attachment source manifest keeps only public official-link fields", async () => {
  const manifest = JSON.parse(await readFile("assets/legal-sources/attachments.json", "utf8"));
  const allowedKeys = ["article_id", "attachment_index", "document_id", "label", "source_url"];

  assert.ok(manifest.length > 0);
  for (const entry of manifest) {
    assert.deepEqual(Object.keys(entry).sort(), allowedKeys);
    assert.match(entry.source_url, /^https:\/\/www?\.law\.go\.kr\//);
  }
});

test("public HTML does not expose personal contact links", async () => {
  const html = await readFile("index.html", "utf8");

  assert.doesNotMatch(html, /moon9239@gmail\.com/i);
  assert.doesNotMatch(html, /mailto:/i);
});

test("reader keeps the public visitor summary connected", async () => {
  const html = await readFile("index.html", "utf8");
  const styles = await readFile("src/styles.css", "utf8");

  assert.match(html, /id="publicVisitorSummary"/);
  assert.match(html, /src="\.\/src\/analytics-loader\.js/);
  assert.equal(existsSync("src/analytics-loader.js"), true);
  assert.equal(existsSync("src/public-visitor-counter.js"), true);
  assert.equal(existsSync("api/public-analytics.js"), true);
  assert.match(styles, /\.header-meta-row \{ position: absolute; top: 4px; right: 10px; width: 148px;/);
  assert.match(styles, /\.public-visitor-summary \{[^}]*width: 148px;[^}]*max-width: 148px;/);
  assert.match(styles, /\.visitor-icon \{ width: 12px; height: 12px;/);
});

