# 03 — Velvet Cadence Voice-to-Authority Studio

Functionality from velvetcadence page:
- Executive Voice Transcript (90-second capture)
- Attach Cross-Cloud Proof Pointer
- Writing style: Executive authority / Short & punchy / Human story
- Audience selection
- "Dictate Live Voice Note" → Generate 3 editable draft options
- LinkedIn Authority Bundle output

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Recording UI, waveform, 3 draft comparison, editable text areas |
| Audio | Web Audio API + MediaRecorder | 90-second capture limit, client-side recording |
| Transcription | Web Speech API (free) or Whisper via endpoint | Web Speech API works client-side with no key; Whisper for higher quality if backend added |
| Text gen | Template-based + optional LLM API | 3 draft variations from transcript; can start rule-based, upgrade to OpenAI/Anthropic later |
| Export | Copy to clipboard / .md download | Draft options |

## Interlink dependencies
- Outputs drafts to **04 CTL Relay** (LinkedIn carousel draft for approval)
- Attaches proof pointer from **02 Asset Vault**
- Sends completed posts to **07 Affiliate Engine** (distribution)
- Deadlines to **01 Timeline**

## Suggested folders
```
03-voice-authority-studio/
  src/
    components/  VoiceRecorder, Waveform, DraftCards, StyleSelector
    audio/       record90Seconds, transcribe
    drafts/      generateExecutiveDrafts, styleVariants
  index.html
  package.json
```
