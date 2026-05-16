# Recap operativo: migrazione e deploy ISME v2 su macchina clienti

Data intervento: 2026-05-16

Macchina clienti: `195.231.60.198`

Dominio: `ismeperditevapore.it`

## Sintesi

E' stata completata la migrazione della macchina clienti dal servizio legacy Apache/PM2 al nuovo stack ISME v2 basato su Docker, Docker Compose v2, nginx e MySQL locale.

Il database migrato localmente e' stato caricato sulla macchina clienti come database applicativo v2, il frontend e il backend sono stati pubblicati in container Docker, e nginx e' stato configurato come reverse proxy HTTPS usando il certificato Let's Encrypt gia' presente.

## Backup iniziale

Prima del deploy e delle modifiche applicative e' stato creato un backup della macchina clienti.

Backup root sulla macchina clienti:

```text
/root/isme-client-backups/2026-05-16_10-28-49_UTC
```

Data/ora backup registrata nel `README.txt` remoto:

```text
2026-05-16T10:28:50Z
```

Dimensione finale del backup:

```text
366M
```

Il backup include:

```text
/var/www
/etc/apache2
/etc/letsencrypt
PM2 dump/config files
MySQL dump completo
```

Dump MySQL completo:

```text
linux-gz/mysql_dump.sql.gz
windows-zip/mysql_dump_windows.zip
extracted-db/mysql_dump.sql
```

Dump del solo database applicativo legacy effettivamente in uso:

```text
linux-gz/app_db_SteamLeaks.sql.gz
windows-zip/app_db_SteamLeaks_windows.zip
extracted-db/app_db_SteamLeaks.sql
```

Archivio file/config per Linux:

```text
linux-gz/files_config.tar.gz
```

Archivio file/config per Windows:

```text
windows-zip/files_config_windows.zip
```

Il backup e' stato verificato con controlli sugli archivi e checksum:

```text
SHA256SUMS.txt
```

Nota: il dump completo MySQL contiene anche tabelle di sistema, mentre `app_db_SteamLeaks.*` contiene solo il database legacy usato dall'applicazione.

## Database

Database locale sorgente usato per il deploy:

```text
v2_migrated_client_20260516
```

Database creato sulla macchina clienti:

```text
SteamLeaksV2
```

Conteggi verificati dopo l'import:

```text
users=5
interventions=908
media=7
```

## Deploy applicativo

Root del deploy v2 sulla macchina clienti:

```text
/opt/isme-v2
```

Componenti deployati:

```text
backend v2
frontend v2
```

Runtime backend:

```text
DB_NAME=SteamLeaksV2
PRIORITY_TRACKING_LIMIT=3
```

I secret runtime sono presenti solo nei file `.env` remoti e non sono riportati in questo recap.

## Docker e Compose

I container sono gestiti con Docker Compose v2.

File Compose attivo:

```text
/opt/isme-v2/compose.yaml
```

Versione verificata:

```text
Docker Compose version 2.40.3+ds1-0ubuntu1~22.04.1
```

Container applicativi finali:

```text
isme-v2-backend   healthy   127.0.0.1:8082->8082
isme-v2-frontend  healthy   127.0.0.1:3001->80
```

Il vecchio `docker-compose` v1 e' stato rimosso, insieme alle dipendenze orfane e agli artefatti Docker intermedi/dangling generati dai primi tentativi di build.

## Web server

Nginx e' ora il web server pubblico.

Apache e' stato disattivato e fermato.

Stato finale:

```text
nginx: active/enabled
apache2: inactive/disabled
mysql: active
docker: active/enabled
```

Nginx espone:

```text
80   HTTP -> HTTPS redirect
443  HTTPS pubblico
```

Backend e frontend sono esposti solo localmente alla macchina:

```text
127.0.0.1:8082  backend
127.0.0.1:3001  frontend
```

Le porte applicative non sono raggiungibili pubblicamente:

```text
public :8081  non raggiungibile
public :8082  non raggiungibile
```

## Certificato HTTPS

E' stato riutilizzato il certificato Let's Encrypt esistente:

```text
/etc/letsencrypt/live/ismeperditevapore.it/
```

Non e' stato necessario rigenerare il certificato.

## Legacy cleanup

Il vecchio processo PM2 legacy e' stato fermato e rimosso:

```text
pm2 jlist -> []
```

La lista PM2 vuota e' stata salvata, cosi' il processo legacy non dovrebbe ripartire al reboot.

## Smoke test finali

Smoke test verificati:

```text
https://ismeperditevapore.it/health      OK
https://www.ismeperditevapore.it/health  OK
https://ismeperditevapore.it/            OK
http://ismeperditevapore.it/             301 -> HTTPS
```

Smoke locali lato server:

```text
http://127.0.0.1:8082/health  OK
https://127.0.0.1/health      OK
```

## Note operative

Durante l'intervento e' stato osservato un problema non applicativo su APT/Ubuntu: alcune operazioni `apt` restavano bloccate nel post-hook `update-motd`.

Report dedicato:

```text
/Users/davide/Progetti/Alessandro/ISME/notes/2026-05-16_apt-update-motd-hook-report.md
```

## Stato finale

La macchina clienti risulta pubblicare ISME v2 tramite nginx e Docker Compose v2.

Non risultano container applicativi duplicati o processi legacy attivi.

Lo stack attivo e' composto da:

```text
nginx
mysql
docker
docker compose v2
isme-v2-backend
isme-v2-frontend
```
