package com.vianova.app;

import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pinta la barra de estado y la de navegación con el color de fondo del tema
 * activo. SystemBars (incluido en Capacitor) se sigue encargando de los insets
 * y del color de los iconos; este plugin solo iguala el fondo de las barras al
 * --bg de la app para que no se vea el color del tema nativo de Android.
 */
@CapacitorPlugin(name = "ThemeBars")
public class ThemeBarsPlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        String hex = call.getString("color", "#000000");
        final int color;
        try {
            color = Color.parseColor(hex);
        } catch (IllegalArgumentException error) {
            call.reject("Color inválido");
            return;
        }

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();

            // El fondo del decor se ve detrás de las barras cuando SystemBars
            // reserva el espacio de los insets (y también en Android 15+).
            window.getDecorView().setBackgroundColor(color);

            // En Android 15+ el sistema ignora estos colores porque fuerza
            // edge-to-edge; el fondo del decor sigue funcionando.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(
                    WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                        | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
                );
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
            }

            // Quita el velo de contraste que Android añade sobre la barra de
            // gestos para que se vea exactamente el color del tema.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }

            call.resolve();
        });
    }
}
