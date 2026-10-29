import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vianova.app',
  appName: 'ViaNova',
  webDir: 'dist/public',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  }
};

export default config;
