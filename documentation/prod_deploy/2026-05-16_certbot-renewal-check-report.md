# Report tecnico: rinnovo automatico certificati Let's Encrypt

Data intervento: 2026-05-16

Macchina clienti: `195.231.60.198`

Dominio: `ismeperditevapore.it`

## Sintesi

E' stata verificata e riallineata la configurazione di rinnovo automatico dei certificati Let's Encrypt dopo il passaggio del servizio pubblico da Apache a nginx.

Il rinnovo automatico era gia' schedulato tramite `certbot.timer`, ma i file di rinnovo erano ancora configurati per il plugin Apache. La configurazione e' stata aggiornata per usare nginx, coerentemente con lo stack attuale.

Il dry-run di rinnovo e' stato eseguito con successo.

## Chiarimenti

- `Let's Encrypt` e' l'ente che emette gratuitamente il certificato digitale HTTPS.
- `Certbot` e' il software che rinnova automaticamente il certificato prima della scadenza.
- `Timer` significa esecuzione pianificata automatica (senza intervento manuale).
- `Dry-run` significa simulazione completa del rinnovo: verifica la procedura senza modificare il certificato reale in uso.

## Stato iniziale rilevato

Certbot era installato:

```text
certbot 1.21.0
```

Il rinnovo automatico era gia' schedulato:

```text
certbot.timer: enabled / active
```

Il service eseguito dal timer e':

```text
/usr/bin/certbot -q renew
```

Prima dell'intervento, i file di renewal erano configurati con:

```text
authenticator = apache
installer = apache
```

Questo era coerente con la precedente configurazione Apache, ma non con lo stato attuale del server, dove nginx e' il web server pubblico.

## Modifica effettuata

E' stato installato il plugin nginx di Certbot:

```text
python3-certbot-nginx 1.21.0-1
```

I file di renewal sono stati aggiornati per usare nginx:

```text
/etc/letsencrypt/renewal/ismeperditevapore.it.conf
/etc/letsencrypt/renewal/ismeperditevapore.it-0001.conf
/etc/letsencrypt/renewal/www.ismeperditevapore.it.conf
```

Configurazione finale:

```text
authenticator = nginx
installer = nginx
server = https://acme-v02.api.letsencrypt.org/directory
```

E' stato aggiunto un deploy hook per ricaricare nginx dopo un rinnovo riuscito:

```text
/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Il contenuto del hook esegue:

```text
nginx -t
systemctl reload nginx
```

Questo passaggio garantisce continuita' del servizio: nginx ricarica la configurazione/certificato senza interruzione percepibile dagli utenti.

Sono stati inoltre riallineati i file TLS helper di Certbot per nginx:

```text
/etc/letsencrypt/options-ssl-nginx.conf
/etc/letsencrypt/ssl-dhparams.pem
```

## Certificato attivo

Nginx usa il certificato:

```text
/etc/letsencrypt/live/ismeperditevapore.it/fullchain.pem
/etc/letsencrypt/live/ismeperditevapore.it/privkey.pem
```

Il certificato copre:

```text
DNS:ismeperditevapore.it
DNS:www.ismeperditevapore.it
```

Scadenza attuale:

```text
notAfter=Jul 1 12:23:14 2026 GMT
```

## Verifica effettuata

La configurazione nginx e' stata validata:

```text
nginx -t
syntax is ok
test is successful
```

E' stato eseguito un dry-run completo del rinnovo Certbot:

```text
certbot renew --dry-run
```

Risultato:

```text
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/ismeperditevapore.it-0001/fullchain.pem (success)
  /etc/letsencrypt/live/ismeperditevapore.it/fullchain.pem (success)
  /etc/letsencrypt/live/www.ismeperditevapore.it/fullchain.pem (success)
```

## Stato finale

Timer rinnovo:

```text
certbot.timer: enabled / active
```

Servizi:

```text
nginx: active
apache2: inactive
docker: active
mysql: active
```

Smoke test applicativo dopo la modifica:

```text
https://127.0.0.1/health  OK
```

Lo stack ISME v2 resta pubblicato tramite nginx e container Docker Compose v2.

## Conclusione

Il rinnovo automatico dei certificati Let's Encrypt e' ora coerente con lo stack nginx attivo sulla macchina.

Il timer Certbot e' attivo, i renewal file usano il plugin nginx, nginx viene ricaricato dopo un rinnovo riuscito, e il dry-run completo del rinnovo e' passato con successo.

In termini di rischio operativo, la probabilita' di scadenza inattesa del certificato e' ora significativamente ridotta rispetto alla configurazione precedente.
