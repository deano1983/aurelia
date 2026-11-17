import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.assetvault',
  appName: 'Cross-Cloud Asset Vault',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config