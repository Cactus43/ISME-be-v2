# Report tecnico: blocco post-hook APT `update-motd`

Data osservazione: 2026-05-16

Macchina: server clienti `195.231.60.198`

Sistema osservato: Ubuntu 22.04.3 LTS

## Sintesi

Durante alcune operazioni `apt` sul server clienti, il comando completava la parte principale dell'installazione/rimozione pacchetti, ma restava bloccato nella fase finale di post-hook Ubuntu.

Il blocco non ha riguardato direttamente Docker, nginx, MySQL o l'applicazione ISME v2. Il processo rimasto appeso era legato all'aggiornamento del messaggio di login di Ubuntu, cioe' il riepilogo che mostra informazioni tipo aggiornamenti disponibili e stato del sistema quando si apre una sessione SSH.

## Sintomo osservato

Dopo comandi come:

```bash
apt-get install ...
apt-get remove ...
apt-get autoremove
```

il comando rimaneva in esecuzione pur avendo gia' installato o rimosso i pacchetti richiesti.

L'albero processi mostrava il blocco su:

```text
/usr/lib/update-notifier/update-motd-updates-available
/usr/lib/update-notifier/apt-check --human-readable
```

Esempio del pattern osservato:

```text
apt-get install/remove/autoremove
  sh -c ... /usr/lib/update-notifier/update-motd-updates-available ...
    /bin/sh -e /usr/lib/update-notifier/update-motd-updates-available
      /usr/bin/python3 /usr/lib/update-notifier/apt-check --human-readable
```

## Cosa fa questo hook

Ubuntu usa `update-motd` e `update-notifier` per aggiornare il Message Of The Day, cioe' il testo mostrato all'accesso SSH.

Una parte di questo sistema calcola quanti aggiornamenti sono disponibili tramite:

```bash
/usr/lib/update-notifier/apt-check --human-readable
```

Normalmente e' una chiamata rapida. In questo caso, invece, la chiamata restava appesa e impediva ad `apt` di terminare pulitamente.

## Impatto operativo

Impatto diretto sull'applicazione: nessuno osservato.

Impatto sulle operazioni di manutenzione: medio-basso, ma fastidioso.

Effetti concreti:

- `apt` sembra bloccato anche se il pacchetto e' gia' stato installato/rimosso.
- Le sessioni operative restano appese.
- Serve verificare se il processo principale ha gia' completato prima di intervenire.
- Puo' creare confusione durante installazioni o manutenzioni urgenti.

Durante il deploy ISME v2, questo comportamento e' comparso su:

- installazione di `nginx`, `docker.io`, `docker-compose`;
- installazione di `docker-compose-v2`;
- rimozione di `docker-compose` v1;
- `apt autoremove` delle dipendenze orfane.

## Cause probabili

Non e' stata fatta una diagnosi invasiva del sistema, quindi queste sono cause probabili, non definitive.

Le ipotesi piu' plausibili sono:

- installazione Ubuntu datata o non completamente aggiornata;
- reboot pendente del sistema;
- stato non ottimale di `update-notifier`, `unattended-upgrades` o `needrestart`;
- lentezza o blocco nel calcolo degli aggiornamenti disponibili;
- ambiente virtualizzato/ospitato su host non standard, da confermare con il fornitore o con chi gestisce la macchina.

La macchina mostrava anche:

```text
System restart required
```

Questo rafforza l'ipotesi che il sistema abbia aggiornamenti o componenti in attesa di riavvio.

## Workaround usato durante l'intervento

Quando il processo era bloccato chiaramente nel post-hook `update-motd`, e solo dopo aver verificato che la parte principale dell'operazione `apt` fosse gia' completata, sono stati terminati i processi rimasti appesi.

Questo ha permesso di proseguire senza impattare i servizi applicativi.

Nota: questo e' un workaround operativo, non una correzione strutturale.

## Raccomandazioni

Si consiglia di pianificare una finestra di manutenzione separata dal deploy applicativo.

Azioni consigliate:

1. Riavviare la macchina in una finestra concordata.
2. Eseguire un aggiornamento completo del sistema.
3. Verificare lo stato di `update-notifier`, `unattended-upgrades` e `needrestart`.
4. Verificare che `apt-check` termini correttamente:

```bash
/usr/lib/update-notifier/apt-check --human-readable
```

5. Controllare eventuali errori nei log:

```bash
journalctl -xe
journalctl -u unattended-upgrades --no-pager
tail -n 200 /var/log/apt/term.log
tail -n 200 /var/log/unattended-upgrades/unattended-upgrades.log
```

6. Se il problema persiste, valutare la reinstallazione/configurazione dei pacchetti coinvolti:

```bash
apt-get install --reinstall update-notifier-common unattended-upgrades needrestart
```

Da eseguire solo in manutenzione e dopo backup/snapshot appropriati.

## Stato finale dopo l'intervento ISME

Il problema dell'hook APT non ha impedito il completamento del deploy ISME v2.

Stato applicativo finale verificato:

```text
nginx: active/enabled
apache2: inactive/disabled
mysql: active
docker: active/enabled
docker compose v2: installed and working
pm2 legacy process: removed
```

Container applicativi finali:

```text
isme-v2-backend   healthy
isme-v2-frontend  healthy
```

Smoke test applicativi:

```text
https://ismeperditevapore.it/health  OK
https://ismeperditevapore.it/        OK
HTTP -> HTTPS redirect               OK
```

## Conclusione

Il comportamento osservato e' riconducibile a un problema di manutenzione del sistema operativo, non a un problema dell'applicazione ISME v2.

La piattaforma applicativa risulta funzionante, ma e' opportuno correggere il blocco del post-hook APT per rendere piu' affidabili le future operazioni di manutenzione sulla macchina.
