import { readFileSync } from "node:fs"

const html = readFileSync("index.html", "utf8")
const requiredMarkers = [
  "<!doctype html>",
  "DEMO DATA",
  "Find supply with certainty",
  "Release pipeline",
  "Prisma migration check",
  "Operations console",
]

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) throw new Error(`Missing required marker: ${marker}`)
}

const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
if (!script) throw new Error("No application script found")
new Function(script)

const secretPattern = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH) PRIVATE KEY)/
if (secretPattern.test(html)) throw new Error("Potential secret found in demo artifact")

console.log(`Neev demo verified: ${html.length} bytes, ${requiredMarkers.length} PRD markers present`)
