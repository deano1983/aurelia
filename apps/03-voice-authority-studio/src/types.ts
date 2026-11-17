export type VoiceStyle = 'executive' | 'punchy' | 'human'

export type Audience =
  | 'linkedin-executives'
  | 'board'
  | 'investors'
  | 'team'
  | 'media'

export interface Draft {
  id: string
  style: VoiceStyle
  title: string
  body: string
}

export interface ProofPointer {
  source: '02-asset-vault' | 'manual'
  url: string
  label: string
}

export interface RecordState {
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'done'
  secondsElapsed: number
  transcript: string
  error: string | null
}

export const STYLE_LABEL: Record<VoiceStyle, string> = {
  executive: 'Executive Authority',
  punchy: 'Short & Punchy',
  human: 'Human Story',
}

export const AUDIENCE_LABEL: Record<Audience, string> = {
  'linkedin-executives': 'LinkedIn Executives',
  board: 'Board of Directors',
  investors: 'Investors',
  team: 'Internal Team',
  media: 'Media & Press',
}
