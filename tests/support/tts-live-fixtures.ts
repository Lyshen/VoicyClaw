import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { resolveVolcengineTTSOptions } from "../../apps/server/src/tts-provider"
import type { TTSAdapter } from "../../packages/tts/src/interface"
import { DemoTTSProvider } from "../../packages/tts/src/providers/demo"
import { VolcengineTTSProvider } from "../../packages/tts/src/providers/volcengine"

const DEFAULT_SAMPLE_RATE = 16_000
const DEFAULT_FIXTURE_ROOT = ".artifacts/tts-fixtures"

export type TTSFixtureMode = "record" | "verify"

export type TTSFixtureSample = {
  id: string
  text: string
  language: string
}

export type TTSFixtureManifest = {
  providerId: string
  sampleId: string
  text: string
  language: string
  sampleRate: number
  chunkCount: number
  byteLength: number
  sha256: string
  durationMs: number
  pcm16Aligned: boolean
  nonZeroSampleCount: number
  peakAmplitude: number
}

type TTSFixtureProviderContext = {
  adapter: TTSAdapter
  sampleRate: number
}

type TTSFixtureProviderResolution =
  | {
      configured: true
      context: TTSFixtureProviderContext
    }
  | {
      configured: false
      reason: string
    }

export type TTSFixtureProviderDefinition = {
  id: string
  comparison:
    | {
        kind: "exact"
      }
    | {
        kind: "bounded"
        maxByteLengthDeltaRatio: number
        maxDurationDeltaRatio: number
        maxPeakAmplitudeDeltaRatio: number
        maxNonZeroSampleDeltaRatio: number
      }
  resolve: (env: NodeJS.ProcessEnv) => TTSFixtureProviderResolution
}

export type TTSFixtureRunResult = {
  providerId: string
  mode: TTSFixtureMode
  latestDir: string
  baselineDir: string
  manifests: TTSFixtureManifest[]
}

const DEFAULT_SAMPLES: TTSFixtureSample[] = [
  {
    id: "zh-nihao",
    text: "你好",
    language: "zh-CN",
  },
  {
    id: "en-hello",
    text: "hello",
    language: "en-US",
  },
]

export const ttsFixtureProviders: TTSFixtureProviderDefinition[] = [
  {
    id: "demo",
    comparison: {
      kind: "exact",
    },
    resolve: () => ({
      configured: true,
      context: {
        adapter: new DemoTTSProvider(),
        sampleRate: DEFAULT_SAMPLE_RATE,
      },
    }),
  },
  {
    id: "volcengine-tts",
    comparison: {
      kind: "bounded",
      maxByteLengthDeltaRatio: 0.2,
      maxDurationDeltaRatio: 0.2,
      maxPeakAmplitudeDeltaRatio: 0.2,
      maxNonZeroSampleDeltaRatio: 0.2,
    },
    resolve: (env) => {
      try {
        const options = resolveVolcengineTTSOptions(env)
        return {
          configured: true,
          context: {
            adapter: new VolcengineTTSProvider(options),
            sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
          },
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Volcengine TTS is not configured."
        return {
          configured: false,
          reason: message,
        }
      }
    },
  },
]

export function resolveSelectedTTSFixtureProviders(
  env: NodeJS.ProcessEnv = process.env,
) {
  const selected = env.VOICYCLAW_TTS_FIXTURE_PROVIDER?.trim()

  if (!selected) {
    return ttsFixtureProviders
  }

  return ttsFixtureProviders.filter((provider) => provider.id === selected)
}

export function resolveTTSFixtureMode(
  env: NodeJS.ProcessEnv = process.env,
): TTSFixtureMode {
  return env.VOICYCLAW_TTS_FIXTURE_MODE === "record" ? "record" : "verify"
}

export function resolveTTSFixtureRoot(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.VOICYCLAW_TTS_FIXTURE_ROOT?.trim()
  return path.resolve(process.cwd(), configured || DEFAULT_FIXTURE_ROOT)
}

export async function runTTSFixtureProvider(
  provider: TTSFixtureProviderDefinition,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TTSFixtureRunResult> {
  const resolved = provider.resolve(env)

  if (!resolved.configured) {
    throw new Error(
      `TTS fixture provider ${provider.id} is not configured: ${resolved.reason}`,
    )
  }

  const mode = resolveTTSFixtureMode(env)
  const rootDir = resolveTTSFixtureRoot(env)
  const latestDir = path.join(rootDir, "latest", provider.id)
  const baselineDir = path.join(rootDir, "baselines", provider.id)

  await mkdir(latestDir, { recursive: true })
  if (mode === "record") {
    await mkdir(baselineDir, { recursive: true })
  }

  const manifests: TTSFixtureManifest[] = []

  for (const sample of DEFAULT_SAMPLES) {
    const rendered = await synthesizeFixtureSample(
      provider.id,
      sample,
      resolved,
    )
    const manifest = rendered.manifest
    manifests.push(manifest)

    const wav = encodeWavFromPcm16(rendered.audio, manifest.sampleRate)
    const wavPath = path.join(latestDir, `${sample.id}.wav`)
    const manifestPath = path.join(latestDir, `${sample.id}.json`)

    await writeFile(wavPath, wav)
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    if (mode === "record") {
      await copyFile(wavPath, path.join(baselineDir, `${sample.id}.wav`))
      await copyFile(manifestPath, path.join(baselineDir, `${sample.id}.json`))
      continue
    }

    const baselinePath = path.join(baselineDir, `${sample.id}.json`)
    if (!existsSync(baselinePath)) {
      throw new Error(
        `Missing TTS fixture baseline for ${provider.id}/${sample.id}. Run pnpm test:tts:live:record first.`,
      )
    }

    const baseline = JSON.parse(
      await readFile(baselinePath, "utf8"),
    ) as TTSFixtureManifest

    const mismatch = findFixtureMismatch(provider, baseline, manifest)
    if (mismatch) {
      throw new Error(mismatch)
    }
  }

  await writeFile(
    path.join(latestDir, "summary.json"),
    JSON.stringify(manifests, null, 2),
  )

  if (mode === "record") {
    await mkdir(baselineDir, { recursive: true })
    await copyFile(
      path.join(latestDir, "summary.json"),
      path.join(baselineDir, "summary.json"),
    )
  }

  return {
    providerId: provider.id,
    mode,
    latestDir,
    baselineDir,
    manifests,
  }
}

async function synthesizeFixtureSample(
  providerId: string,
  sample: TTSFixtureSample,
  resolved: Extract<TTSFixtureProviderResolution, { configured: true }>,
) {
  const rendered = await synthesizeFixtureAudio(sample, resolved.context)
  const stats = inspectPcm16(rendered.audio)

  return {
    audio: rendered.audio,
    manifest: {
      providerId,
      sampleId: sample.id,
      text: sample.text,
      language: sample.language,
      sampleRate: resolved.context.sampleRate,
      chunkCount: rendered.chunkCount,
      byteLength: rendered.audio.byteLength,
      sha256: sha256(rendered.audio),
      durationMs: Math.round(
        (stats.sampleCount / resolved.context.sampleRate) * 1000,
      ),
      pcm16Aligned: stats.pcm16Aligned,
      nonZeroSampleCount: stats.nonZeroSampleCount,
      peakAmplitude: stats.peakAmplitude,
    },
  }
}

async function synthesizeFixtureAudio(
  sample: TTSFixtureSample,
  context: TTSFixtureProviderContext,
) {
  const chunks: Buffer[] = []

  for await (const chunk of context.adapter.synthesize(
    singleText(sample.text),
    {
      language: sample.language,
      sampleRate: context.sampleRate,
    },
  )) {
    chunks.push(Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    throw new Error(`No audio returned for fixture sample ${sample.id}`)
  }

  const audio = Buffer.concat(chunks)
  if (audio.byteLength === 0) {
    throw new Error(`Empty audio returned for fixture sample ${sample.id}`)
  }

  return {
    audio,
    chunkCount: chunks.length,
  }
}

function inspectPcm16(audio: Buffer) {
  const pcm16Aligned = audio.byteLength % 2 === 0
  let nonZeroSampleCount = 0
  let peakAmplitude = 0

  for (let offset = 0; offset + 1 < audio.byteLength; offset += 2) {
    const sample = audio.readInt16LE(offset)
    if (sample !== 0) {
      nonZeroSampleCount += 1
    }
    peakAmplitude = Math.max(peakAmplitude, Math.abs(sample))
  }

  return {
    sampleCount: Math.floor(audio.byteLength / 2),
    pcm16Aligned,
    nonZeroSampleCount,
    peakAmplitude,
  }
}

function encodeWavFromPcm16(audio: Buffer, sampleRate: number) {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * 2

  header.write("RIFF", 0)
  header.writeUInt32LE(36 + audio.byteLength, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(audio.byteLength, 40)

  return Buffer.concat([header, audio])
}

function sha256(audio: Buffer) {
  return createHash("sha256").update(audio).digest("hex")
}

function findFixtureMismatch(
  provider: TTSFixtureProviderDefinition,
  baseline: TTSFixtureManifest,
  manifest: TTSFixtureManifest,
) {
  if (baseline.sampleRate !== manifest.sampleRate) {
    return `TTS fixture mismatch for ${provider.id}/${manifest.sampleId}. Expected sampleRate ${baseline.sampleRate} but got ${manifest.sampleRate}.`
  }

  if (provider.comparison.kind === "exact") {
    if (
      baseline.sha256 !== manifest.sha256 ||
      baseline.byteLength !== manifest.byteLength ||
      baseline.chunkCount !== manifest.chunkCount
    ) {
      return `TTS fixture mismatch for ${provider.id}/${manifest.sampleId}. Expected sha256 ${baseline.sha256} but got ${manifest.sha256}. Re-record with pnpm test:tts:live:record if the change is intentional.`
    }

    return null
  }

  const checks: Array<
    [label: string, current: number, expected: number, maxRatio: number]
  > = [
    [
      "byteLength",
      manifest.byteLength,
      baseline.byteLength,
      provider.comparison.maxByteLengthDeltaRatio,
    ],
    [
      "durationMs",
      manifest.durationMs,
      baseline.durationMs,
      provider.comparison.maxDurationDeltaRatio,
    ],
    [
      "peakAmplitude",
      manifest.peakAmplitude,
      baseline.peakAmplitude,
      provider.comparison.maxPeakAmplitudeDeltaRatio,
    ],
    [
      "nonZeroSampleCount",
      manifest.nonZeroSampleCount,
      baseline.nonZeroSampleCount,
      provider.comparison.maxNonZeroSampleDeltaRatio,
    ],
  ]

  for (const [label, current, expected, maxRatio] of checks) {
    if (!withinRatio(current, expected, maxRatio)) {
      return `TTS fixture mismatch for ${provider.id}/${manifest.sampleId}. ${label} drifted from ${expected} to ${current}, beyond ${Math.round(maxRatio * 100)}% tolerance. Re-record with pnpm test:tts:live:record if the new output is expected.`
    }
  }

  return null
}

function withinRatio(current: number, expected: number, maxRatio: number) {
  if (expected === current) {
    return true
  }

  const denominator = Math.max(1, Math.abs(expected))
  return Math.abs(current - expected) / denominator <= maxRatio
}

async function* singleText(value: string) {
  yield value
}
