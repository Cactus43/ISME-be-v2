# Report allineamento team e unità - 2026-05-16

## Obiettivo

Allineare l'anagrafica delle unità applicative alla lista di riferimento `team_units.csv`, mantenendo le associazioni corrette tra team e unità.

## Chiarimenti

- `Anagrafica` = elenco ufficiale e strutturato dei valori ammessi nel sistema.
- `Allineamento` = verifica e correzione dei dati affinche' coincidano con la lista di riferimento approvata.
- `Intervento storico` = dato gia' registrato in passato, da preservare per coerenza documentale.

## Stato iniziale rilevato

Il team `CPX-D` era già presente nell'ambiente online.

Rispetto alla lista di riferimento mancavano le seguenti unità:

- `CPX-B`: `MEA`, `TGCU`, `T4`, `T5HF`
- `CPX-C`: `ALKY`, `C3C4SPL`, `PPS`, `BD`, `CTW1`, `CTW2`
- `CPX-D`: `R4`, `R5`, `PSU`, `R1`, `SCF`, `SWS`, `CTW4`
- `LUBE1`: `CTW5`
- `LUBE2`: `CS`, `CTW8`
- `OFFSITE`: `PONTILE`, `BLS`
- `UTA`: `CTW6`

Erano inoltre presenti unità non previste dalla lista di riferimento:

- `CPX-B`: `zolfo1`
- `CPX-B`: `zolfo2`
- `CPX-C`: `CANDELA`

Sono state rilevate anche due discrepanze sui dati intervento:

- `2` interventi erano associati a `CPX-A / DAU2`
- `1` intervento era associato a `CPX-C / CANDELA`

## Decisioni applicate

Le unità `zolfo1` e `zolfo2` sono state rimosse dall'anagrafica unità, perché sostituite dai valori corretti `S1` e `S2`.

Gli interventi associati a `CPX-A / DAU2` sono stati riallineati a `LUBE2 / DAU2`, perché `DAU2` appartiene al team `LUBE2`.

L'unità `CANDELA` è stata mantenuta e lasciata associata a `CPX-C`, perché già usata da un intervento storico.

Questa decisione evita perdita di continuita' sul dato storico: il sistema resta coerente sia con la lista di riferimento sia con le registrazioni pregresse.

## Stato finale

Conteggio finale unità per team:

| Team | Numero unità |
|---|---:|
| CPX-A | 5 |
| CPX-B | 8 |
| CPX-C | 7 |
| CPX-D | 7 |
| LUBE1 | 5 |
| LUBE2 | 5 |
| OFFSITE | 3 |
| UTA | 2 |

La lista finale comprende tutte le unità presenti nel file di riferimento più `CPX-C / CANDELA`, mantenuta intenzionalmente per coerenza con i dati storici.

## Verifiche finali

- Unità mancanti rispetto alla lista di riferimento: `0`
- Unità extra non autorizzate: `0`
- `CPX-A / DAU2` negli interventi: `0`
- `zolfo1` / `zolfo2` in anagrafica unità: `0`
- `CPX-C / CANDELA` presente in anagrafica: sì

È stato inoltre verificato che non è rimasta alcuna tabella persistente di lavoro usata per l'allineamento.

In altre parole, l'attivita' e' stata chiusa senza lasciare artefatti tecnici temporanei nel database di produzione.
