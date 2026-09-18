# Garage Mini AI

## Obiettivo

Facilitare la ricerca senza rendere Garage dipendente da internet o da un backend.

La versione 1 usa un motore locale deterministico, non un LLM generativo.

## Funzioni attive

### Magazzino

La ricerca comprende:

- errori di battitura;
- abbreviazioni;
- sinonimi da officina;
- marca e codice;
- compatibilità;
- scaffale / ripiano / cassetto;
- condizione;
- note.

Esempi:

- `carb betwin`
- `carburatre betwin`
- `cdi peugeot`
- `gomma liberty`
- `verde scaffale C ripiano 2`
- `carb betwin verde C 2`

Colori condizione:

- rosso → Discreto;
- giallo → Buono;
- verde → Ottimo.

### Clienti e veicoli

La stessa logica fuzzy viene usata per:

- targa;
- telefono;
- nome;
- cognome;
- marca;
- modello;
- problemi dichiarati;
- problemi riscontrati.

## Perché non usare subito un LLM

La ricerca di magazzino è un problema di retrieval, non di generazione.

Un LLM generativo:

- occupa più spazio;
- usa più RAM;
- consuma più batteria;
- è più lento;
- può inventare risposte.

Garage Mini AI restituisce soltanto ricambi realmente presenti nel database.

## Livello 2 opzionale: embedding semantici

Quando il magazzino crescerà, si può aggiungere una seconda fase con un modello di embedding.

Candidato:

- `onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX`;
- 384 dimensioni;
- compatibile con Transformers.js;
- adatto a semantic search multilingue.

Flusso futuro:

`query → Mini AI veloce → candidati → embedding similarity → ranking finale`

Il modello non deve decidere se un ricambio esiste: serve soltanto a riordinare i risultati.

## Livello 3 opzionale: assistente locale

Solo se utile, un piccolo modello generativo potrà essere aggiunto per:

- trasformare appunti grezzi in descrizioni ordinate;
- preparare un messaggio per il cliente;
- riassumere lo storico di una targa;
- estrarre da una frase marca/modello/problema;
- proporre termini di ricerca nel magazzino.

Non dovrà:

- inventare diagnosi;
- modificare quantità senza conferma;
- cancellare dati;
- dichiarare disponibile un pezzo che non è registrato.

## Altri usi utili nell'app

### Ricambio suggerito da problema

Da una scheda con testo come:

`non parte a freddo, scintilla debole`

Mini AI può suggerire **termini da cercare**:

`candela · bobina · statore · centralina CDI`

ma deve mostrare chiaramente che sono suggerimenti di ricerca, non una diagnosi.

### Compilazione rapida

Può normalizzare:

`t max` → `TMAX`

`carb` → `Carburatore`

`cdi` → `Centralina CDI`

### Ricerca per linguaggio naturale

Esempio:

`mi serve un carburatore per Betwin in buone condizioni`

viene interpretato come:

- tipo: carburatore;
- compatibilità: Betwin;
- condizione: Buono.

### Storico cliente

Una ricerca può trovare una persona anche con nome scritto male oppure usando solo una parte del numero di telefono.
