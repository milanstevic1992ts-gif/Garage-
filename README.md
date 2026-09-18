# Garage

Frontend Android offline-first per officina scooter e moto.

Garage funziona senza backend. Tutti i dati operativi restano sul telefono e vengono
copiati automaticamente in due destinazioni configurabili:

1. una cartella scelta dall'utente sul telefono / memoria condivisa;
2. una cartella Google Drive scelta tramite il selettore documenti Android.

## Flusso

`Home → Nuovo ingresso → Scheda veicolo → Foto → Interventi → Magazzino → Backup`

## Nuovo ingresso

Campi principali:

- targa;
- nome;
- cognome;
- telefono;
- marca;
- modello;
- chilometri;
- problemi dichiarati dal cliente;
- problemi riscontrati in officina;
- stato lavorazione.

## Archivio

Ogni veicolo viene esportato in una cartella leggibile anche senza l'app:

```
Garage/
  AB123CD - Mario Rossi/
    scheda.txt
    scheda.json
    storico.txt
    interventi.json
    foto/
      ingresso/
      diagnosi/
      lavorazione/
      consegna/
  _magazzino/
    ricambi.txt
    ricambi.json
```

## Magazzino ricambi

Ogni ricambio può avere:

- nome;
- categoria;
- marca/codice;
- compatibilità;
- quantità;
- scaffale;
- ripiano;
- cassetto opzionale;
- condizione: Discreto / Buono / Ottimo.

## Android

- Capacitor 7;
- offline-first;
- Storage Access Framework per le cartelle di backup;
- nessun backend richiesto;
- application id: `it.ge360.garage`.

Il futuro **Gestionale Garage PC** verrà collegato in seguito tramite API, senza
rendere il frontend dipendente dal server.


## Magazzino adattivo

- **PRELEVA 1** scala la quantità.
- A quantità zero il pezzo sparisce dalla lista disponibile ma resta nello storico.
- **Mostra prelevati** permette di recuperarlo.
- **RIPONI** rimette il pezzo a stock.
- **METTI SU SCAFFALE / SPOSTA** aggiorna la posizione senza cancellare il pezzo.
- Garage suggerisce scaffale e ripiano osservando dove sono già pezzi simili.
- La posizione può essere inserita manualmente oppure acquisita da QR scaffale.
- Ogni entrata, prelievo, riposizionamento e ripristino viene salvato nei movimenti.

Formato QR consigliato:

`GARAGE:SCAFFALE:B:RIPIANO:2`

## Appunti intelligenti

Problemi dichiarati, problemi riscontrati e interventi hanno **Riordina appunti**.
La funzione pulisce e struttura appunti grezzi senza aggiungere informazioni non scritte.

Dai problemi registrati Garage può inoltre proporre termini da cercare nel
magazzino. Sono suggerimenti di ricerca, non diagnosi automatiche.


## Dettatura vocale

Garage include un pannello microfono grande e visibile nei moduli dove si scrivono appunti.

- **Nuovo ingresso**: Problemi dichiarati / Problemi riscontrati.
- **Intervento**: Lavoro / Cliente / Nota interna.
- **Ricambio**: Note ricambio.

Il pannello mostra il testo riconosciuto in tempo reale. Il testo viene aggiunto
al campo selezionato senza cancellare quello già presente. Dopo la dettatura è
possibile usare **Riordina appunti**.

La build Android usa `@capgo/capacitor-speech-recognition` v7 con lingua
`it-IT`, risultati parziali inline e riconoscimento on-device quando supportato.


## Targa e chilometri verificati

La scheda veicolo contiene un riquadro **Chilometri verificati** separato dai km
attuali.

Garage può aprire:

- Portale dell'Automobilista per storico revisioni e km registrati;
- ACI / Infotarga per marca, modello e dati tecnici.

Il Portale dell'Automobilista richiede CAPTCHA, quindi il frontend non effettua
scraping automatico. I dati verificati vengono salvati con fonte, data
revisione e data della verifica e sono inclusi nei backup.

Se i km attuali sono inferiori ai km dell'ultima revisione, Garage mostra un
avviso evidente.

Il futuro Gestionale Garage PC potrà riempire gli stessi campi automaticamente
tramite API autorizzate Motorizzazione/PRA o provider automotive.
