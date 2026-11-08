package com.vianova.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhotoSpherePlugin.class);
        registerPlugin(ThemeBarsPlugin.class);
        super.onCreate(savedInstanceState);

        // Permite que el contenido llegue hasta las barras; SystemBars aplica
        // los insets nativos y ThemeBars pinta el fondo del tema.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
