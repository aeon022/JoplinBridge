import os
import re
import sqlite3
import time

def restore_notes(db_path, docs_dir):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Load existing notebook folders
    c.execute("SELECT id, title, parent_id FROM folders")
    folders_list = c.fetchall()
    
    folder_by_id = {f[0]: {'id': f[0], 'title': f[1], 'parent_id': f[2]} for f in folders_list}
    folder_by_title = {f[1].lower(): f[0] for f in folders_list}

    print(f"Loaded {len(folders_list)} notebook folders from database.")

    # Find root sync folder or default folder
    root_folder_id = ''
    if folders_list:
        root_folder_id = folders_list[0][0]

    # Collect markdown files
    md_files = []
    for root, dirs, files in os.walk(docs_dir):
        for f in files:
            if f.endswith('.md'):
                md_files.append(os.path.join(root, f))

    print(f"Found {len(md_files)} Markdown files to restore.")

    restored_count = 0

    for filepath in md_files:
        try:
            mtime_ms = int(os.path.getmtime(filepath) * 1000)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Parse frontmatter
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
                print(f"Skipping {filepath} (no joplin_id)")
                continue

            # Title extraction
            title = os.path.basename(filepath)[:-3]
            h1_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
            if h1_match and h1_match.group(1):
                title = h1_match.group(1).trim() if hasattr(h1_match.group(1), 'trim') else h1_match.group(1).strip()

            # Parent folder determination
            dir_name = os.path.basename(os.path.dirname(filepath)).lower()
            parent_id = folder_by_title.get(dir_name, root_folder_id)

            # Insert or replace note in notes table
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

    # Remove notes from deleted_items table
    c.execute("DELETE FROM deleted_items WHERE item_type = 1")
    conn.commit()

    # Verify notes table count
    c.execute("SELECT count(*) FROM notes WHERE deleted_time = 0")
    total_notes_now = c.fetchone()[0]

    conn.close()
    print(f"Successfully restored {restored_count} notes into SQLite database.")
    print(f"Total active notes in database: {total_notes_now}")

if __name__ == '__main__':
    db_target = '/Users/gweiher/.config/joplin-desktop/database.sqlite'
    docs_source = '/Users/gweiher/Developing/Projects/missionctl/postctl/documents'
    restore_notes(db_target, docs_source)
