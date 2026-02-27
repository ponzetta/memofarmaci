package it.memofarmaci.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        // Svuota la history del WebView così Capacitor passa sempre
        // l'evento backButton al JavaScript invece di navigare indietro.
        if (bridge != null && bridge.getWebView().canGoBack()) {
            bridge.getWebView().clearHistory();
        }
        super.onBackPressed();
    }
}
