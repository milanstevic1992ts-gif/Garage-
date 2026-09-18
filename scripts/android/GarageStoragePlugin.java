package it.ge360.garage;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "GarageStorage")
public class GarageStoragePlugin extends Plugin {

    private static final String PREFS = "garage_storage_targets";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean validSlot(String slot) {
        return "local".equals(slot) || "drive".equals(slot);
    }

    @PluginMethod
    public void pickTree(PluginCall call) {
        String slot = call.getString("slot");
        if (!validSlot(slot)) {
            call.reject("Destinazione non valida");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "pickTreeResult");
    }

    @ActivityCallback
    private void pickTreeResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Nessuna cartella selezionata");
            return;
        }

        String slot = call.getString("slot");
        if (!validSlot(slot)) {
            call.reject("Destinazione non valida");
            return;
        }

        Uri uri = data.getData();
        int flags = data.getFlags()
            & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException e) {
            call.reject("Android non ha concesso il permesso persistente", e);
            return;
        }

        DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
        String label = root != null && root.getName() != null ? root.getName() : "Cartella selezionata";

        prefs().edit()
            .putString(slot + "_uri", uri.toString())
            .putString(slot + "_label", label)
            .apply();

        JSObject out = new JSObject();
        out.put("slot", slot);
        out.put("configured", true);
        out.put("label", label);
        call.resolve(out);
    }

    @PluginMethod
    public void getTargets(PluginCall call) {
        JSObject out = new JSObject();
        out.put("local", target("local"));
        out.put("drive", target("drive"));
        call.resolve(out);
    }

    private JSObject target(String slot) {
        String uri = prefs().getString(slot + "_uri", "");
        JSObject out = new JSObject();
        out.put("configured", !uri.isEmpty());
        out.put("label", prefs().getString(slot + "_label", ""));
        return out;
    }

    @PluginMethod
    public void writeText(PluginCall call) {
        String text = call.getString("text", "");
        String mime = call.getString("mime", "text/plain");
        write(call, text.getBytes(StandardCharsets.UTF_8), mime);
    }

    @PluginMethod
    public void writeBase64(PluginCall call) {
        String value = call.getString("base64");
        if (value == null) {
            call.reject("Dati mancanti");
            return;
        }

        try {
            write(call, Base64.decode(value, Base64.DEFAULT),
                call.getString("mime", "application/octet-stream"));
        } catch (IllegalArgumentException e) {
            call.reject("Dati base64 non validi", e);
        }
    }

    private void write(PluginCall call, byte[] data, String mime) {
        String slot = call.getString("slot");
        String path = call.getString("path");

        if (!validSlot(slot) || path == null || path.trim().isEmpty() || path.contains("..")) {
            call.reject("Percorso non valido");
            return;
        }

        String rootValue = prefs().getString(slot + "_uri", "");
        if (rootValue.isEmpty()) {
            call.reject("Destinazione non configurata");
            return;
        }

        DocumentFile root = DocumentFile.fromTreeUri(getContext(), Uri.parse(rootValue));
        if (root == null || !root.canWrite()) {
            call.reject("La cartella non è disponibile in scrittura");
            return;
        }

        try {
            DocumentFile file = resolveFile(root, path, mime);
            if (file == null) throw new IllegalStateException("Impossibile creare il file");

            try (OutputStream stream = getContext().getContentResolver()
                    .openOutputStream(file.getUri(), "wt")) {
                if (stream == null) throw new IllegalStateException("Stream non disponibile");
                stream.write(data);
                stream.flush();
            }

            JSObject out = new JSObject();
            out.put("ok", true);
            out.put("path", path);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Errore scrittura backup: " + e.getMessage(), e);
        }
    }

    private DocumentFile resolveFile(DocumentFile root, String path, String mime) {
        String[] parts = path.replace('\\', '/').split("/");
        DocumentFile dir = root;

        for (int i = 0; i < parts.length - 1; i++) {
            String name = parts[i].trim();
            if (name.isEmpty() || ".".equals(name)) continue;

            DocumentFile next = dir.findFile(name);
            if (next == null) next = dir.createDirectory(name);
            if (next == null || !next.isDirectory()) return null;
            dir = next;
        }

        String filename = parts[parts.length - 1].trim();
        if (filename.isEmpty()) return null;

        DocumentFile file = dir.findFile(filename);
        if (file != null && file.isDirectory()) return null;
        if (file == null) file = dir.createFile(mime, filename);
        return file;
    }
}
