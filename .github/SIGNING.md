# Firma Android permanente — Garage

La repository è pubblica: **non caricare mai il file `garage-release.jks` né le password nella repo**.

Le build installabili devono usare sempre la stessa chiave tramite GitHub Actions Secrets.

Secrets richiesti:

- `GARAGE_KEYSTORE_B64`
- `GARAGE_KEYSTORE_PASSWORD`
- `GARAGE_KEY_ALIAS`
- `GARAGE_KEY_PASSWORD`

Il file di backup della firma viene conservato separatamente dalla repository.

Il workflow `.github/workflows/apk.yml` pubblica un APK solo quando questi quattro secrets sono configurati. Se mancano, esegue test e compilazione ma non pubblica un APK firmato con una chiave temporanea.
