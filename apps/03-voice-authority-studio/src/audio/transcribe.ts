type SpeechRecognitionCtor = any

const getSpeechRecognition = (): SpeechRecognitionCtor | null =>
  (window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }).SpeechRecognition ||
  (window as unknown as {
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }).webkitSpeechRecognition

export interface TranscriberCallbacks {
  onResult: (text: string, isFinal: boolean) => void
  onEnd: () => void
  onError: (message: string) => void
}

export class SpeechTranscriber {
  private recognition: SpeechRecognitionCtor | null = null
  private finalText = ''

  constructor(private readonly callbacks: TranscriberCallbacks) {}

  get isSupported(): boolean {
    return Boolean(getSpeechRecognition())
  }

  get text(): string {
    return this.finalText
  }

  start(lang = 'en-AU'): void {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      this.callbacks.onError(
        'Web Speech API is not available in this browser. Transcription is a stub here.',
      )
      return
    }
    this.finalText = ''
    this.recognition = new Ctor()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = lang

    this.recognition.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) final += transcript
        else interim += transcript
      }
      if (final) {
        this.finalText = this.finalText
          ? `${this.finalText} ${final}`
          : final
      }
      const combined = [this.finalText, interim]
        .filter(Boolean)
        .join(' ')
        .trim()
      this.callbacks.onResult(combined, Boolean(final))
    }

    this.recognition.onend = () => {
      this.recognition = null
      this.callbacks.onEnd()
    }

    this.recognition.onerror = () => {
      this.callbacks.onError('Transcription encountered an error.')
      this.recognition = null
    }

    this.recognition.start()
  }

  stop(): void {
    if (this.recognition) {
      try { this.recognition.stop() } catch { /* ignore */ }
      this.recognition = null
    }
  }
}
