# Guida operativa: migrazione ISME v2 da un server a un altro

Data: 2026-06-15

## Obiettivo

Questa guida descrive come migrare in sicurezza uno stack ISME v2 da un server sorgente (Server A) a un server destinazione (Server B), mantenendo continuita' del servizio e possibilita' di rollback.

Ambito coperto:
- backup completo e backup mirati
- migrazione database
- migrazione media (photo_before, photo_after)
- deploy container backend/frontend
- configurazione nginx HTTPS
- validazioni finali
- piano rollback

Principi operativi usati in questa guida:
- nessuna modifica distruttiva senza backup verificato
- passaggi idempotenti quando possibile
- confronto numerico source/target prima del go-live
- rollback pronto prima del cutover

## Prerequisiti

Verificare prima di iniziare:
- accesso SSH root o utente con sudo su Server A e Server B
- dominio DNS gestibile (A record verso nuovo server al momento dello switch)
- certificati TLS disponibili o rigenerabili con Certbot
- Docker e Docker Compose v2 installabili su Server B
- MySQL operativo su Server B
- spazio disco sufficiente su Server B per DB + media + immagini Docker
- finestra di manutenzione approvata e freeze scritture pianificato
- test di restore provato almeno una volta su ambiente non produzione (consigliato)

Variabili suggerite per i comandi:

```bash
DOMAIN="ismeperditevapore.it"
SRC_HOST="<ip_o_host_server_a>"
DST_HOST="<ip_o_host_server_b>"
APP_ROOT="/opt/isme-v2"
BACKUP_ROOT="/root/isme-client-backups"
DB_NAME="SteamLeaksV2"
DB_USER="<utente_db>"
DB_PASS="<password_db>"
APP_UID="1001"
APP_GID="1001"
```

## Strategia consigliata

Approccio in 2 fasi:
1. Pre-staging su Server B (tutto pronto, test locale OK)
2. Cutover breve (freeze scritture, ultimo dump/sync delta, switch DNS/proxy)

Beneficio: downtime ridotto e rollback rapido.

## Fase 1 - Inventario e freeze plan

Sul Server A raccogliere stato attuale:

```bash
systemctl is-active nginx apache2 docker mysql
cd /opt/isme-v2 && docker compose ps
ss -ltnp | grep -E ':80|:443|:3001|:8082'
```

Annotare:
- path dati backend (tipico: /opt/isme-v2/backend/data)
- nome DB in uso (tipico: SteamLeaksV2)
- porte locali backend/frontend
- file env usati da backend e frontend

Preparare finestra di migrazione:
- comunicare freeze scritture utenti
- definire orario cutover
- definire responsabile go/no-go e rollback

## Fase 2 - Backup sul Server A

Creare backup completo (consigliato) e backup mirato (obbligatorio prima del cutover).

### 2.1 Backup completo macchina (consigliato)

Contenuto minimo:
- /var/www
- /etc/apache2
- /etc/letsencrypt
- dump MySQL completo
- config PM2 legacy (se presenti)

### 2.2 Backup mirato ISME v2 (obbligatorio)

```bash
set -euo pipefail
umask 077

TS="$(date -u +%Y-%m-%d_%H-%M-%S_UTC)"
OUT="$BACKUP_ROOT/${TS}_v2-migration"
mkdir -p "$OUT"

# Dump DB applicativo
mysqldump --single-transaction --no-tablespaces -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$OUT/${DB_NAME}.sql"
gzip -9 "$OUT/${DB_NAME}.sql"

# Archivio media e runtime data
tar -czf "$OUT/backend_data.tar.gz" -C "$APP_ROOT/backend" data

# Snapshot metriche sorgente per confronto post-restore
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS users FROM users;" > "$OUT/source_count_users.txt"
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS interventions FROM interventions;" > "$OUT/source_count_interventions.txt"
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS media FROM media;" > "$OUT/source_count_media.txt"
find "$APP_ROOT/backend/data/photo_before" -type f | wc -l > "$OUT/source_count_photo_before.txt"
find "$APP_ROOT/backend/data/photo_after" -type f | wc -l > "$OUT/source_count_photo_after.txt"

# Checksum
(cd "$OUT" && sha256sum * > SHA256SUMS.txt)

echo "Backup pronto in: $OUT"
```

Verifica backup:

```bash
cd "$OUT"
sha256sum -c SHA256SUMS.txt
```

## Fase 3 - Preparazione Server B

Installare stack base:

```bash
apt-get update
apt-get install -y nginx docker.io docker-compose-v2 mysql-server certbot python3-certbot-nginx
systemctl enable --now docker nginx mysql certbot.timer
```

Nota: se APT resta apparentemente bloccato in coda su update-motd, verificare prima che installazione/rimozione pacchetti sia realmente conclusa (caso gia' osservato su Ubuntu 22.04).

Creare root applicativa:

```bash
mkdir -p /opt/isme-v2
```

Copiare progetto backend/frontend e file compose nel path finale:

```bash
# Esempio: da repository o artifact
git clone <repo-backend> /opt/isme-v2/backend
git clone <repo-frontend> /opt/isme-v2/frontend
cp <compose_file> /opt/isme-v2/compose.yaml
```

Configurare .env runtime su Server B (non committare secret):
- backend .env con DB_HOST, DB_NAME, DB_USER, DB_PASS, JWT, ecc.
- frontend env build/runtime coerenti con dominio finale
- conservare una copia cifrata/permessa dei file env usati nel go-live per audit tecnico

## Fase 4 - Migrazione DB e media verso Server B

Trasferire backup mirato da A a B (esempio con scp):

```bash
scp -r root@"$SRC_HOST":"$OUT" root@"$DST_HOST":"$BACKUP_ROOT/"
```

Sul Server B:

```bash
set -euo pipefail

LATEST_BACKUP="$(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -name '*_v2-migration' | sort | tail -n1)"
test -n "$LATEST_BACKUP"

# Verifica integrita' backup
(cd "$LATEST_BACKUP" && sha256sum -c SHA256SUMS.txt)

# Ripristino DB
mysql -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# Scelta conservativa: pulire il DB target prima dell'import per evitare residui
mysql -u"$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS ${DB_NAME}_pre_restore_backup;"
mysql -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE ${DB_NAME}_pre_restore_backup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysqldump --single-transaction --no-tablespaces -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" | mysql -u"$DB_USER" -p"$DB_PASS" "${DB_NAME}_pre_restore_backup"
mysql -u"$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS $DB_NAME;"
mysql -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gzip -dc "$LATEST_BACKUP/${DB_NAME}.sql.gz" | mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"

# Ripristino media/data
mkdir -p /opt/isme-v2/backend
rm -rf /opt/isme-v2/backend/data
tar -xzf "$LATEST_BACKUP/backend_data.tar.gz" -C /opt/isme-v2/backend
```

Impostare permessi corretti per scrittura media (fondamentale):

```bash
chown -R "$APP_UID":"$APP_GID" /opt/isme-v2/backend/data
find /opt/isme-v2/backend/data -type d -exec chmod 775 {} \;
find /opt/isme-v2/backend/data -type f -exec chmod 664 {} \;
```

Verifica rapida permessi da container (dopo avvio backend):

```bash
docker exec -it isme-v2-backend sh -lc 'touch /data/photo_before/.perm_test && echo write_ok && rm -f /data/photo_before/.perm_test'
```

## Fase 5 - Avvio container e test locali su Server B

Build e up:

```bash
cd /opt/isme-v2
docker compose up -d --build
docker compose ps
```

Health check locali:

```bash
curl -fsS http://127.0.0.1:8082/health
```

Controlli DB minimi:

```bash
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS users FROM users;"
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS interventions FROM interventions;"
mysql -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" -e "SELECT COUNT(*) AS media FROM media;"
```

Controlli file media minimi:

```bash
find /opt/isme-v2/backend/data/photo_before -type f | wc -l
find /opt/isme-v2/backend/data/photo_after -type f | wc -l
```

Confronto consigliato source vs target:
- confrontare i valori correnti con i file nel backup `source_count_*.txt`
- accettare il cutover solo se i conteggi sono coerenti o differiscono per cause note e documentate

## Fase 6 - Configurazione nginx + TLS su Server B

Configurare virtual host con:
- redirect 80 -> 443
- reverse proxy verso frontend locale (127.0.0.1:3001)
- reverse proxy API/health verso backend locale (127.0.0.1:8082)

Verifica config:

```bash
nginx -t
systemctl reload nginx
```

TLS con Certbot (se non si riutilizza cert esistente):

```bash
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN"
certbot renew --dry-run
```

Verificare che renewal usi plugin nginx nei file:
- /etc/letsencrypt/renewal/<domain>.conf

Valori attesi:

```text
authenticator = nginx
installer = nginx
```

Hook di deploy consigliato (riavvio soft nginx post-rinnovo):

```bash
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/usr/bin/env bash
set -e
nginx -t
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

## Fase 7 - Cutover

Checklist immediatamente prima del cutover:
- freeze scritture attivo
- ultimo dump DB da Server A completato
- ultimo sync media completato
- container su Server B healthy
- health locale backend OK
- nginx test OK
- confronto conteggi source/target completato

Eseguire switch traffico:
- aggiornare DNS A record verso Server B
- in alternativa, spostare reverse proxy/LB verso Server B

Ridurre TTL DNS in anticipo (es. 300s) per accelerare propagazione.

## Fase 8 - Smoke test post-cutover

Test pubblici:

```bash
curl -I "http://$DOMAIN/"
curl -fsS "https://$DOMAIN/health"
curl -fsS "https://www.$DOMAIN/health"
ss -ltnp | grep -E ':3001|:8082' || true
```

Esiti attesi:
- HTTP risponde 301 verso HTTPS
- /health risponde OK
- frontend raggiungibile via dominio

Test sicurezza attesi:
- porte backend/frontend non esposte pubblicamente
- endpoint media protetti da autenticazione (401 senza token)

## Fase 9 - Pulizia legacy e hardening

Dopo stabilizzazione:
- fermare/disabilitare Apache legacy (se non piu' usato)
- fermare/rimuovere processi PM2 legacy
- eliminare container dangling e immagini non usate
- mantenere backup e checksum della migrazione

Esempi:

```bash
systemctl disable --now apache2
pm2 save
pm2 list

docker image prune -f
docker container prune -f
```

## Piano rollback

Condizioni rollback (esempi):
- health pubblica KO oltre soglia concordata
- errori applicativi bloccanti
- problemi DB non risolvibili rapidamente

Procedura rollback rapida:
1. riportare DNS/LB verso Server A
2. riattivare stack pubblico su Server A (nginx/apache secondo scenario)
3. verificare health e login
4. congelare Server B per analisi post-mortem

Se sul Server B ci sono state scritture dopo il cutover fallito:
1. esportare delta dati da Server B (DB + media nuovi)
2. decidere se riallinearli su Server A oppure annullarli con approvazione business
3. documentare la scelta nel report di incidente

Nota: mantenere Server A intatto fino a chiusura positiva del periodo di osservazione.

## Checklist finale (Go-Live)

- [ ] backup completo eseguito e verificato
- [ ] backup mirato DB+media con SHA256 verificato
- [ ] DB ripristinato su Server B
- [ ] media ripristinate su Server B
- [ ] permessi /opt/isme-v2/backend/data corretti (uid/gid runtime)
- [ ] container backend/frontend healthy
- [ ] nginx attivo e testato
- [ ] certificato TLS valido e renew dry-run OK
- [ ] smoke test pubblici OK
- [ ] piano rollback pronto e validato
- [ ] report finale con conteggi source/target allegato

## Troubleshooting rapido

### APT sembra bloccato a fine comando
Possibile blocco su post-hook update-motd. Verificare che l'azione principale sia conclusa prima di intervenire sui processi bloccati. Pianificare manutenzione OS dedicata.

### Upload immagini fallisce con EACCES
Correggere owner/permessi su /opt/isme-v2/backend/data come indicato in Fase 4.

### Certbot renew non coerente con nginx
Controllare i file renewal in /etc/letsencrypt/renewal/ e verificare plugin nginx.

### Conteggi DB e file media non allineati
Ripetere il controllo mapping e assicurarsi che il tar media non contenga artefatti extra (es. file AppleDouble ._*).

## Allegati consigliati da produrre a fine attivita'

- recap migrazione (data, host, versione compose, stato servizi)
- report media migration (conteggi, esclusioni, correzioni)
- report allineamento team/unita'
- report certbot renewal check
- report problemi infrastrutturali emersi (es. apt update-motd)
