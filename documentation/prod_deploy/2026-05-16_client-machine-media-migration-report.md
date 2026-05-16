# Report migrazione immagini legacy - 2026-05-16

## Contesto

Il servizio v2 su `ismeperditevapore.it` era stato pubblicato con il database migrato ma con sole `7` immagini, provenienti dalla precedente cartella locale di test.

Le immagini reali erano ancora presenti nella vecchia struttura legacy:

- `/var/www/ismeperditevapore.it/fotoPerdita`
- `/var/www/ismeperditevapore.it/fotoRiparazione`

È stata quindi rifatta la migrazione in locale includendo le immagini reali, poi il risultato è stato caricato online.

## Backup prima della sostituzione online

Prima della sostituzione su server è stato creato un backup mirato, senza duplicare nuovamente tutto il backup macchina già esistente:

`/root/isme-client-backups/2026-05-16_12-49-46_UTC_v2-media-refresh`

Contenuto principale:

- dump di `SteamLeaksV2` prima del refresh media
- archivio della precedente `/opt/isme-v2/backend/data`
- `SHA256SUMS.txt`

Nota: un primo tentativo di dump pochi secondi prima è stato interrotto dal permesso MySQL mancante sui tablespace. Il backup valido è quello indicato sopra, eseguito con `--no-tablespaces`.

## Preparazione locale

Cartella operativa locale:

`/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full`

Database locale rigenerato:

`v2_migrated_client_20260516_media_full`

Sorgente media locale preparata per la migration:

`/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full/migration_source_media`

Output dati v2 locale:

`/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full/v2_data`

Report dettagliati locali:

- `/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full/media_mapping_report.md`
- `/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full/media_staging_report.md`
- `/Users/davide/Progetti/Alessandro/ISME/notes/client-media-migration/2026-05-16_media-full/media_staging_report.csv`

## Criteri di mapping

Sono state migrate solo le immagini mappabili con certezza a un intervento v2.

Per i duplicati case-sensitive in `fotoRiparazione` è stata mantenuta solo la variante con nome tutto maiuscolo, come richiesto:

- mantenuto `LUBE1-0018-24.jpg`, escluso `Lube1-0018-24.jpg`
- mantenuto `LUBE1-0019-24.jpg`, escluso `Lube1-0019-24.jpg`

I file incerti non sono stati forzati.

## Conteggi

File legacy analizzati:

- `fotoPerdita`: `925`
- `fotoRiparazione`: `598`
- totale: `1523`

File selezionati per la migrazione:

- `photo_before`: `905`
- `photo_after`: `594`
- totale: `1499`

Database v2 finale:

- utenti: `5`
- interventi: `908`
- record media: `1499`
- `photo_before`: `905`
- `photo_after`: `594`

File fisici finali su server:

- `/opt/isme-v2/backend/data/photo_before`: `905`
- `/opt/isme-v2/backend/data/photo_after`: `594`

## Correzioni applicate

Sono state applicate solo correzioni con target univoco:

- `photo_after`: `LUBE2-0238.jpg` -> `LUBE2-0238-24.jpg`, intervento `384`, tag `LUBE2-0238-24`
- `photo_after`: `LUBE2-0276-24  .jpg` -> `LUBE2-0276-24.jpg`, intervento `479`, tag `LUBE2-0276-24`
- `photo_before`: `LHBE2-0286-24.jpg` -> `LUBE2-0286-24.jpg`, intervento `489`, tag `LUBE2-0286-24`
- `photo_before`: `LUBE2-0238.jpg` -> `LUBE2-0238-24.jpg`, intervento `384`, tag `LUBE2-0238-24`
- `photo_before`: `LUBE2-0275-24 .jpg` -> `LUBE2-0275-24.jpg`, intervento `478`, tag `LUBE2-0275-24`
- `photo_before`: `LUBE2-0276-24  .jpg` -> `LUBE2-0276-24.jpg`, intervento `479`, tag `LUBE2-0276-24`

Altri filename apparentemente errati non sono stati usati come correzione perché per lo stesso intervento/slot esisteva già anche il file con nome corretto. In questi casi è stato scelto il file già corretto:

- `CPX-B0007-24.jpg` escluso perché presente `CPX-B-0007-24.jpg`
- `CPX-B0008-24.jpg` escluso perché presente `CPX-B-0008-24.jpg`
- `CPX-B0009-24.jpg` escluso perché presente `CPX-B-0009-24.jpg`
- `CPX-B0010-24.jpg` escluso perché presente `CPX-B-0010-24.jpg`
- `CPX-B0039-24.jpg` escluso perché presente `CPX-B-0039-24.jpg`
- `LUBE-1-0021-24.jpg` escluso perché presente `LUBE1-0021-24.jpg`
- `LUBE1-0037.jpg` escluso perché presente `LUBE1-0037-26.jpg`
- `LUBE2-003-26.jpg` escluso perché presente `LUBE2-0003-26.jpg`
- `LUBE2-005-26.jpg` escluso perché presente `LUBE2-0005-26.jpg`
- `LUBE2-0304.jpg` escluso perché presente `LUBE2-0304-24.jpg`
- `UTA0001-24.jpg` escluso perché presente `UTA-0001-24.jpg`

## File non migrati perché incerti

Questi file non sono stati migrati perché non esisteva un mapping univoco e sicuro:

- `photo_after`: `LUBE2-0099-24.jpg` - nessun tag esatto; i candidati fuzzy cambiano numero o linea.
- `photo_after`: `LUBE2-0205-25.jpg` - nessun tag esatto; possibile mismatch anno/tag.
- `photo_before`: `LUBE1-0185-24.jpg` - possibile mismatch `LUBE1`/`LUBE2`.
- `photo_before`: `LUBE2-0004.jpg` - manca l'anno, candidati multipli `-24`, `-25`, `-26`.
- `photo_before`: `LUBE2-0061.jpg` - manca l'anno, candidati multipli `-24`, `-25`, `-26`.
- `photo_before`: `LUBE2-0099-24.jpg` - nessun tag esatto; i candidati fuzzy cambiano numero o linea.
- `photo_before`: `LUBE2-0109-24.jpg` - nessun tag esatto; candidati fuzzy non sicuri.
- `photo_before`: `LUBE2-0135-24.jpg` - nessun tag esatto; candidati fuzzy non sicuri.
- `photo_before`: `LUBE2-0205-25.jpg` - nessun tag esatto; possibile mismatch anno/tag.
- `photo_before`: `UTA-0003.jpg` - manca l'anno, candidati multipli `UTA-0003-24` e `UTA-0003-26`.

File escluso perché di test:

- `photo_before`: `TAG-PROVA.jpg`

## Caricamento online

Sono stati caricati sul server:

- dump locale rigenerato come `SteamLeaksV2`
- directory dati v2 con `1499` immagini selezionate

Durante l'estrazione del tar creato da macOS sono stati rimossi gli artefatti AppleDouble `._*` generati dal pacchetto. Dopo la rimozione, i conteggi fisici corrispondono ai record DB.

## Intervento successivo: fix permessi scrittura media

In un intervento successivo della stessa giornata e' stato rilevato che i nuovi upload immagine fallivano sia da portale backoffice sia da sincronizzazione app Electron.

Errore osservato nei log backend:

- `EACCES: permission denied, open '/data/photo_before/198_photo_before.png'`

Analisi root cause:

- il container `isme-v2-backend` gira come utente `uid=1001` (`isme`)
- il volume bind mount e' `/opt/isme-v2/backend/data -> /data`
- le directory sotto `/data` avevano owner `501:staff`, quindi non scrivibili dall'utente runtime del container

Correzione applicata sul server:

- `chown -R 1001:1001 /opt/isme-v2/backend/data`
- permessi directory a `775`
- permessi file a `664`

Verifica tecnica eseguita:

- test di scrittura dal container: `touch /data/photo_before/.perm_test` -> `write_ok`
- backend rimasto `healthy`
- assenza di nuovi errori `EACCES` nei log immediatamente successivi al fix

## Stato finale

Container:

- `isme-v2-backend`: healthy
- `isme-v2-frontend`: healthy

Smoke HTTPS:

- `https://ismeperditevapore.it/health`: OK
- `https://www.ismeperditevapore.it/health`: OK

Nota: il test diretto anonimo su `/api/media/:id/file` restituisce correttamente `401`, perché la rotta media è autenticata.
