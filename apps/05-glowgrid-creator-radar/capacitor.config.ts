import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.glowgrid',
  appName: 'GlowGrid Creator Radar',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config