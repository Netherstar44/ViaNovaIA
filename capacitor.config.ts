import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vianova.app',
  appName: 'ViaNova',
  webDir: 'dist/public',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    // Insets nativos: la WebView queda entre las barras y el color de estas
    // lo pinta ThemeBars con el --bg del tema activo.
    SystemBars: {
      style: "DEFAULT",
      insetsHandling: "native",
    },
  }
};

export default config;
