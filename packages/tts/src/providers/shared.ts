export async function collectFullText(source: AsyncIterable<string>) {
  const chunks: string[] = []

  for await (const chunk of source) {
    if (!chunk.trim()) {
      continue
    }

    chunks.push(chunk)
  }

  const merged = chunks.join("").trim()
  return merged || null
}

export function stripWavHeaderIfPresent(audio: Buffer) {
  if (
    audio.length < 44 ||
    audio.subarray(0, 4).toString("ascii") !== "RIFF" ||
    audio.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    return audio
  }

  const dataOffset = audio.indexOf(Buffer.from("data"))
  if (dataOffset < 0 || dataOffset + 8 > audio.length) {
    return audio
  }

  return audio.subarray(dataOffset + 8)
}
