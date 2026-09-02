#!/usr/bin/env node
/**
 * docs-check — the documentation gate.
 *
 * Every ID defined in a Markdown document must also be anchorable in its HTML
 * rendering, and vice versa. If they drift, this exits non-zero.
 *
 * Run:  node scripts/docs-check.mjs
 * CI:   part of `npm run docs:check`, wired into the pipeline in US-1.01.
 *
 * Why this exists: cross-document traceability is only worth having if it is
 * true. A hand-maintained pair of documents diverges within about three weeks.
 * See CLAUDE.md § "The documentation gate".
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => resolve(root, p);

/** Markdown source → HTML rendering. Add a row here when a doc gains a page. */
const PAIRS = [
  { md: "docs/01-TECHNICAL-ARCHITECTURE.md", html: "docs/html/architecture.html" },
  { md: "docs/02-FUNCTIONAL-SPECIFICATION.md", html: "docs/html/functional.html" },
  { md: "docs/03-SPRINT-PLAN.md", html: "docs/html/sprints.html" },
];

const ID = String.raw`ADR-\d{3}|NFR-\d{3}|RISK-\d{3}|TA-[A-Z]{3}-\d{3}|FR-[A-Z]{3}-\d{3}|US-\d\.\d{2}`;

/** An ID is *defined* in Markdown by a heading, or by being the first cell of a table row. */
function definedInMarkdown(text) {
  const out = new Set();
  const heading = new RegExp(String.raw`^#{2,4}\s+\`?(${ID})\`?`, "gm");
  const rowCell = new RegExp(String.raw`^\|\s*\`(${ID})\`\s*\|`, "gm");
  for (const re of [heading, rowCell]) {
    let m;
    while ((m = re.exec(text)) !== null) out.add(m[1]);
  }
  return out;
}

/** An ID is *anchorable* in HTML when something carries it as an id attribute. */
function definedInHtml(text) {
  const out = new Set();
  const re = new RegExp(String.raw`\bid="(${ID})"`, "g");
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return out;
}

const sorted = (s) => [...s].sort();
let failures = 0;

for (const { md, html } of PAIRS) {
  const mdPath = P(md);
  const htmlPath = P(html);

  if (!existsSync(mdPath)) { console.error(`MISSING  ${md}`); failures++; continue; }
  if (!existsSync(htmlPath)) { console.error(`MISSING  ${html}  (rendering of ${md})`); failures++; continue; }

  const inMd = definedInMarkdown(readFileSync(mdPath, "utf8"));
  const inHtml = definedInHtml(readFileSync(htmlPath, "utf8"));

  const onlyMd = sorted(inMd).filter((id) => !inHtml.has(id));
  const onlyHtml = sorted(inHtml).filter((id) => !inMd.has(id));

  if (onlyMd.length === 0 && onlyHtml.length === 0) {
    console.log(`ok       ${md}  ↔  ${html}   (${inMd.size} ids)`);
    continue;
  }

  failures++;
  console.error(`DRIFT    ${md}  ↔  ${html}`);
  if (onlyMd.length) console.error(`  in Markdown but not anchorable in HTML: ${onlyMd.join(", ")}`);
  if (onlyHtml.length) console.error(`  anchorable in HTML but not defined in Markdown: ${onlyHtml.join(", ")}`);
}

if (failures) {
  console.error(`\ndocs-check failed. Update both halves — see CLAUDE.md § "The documentation gate".`);
  process.exit(1);
}
console.log("\ndocs-check passed.");
