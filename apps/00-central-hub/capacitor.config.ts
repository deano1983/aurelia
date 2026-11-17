import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.centralhub',
  appName: 'Aurelia OS — Central Hub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config