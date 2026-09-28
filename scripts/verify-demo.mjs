import { readFileSync } from "node:fs"

const artifacts = [
  {
    path: "index.html",
    markers: [
      "<!doctype html>",
      "Quality bricks. Easy access. Less chasing.",
      "NCR East / trusted local supply",
      "Core journeys",
      "Razorpay + Stripe",
      "Gemini-ready supply guide",
    ],
  },
  {
    path: "workspace.html",
    markers: [
      "<!doctype html>",
      "DEMO DATA",
      "Find supply with certainty",
      "Release pipeline",
      "Prisma migration check",
      "Operations console",
    ],
  },
]

let markerCount = 0
for (const artifact of artifacts) {
  const html = readFileSync(artifact.path, "utf8")
  for (const marker of artifact.markers) {
    if (!html.includes(marker)) throw new Error(`Missing required marker in ${artifact.path}: ${marker}`)
    markerCount += 1
  }

  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
  if (!script) throw new Error(`No application script found in ${artifact.path}`)
  new Function(script)

  const secretPattern = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH) PRIVATE KEY)/
  if (secretPattern.test(html)) throw new Error(`Potential secret found in ${artifact.path}`)
}

console.log(`Neev demo verified: ${artifacts.length} pages, ${markerCount} required markers present`)
