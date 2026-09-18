# Garage — modello dati locale

## Vehicle

- id UUID;
- plate;
- normalizedPlate;
- firstName;
- lastName;
- phone;
- brand;
- model;
- mileageKm;
- declaredProblems;
- foundProblems;
- status;
- createdAt;
- updatedAt.

Stati:

- `da_controllare`;
- `in_lavorazione`;
- `attesa_ricambi`;
- `pronto`;
- `consegnato`.

## Job

- id UUID;
- vehicleId;
- date;
- mileageKm;
- workDone;
- customerNotes;
- internalNotes;
- createdAt;
- updatedAt.

## Photo

- id UUID;
- vehicleId;
- phase: ingresso / diagnosi / lavorazione / consegna;
- createdAt;
- blob;
- backupLocal;
- backupDrive.

## InventoryItem

- id UUID;
- name;
- category;
- brand;
- partNumber;
- compatibleWith;
- quantity;
- shelf;
- level;
- drawer;
- condition: discreto / buono / ottimo;
- notes;
- createdAt;
- updatedAt.

## Regole

- La targa viene normalizzata rimuovendo spazi e simboli e convertendo in maiuscolo.
- La targa normalizzata deve essere unica tra i veicoli attivi.
- L'UUID è l'identificativo stabile usato da foto e interventi.
- Le fotografie restano file/blob, non vengono serializzate nei JSON.
- I backup sono copie: il database locale del telefono resta la fonte primaria.


## StockMovement

- id UUID;
- itemId;
- itemName snapshot;
- type: intake / withdraw / putaway / relocate;
- delta;
- quantityAfter;
- shelf / level / drawer snapshot;
- createdAt.

Un pezzo con quantità `0` non viene cancellato: diventa non disponibile e
sparisce dalla lista principale. Rimane consultabile attivando "Mostra prelevati".

## Scaffali

La posizione può essere:

- suggerita da Garage in base a categoria, marca, compatibilità e pezzi simili;
- inserita manualmente;
- acquisita da QR scaffale.

Formato QR consigliato:

`GARAGE:SCAFFALE:B:RIPIANO:2`

Sono accettati anche `SCAFFALE B` e codici scaffale brevi.
