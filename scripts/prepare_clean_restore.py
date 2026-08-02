import os
import re
import sqlite3
import json

def clean_restore():
    db_path = os.path.expanduser('~/.config/joplin-desktop/database.sqlite')
    docs_dir = '/Users/gweiher/Developing/Projects/missionctl/postctl/documents'
    settings_path = os.path.expanduser('~/.config/joplin-desktop/settings.json')

    # 1. Disable Joplin background sync in settings.json
    if os.path.exists(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            settings['sync.target'] = 0
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2)
            print("Disabled background sync in settings.json (sync.target = 0).")
        except Exception as e:
            print(f"Error updating settings.json: {e}")

    # 2. Connect to database
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Clear deleted_items and sync_items
    c.execute("DELETE FROM deleted_items;")
    c.execute("DELETE FROM sync_items;")
    print("Cleared deleted_items and sync_items tables.")

    # Load folders
    c.execute("SELECT id, title, parent_id FROM folders")
    folders_list = c.fetchall()
    folder_by_title = {f[1].lower(): f[0] for f in folders_list}
    root_folder_id = folders_list[0][0] if folders_list else ''

    # Collect and restore markdown files
    md_files = []
    for root, dirs, files in os.walk(docs_dir):
        for f in files:
            if f.endswith('.md'):
                md_files.append(os.path.join(root, f))

    print(f"Restoring {len(md_files)} markdown files into database...")

    restored_count = 0
    for filepath in md_files:
        try:
            mtime_ms = int(os.path.getmtime(filepath) * 1000)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            fm_match = re.match(r'^---\r?\n([\s\S]*?)\r?\n---\r?\n?', content)
            body = content
            joplin_id = None

            if fm_match:
                raw_fm = fm_match.group(1)
                body = content[fm_match.end():]
                id_match = re.search(r'joplin_id:\s*["\']?([a-f0-9\-]+)["\']?', raw_fm)
                if id_match:
                    joplin_id = id_match.group(1)

            if not joplin_id:
                continue

            title = os.path.basename(filepath)[:-3]
            h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
            if h1_match and h1_match.group(1):
                title = h1_match.group(1).strip()

            dir_name = os.path.basename(os.path.dirname(filepath)).lower()
            parent_id = folder_by_title.get(dir_name, root_folder_id)

            c.execute("""
                INSERT OR REPLACE INTO notes (
                    id, parent_id, title, body, created_time, updated_time,
                    user_created_time, user_updated_time, is_conflict, deleted_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
            """, (
                joplin_id,
                parent_id,
                title,
                body,
                mtime_ms,
                mtime_ms,
                mtime_ms,
                mtime_ms
            ))
            restored_count += 1
        except Exception as err:
            print(f"Error restoring {filepath}: {err}")

    conn.commit()

    c.execute("SELECT count(*) FROM notes WHERE deleted_time = 0;")
    active_notes = c.fetchone()[0]

    c.execute("SELECT count(*) FROM folders;")
    active_folders = c.fetchone()[0]

    conn.close()

    print(f"SUCCESS: Restored {restored_count} notes.")
    print(f"Active Notes in DB: {active_notes}")
    print(f"Active Folders in DB: {active_folders}")

if __name__ == '__main__':
    clean_restore()
