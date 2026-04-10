# Posta Network — Deploy Package PRE-COMPILATO (10/04/2026)

Pacchetto **pronto all'uso** per installazione rapida su Plesk, VPS o qualsiasi
server con Node.js. **Niente TypeScript da compilare**: tutto il codice è già
JavaScript pronto da eseguire.

Include:
- `dist/` — JavaScript già compilato (entry point: `dist/index.js`)
- `public/` — pannello admin HTML
- `dump_track.sql` — dump SQL completo del DB track (tabelle + admin + 20 utenti + config)
- `dump_spedizioni.sql` — dump SQL completo del DB spedizioni
- `.env.example` — template credenziali
- `package.json` + `package-lock.json`

**NON include:** `src/`, `tsconfig.json`, `node_modules/`, `.env` reale, script di sessione. Completamente stand-alone.

---

## Prerequisiti

- **Node.js** ≥ 18 (raccomandato 20 LTS)
- **MySQL 8.0** o **TiDB Cloud** (i dump sono compatibili con entrambi)
- **Client MySQL** per importare i dump. Hai 3 opzioni:
  - **phpMyAdmin** (presente in Plesk di default)
  - **Adminer** (presente in Plesk di default)
  - **mysql CLI** da riga di comando
- **3 database** (i primi 2 da creare vuoti, il 3° esistente):
  1. `postanetwork_track` — nuovo, da creare vuoto (poi importi `dump_track.sql`)
  2. `postanetwork_spedizioni` — nuovo, da creare vuoto (poi importi `dump_spedizioni.sql`)
  3. **Gestionale esterno** — esistente, credenziali da inserire in `.env` per il sync live

---

## Installazione in 5 passi

### Step 1 — Crea i 2 database vuoti

#### Opzione A — Da Plesk UI
1. **Websites & Domains** → il tuo dominio → **Databases**
2. **Add Database** → nome `postanetwork_track`, crea utente DB con password forte, ruolo `Administrator`
3. **Add Database** → nome `postanetwork_spedizioni` (usa lo **stesso** utente o uno nuovo)
4. Annota: **host**, **port**, **user**, **password**, nomi DB

#### Opzione B — Da riga di comando
```bash
mysql -u root -p -e "
CREATE DATABASE postanetwork_track CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE postanetwork_spedizioni CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'postanet'@'localhost' IDENTIFIED BY 'PASSWORD_FORTE_QUI';
GRANT ALL PRIVILEGES ON postanetwork_track.* TO 'postanet'@'localhost';
GRANT ALL PRIVILEGES ON postanetwork_spedizioni.* TO 'postanet'@'localhost';
FLUSH PRIVILEGES;
"
```

### Step 2 — Importa i dump SQL

#### Opzione A — Da phpMyAdmin (Plesk)
1. Apri phpMyAdmin dal pannello Plesk
2. Seleziona il database `postanetwork_track` dalla sidebar sinistra
3. Tab **Import** → **Choose file** → scegli `dump_track.sql` → **Go**
4. Aspetta il "Import has been successfully finished" (pochi secondi, è piccolo — 29 KB)
5. Ripeti per `postanetwork_spedizioni` con `dump_spedizioni.sql`

#### Opzione B — Da Adminer
1. Apri Adminer (Plesk → Databases → icona Adminer)
2. Seleziona `postanetwork_track` → Import → File upload → `dump_track.sql` → Execute
3. Ripeti per `postanetwork_spedizioni`

#### Opzione C — Da mysql CLI
```bash
mysql -u postanet -p postanetwork_track < dump_track.sql
mysql -u postanet -p postanetwork_spedizioni < dump_spedizioni.sql
```

**Cosa contengono i dump:**
- `dump_track.sql` → 19 tabelle + **21 utenti** (admin + 20 importati) + 3 configurazioni app_config preservate (esiti, modalità rapida, GPS SuperPower Saver)
- `dump_spedizioni.sql` → 2 tabelle (spedizioni + archivio) vuote

### Step 3 — Configura `.env`

1. Carica il pacchetto sul server (via SFTP in `httpdocs/` su Plesk, o `/opt/posta-network/` su VPS)
2. Rinomina `.env.example` in `.env`:
   ```bash
   cp .env.example .env
   ```
3. Apri `.env` e compila i campi:

```env
# Server
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://tuodominio.it,https://www.tuodominio.it

# JWT (genera due stringhe random diverse)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=30d

# DB TRACK (quello che hai importato con dump_track.sql)
DB_TRACK_HOST=localhost
DB_TRACK_PORT=3306
DB_TRACK_USER=postanet
DB_TRACK_PASS=PASSWORD_FORTE_QUI
DB_TRACK_NAME=postanetwork_track

# DB SPEDIZIONI (quello che hai importato con dump_spedizioni.sql)
DB_SPED_HOST=localhost
DB_SPED_PORT=3306
DB_SPED_USER=postanet
DB_SPED_PASS=PASSWORD_FORTE_QUI
DB_SPED_NAME=postanetwork_spedizioni

# DB EXTERNAL (gestionale — sync live)
EXTERNAL_SYNC_ENABLED=true
DB_EXT_HOST=indirizzo.del.gestionale
DB_EXT_PORT=3306
DB_EXT_USER=utente_esterno
DB_EXT_PASS=password_esterno
DB_EXT_NAME=nome_db_esterno
```

### Step 4 — Installa le dipendenze (SENZA dev)

```bash
cd /percorso/dove/hai/messo/il/package
npm install --production
```

Il flag `--production` salta i `devDependencies` (typescript, jest, ecc.) perché non servono: il codice è già compilato. Installazione veloce (~1-2 minuti).

### Step 5 — Avvia il server

```bash
npm start
```

Equivalente a `node dist/index.js`. Il server ascolta sulla porta in `.env` (default `3000`).

**Per Plesk:** configura Node.js dal pannello:
- **Application Startup File:** `dist/index.js`
- **Application Mode:** `production`
- **Application Root:** la cartella dove hai uploadato il pacchetto
- Poi clicca **Restart App**

---

## Credenziali di default dopo l'import

### Admin (già pronto nel dump)

| Campo | Valore |
|---|---|
| username | `admin` |
| password | `Adm1n!@P0staN3tw0rk` |

**⚠️ Cambia la password admin al primo login** dal pannello admin → Gestione Utenti.

### Altri 20 utenti (già presenti nel dump)

Loggano con:
- **Username:** il prefisso prima della `@` della loro email (es. `g.pantoli.mp`, `f.diomede`, `katia.r`, `alex.o`, …)
- **Password:** la stessa che usano sul gestionale esterno (gli hash `$2a$07$` sono copiati tali e quali nel dump)

Lista completa nel dump SQL (tabella `users`).

---

## Test post-install

Dopo `npm start` verifica che tutto funzioni:

```bash
# Health check
curl http://localhost:3000/status
# Dovrebbe rispondere: {"status":"ok","timestamp":"..."}
```

Oppure dal browser:
- `https://tuodominio.it/status` → JSON con status ok
- `https://tuodominio.it/admin/` → pannello admin web, logga con `admin` / `Adm1n!@P0staN3tw0rk`

---

## Nota importante sul sync gestionale esterno

Gli utenti del dump hanno già il loro `external_user_id` mappato ai record del gestionale esterno **originale**. Se il nuovo gestionale esterno (`DB_EXT_*` in `.env`) ha lo **stesso schema** e gli **stessi ID**, il sync funziona al primo tentativo.

Se invece il nuovo gestionale ha ID diversi, due opzioni:
1. **Disabilita il sync** temporaneamente: `EXTERNAL_SYNC_ENABLED=false` nel `.env`
2. **Ri-mappa gli ID**: contattami per uno script che rifà il matching

---

## Struttura del pacchetto

```
DEPLOY_PACKAGE_PRECOMPILED_20260410/
├── README.md              ← questo file
├── .env.example           ← template credenziali
├── package.json
├── package-lock.json
├── dump_track.sql         ← 29 KB — 19 tabelle + 21 utenti + config
├── dump_spedizioni.sql    ← 3 KB  — 2 tabelle vuote
├── dist/                  ← JavaScript compilato, entry: dist/index.js
│   ├── index.js
│   ├── config/ controllers/ db/ middleware/ routes/
│   ├── services/ socket/ types/ utils/
│   └── ...
└── public/
    └── admin/
        └── index.html     ← pannello amministrativo web
```

Dimensione totale: **~2 MB**.
Con `node_modules/` dopo `npm install --production`: ~150 MB.

---

## Confronto con altre versioni del pacchetto

| Aspetto | PRECOMPILED (questo) | DEPLOY_PACKAGE_20260410 (sorgente) |
|---|---|---|
| Codice | `dist/` JS compilato | `src/` TypeScript |
| Richiede `npm run build`? | ❌ NO | ✅ sì |
| Installazione DB | Import SQL dump | `node setup-db.js` |
| Dimensione | ~2 MB | ~1.2 MB |
| Modificabile sul server? | ❌ (solo con rebuild) | ✅ (modifichi src/ e ri-builda) |
| Consigliato per | Plesk, shared hosting | Dev, VPS con SSH |

---

## Troubleshooting

### `npm install --production` fallisce su `sharp`
Su Linux serve `libvips-dev`:
```bash
sudo apt install libvips-dev
```
Su Plesk senza SSH, contatta l'admin del server oppure installa il pacchetto `sharp` via Plesk Node.js → "Additional NPM install params" → `--platform=linux --arch=x64`.

### Import SQL fallisce con "Table already exists"
I dump hanno `DROP TABLE IF EXISTS` all'inizio di ogni tabella — se il DB non è vuoto, le tabelle esistenti vengono ricreate. **Se vuoi preservare dati esistenti, NON importare il dump** (è pensato per setup fresco).

### L'app parte ma dà `Error: Cannot find module`
Non hai lanciato `npm install`. Oppure hai saltato `--production` e l'installazione si è fermata per un errore su devDependencies. Prova:
```bash
rm -rf node_modules
npm install --production --no-optional
```

### Plesk dà 502 Bad Gateway
Passenger non riesce ad avviare Node. Controlla i log:
- **Plesk → Logs** del dominio → `error_log`
- Spesso è un errore in `.env` (credenziali DB sbagliate, formato chiave JWT non valido, ecc.)

### Il dump richiede MySQL 8
I dump usano syntax MySQL 8+ (includono qualche commento TiDB `/*T!...*/` che su MySQL 8 viene ignorato come commento normale). **Non testato su MySQL 5.x** — se ti serve compatibilità 5.x, fammelo sapere.

### "Access denied for user" dopo import
Hai importato il dump ma l'utente `.env → DB_TRACK_USER` non ha permessi sul database. Esegui:
```sql
GRANT ALL PRIVILEGES ON postanetwork_track.* TO 'nome_utente'@'%';
GRANT ALL PRIVILEGES ON postanetwork_spedizioni.* TO 'nome_utente'@'%';
FLUSH PRIVILEGES;
```

---

## Versione

Pacchetto generato il **10 aprile 2026** dalla codebase Posta Network.

Include (come il pacchetto sorgente):
- ✅ Sync bidirezionale con gestionale esterno
- ✅ Nuovi esiti allineati (15 codici char)
- ✅ Modalità rapida scan
- ✅ GPS SuperPower Saver
- ✅ Form utente con nome/cognome/email
- ✅ Permessi italiani corretti per supervisori
- ✅ 21 utenti pre-caricati (admin + 20 dal gestionale)

**Differenza chiave vs versione sorgente:** questa è già compilata, niente `tsc`, niente `setup-db.js`. Solo importa i 2 dump SQL + `npm install --production` + `npm start`.
