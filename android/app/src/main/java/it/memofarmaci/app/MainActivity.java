package it.memofarmaci.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Status bar trasparente e sovrapposta al contenuto (edge-to-edge)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
    }

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
