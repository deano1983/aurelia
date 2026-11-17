import { useEffect, useRef, useCallback } from 'react'

interface WaveformProps {
  stream: MediaStream | null
  active?: boolean
  width?: number
  height?: number
}

const BAR_COUNT = 64

export function Waveform({
  stream,
  active = false,
  width = 320,
  height = 100,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(
    null,
  )
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)

    const sliceWidth = (width * 1.0) / BAR_COUNT
    let x = 0

    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 2
    ctx.strokeStyle = active ? '#5b21b6' : '#cbd5e1'
    ctx.lineJoin = 'round'
    ctx.beginPath()

    for (let i = 0; i < BAR_COUNT; i++) {
      const v = data[i] || 128
      const y = (v / 256) * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    animationRef.current = requestAnimationFrame(draw)
  }, [active, width, height])

  useEffect(() => {
    if (!stream) return

    const setup = async () => {
      const AudioContext = window.AudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.6
      source.connect(analyser)
      analyserRef.current = analyser

      if (active) draw()
    }
    setup()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      try { audioContextRef.current?.close() } catch { /* ignore */ }
      audioContextRef.current = null
      analyserRef.current = null
    }
  }, [stream, active, draw])

  return (
    <div className="w-full h-[100px] flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0"
      />
      {!stream && (
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
          Audio visualisation
        </span>
      )}
    </div>
  )
}
