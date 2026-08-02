# AI Agent Instructions: JoplinBridge

Dieses Dokument enthält die verbindlichen technischen Leitlinien, architektonischen Schutzmechanismen und API-Konventionen für alle KI-Agenten, die an der Entwicklung, Wartung oder Erweiterung von **JoplinBridge** beteiligt sind.

---

## 1. Core Principles & Guardrails

* **Kein Code-Raten:** Verwende ausschließlich verifizierte Signaturen der offiziellen Joplin Plugin API, der Joplin Data API und etablierter Node.js-Kernmodule (`fs-extra`, `path`).
* **In-Memory State Safety:** Vermeide globale Mutable States außerhalb definierter Manager-Klassen. Alle Transaktionszustände müssen gekapselt sein.
* **Plattformunabhängigkeit:** Verwende für alle Pfadoperationen konsequent `path.resolve` und `path.join`, um plattformübergreifende Pfadfehler (macOS/Linux/Windows) auszuschließen.

---

## 2. Technische Kernarchitektur & Komponenten

### 2.1. ID-Mapping-Strategie

Um die Integrität bei Dateioperationen (insbesondere bei Umbenennungen oder Verschieben in Vim) zu wahren, wird das Mapping zwischen lokaler Datei und Joplin-Notiz wie folgt gelöst:

* **Frontmatter-Injektion:** Jede von Joplin synchronisierte Markdown-Datei **muss** im YAML-Frontmatter die eindeutige Joplin-UUID enthalten:
```yaml
---
joplin_id: "c23a4b56c... (UUIDv4)"
updated_at: "2026-08-02T16:30:00Z"
---

```


* **Fallback / Neue Dateien:** Wird eine komplett neue `.md`-Datei im lokalen Ordner angelegt (ohne Frontmatter), interpretiert das Plugin dies als Erstellungsbefehl und erzeugt eine neue Notiz über die Joplin Data API, woraufhin das Frontmatter dynamisch in die lokale Datei zurückgeschrieben wird.

### 2.2. Endlosschleifen-Prävention & Lock-Mechanismus

Da Dateisystem-Watcher (`chokidar` oder natives `fs.watch`) auf Schreibvorgänge reagieren, führt ein ungesicherter Sync zu einer Endlosschleife (Vim schreibt $\rightarrow$ Watcher triggert $\rightarrow$ Joplin API schreibt $\rightarrow$ Datei wird lokal aktualisiert $\rightarrow$ Watcher triggert erneut).

* **Pfad-basiertes Locking:** Der `SyncManager` führt ein temporäres Set von aktiven Schreibpfaden (`activeWrites = new Set<string>()`).
* **Ablauf:**
1. Bevor das Plugin eine lokale Datei schreibt, wird der Pfad zu `activeWrites` hinzugefügt.
2. Der File-Watcher prüft bei einem `change`-Event, ob der Pfad in `activeWrites` liegt. Ist dies der Fall, wird das Event ignoriert und der Pfad aus dem Set entfernt.



### 2.3. Initial Sync / Bootstrap-Prozedur

Beim Systemstart des Plugins darf kein blinder Event-Trigger erfolgen. Es gilt folgende Initialisierungsreihenfolge:

1. **Laden der Settings:** Auslesen des konfigurierten lokalen Zielordners über die Joplin Settings API.
2. **Bestandsaufnahme:** Einlesen des lokalen Ordners und Abgleich aller vorhandenen `.md`-Dateien mit der Joplin-Datenbank (`GET /notes`).
3. **Zeitstempel-Abgleich (LWW - Last-Write-Wins):**
* Ist die lokale Datei neuer (`mtime` > Joplin `updated_time`), gewinnt lokal $\rightarrow$ Update in Joplin.
* Ist die Joplin-Notiz neuer (`updated_time` > `mtime`), gewinnt Joplin $\rightarrow$ Überschreiben der lokalen Datei.



---

## 3. Fehlerbehandlung & Logging

* **Keine ungesicherten Promises:** Alle Datei-I/O-Operationen (`fs-extra`) und API-Calls müssen in `try/catch`-Blöcke eingefasst sein.
* **Graceful Degradation:** Schlägt ein API-Call fehl (z. B. Netzwerk-Timeout bei externem Sync), darf das Plugin nicht abstürzen. Der Fehler muss über `console.error('[JoplinBridge]', error)` protokolliert und der Vorgang in die nächste Sync-Schleife verschoben werden.

---

## 4. Code-Konventionen für Agenten

* **Sprache:** TypeScript im gesamten `src/`-Verzeichnis.
* **Modul-Importe:** Verwende ES-Module-Syntax entsprechend den Joplin-Vorgaben:
```typescript
import joplin from 'api';
import * as fs from 'fs-extra';
import * as path from 'path';

```


* **Asynchrones Programming:** Konsequente Nutzung von `async/await` statt Callback-Höllen.
