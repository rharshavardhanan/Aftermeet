import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Aftermeet runs as a server-rendered Next.js app (server actions,
 * NextAuth, Stripe), which can't be fully static-exported. The pragmatic mobile
 * strategy is a thin native shell that loads the deployed web app, giving us one
 * codebase across web + Android.
 *
 *  - Production: set `server.url` to your deployed origin (HTTPS required for
 *    OAuth + microphone). The native app becomes a managed WebView of the app.
 *  - `webDir` ("mobile/") holds only an offline fallback splash, shown when the
 *    device is offline or CAP_SERVER_URL is unset. The app is server-rendered
 *    (server actions, API routes), so it is NOT statically exported.
 */
const useRemote = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.aftermeet.app",
  appName: "Aftermeet",
  webDir: "mobile",
  backgroundColor: "#ffffff",
  android: {
    allowMixedContent: false,
  },
  server: useRemote
    ? { url: process.env.CAP_SERVER_URL, cleartext: false, androidScheme: "https" }
    : { androidScheme: "https" },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
  },
};

export default config;
