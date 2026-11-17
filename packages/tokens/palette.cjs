// Raw Aurelia design values. The Tailwind preset (index.cjs) is built from
// these, and tokens.css mirrors them as CSS variables; keep the two in sync.
'use strict'

const colors = {
  dark: '#0b1f3a',
  primary: '#1d4ed8',
  surface: '#f8fafc',
  ink: '#0f172a',
}

// Per-app accent colours, as hex and as space-separated RGB channels (the
// form --aurelia-accent takes, so Tailwind opacity modifiers work).
const accents = {
  cyan: { hex: '#22d3ee', rgb: '34 211 238' },
  violet: { hex: '#8b5cf6', rgb: '139 92 246' },
  emerald: { hex: '#10b981', rgb: '16 185 129' },
  pink: { hex: '#ec4899', rgb: '236 72 153' },
  gold: { hex: '#f59e0b', rgb: '245 158 11' },
}

// Which accent each app uses, keyed by the app folder's two-digit prefix.
const appAccents = {
  '00': 'cyan',
  '01': 'cyan',
  '02': 'cyan',
  '03': 'violet',
  '04': 'emerald',
  '05': 'pink',
  '06': 'cyan',
  '07': 'gold',
}

const radius = '8px'

const fontSans = [
  'Inter',
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
]

// Tailwind colour value that follows the --aurelia-accent CSS variable
// (falls back to cyan when tokens.css is not loaded).
const accentVar = 'rgb(var(--aurelia-accent, 34 211 238) / <alpha-value>)'

// The shared `aurelia-*` colour scale used by the preset.
const aurelia = { ...colors, accent: accentVar }

// Legacy per-app colour scale (e.g. `timeline-*`, `vault-*`): the shared
// tokens plus app-specific overrides, so older class names keep working.
function appColors(overrides = {}) {
  return { ...aurelia, ...overrides }
}

module.exports = { colors, accents, appAccents, radius, fontSans, accentVar, aurelia, appColors }
