Ja, **JoplinBridge** ist absolut treffend, frei von Namenskolisionen im offiziellen Plugin-Verzeichnis und klingt genau nach einem sauberen Senior-Dev-Projekt.

Hier ist die aktualisierte Dokumentation als `master-konzept.md` mit dem finalen Namen.

---

## Master-Konzept: JoplinBridge

Dieses Dokument definiert die vollständige Architektur, Spezifikation und Agenten-Instructions für die Entwicklung des Plugins **JoplinBridge** zur bidirektionalen Synchronisation zwischen lokalen Markdown-Ordnern (Vim) und der Joplin-SQLite-Datenbank.

---

## 1. Projekt-Übersicht & Ziele

* **Projektname:** JoplinBridge
* **Ziel:** Lokale `.md`-Dateien in einem spezifischen Verzeichnis nahtlos und bidirektional mit Joplin abgleichen.
* **Primäres Interface:** Externer Dateizugriff über Vim $\leftrightarrow$ Interner Joplin-Client.
* **Auslöser (Triggers):**
* Dateisystem-Änderungen (File Watcher auf lokaler Seite beim Speichern in Vim).
* Joplin-interne Änderungen (Event-Emitter der Joplin Data API).


* **Konfliktstrategie:** Zeitstempel-basierter Last-Write-Wins (LWW) mit Sicherheitskopie bei Konflikten.

---

## 2. Architektur & Tech-Stack

* **Plattform:** Joplin Plugin (TypeScript, Node.js-Umgebung).
* **Bibliotheken:**
* `fs-extra`: Robuste Dateioperationen.
* `chokidar` (oder natives `fs.watch`): Überwachung des lokalen Markdown-Ordners.


* **APIs:**
* Joplin Data API (`joplin.data.*`) für Notizen, Notebooks und Metadaten.
* Joplin Workspace API (`joplin.workspace.*`) für UI-Events und aktive Notizen.



---

## 3. Datenfluss & Synchronisations-Logik

```text
[ Vim / Editor ] <---> ( Lokaler Ordner ) <---> [ JoplinBridge ] <---> [ Joplin SQLite DB ]

```

1. **Vim $\rightarrow$ Joplin (Lokale Änderung):**
* Der Anwender bearbeitet eine `.md`-Datei und speichert in Vim.
* Der File-Watcher registriert das Event (`change`).
* Das Plugin liest den Inhalt, extrahiert Titel und Body.
* Abgleich des Zeitstempels (`mtime`) gegen die Joplin-Notiz (`updated_time`). Ist die Datei neuer, wird ein `PUT /notes/{id}` an die Joplin Data API gesendet.


2. **Joplin $\rightarrow$ Vim (Interne Änderung):**
* Der Anwender ändert eine Notiz direkt in Joplin.
* Das Joplin Workspace Event `noteChange` fires.
* Das Plugin schreibt den aktuellen Notiz-Inhalt in die entsprechende `.md`-Datei zurück (inklusive Pufferung zur Vermeidung von Endlosschleifen).



---

## 4. Anweisungen für KI-Entwickleragenten (AI Agent Instructions)

Wenn du als KI-Agent an JoplinBridge arbeitest, befolge strikt diese Vorgaben:

1. **Kein Code-Raten:** Verwende ausschließlich die offizielle Joplin Plugin API und dokumentierte Node.js-Module. Verifiziere Funktionssignaturen vor dem Generieren von Implementierungen.
2. **Endlosschleifen-Prävention:** Implementiere einen internen Lock-Mechanismus oder einen Zeitstempel-Puffer (`lastSyncTime`), um zu verhindern, dass geschriebene Dateien sofort wieder als externe Änderung eingelesen werden.
3. **Pfadsicherheit:** Nutze absolute Pfade und validiere Verzeichnispfade über `path.resolve` und `fs-extra`, um plattformübergreifende Fehler zu verhindern.
4. **Fehlerbehandlung:** Fange Datei-I/O-Fehler und API-Timeouts ab. Logge Fehler sauber in die Joplin-Konsole (`console.error`).

---

## 5. Projekt-Struktur (Senior Dev Layout)

```text
joplinbridge/
├── .eslintrc.json
├── package.json
├── tsconfig.json
├── webpack.config.js
├── src/
│   ├── index.ts          # Plugin-Einstiegspunkt & Registrierung
│   ├── settings.ts       # Konfigurations-UI & Settings-Definition
│   ├── syncManager.ts    # Kern-Logik für bidirektionale Synchronisation
│   ├── fileWatcher.ts    # Überwachung des lokalen Ordners
│   └── utils.ts          # Hilfsfunktionen (Frontmatter, Zeitstempel, Sanitization)
└── publish/
    └── com.aeon022.joplinbridge.jpl  # Kompiliertes Plugin

```
