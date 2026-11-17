import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.voicestudio',
  appName: 'Voice-to-Authority Studio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config