import type { CapacitorConfig } from "@capacitor/core"

const config: CapacitorConfig = {
  appId: 'com.aurelia.os.taxinvoice',
  appName: 'Expense & Tax Invoice',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config