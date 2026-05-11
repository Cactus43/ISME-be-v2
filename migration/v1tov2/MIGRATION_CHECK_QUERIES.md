# Migration Check Queries (v1 -> v2)

Questo file contiene query SQL pronte da incollare per verificare la migrazione in modo puntuale.

## Come usarlo

1. Esegui le query v1 sul DB sorgente (`SteamLeaks`).
2. Esegui le query v2 sul DB target (`SteamLeaksV2_migration_test` o quello configurato).
3. Confronta i risultati per contatori globali e distribuzioni (`GROUP BY`).

---

## 1) Conteggi Globali

### v1 (SteamLeaks)

```sql
-- Utenti backoffice
SELECT COUNT(*) AS users_count
FROM users;

-- Operatori mobile
SELECT COUNT(*) AS operators_count
FROM operators;

-- Interventi non eliminati
SELECT COUNT(*) AS interventions_count
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0;

-- Team distinti presenti negli interventi
SELECT COUNT(DISTINCT TRIM(business_team)) AS teams_distinct
FROM steamleaks
WHERE business_team IS NOT NULL
  AND TRIM(business_team) <> ''
  AND IFNULL(is_deleted, 0) = 0;

-- Unit distinte presenti negli interventi
SELECT COUNT(DISTINCT TRIM(unit)) AS units_distinct
FROM steamleaks
WHERE unit IS NOT NULL
  AND TRIM(unit) <> ''
  AND IFNULL(is_deleted, 0) = 0;

-- Token totali (backoffice + mobile)
SELECT
  (SELECT COUNT(*) FROM auth_tokens) AS backoffice_tokens,
  (SELECT COUNT(*) FROM operators_auth_tokens) AS mobile_tokens,
  (SELECT COUNT(*) FROM auth_tokens) + (SELECT COUNT(*) FROM operators_auth_tokens) AS total_tokens;
```

### v2 (SteamLeaksV2)

```sql
-- Utenti totali
SELECT COUNT(*) AS users_count
FROM users;

-- Operatori (utenti con role=operator)
SELECT COUNT(*) AS operators_count
FROM users
WHERE role = 'operator';

-- Interventi non eliminati
SELECT COUNT(*) AS interventions_count
FROM interventions
WHERE deleted_at IS NULL;

-- Team non eliminati
SELECT COUNT(*) AS teams_count
FROM teams
WHERE deleted_at IS NULL;

-- Unit non eliminate
SELECT COUNT(*) AS units_count
FROM units
WHERE deleted_at IS NULL;

-- Access token totali
SELECT COUNT(*) AS access_tokens_count
FROM access_tokens;

-- Media non eliminati
SELECT COUNT(*) AS media_count
FROM media
WHERE deleted_at IS NULL;
```

---

## 2) Distribuzione Team (GROUP BY)

### v1

```sql
SELECT
  TRIM(business_team) AS team_name,
  COUNT(*) AS interventions_count
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0
  AND business_team IS NOT NULL
  AND TRIM(business_team) <> ''
GROUP BY TRIM(business_team)
ORDER BY interventions_count DESC, team_name ASC;
```

### v2

```sql
SELECT
  i.business_team AS team_code,
  t.name AS team_name,
  COUNT(*) AS interventions_count
FROM interventions i
LEFT JOIN teams t
  ON t.code = i.business_team
 AND t.deleted_at IS NULL
WHERE i.deleted_at IS NULL
GROUP BY i.business_team, t.name
ORDER BY interventions_count DESC, team_code ASC;
```

---

## 3) Distribuzione Unit (GROUP BY)

### v1

```sql
SELECT
  TRIM(unit) AS unit_name,
  COUNT(*) AS interventions_count
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0
  AND unit IS NOT NULL
  AND TRIM(unit) <> ''
GROUP BY TRIM(unit)
ORDER BY interventions_count DESC, unit_name ASC;
```

### v2

```sql
SELECT
  i.unit AS unit_name,
  COUNT(*) AS interventions_count
FROM interventions i
WHERE i.deleted_at IS NULL
  AND i.unit IS NOT NULL
  AND TRIM(i.unit) <> ''
GROUP BY i.unit
ORDER BY interventions_count DESC, unit_name ASC;
```

---

## 4) Distribuzione Team + Unit (GROUP BY combinato)

### v1

```sql
SELECT
  TRIM(business_team) AS team_name,
  TRIM(unit) AS unit_name,
  COUNT(*) AS interventions_count
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0
  AND business_team IS NOT NULL
  AND TRIM(business_team) <> ''
  AND unit IS NOT NULL
  AND TRIM(unit) <> ''
GROUP BY TRIM(business_team), TRIM(unit)
ORDER BY team_name ASC, unit_name ASC;
```

### v2

```sql
SELECT
  i.business_team AS team_code,
  i.unit AS unit_name,
  COUNT(*) AS interventions_count
FROM interventions i
WHERE i.deleted_at IS NULL
  AND i.business_team IS NOT NULL
  AND TRIM(i.business_team) <> ''
  AND i.unit IS NOT NULL
  AND TRIM(i.unit) <> ''
GROUP BY i.business_team, i.unit
ORDER BY team_code ASC, unit_name ASC;
```

---

## 5) Controllo Tag Interventi (univocita e mismatch)

### v1

```sql
-- Tag duplicati in v1 (dovrebbe idealmente essere 0 righe)
SELECT tag, COUNT(*) AS c
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0
GROUP BY tag
HAVING COUNT(*) > 1
ORDER BY c DESC, tag ASC;
```

### v2

```sql
-- Tag duplicati in v2 (dovrebbe idealmente essere 0 righe)
SELECT tag, COUNT(*) AS c
FROM interventions
WHERE deleted_at IS NULL
GROUP BY tag
HAVING COUNT(*) > 1
ORDER BY c DESC, tag ASC;
```

---

## 6) Controllo Media per tipo

### v2

```sql
-- Quante foto before/after sono state migrate
SELECT media_type, COUNT(*) AS media_count
FROM media
WHERE deleted_at IS NULL
GROUP BY media_type
ORDER BY media_type;

-- Interventi senza photo_before
SELECT COUNT(*) AS interventions_without_before
FROM interventions i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM media m
    WHERE m.intervention_id = i.id
      AND m.media_type = 'photo_before'
      AND m.deleted_at IS NULL
  );

-- Interventi senza photo_after
SELECT COUNT(*) AS interventions_without_after
FROM interventions i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM media m
    WHERE m.intervention_id = i.id
      AND m.media_type = 'photo_after'
      AND m.deleted_at IS NULL
  );
```

---

## 7) Controllo integrita team/unit in v2

```sql
-- Interventi con team_code non risolto su teams
SELECT i.business_team AS team_code, COUNT(*) AS c
FROM interventions i
LEFT JOIN teams t
  ON t.code = i.business_team
 AND t.deleted_at IS NULL
WHERE i.deleted_at IS NULL
  AND i.business_team IS NOT NULL
  AND TRIM(i.business_team) <> ''
  AND t.id IS NULL
GROUP BY i.business_team
ORDER BY c DESC, team_code ASC;

-- Interventi con unit valorizzata ma assente in tabella units (per team)
SELECT i.business_team AS team_code, i.unit AS unit_name, COUNT(*) AS c
FROM interventions i
LEFT JOIN units u
  ON u.team_id = (
       SELECT t.id
       FROM teams t
       WHERE t.code = i.business_team
         AND t.deleted_at IS NULL
       LIMIT 1
     )
 AND u.name = i.unit
 AND u.deleted_at IS NULL
WHERE i.deleted_at IS NULL
  AND i.unit IS NOT NULL
  AND TRIM(i.unit) <> ''
  AND u.id IS NULL
GROUP BY i.business_team, i.unit
ORDER BY c DESC, team_code ASC, unit_name ASC;
```

---

## 8) Confronto rapido con UNION (stessa query, due DB)

Esegui una query alla volta cambiando DB/schema (o usando prefisso schema.tabella):

```sql
-- Esempio su interventi per team (v1)
SELECT 'v1' AS source, TRIM(business_team) AS team_key, COUNT(*) AS c
FROM steamleaks
WHERE IFNULL(is_deleted, 0) = 0
  AND business_team IS NOT NULL
  AND TRIM(business_team) <> ''
GROUP BY TRIM(business_team)
ORDER BY team_key;

-- Esempio su interventi per team (v2)
SELECT 'v2' AS source, business_team AS team_key, COUNT(*) AS c
FROM interventions
WHERE deleted_at IS NULL
  AND business_team IS NOT NULL
  AND TRIM(business_team) <> ''
GROUP BY business_team
ORDER BY team_key;
```

---

## 9) Query di diagnostica sui file non risolti (orphan tags)

Se durante la migrazione alcuni filename non vengono risolti, verifica se il tag base esiste in v1.

```sql
-- Cerca un tag specifico in v1 (esempio)
SELECT id, tag, business_team, unit, inspection_date
FROM steamleaks
WHERE tag = 'CPX-B0007'
   OR tag = 'CPX-B0007-24';
```

Suggerimento: per filename del tipo `CPX-A-0001-24.jpg`, in genere il tag atteso e `CPX-A-0001`.

---

## 10) Check consistenza naming media in v2

```sql
-- File non conformi al naming backend: {id}_{media_type}.{ext}
SELECT id, intervention_id, media_type, filename
FROM media
WHERE deleted_at IS NULL
  AND filename NOT REGEXP CONCAT('^', intervention_id, '_(photo_before|photo_after)\\.[A-Za-z0-9]+$')
ORDER BY id DESC
LIMIT 200;
```

---

## Note pratiche

- `users` in v2 include sia utenti backoffice v1 sia operatori migrati come utenti (`role='operator'`), quindi il totale puo essere maggiore del `users` v1.
- `media` in v2 non ha equivalente 1:1 in v1 (v1 usava campi `img_url` / `after_img_url` in `steamleaks`).
- Piccole differenze su token possono dipendere da vincoli/normalizzazioni durante l'upsert.
