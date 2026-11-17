import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.ctlrelay',
  appName: 'C.T.L. Encrypted Relay',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config