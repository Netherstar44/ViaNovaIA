package com.vianova.app;

import android.content.Intent;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the web app with SGCam360, the Google Camera mod that opens directly
 * into Photo Sphere and writes an equirectangular JPEG (XMP panorama metadata).
 *
 * The camera app owns the capture UI and saves to the gallery, so this plugin
 * only checks availability and launches it. The web layer then imports the
 * resulting panorama with the system photo picker.
 */
@CapacitorPlugin(name = "PhotoSphere")
public class PhotoSpherePlugin extends Plugin {

    /** Package name documented by the SGCam360 build. */
    private static final String CAMERA_PACKAGE = "com.shamim.cam";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", launchIntent() != null);
        result.put("packageName", CAMERA_PACKAGE);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = launchIntent();
        if (intent == null) {
            call.reject("SGCam 360 no está instalada en este dispositivo.", "NOT_INSTALLED");
            return;
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception error) {
            call.reject("No se pudo abrir SGCam 360.", "LAUNCH_FAILED", error);
            return;
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    private Intent launchIntent() {
        try {
            PackageManager manager = getContext().getPackageManager();
            return manager.getLaunchIntentForPackage(CAMERA_PACKAGE);
        } catch (Exception error) {
            return null;
        }
    }
}
