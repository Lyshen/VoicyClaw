type MicrophoneCallbacks = {
  onChunk: (chunk: ArrayBuffer) => void
  onLevel?: (level: number) => void
}

export class PcmStreamPlayer {
  private context: AudioContext | null = null
  private nextStartTime = 0

  async enqueueBase64(base64: string, sampleRate = 16_000) {
    const context = await this.ensureContext()
    const pcm = decodeBase64(base64)
    const floatBuffer = new Float32Array(pcm.length)

    for (let index = 0; index < pcm.length; index += 1) {
      floatBuffer[index] = pcm[index] / 32_768
    }

    const audioBuffer = context.createBuffer(1, floatBuffer.length, sampleRate)
    audioBuffer.copyToChannel(floatBuffer, 0)

    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(context.destination)

    const startTime = Math.max(this.nextStartTime, context.currentTime + 0.02)
    source.start(startTime)
    this.nextStartTime = startTime + audioBuffer.duration
  }

  reset() {
    if (this.context) {
      this.nextStartTime = this.context.currentTime
    }
  }

  private async ensureContext() {
    if (!this.context) {
      this.context = new window.AudioContext()
    }

    if (this.context.state === "suspended") {
      await this.context.resume()
    }

    return this.context
  }
}

export class MicrophoneStreamer {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private silence: GainNode | null = null

  constructor(private readonly callbacks: MicrophoneCallbacks) {}

  async start() {
    if (this.stream) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    this.context = new window.AudioContext()
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4_096, 1, 1)
    this.silence = this.context.createGain()
    this.silence.gain.value = 0

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsampleFloat32(input, this.context?.sampleRate ?? 48_000, 16_000)
      const pcm = floatToPcm16(downsampled)

      this.callbacks.onChunk(
        pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
      )
      this.callbacks.onLevel?.(computeLevel(input))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.silence)
    this.silence.connect(this.context.destination)
    await this.context.resume()
  }

  stop() {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.silence?.disconnect()
    this.processor = null
    this.source = null
    this.silence = null

    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null

    void this.context?.close()
    this.context = null
    this.callbacks.onLevel?.(0)
  }
}

function decodeBase64(base64: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Int16Array(bytes.buffer)
}

function downsampleFloat32(input: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate === targetRate) {
    return input
  }

  const ratio = sourceRate / targetRate
  const length = Math.round(input.length / ratio)
  const result = new Float32Array(length)
  let offset = 0

  for (let index = 0; index < length; index += 1) {
    const nextOffset = Math.round((index + 1) * ratio)
    let accumulator = 0
    let count = 0

    for (let sample = offset; sample < nextOffset && sample < input.length; sample += 1) {
      accumulator += input[sample]
      count += 1
    }

    result[index] = count ? accumulator / count : 0
    offset = nextOffset
  }

  return result
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length)

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

function computeLevel(input: Float32Array) {
  let sumSquares = 0

  for (const sample of input) {
    sumSquares += sample * sample
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, input.length))
  return Math.min(1, rms * 4)
}
