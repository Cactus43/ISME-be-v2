# ISME Backend v2

Backend API per **ISME — Perdite Vapore**, sistema di gestione interventi su impianti vapore industriali.

```
Express 4.21 · TypeScript 5.7 · Sequelize 6 · MySQL 8.4 · Node ≥ 20
```

---

## Quick Start

```bash
# Installa dipendenze
npm install

# Copia e configura le variabili d'ambiente
cp .env.example .env

# Sviluppo (hot reload)
npm run dev

# Build
npm run build

# Produzione
npm start
```

---

## Variabili d'Ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `NODE_ENV` | `development` | `development` · `production` |
| `PORT` | `8081` | Porta HTTP |
| `DB_HOST` | `127.0.0.1` | Host MySQL |
| `DB_PORT` | `3306` | Porta MySQL |
| `DB_NAME` | `SteamLeaksV2` | Nome database |
| `DB_USER` | — | Utente database |
| `DB_PASSWORD` | — | Password database |
| `JWT_SECRET` | — | Chiave segreta JWT |
| `JWT_ALGORITHM` | `HS512` | Algoritmo firma |
| `JWT_SESSION_MINUTES` | `1440` | Durata sessione (minuti) |
| `CORS_ORIGINS` | `http://localhost:3001` | Origini CORS (separati da virgola) |
| `DATA_PATH` | `./data` | Percorso storage foto/documenti |
| `LOG_LEVEL` | `debug` | Livello logging pino |

---

## Architettura

Clean Architecture concentrica — ogni layer dipende solo da quelli più interni.

```
src/
├── Index.ts                    ← bootstrap + graceful shutdown
├── App.ts                      ← Express app + route mounting
│
├── Config/
│   ├── Index.ts                ← variabili d'ambiente tipizzate
│   └── Database.ts             ← configurazione Sequelize
│
├── Data/                       ← layer più interno (zero dipendenze esterne)
│   ├── Exceptions/             ← AppError + sottoclassi (NotFound, Unauthorized, ...)
│   ├── Interfaces/             ← contratti IAdapter, IOperations
│   ├── Models/                 ← 8 modelli Sequelize con InitModel()
│   ├── Schemas/                ← validazione Zod dichiarativa
│   └── Types/                  ← DTOs + IAuthenticatedRequest
│
├── Utils/
│   ├── Logger.ts               ← pino logger (structured JSON)
│   ├── AuditLogger.ts          ← fire-and-forget audit trail → tabella logs
│   ├── ParseId.ts              ← validazione route params (positivi, interi)
│   ├── Crypto.ts               ← bcrypt, JWT sign/verify, SHA-256
│   ├── SteamFlow.ts            ← calcolo portata vapore (polinomiale)
│   └── Normalize.ts            ← normalizzazione campi intervento
│
├── Adapters/                   ← repository pattern (accesso DB)
│   ├── UserAdapter.ts          ← utenti + operatori (role='operator')
│   ├── TokenAdapter.ts         ← sessioni unificate (backoffice + mobile)
│   ├── DeviceAdapter.ts
│   ├── TeamAdapter.ts
│   ├── InterventionAdapter.ts
│   └── MediaAdapter.ts
│
├── Operations/                 ← business logic (constructor injection)
│   ├── AuthOperations.ts
│   ├── InterventionOperations.ts
│   ├── MediaOperations.ts
│   ├── TeamOperations.ts
│   └── OperatorOperations.ts
│
├── Middleware/
│   ├── Authenticate.ts         ← cookie (backoffice) + Bearer (mobile)
│   ├── RequestLogger.ts        ← HTTP request logging (method, status, durata, IP)
│   ├── ErrorHandler.ts         ← error centralizzato
│   ├── RateLimiter.ts          ← API 100/min · Auth 10/min
│   └── Validate.ts             ← factory Zod → middleware
│
├── Controllers/                ← HTTP boundary (5 controller con Router)
│   ├── AuthController.ts
│   ├── InterventionController.ts
│   ├── MediaController.ts
│   ├── TeamController.ts
│   └── OperatorController.ts
│
└── Infra/                      ← composizione
    ├── Database.ts             ← istanza Sequelize, modelli, associazioni
    ├── Container.ts            ← composition root (DI manuale)
    ├── EventBus.ts             ← bus eventi sincrone in-process
    └── AuditSubscriber.ts      ← subscriber wildcard → audit logs
```

### Flusso di una request

```
Request → Middleware (helmet, RequestLogger, cors, rate-limit, authenticate, validate)
        → Controller (routing, ParseId params)
        → Operations (business logic + Audit)
        → Adapter (query DB via Sequelize)
        → Response / ErrorHandler
```

### Pattern utilizzati

| Pattern | Dove | Descrizione |
|---------|------|-------------|
| Dependency Inversion | Operations, Controllers | Dipendono da interfacce (`IUserAdapter`), non da classi concrete |
| Constructor Injection | Operations, Controllers | Keyword-style destructuring: `{ Adapter, Logger }` |
| Repository | Adapters | Isolano Sequelize dalla business logic |
| Composition Root | `Infra/Container.ts` | Unico punto di istanziazione di tutto il grafo |
| Strategy | `Authenticate()` | Scelta runtime tra autenticazione cookie / Bearer |
| Factory | `Validate(schema)` | Genera middleware da schema Zod |
| Error Hierarchy | `Data/Exceptions/` | `AppError` base con `StatusCode` + sottoclassi |
| Audit Trail | `Utils/AuditLogger.ts` | Fire-and-forget logging su tabella `logs` |

---

## API Reference

**Base URL:** `http://localhost:8081`

### Health Check

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Stato del server |

### Auth — `/api/auth`

| Metodo | Endpoint | Auth | Middleware | Descrizione |
|--------|----------|------|------------|-------------|
| `POST` | `/api/auth/login` | — | Rate-limit, Validate | Login backoffice (email + password) |
| `POST` | `/api/auth/logout` | Backoffice | — | Logout backoffice (revoca token) |
| `GET` | `/api/auth/verify` | Backoffice | — | Verifica sessione backoffice |
| `POST` | `/api/auth/mobile/login` | — | Rate-limit, Validate | Login mobile (username + password + device) |
| `POST` | `/api/auth/mobile/logout` | Mobile | — | Logout mobile |
| `GET` | `/api/auth/mobile/verify` | Mobile | — | Verifica sessione mobile |

### Interventions — `/api/interventions`

| Metodo | Endpoint | Auth | Middleware | Descrizione |
|--------|----------|------|------------|-------------|
| `GET` | `/api/interventions` | Backoffice | ValidateQuery | Lista paginata interventi |
| `GET` | `/api/interventions/:id` | Backoffice | — | Dettaglio intervento |
| `POST` | `/api/interventions` | Entrambi | Validate | Crea intervento (+ foto base64) |
| `PUT` | `/api/interventions/:id` | Backoffice | Validate | Aggiorna intervento |
| `POST` | `/api/interventions/toggle-delete` | Backoffice | Validate | Soft-delete / restore batch |
| `GET` | `/api/interventions/export/csv` | Backoffice | — | Export CSV |
| `GET` | `/api/interventions/mobile/sync` | Mobile | — | Sync dati per app mobile |

### Media — `/api/media`

| Metodo | Endpoint | Auth | Descrizione |
|--------|----------|------|-------------|
| `GET` | `/api/media/:id/file` | Entrambi | Scarica file media |
| `GET` | `/api/media/intervention/:id` | Entrambi | Lista media di un intervento |
| `DELETE` | `/api/media/:id` | Backoffice | Elimina media |

### Teams — `/api/teams`

| Metodo | Endpoint | Auth | Middleware | Descrizione |
|--------|----------|------|------------|-------------|
| `GET` | `/api/teams` | Backoffice | — | Lista team |
| `GET` | `/api/teams/:id` | Backoffice | — | Dettaglio team |
| `POST` | `/api/teams` | Backoffice | Validate | Crea team |
| `PUT` | `/api/teams/:id` | Backoffice | Validate | Aggiorna team |
| `DELETE` | `/api/teams/:id` | Backoffice | — | Elimina team |

### Operators — `/api/operators`

| Metodo | Endpoint | Auth | Middleware | Descrizione |
|--------|----------|------|------------|-------------|
| `GET` | `/api/operators` | Backoffice | — | Lista operatori |
| `GET` | `/api/operators/:id` | Backoffice | — | Dettaglio operatore |
| `POST` | `/api/operators` | Backoffice | Validate | Crea operatore |
| `PUT` | `/api/operators/:id` | Backoffice | Validate | Aggiorna operatore |
| `DELETE` | `/api/operators/:id` | Backoffice | — | Elimina operatore |

---

## Autenticazione

Due meccanismi in base al client:

| Client | Meccanismo | Dettaglio |
|--------|-----------|-----------|
| **Backoffice** (web) | Cookie `session` | `httpOnly`, `secure` in produzione, `sameSite: strict` |
| **Mobile** (app) | Header `Authorization: Bearer <signature>` | Signature SHA-256 restituita dal login mobile |

Il middleware `Authenticate()` supporta entrambi — senza argomento prova cookie poi Bearer. Si può restringere con `Authenticate('backoffice')` o `Authenticate('mobile')`.

`req.User` è unificato per entrambi i flussi e contiene: `Id`, `Firstname`, `Lastname`, `Email`, `Username`, `Role`, `TeamId`, `Lang`.

---

## Database

**MySQL 8.4** — schema `SteamLeaksV2`, 8 tabelle:

| Tabella | Descrizione |
|---------|-------------|
| `users` | Utenti backoffice + operatori (ruolo `admin`/`viewer`/`operator`) |
| `access_tokens` | Sessioni unificate (discriminatore `source`: backoffice/mobile) |
| `teams` | Squadre operative |
| `mobile_devices` | Dispositivi mobile registrati |
| `interventions` | Interventi (40+ campi, dati tecnici vapore) |
| `interventions_history` | Storico modifiche interventi |
| `media` | Foto e documenti allegati |
| `logs` | Audit trail (login, CRUD, mutazioni) |

**Audit columns** su tutte le tabelle mutabili: `created_by`, `updated_by`, `deleted_at`, `deleted_by`.

**Soft-delete** unificato: `deleted_at` (timestamp) + `deleted_by` (FK → users) anziché `is_deleted` boolean.

---

## Logging & Audit Trail

Sistema di logging multi-livello pensato per ambiente industriale (raffineria).

### Structured HTTP Logging

Ogni request HTTP viene loggata automaticamente dal middleware `RequestLogger`:

```json
{
  "level": 30,
  "module": "http",
  "method": "POST",
  "url": "/api/interventions",
  "status": 201,
  "duration": "45ms",
  "ip": "192.168.1.100",
  "userId": 12
}
```

- **≥ 500** → `error`
- **≥ 400** → `warn`
- **resto** → `info`
- Include contesto utente autenticato quando disponibile (userId, email, username)

### Database Audit Trail

`AuditLogger` persiste ogni evento di mutazione nella tabella `logs` in modo fire-and-forget (non blocca mai il flusso principale).

**Eventi tracciati:**

| Action | Source | Descrizione |
|--------|--------|-------------|
| `Auth.BackofficeLogin` | backoffice | Login riuscito (con IP, user-agent) |
| `Auth.MobileLogin` | mobile | Login riuscito (con device) |
| `Auth.BackofficeLoginFailed` | backoffice | Tentativo fallito |
| `Auth.MobileLoginFailed` | mobile | Tentativo fallito |
| `Auth.BackofficeLogout` | backoffice | Sessione revocata |
| `Auth.MobileLogout` | mobile | Sessione revocata |
| `Intervention.Created` | mobile | Nuovo intervento creato |
| `Intervention.Updated` | backoffice | Intervento aggiornato |
| `Intervention.Deleted` | backoffice | Soft-delete intervento |
| `Intervention.Restored` | backoffice | Ripristino intervento |
| `Media.Deleted` | backoffice | Eliminazione media |
| `Team.Created/Updated/Deleted` | backoffice | Gestione team |
| `User.Created/Updated/Deleted` | backoffice | Gestione utenti/operatori |

Ogni record include: `source`, `level`, `action`, `entity_type`, `entity_id`, `user_id`, `device_id`, `message`, `metadata` (JSON), `ip_address`, `created_at`.

### SQL Logging

In modalità development, tutte le query Sequelize vengono loggate via pino child logger (`module: 'sequelize'`) a livello `debug`.

### Parametri Route

`ParseId()` valida che ogni `:id` nei parametri route sia un intero positivo. Se il valore è invalido (NaN, ≤ 0), risponde con `400 Bad Request` prima ancora di raggiungere la business logic.

---

## Naming Conventions

| Cosa | Convenzione | Esempio |
|------|------------|---------|
| File e cartelle | PascalCase | `InterventionAdapter.ts` |
| Classi e metodi pubblici | PascalCase | `FindById()`, `LoginBackoffice()` |
| Metodi privati | _camelCase | `_savePhoto()`, `_registerRoutes()` |
| Costanti | SCREAMING_SNAKE | `LOGIN_SCHEMA`, `API_LIMITER` |
| Interfacce | Prefisso `I` | `IUserAdapter`, `IAuthOperations` |
| Sezioni nel codice | Separatore | `// ─── Section Name ─────────` |

---

## Sicurezza

| Misura | Dettaglio |
|--------|-----------|
| **Password hashing** | bcrypt 12 rounds (mai SHA-256) |
| **Token in DB** | Salvato come hash SHA-256, non in chiaro |
| **Path traversal** | `path.resolve()` + `startsWith()` su file serving |
| **Base64 limit** | Max 14 MB su campi foto (Zod `.max(14_000_000)`) |
| **Rate limiting** | 100 req/min API, 10 req/min auth |
| **Helmet** | Header di sicurezza HTTP |
| **Route params** | `ParseId()` valida interi positivi su ogni `:id` |
| **Graceful shutdown** | `Sequelize.close()` + `server.close()` su SIGTERM/SIGINT |
| **Unhandled rejections** | Catturati e loggati, processo termina |
| **Audit trail** | Ogni mutazione e login tracciati nel DB |

---

## Docker

Multi-stage build, Node 20 Alpine, utente non-root:

```bash
# Build immagine
docker build -t isme-backend:2.0 .

# Esegui
docker run -d \
  --name isme-api \
  -p 8081:8081 \
  -v /path/to/data:/data \
  --env-file .env \
  isme-backend:2.0
```

Health check integrato su `/health` (ogni 30s).

---

## Scripts

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Sviluppo con hot reload (`tsx watch`) |
| `npm run build` | Compilazione TypeScript → `dist/` |
| `npm start` | Avvio produzione (`node dist/index.js`) |
| `npm run lint` | Linting ESLint |
| `npm test` | Test con Vitest |
| `npm run test:watch` | Test in watch mode |

---

## Licenza

UNLICENSED — Proprietario — © Saturn Technologies
