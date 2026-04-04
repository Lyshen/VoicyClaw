import { createRequire } from "node:module"

import { runCommand } from "./runtime-shared"

const packageBuilds = [
  {
    entry: "packages/protocol/src/index.ts",
    outDir: "packages/protocol/dist",
    external: [] as string[],
  },
  {
    entry: "packages/config/src/index.ts",
    outDir: "packages/config/dist",
    external: ["yaml"],
  },
  {
    entry: "packages/asr/src/index.ts",
    outDir: "packages/asr/dist",
    external: [] as string[],
  },
  {
    entry: "packages/tts/src/index.ts",
    outDir: "packages/tts/dist",
    external: [
      "@google-cloud/text-to-speech",
      "microsoft-cognitiveservices-speech-sdk",
      "ws",
    ],
  },
]

const require = createRequire(import.meta.url)
const tsupCli = require.resolve("tsup/dist/cli-default.js")

for (const build of packageBuilds) {
  const args = [
    tsupCli,
    build.entry,
    "--format",
    "esm",
    "--out-dir",
    build.outDir,
  ]

  for (const dependency of build.external) {
    args.push("--external", dependency)
  }

  await runCommand(process.execPath, args)
}
