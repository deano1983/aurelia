import { useCallback, useEffect, useRef, useState } from 'react'
import { createRecorder, MAX_RECORD_SECONDS } from '../audio/recorder'
import { SpeechTranscriber } from '../audio/transcribe'
import { Waveform } from './Waveform'

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string) => void
  onAudioReady: (audioBlob: Blob) => void
}

export function VoiceRecorder({ onTranscriptReady, onAudioReady }: VoiceRecorderProps) {
  const [status, setStatus] = useState<
    'idle' | 'recording' | 'paused' | 'processing' | 'done'
  >('idle')
  const [seconds, setSeconds] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null)
  const transcriberRef = useRef<SpeechTranscriber | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    recorderRef.current = createRecorder({
      onBlob: (blob) => {
        const url = URL.createObjectURL(blob)
        audioUrlRef.current = url
        setStatus('done')
        onAudioReady(blob)
      },
      onSecond: setSeconds,
      onLimitReached: () => {
        setStatus('processing')
        transcriberRef.current?.stop()
        onTranscriptReady(transcriberRef.current?.text ?? '')
      },
      onError: (message) => {
        setError(message)
        setStatus('idle')
      },
    })
    transcriberRef.current = new SpeechTranscriber({
      onResult: (text) => setTranscript(text),
      onEnd: () => {},
      onError: (message) => {
        setError(message)
        setStatus('idle')
      },
    })
    return () => {
      recorderRef.current?.stop()
      transcriberRef.current?.stop()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [onTranscriptReady, onAudioReady])

  const handleRecord = useCallback(async () => {
    setError(null)
    setTranscript('')
    setStatus('processing')
    try {
      const s = await recorderRef.current!.start()
      setStream(s)
      transcriberRef.current!.start()
      setStatus('recording')
    } catch {
      setStatus('idle')
    }
  }, [])

  const handlePause = useCallback(() => {
    recorderRef.current?.pause()
    transcriberRef.current?.stop()
    setStatus('paused')
  }, [])

  const handleResume = useCallback(() => {
    recorderRef.current?.resume()
    transcriberRef.current?.start()
    setStatus('recording')
  }, [])

  const handleStop = useCallback(() => {
    setStatus('processing')
    recorderRef.current?.stop()
    transcriberRef.current?.stop()
    onTranscriptReady(transcriberRef.current?.text ?? '')
  }, [onTranscriptReady])

  const isLimitReached = seconds >= MAX_RECORD_SECONDS

  const canRecord = status === 'idle' || status === 'done'
  const canPause = status === 'recording'
  const canResume = status === 'paused'
  const canStop = status === 'recording' || status === 'paused'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Live Voice Capture</h3>
          <p className="text-[11px] text-slate-500">
            Up to {MAX_RECORD_SECONDS}-second executive capture
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
            status === 'recording'
              ? 'bg-red-100 text-red-700 animate-pulse'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <Waveform stream={stream} active={status === 'recording'} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="font-mono font-semibold text-slate-700">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(
            seconds % 60,
          )
            .padStart(2, '0')}
        </span>
        {isLimitReached && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
            90-second limit reached
          </span>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3">
        <button
          onClick={handleRecord}
          disabled={!canRecord || isLimitReached}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {status === 'done' ? 'Record Again' : 'Dictate Live Voice Note'}
        </button>
        <button
          onClick={handlePause}
          disabled={!canPause}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Pause
        </button>
        <button
          onClick={handleResume}
          disabled={!canResume}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Resume
        </button>
        <button
          onClick={handleStop}
          disabled={!canStop}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Stop
        </button>
      </div>

      {transcript && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Transcript (Web Speech API)
          </h4>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{transcript}</p>
        </div>
      )}
    </section>
  )
}

