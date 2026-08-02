# JoplinBridge 🌁

**JoplinBridge** ist ein performantes, bidirektionales Synchronisations-Plugin für [Joplin](https://joplinapp.org/). Es verbindet Joplin-Notizen nahtlos mit einem lokalen Verzeichnis von `.md`-Dateien, sodass Notizen direkt mit externen Texteditoren (z. B. **Vim**, **Neovim**, **VS Code**, **Sublime Text**) bearbeitet werden können.

---

## 🌟 Hauptmerkmale

* **Bidirektionale Echtzeit-Synchronisation:**
  * **Vim $\rightarrow$ Joplin:** Änderungen an lokalen `.md`-Dateien werden sofort an die Joplin-Datenbank übertragen.
  * **Joplin $\rightarrow$ Vim:** Änderungen in der Joplin-App werden direkt in die lokalen Dateien zurückgeschrieben.
* **Eindeutiges ID-Mapping via Frontmatter:**
  Jede synchronisierte Datei enthält im YAML-Frontmatter die Joplin Notiz-UUID (`joplin_id`) und den Zeitstempel der letzten Aktualisierung (`updated_at`).
* **Automatische Subfolder- & Notizbuch-Strukturierung:**
  Unterordner innerhalb deines Sync-Verzeichnisses (z. B. `docs/api/`, `docs/setup/`) werden automatisch als Unter-Notizbücher in Joplin gespiegelt. Die Ordnerstruktur auf deiner Festplatte bleibt exakt erhalten.
* **Endlosschleifen-Prävention (Lock-Mechanismus):**
  Ein interner In-Memory Schreibschutz (`activeWrites`) verhindert, dass vom Plugin geschriebene Dateien als externe Änderungen fehlinterpretiert werden.
* **Intelligenter Bootstrap (Last-Write-Wins):**
  Beim Anwendungsstart vergleicht JoplinBridge die Datei-Änderungszeiten (`mtime`) mit den Joplin-Zeitstempeln (`updated_time`), um den aktuellsten Stand zu gewährleisten.
* **Schutz vor Datenverlust:**
  Lokale Löschungen werden aus Sicherheitsgründen nicht automatisch in Joplin gelöscht.

---

## 📦 Installation

### Option 1: Fertiges Plugin (`.jpl`) installieren

1. Lade die Datei `com.aeon022.joplinbridge.jpl` aus dem Ordner `publish/` herunter.
2. Öffne **Joplin**.
3. Navigiere zu **Extras** $\rightarrow$ **Optionen** (macOS: **Joplin** $\rightarrow$ **Einstellungen**).
4. Wähle im linken Menü den Punkt **Plugins**.
5. Klicke oben rechts auf das Zahnrad-Symbol ⚙️ und wähle **Aus Datei installieren...**.
6. Wähle die Datei `com.aeon022.joplinbridge.jpl` aus.
7. Starte Joplin neu, wenn du dazu aufgefordert wirst.

---

### Option 2: Aus dem Quellcode bauen

Voraussetzungen: Node.js (v18+) und npm.

```bash
# 1. Repository klonen & Abhängigkeiten installieren
git clone https://github.com/aeon022/joplinbridge.git
cd joplinbridge
npm install

# 2. Tests ausführen
npm test

# 3. Plugin bauen & .jpl Paket erstellen
npm run pack
```

Die fertige Plugin-Datei befindet sich anschließend unter `publish/com.aeon022.joplinbridge.jpl`.

---

## ⚙️ Konfiguration & Ordner hinzufügen

Es gibt zwei einfache Wege, Verzeichnisse zu verknüpfen:

### Methode A: Über das Joplin-Menü (Mit Drag & Drop)
1. Klicke in Joplin auf **Werkzeuge** (Tools) $\rightarrow$ **JoplinBridge: Add Local Sync Folder...**.
2. **Drag & Drop:** Ziehe den Projektordner (z. B. deinen `docs/`-Ordner) einfach per Drag & Drop aus dem Finder / Datei-Manager in das blaue Feld des Dialogs. Der Pfad wird automatisch eingetragen.
3. Klicke auf **OK** – der Ordner ist sofort verknüpft.

### Methode B: Über die Plugin-Einstellungen
1. Gehe in Joplin zu **Einstellungen** (Preferences) $\rightarrow$ **JoplinBridge** (in der linken Seitenleiste).
2. Trage bei **Local Sync Directories** deine Pfade ein (zeilenweise oder kommagetrennt).

---

## 📝 Dateiformat-Beispiel

Eine von JoplinBridge verwaltete Notiz sieht im lokalen Dateisystem wie folgt aus:

```markdown
---
joplin_id: "c23a4b56c-7890-4abc-def0-123456789abc"
updated_at: "2026-08-02T17:30:00.000Z"
---

# Meine Notiz aus Vim

Dies ist der Notizinhalt, der bidirektional mit Joplin synchronisiert wird.
```

---

## 🛠️ Entwickler & Skripte

* `npm run build`: Kompiliert das Plugin im Entwicklungsmodus.
* `npm run watch`: Automatisches Re-Build bei Dateiänderungen.
* `npm run dist`: Produktions-Build.
* `npm run pack`: Produktions-Build inkl. Erstellung der `.jpl`-Datei in `publish/`.
* `npm test`: Führt die Unit-Tests für Hilfsfunktionen und Frontmatter-Parsing aus.

---

## 📄 Lizenz

MIT License.
