package com.vianova.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhotoSpherePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
