import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { makeBadge } from "badge-maker"

const summaryPath = resolve(process.cwd(), "coverage", "coverage-summary.json")
const badgePath = resolve(process.cwd(), "docs", "badges", "coverage.svg")
const markdownPath = resolve(process.cwd(), "coverage", "summary.md")

const summary = JSON.parse(await readFile(summaryPath, "utf8"))
const total = summary.total

const metrics = [
  createMetric("Lines", total.lines),
  createMetric("Statements", total.statements),
  createMetric("Functions", total.functions),
  createMetric("Branches", total.branches)
]

const lineCoverage = total.lines?.pct ?? 0
const badge = makeBadge({
  label: "coverage",
  message: `${formatPercent(lineCoverage)}%`,
  color: coverageColor(lineCoverage),
  style: "flat"
})

const markdown = [
  "## Coverage Summary",
  "",
  "| Metric | Coverage | Covered / Total |",
  "| --- | ---: | ---: |",
  ...metrics.map(
    (metric) =>
      `| ${metric.label} | ${metric.percent}% | ${metric.covered} / ${metric.total} |`
  ),
  "",
  `Line coverage badge updated at \`${toTimestamp(new Date())}\`.`,
  ""
].join("\n")

await mkdir(resolve(process.cwd(), "docs", "badges"), { recursive: true })
await mkdir(resolve(process.cwd(), "coverage"), { recursive: true })
await writeFile(badgePath, badge, "utf8")
await writeFile(markdownPath, markdown, "utf8")

console.log(`Coverage badge written to ${badgePath}`)
console.log(`Coverage summary written to ${markdownPath}`)

function createMetric(label, metric = { pct: 0, covered: 0, total: 0 }) {
  return {
    label,
    percent: formatPercent(metric.pct ?? 0),
    covered: metric.covered ?? 0,
    total: metric.total ?? 0
  }
}

function formatPercent(value) {
  return Number(value).toFixed(1)
}

function coverageColor(value) {
  if (value >= 90) return "brightgreen"
  if (value >= 80) return "green"
  if (value >= 70) return "yellowgreen"
  if (value >= 60) return "yellow"
  if (value >= 50) return "orange"
  return "red"
}

function toTimestamp(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
}
