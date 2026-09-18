package it.ge360.garage;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GarageStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
