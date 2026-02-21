import fs from "node:fs";

const inputPath = process.argv[2] || "docs/quality/baselines/eslint-baseline-current.json";
const outputPath = process.argv[3] || "docs/quality/eslint-baseline-summary.md";

if (!fs.existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const report = JSON.parse(raw);

let filesWithMessages = 0;
let totalMessages = 0;
let errors = 0;
let warnings = 0;
const byRule = new Map();
const bySonarRule = new Map();

for (const fileReport of report) {
  const messages = fileReport.messages || [];
  if (messages.length > 0) {
    filesWithMessages += 1;
  }
  for (const msg of messages) {
    totalMessages += 1;
    if (msg.severity === 2) errors += 1;
    if (msg.severity === 1) warnings += 1;
    const rule = msg.ruleId || "unknown";
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
    if (rule.startsWith("sonarjs/")) {
      bySonarRule.set(rule, (bySonarRule.get(rule) || 0) + 1);
    }
  }
}

const topRules = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
const sonarRules = [...bySonarRule.entries()].sort((a, b) => b[1] - a[1]);

const lines = [
  "# ESLint Baseline Summary",
  "",
  `Source: \`${inputPath}\``,
  "",
  "## Totals",
  "",
  `- Files with messages: ${filesWithMessages}`,
  `- Total messages: ${totalMessages}`,
  `- Errors: ${errors}`,
  `- Warnings: ${warnings}`,
  "",
  "## Top Rules",
  "",
  "| Rule | Count |",
  "| --- | ---: |",
  ...topRules.map(([rule, count]) => `| \`${rule}\` | ${count} |`),
  "",
  "## SonarJS Rules",
  "",
  sonarRules.length === 0
    ? "- No SonarJS findings in this baseline."
    : "| Rule | Count |\n| --- | ---: |\n" +
      sonarRules.map(([rule, count]) => `| \`${rule}\` | ${count} |`).join("\n"),
  "",
];

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outputPath}`);
