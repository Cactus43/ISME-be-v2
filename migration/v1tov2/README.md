# v1 -> v2 data migration

Script: `migration/v1tov2/MigrateV1ToV2.ts`

Questo script legge i dati dal DB v1 e li importa nel DB v2 corrente (`ISME-be-v2/src`).

## File env dedicato (consigliato)

Per evitare confusione col `.env` principale del backend, usa il file locale:

- template: `migration/v1tov2/.env.example`
- runtime: `migration/v1tov2/.env`

Lo script carica automaticamente:

1. root `.env` (base)
2. `migration/v1tov2/.env` (override solo per la migrazione)

## Cosa migra

- `users` (v1) -> `users` (v2)
- `operators` (v1) -> `users` (v2, `role='operator'`)
- `steamleaks` (v1) -> `interventions` (v2)
- `auth_tokens` + `operators_auth_tokens` (v1) -> `access_tokens` (v2)
- `business_team` + `unit` (v1) -> `teams` + `units` (v2)
- `img_url` + `after_img_url` (v1) -> `media` (v2, opzionale)
- Scan filesystem legacy foto -> `media` (v2)

Note media:
- Viene salvato un record `media` con `storage_path` in formato legacy (`legacy/v1/...`).
- Lo script scansiona anche le cartelle foto legacy e registra i record media se l'intervento esiste in `interventions`.
- I file vengono associati per naming convention: `<intervention_id>_photo_before.*` e `<intervention_id>_photo_after.*`.
- Se per uno slot (`photo_before`/`photo_after`) esiste gia' un record media, viene aggiornato (no duplicati per slot).
- Lo script non copia file da un server remoto: legge i file presenti sul filesystem locale.

## Variabili ambiente

Obbligatorie per source (v1):

- `MIGRATION_SOURCE_DB_HOST`
- `MIGRATION_SOURCE_DB_PORT` (default `3306`)
- `MIGRATION_SOURCE_DB_NAME`
- `MIGRATION_SOURCE_DB_USER`
- `MIGRATION_SOURCE_DB_PASSWORD`

Target (v2):

- Puoi usare le classiche `DB_*` già presenti in `.env`
- Oppure override con:
  - `MIGRATION_TARGET_DB_HOST`
  - `MIGRATION_TARGET_DB_PORT`
  - `MIGRATION_TARGET_DB_NAME`
  - `MIGRATION_TARGET_DB_USER`
  - `MIGRATION_TARGET_DB_PASSWORD`

Flag operativi:

- `MIGRATION_DRY_RUN` (default `true`): esegue tutto in transazione e poi fa rollback
- `MIGRATION_TRUNCATE_TARGET` (default `false`): svuota le tabelle target prima della migrazione
- `MIGRATION_ALLOW_NON_EMPTY_DESTINATION` (default `false`): permette import su DB non vuoto
- `MIGRATION_INCLUDE_MEDIA` (default `true`): importa anche i record media
- `MIGRATION_MEDIA_SCAN_ROOT` (default `./data`): root filesystem da cui leggere le foto
- `MIGRATION_MEDIA_BEFORE_DIR` (default `fotoPerdita`): cartella foto before sotto la root
- `MIGRATION_MEDIA_AFTER_DIR` (default `fotoRiparazione`): cartella foto after sotto la root
- `MIGRATION_MEDIA_FROM_DB_URLS` (default `true`): mantiene anche il mapping media da `img_url/after_img_url`
- `MIGRATION_CLEAN_CONFIRM` (default vuoto): per pulizia target dev'essere `YES`

## Esempio .env

```env
# source v1
MIGRATION_SOURCE_DB_HOST=127.0.0.1
MIGRATION_SOURCE_DB_PORT=3306
MIGRATION_SOURCE_DB_NAME=SteamLeaks
MIGRATION_SOURCE_DB_USER=root
MIGRATION_SOURCE_DB_PASSWORD=secret

# target v2 (puoi usare DB_* o questi override)
MIGRATION_TARGET_DB_HOST=127.0.0.1
MIGRATION_TARGET_DB_PORT=3306
MIGRATION_TARGET_DB_NAME=SteamLeaksV2
MIGRATION_TARGET_DB_USER=root
MIGRATION_TARGET_DB_PASSWORD=secret

# safety flags
MIGRATION_DRY_RUN=true
MIGRATION_TRUNCATE_TARGET=false
MIGRATION_ALLOW_NON_EMPTY_DESTINATION=false
MIGRATION_INCLUDE_MEDIA=true
MIGRATION_MEDIA_SCAN_ROOT=./data
MIGRATION_MEDIA_BEFORE_DIR=fotoPerdita
MIGRATION_MEDIA_AFTER_DIR=fotoRiparazione
MIGRATION_MEDIA_FROM_DB_URLS=true
```

## Esecuzione

```bash
npm run migrate:v1tov2
```

## Pulizia DB target migrazione

Script: `migration/v1tov2/CleanMigrationTargetDb.ts`

1. Imposta `MIGRATION_CLEAN_CONFIRM=YES` in `migration/v1tov2/.env`
2. Esegui:

```bash
npm run migrate:v1tov2:clean-target
```

Il cleanup svuota in sicurezza queste tabelle target, se esistono:
`logs`, `media`, `intervention_history`, `access_tokens`, `interventions`, `mobile_devices`, `units`, `users`, `teams`.

Flusso consigliato:

1. Primo giro con `MIGRATION_DRY_RUN=true`
2. Verifica output e conteggi
3. Se serve, pulisci il target con `npm run migrate:v1tov2:clean-target`
4. Migrazione reale con `MIGRATION_DRY_RUN=false`
5. Se il target non e' vuoto, usare `MIGRATION_TRUNCATE_TARGET=true` oppure `MIGRATION_ALLOW_NON_EMPTY_DESTINATION=true`
