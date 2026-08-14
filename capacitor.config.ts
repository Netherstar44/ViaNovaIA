import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vianova.app',
  appName: 'ViaNovaIA',
  webDir: 'dist/public',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "963320565575-69dp01atb3oo5cmrhiq4uf2ca8fc2g79.apps.googleusercontent.com",
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
