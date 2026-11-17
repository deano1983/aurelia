export const MAX_RECORD_SECONDS = 90

export interface RecorderCallbacks {
  onBlob: (blob: Blob) => void
  onSecond: (seconds: number) => void
  onLimitReached: () => void
  onError: (message: string) => void
}

export interface Recorder {
  readonly isSupported: boolean
  isRecording(): boolean
  isPaused(): boolean
  elapsedSeconds(): number
  start: () => Promise<MediaStream>
  pause: () => void
  resume: () => void
  stop: () => void
}

export function createRecorder(callbacks: RecorderCallbacks): Recorder {
  let mediaRecorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let interval: ReturnType<typeof setInterval> | null = null
  let limitTimer: ReturnType<typeof setTimeout> | null = null
  let startTime = 0
  let pausedAccumulated = 0
  let lastPauseTime = 0

  const isSupported =
    !!navigator.mediaDevices && !!window.MediaRecorder

  const isRecording = () => mediaRecorder?.state === 'recording'
  const isPaused = () => mediaRecorder?.state === 'paused'

  const elapsedSeconds = () => {
    if (!startTime) return Math.round(pausedAccumulated / 1000)
    const running = Date.now() - startTime + pausedAccumulated
    return Math.max(0, Math.round(running / 1000))
  }

  const clearTimers = () => {
    if (interval) { clearInterval(interval); interval = null }
    if (limitTimer) { clearTimeout(limitTimer); limitTimer = null }
  }

  const finalize = () => {
    clearTimers()
    const blob = new Blob(chunks, { type: 'audio/webm' })
    chunks = []
    callbacks.onBlob(blob)
  }

  const tick = () => {
    callbacks.onSecond(elapsedSeconds())
  }

  async function start(): Promise<MediaStream> {
    if (!isSupported) {
      const err = 'MediaRecorder is not supported in this browser.'
      callbacks.onError(err)
      throw new Error(err)
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.onstop = () => {
      finalize()
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
    }
    mediaRecorder.start(1000)
    pausedAccumulated = 0
    startTime = Date.now()
    tick()
    interval = setInterval(tick, 1000)
    limitTimer = setTimeout(() => {
      callbacks.onLimitReached()
      stop()
    }, MAX_RECORD_SECONDS * 1000)
    return stream
  }

  function pause(): void {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return
    mediaRecorder.pause()
    clearTimers()
    lastPauseTime = Date.now()
  }

  function resume(): void {
    if (!mediaRecorder || mediaRecorder.state !== 'paused') return
    mediaRecorder.resume()
    pausedAccumulated += Date.now() - lastPauseTime
    startTime = Date.now()
    tick()
    interval = setInterval(tick, 1000)
    limitTimer = setTimeout(() => {
      callbacks.onLimitReached()
      stop()
    }, MAX_RECORD_SECONDS * 1000)
  }

  function stop(): void {
    if (!mediaRecorder) return
    clearTimers()
    try { mediaRecorder.stop() } catch { /* already stopped */ }
    mediaRecorder = null
    startTime = 0
    pausedAccumulated = 0
    lastPauseTime = 0
  }

  return {
    isSupported,
    isRecording,
    isPaused,
    elapsedSeconds,
    start,
    pause,
    resume,
    stop,
  }
}
