// @aurelia/tokens: Tailwind 3 preset.
//
//   // tailwind.config.js (ESM)
//   import aurelia from '@aurelia/tokens'
//   export default { presets: [aurelia], content: [...] }
//
//   /* src/index.css */
//   @import '@aurelia/tokens/tokens.css';
//
// Gives every app `aurelia-{dark,primary,surface,ink,accent}` colours, an 8px
// default radius and the Aurelia font stack. `aurelia-accent` reads the
// --aurelia-accent CSS variable (RGB channels), which tokens.css sets per app.
// Raw values and the `appColors()` helper live in `@aurelia/tokens/palette`.
'use strict'

const palette = require('./palette.cjs')

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: { aurelia: palette.aurelia },
      borderRadius: { DEFAULT: palette.radius },
      fontFamily: { sans: palette.fontSans },
    },
  },
}
