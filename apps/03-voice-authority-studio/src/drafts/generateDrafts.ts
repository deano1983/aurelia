import type { Audience, Draft, VoiceStyle } from '../types'

const STYLE_TITLES: Record<VoiceStyle, string> = {
  executive: 'Executive Authority Draft',
  punchy: 'Short & Punchy Draft',
  human: 'Human Story Draft',
}

const STYLE_INTROS: Record<VoiceStyle, string> = {
  executive: 'The bottom line:',
  punchy: 'Here is the takeaway:',
  human: 'Here is the story behind it:',
}

const AUDIENCE_FRAMES: Record<Audience, string> = {
  'linkedin-executives':
    'Position this for a LinkedIn executive audience: credible, forward-looking, and written to spark authority.',
  board:
    'Frame this for a board of directors: concise, risk-aware, and decision-oriented.',
  investors:
    'Frame this for investors: growth-minded, metric-led, and confidence-inspiring.',
  team:
    'Frame this for the internal team: clear, action-oriented, and aligned.',
  media:
    'Frame this for media and press: quotable, accessible, and newsworthy.',
}

export function generateDrafts(
  transcript: string,
  audience: Audience,
): Draft[] {
  const source = transcript.trim() || '(no transcript captured)'
  const frame = AUDIENCE_FRAMES[audience]
  const timestamp = new Date().toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const executive: Draft = {
    id: 'draft-executive',
    style: 'executive',
    title: STYLE_TITLES.executive,
    body: [
      `${STYLE_INTROS.executive}`,
      '',
      `${source}`,
      '',
      `${frame}`,
      '',
      `Voice captured on ${timestamp} via Velvet Cadence Voice-to-Authority Studio (90-second executive capture).`,
      '',
      'Recommended next step: approve for LinkedIn Authority Bundle distribution.',
    ].join('\n'),
  }

  const punchy: Draft = {
    id: 'draft-punchy',
    style: 'punchy',
    title: STYLE_TITLES.punchy,
    body: [
      `${STYLE_INTROS.punchy}`,
      '',
      source.length > 200 ? `${source.slice(0, 200)}…` : source,
      '',
      '- Why it matters now.',
      '- What changes as a result.',
      '- What we do next.',
      '',
      `${frame}`,
      '',
      `Captured ${timestamp} • 90-second voice note • Velvet Cadence`,
    ].join('\n'),
  }

  const human: Draft = {
    id: 'draft-human',
    style: 'human',
    title: STYLE_TITLES.human,
    body: [
      `${STYLE_INTROS.human}`,
      '',
      source,
      '',
      `${frame}`,
      '',
      `This came from a live 90-second voice note recorded on ${timestamp}. Sometimes the authority is in the telling, not just the telling-off.`,
      '',
      'Velvet Cadence — Voice-to-Authority Studio.',
    ].join('\n'),
  }

  return [executive, punchy, human]
}
