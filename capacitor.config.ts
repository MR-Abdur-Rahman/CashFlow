import type { CapacitorConfig } from "@capacitor/cli";

// The native shell loads the live web app (remote-URL strategy), so Vercel deploys update the app
// instantly. The APK only needs rebuilding when a native plugin is added/changed. Native plugins
// (contacts, camera, notifications) still work against the remotely-loaded UI via the Capacitor
// bridge, since the same web bundle ships their JS.
const config: CapacitorConfig = {
  appId: "app.cashflow.mobile",
  appName: "CashFlow",
  webDir: "dist",
  server: {
    url: "https://cash-flow-six-beta.vercel.app",
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
