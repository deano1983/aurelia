import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.timeline',
  appName: 'Daily Command Timeline',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config