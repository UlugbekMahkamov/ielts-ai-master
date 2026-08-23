"""
SQLite & PostgreSQL (Supabase) Database manager and Spaced Repetition System (SRS) logic
for IELTS AI Master Mobile Application.
"""

import sqlite3
import json
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

TMP_DIR = "/tmp" if os.path.exists("/tmp") and os.access("/tmp", os.W_OK) else os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(TMP_DIR, "ai_ielts.db")


class DictRow(dict):
    def __getitem__(self, item):
        if isinstance(item, int):
            return list(self.values())[item]
        return super().__getitem__(item)
    def get(self, item, default=None):
        if isinstance(item, int):
            vals = list(self.values())
            return vals[item] if item < len(vals) else default
        return super().get(item, default)


class PostgresCursorWrapper:
    def __init__(self, raw_cursor, conn):
        self._cur = raw_cursor
        self._conn = conn
        self.lastrowid = None

    def execute(self, query: str, params: Any = None):
        q = query
        # Adapt SQLite schema & syntax to PostgreSQL
        q = re.sub(r'INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT', 'SERIAL PRIMARY KEY', q, flags=re.IGNORECASE)
        already_has_conflict_clause = 'on conflict' in q.lower()
        if 'settings' in q.lower() and 'insert' in q.lower():
            q = re.sub(r'INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+settings', 'INSERT INTO settings', q, flags=re.IGNORECASE)
            if not already_has_conflict_clause:
                q = q.rstrip('; \n') + ' ON CONFLICT (key) DO NOTHING'
        elif 'vocabulary' in q.lower() and 'insert' in q.lower():
            q = re.sub(r'INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+vocabulary', 'INSERT INTO vocabulary', q, flags=re.IGNORECASE)
            if not already_has_conflict_clause:
                q = q.rstrip('; \n') + ' ON CONFLICT (word) DO NOTHING'
            if 'returning' not in q.lower():
                q = q.rstrip('; \n') + ' RETURNING id'
        elif 'insert into' in q.lower() and 'returning' not in q.lower() and 'user_stats' not in q.lower():
            q = q.rstrip('; \n') + ' RETURNING id'
        
        q = q.replace('?', '%s')
        
        if params:
            self._cur.execute(q, params)
        else:
            self._cur.execute(q)
            
        if 'returning id' in q.lower() and self._cur.description and self._cur.rowcount > 0:
            try:
                row = self._cur.fetchone()
                if row:
                    self.lastrowid = row[0]
            except Exception:
                pass
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        if self._cur.description:
            cols = [desc[0] for desc in self._cur.description]
            return DictRow(dict(zip(cols, row)))
        return row

    def fetchall(self):
        rows = self._cur.fetchall()
        if not rows:
            return []
        if self._cur.description:
            cols = [desc[0] for desc in self._cur.description]
            return [DictRow(dict(zip(cols, r))) for r in rows]
        return rows

    def close(self):
        self._cur.close()


class PostgresConnectionWrapper:
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        return PostgresCursorWrapper(self._conn.cursor(), self._conn)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


DEFAULT_SUPABASE_URL = "postgresql://postgres.tpjrmyjlniwzzbtsyhuw:T6NZ6HInCwMdcnRV@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

def get_db_connection():
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or DEFAULT_SUPABASE_URL
    if db_url and db_url.strip():
        try:
            import urllib.parse
            import pg8000.dbapi
            parsed = urllib.parse.urlparse(db_url.strip())
            raw_conn = pg8000.dbapi.connect(
                user=urllib.parse.unquote(parsed.username or "postgres"),
                password=urllib.parse.unquote(parsed.password or ""),
                host=parsed.hostname or "localhost",
                port=parsed.port or 5432,
                database=parsed.path.lstrip("/") or "postgres",
                ssl_context=True
            )
            return PostgresConnectionWrapper(raw_conn)
        except Exception as e:
            print(f"PostgreSQL connection error: {e}. Falling back to SQLite.")

    conn = sqlite3.connect(DB_FILE, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except Exception:
        pass
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Articles table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        level TEXT DEFAULT 'B2',
        status TEXT DEFAULT 'new',
        word_count INTEGER DEFAULT 0,
        listening_data TEXT,
        speaking_data TEXT,
        writing_data TEXT,
        created_at TEXT NOT NULL,
        last_practiced_at TEXT
    )
    """)

    # 2. Podcasts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS podcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        audio_url TEXT,
        transcript TEXT,
        status TEXT DEFAULT 'new',
        listening_data TEXT,
        speaking_data TEXT,
        writing_data TEXT,
        created_at TEXT NOT NULL,
        last_practiced_at TEXT
    )
    """)

    # 3. Vocabulary (SRS) table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        translation TEXT,
        definition TEXT,
        ipa TEXT,
        example TEXT,
        collocations TEXT,
        source TEXT,
        interval_stage INTEGER DEFAULT 1,
        interval_days INTEGER DEFAULT 1,
        review_count INTEGER DEFAULT 0,
        next_review_date TEXT NOT NULL,
        last_reviewed_date TEXT,
        is_learned INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    # 4. Mistakes repository table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        error_text TEXT NOT NULL,
        corrected_text TEXT NOT NULL,
        explanation TEXT,
        error_type TEXT DEFAULT 'grammar',
        source_type TEXT,
        source_title TEXT,
        created_at TEXT NOT NULL,
        practice_count INTEGER DEFAULT 0,
        is_resolved INTEGER DEFAULT 0
    )
    """)

    # 5. Sentences history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sentences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        structure_or_word TEXT NOT NULL,
        pattern_hint TEXT,
        user_sentence TEXT NOT NULL,
        ai_feedback TEXT,
        band_score REAL DEFAULT 6.0,
        corrected_sentence TEXT,
        is_daily INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
    )
    """)

    # 6. Sentence Structures table (extracted from Articles/Podcasts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sentence_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        name TEXT,
        hint TEXT,
        example TEXT,
        original_sentence TEXT,
        source TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 7. Dictations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dictations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        topic TEXT,
        transcript TEXT NOT NULL,
        audio_filename TEXT,
        connected_speech_notes TEXT,
        accuracy_rate REAL DEFAULT 0.0,
        status TEXT DEFAULT 'new',
        created_at TEXT NOT NULL
    )
    """)

    # 8. Study Plans table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        tasks_json TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        completed_at TEXT
    )
    """)

    # 9. User Stats & Streak table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        streak_days INTEGER DEFAULT 0,
        last_active_date TEXT,
        lessons_done INTEGER DEFAULT 0,
        words_learned INTEGER DEFAULT 0,
        articles_added INTEGER DEFAULT 0,
        podcasts_added INTEGER DEFAULT 0,
        dictations_done INTEGER DEFAULT 0,
        sentences_written INTEGER DEFAULT 0,
        mistakes_logged INTEGER DEFAULT 0
    )
    """)

    # 10. App Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # 11. Coach Conversations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coach_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        mode TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        meta_json TEXT,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("SELECT id FROM user_stats WHERE id = 1")
    if not cursor.fetchone():
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
        INSERT INTO user_stats (id, streak_days, last_active_date, lessons_done, words_learned, articles_added, podcasts_added, dictations_done, sentences_written, mistakes_logged)
        VALUES (1, 1, ?, 0, 0, 0, 0, 0, 0, 0)
        """, (today_str,))

    default_settings = {
        "llm_provider": "gemini",
        "gemini_api_key": "",
        "openai_api_key": "",
        "groq_api_key": "",
        "custom_api_base": "",
        "custom_api_key": "",
        "custom_model": "",
        "tts_voice": "en-GB-RyanNeural",
        "tts_speed": "+0%",
        "stt_engine": "web_speech"
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    conn.commit()
    conn.close()


# ------------------ STATS & STREAK ------------------ #

def update_streak_and_activity():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT streak_days, last_active_date FROM user_stats WHERE id = 1")
        row = cursor.fetchone()
        today = datetime.now().date()
        today_str = today.strftime("%Y-%m-%d")

        if row:
            last_date_str = row["last_active_date"]
            streak = row["streak_days"]
            if last_date_str:
                last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
                diff = (today - last_date).days
                if diff == 1:
                    streak += 1
                elif diff > 1:
                    streak = 1
            else:
                streak = 1

            cursor.execute("""
            UPDATE user_stats
            SET streak_days = ?, last_active_date = ?
            WHERE id = 1
            """, (streak, today_str))
            conn.commit()
    finally:
        conn.close()


def get_dashboard_summary() -> Dict[str, Any]:
    update_streak_and_activity()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM user_stats WHERE id = 1")
        stats = dict(cursor.fetchone() or {})

        cursor.execute("SELECT COUNT(*) as count FROM articles")
        articles_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM articles WHERE status = 'completed'")
        articles_completed = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM podcasts")
        podcasts_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM podcasts WHERE status = 'completed'")
        podcasts_completed = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM vocabulary")
        vocab_total = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM vocabulary WHERE is_learned = 1")
        vocab_learned = cursor.fetchone()["count"]

        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("SELECT COUNT(*) as count FROM vocabulary WHERE next_review_date <= ? AND is_learned = 0", (today_str,))
        vocab_due_today = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM mistakes")
        mistakes_total = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM sentences")
        sentences_total = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM dictations")
        dictations_total = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM dictations WHERE status = 'completed'")
        dictations_completed = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM study_plans")
        lessons_total = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM study_plans WHERE is_completed = 1")
        lessons_completed = cursor.fetchone()["count"]

        article_prog = round((articles_completed / articles_count * 100) if articles_count > 0 else 0)
        podcast_prog = round((podcasts_completed / podcasts_count * 100) if podcasts_count > 0 else 0)
        dictation_prog = round((dictations_completed / dictations_total * 100) if dictations_total > 0 else 0)
        vocab_prog = round((vocab_learned / vocab_total * 100) if vocab_total > 0 else 0)
        study_prog = round((lessons_completed / lessons_total * 100) if lessons_total > 0 else 0)
        sentences_prog = min(100, round((sentences_total / 20) * 100))
        mistakes_prog = min(100, round((mistakes_total * 10)))

        return {
            "streak_days": stats.get("streak_days", 1),
            "lessons_done": lessons_completed,
            "lessons_total": lessons_total,
            "words_learned": vocab_learned,
            "words_total": vocab_total,
            "words_due_today": vocab_due_today,
            "articles_added": articles_count,
            "articles_completed": articles_completed,
            "podcasts_added": podcasts_count,
            "podcasts_completed": podcasts_completed,
            "dictations_done": dictations_completed,
            "dictations_total": dictations_total,
            "sentences_written": sentences_total,
            "mistakes_logged": mistakes_total,
            "progress": {
                "study_plan": study_prog,
                "article": article_prog,
                "podcast": podcast_prog,
                "dictation": dictation_prog,
                "vocabulary": vocab_prog,
                "mistakes": mistakes_prog,
                "sentences": sentences_prog
            }
        }
    finally:
        conn.close()


# ------------------ ARTICLES ------------------ #

def add_single_article(title: str, content: str, level: str = "B2") -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        word_count = len(content.split())
        cursor.execute("""
        INSERT INTO articles (title, content, level, word_count, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (title.strip(), content.strip(), level, word_count, created_at))
        article_id = cursor.lastrowid
        cursor.execute("UPDATE user_stats SET articles_added = articles_added + 1 WHERE id = 1")
        conn.commit()
        return article_id
    finally:
        conn.close()


def add_bulk_articles(articles_data: List[Dict[str, str]]) -> List[int]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM articles")
        current_count = cursor.fetchone()["count"]

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        inserted_ids = []

        for idx, item in enumerate(articles_data, start=current_count + 1):
            content = item.get("content", "").strip()
            if not content:
                continue
            title = item.get("title", "").strip()
            if not title:
                title = f"Article {idx}"
            level = item.get("level", "B2")
            word_count = len(content.split())

            cursor.execute("""
            INSERT INTO articles (title, content, level, word_count, created_at)
            VALUES (?, ?, ?, ?, ?)
            """, (title, content, level, word_count, created_at))
            inserted_ids.append(cursor.lastrowid)

        cursor.execute("UPDATE user_stats SET articles_added = articles_added + ? WHERE id = 1", (len(inserted_ids),))
        conn.commit()
        return inserted_ids
    finally:
        conn.close()


def get_articles_list(search: str = "", status: str = "all") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT id, title, level, status, word_count, created_at, (listening_data IS NOT NULL) as has_tasks FROM articles WHERE 1=1"
        params = []

        if search:
            query += " AND (title LIKE ? OR content LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        if status != "all":
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY id ASC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_article_by_id(article_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
        row = cursor.fetchone()
        if not row:
            return None
        data = dict(row)
        for field in ["listening_data", "speaking_data", "writing_data"]:
            if data.get(field):
                try:
                    data[field] = json.loads(data[field])
                except Exception:
                    pass
        return data
    finally:
        conn.close()


def save_article_ai_tasks(article_id: int, listening: Dict, speaking: Dict, writing: Dict):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE articles
        SET listening_data = ?, speaking_data = ?, writing_data = ?
        WHERE id = ?
        """, (json.dumps(listening, ensure_ascii=False),
              json.dumps(speaking, ensure_ascii=False),
              json.dumps(writing, ensure_ascii=False),
              article_id))
        conn.commit()
    finally:
        conn.close()


def update_article_status(article_id: int, status: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        UPDATE articles
        SET status = ?, last_practiced_at = ?
        WHERE id = ?
        """, (status, now_str, article_id))
        conn.commit()
    finally:
        conn.close()


# ------------------ PODCASTS ------------------ #

def add_single_podcast(title: str, url: str, audio_url: str = "", transcript: str = "") -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM podcasts")
        current_count = cursor.fetchone()["count"]

        if not title:
            title = f"Podcast {current_count + 1}"

        status = "transcribed" if transcript.strip() else "new"
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")

        cursor.execute("""
        INSERT INTO podcasts (title, url, audio_url, transcript, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (title.strip(), url.strip(), audio_url.strip(), transcript.strip(), status, created_at))
        pod_id = cursor.lastrowid
        cursor.execute("UPDATE user_stats SET podcasts_added = podcasts_added + 1 WHERE id = 1")
        conn.commit()
        return pod_id
    finally:
        conn.close()


def add_bulk_podcasts(podcasts_data: List[Dict[str, str]]) -> List[int]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM podcasts")
        current_count = cursor.fetchone()["count"]

        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        inserted_ids = []

        for idx, item in enumerate(podcasts_data, start=current_count + 1):
            url = item.get("url", "").strip()
            transcript = item.get("transcript", "").strip()
            
            if not url and not transcript:
                continue

            if not url:
                url = f"Audio {idx}"

            title = item.get("title", "").strip()
            if not title:
                title = f"Podcast {idx}"
            audio_url = item.get("audio_url", "").strip()
            status = "transcribed" if transcript else "new"

            cursor.execute("""
            INSERT INTO podcasts (title, url, audio_url, transcript, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (title, url, audio_url, transcript, status, created_at))
            inserted_ids.append(cursor.lastrowid)

        if inserted_ids:
            cursor.execute("UPDATE user_stats SET podcasts_added = podcasts_added + ? WHERE id = 1", (len(inserted_ids),))
            conn.commit()
        return inserted_ids
    finally:
        conn.close()


def get_podcasts_list() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, url, audio_url, status, created_at, (transcript IS NOT NULL AND length(transcript) > 0) as has_transcript FROM podcasts ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_podcast_by_id(podcast_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM podcasts WHERE id = ?", (podcast_id,))
        row = cursor.fetchone()
        if not row:
            return None
        data = dict(row)
        for field in ["listening_data", "speaking_data", "writing_data"]:
            if data.get(field):
                try:
                    data[field] = json.loads(data[field])
                except Exception:
                    pass
        return data
    finally:
        conn.close()


def update_podcast_transcript(podcast_id: int, transcript: str, audio_url: str = ""):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if audio_url:
            cursor.execute("""
            UPDATE podcasts
            SET transcript = ?, audio_url = ?, status = 'transcribed'
            WHERE id = ?
            """, (transcript, audio_url, podcast_id))
        else:
            cursor.execute("""
            UPDATE podcasts
            SET transcript = ?, status = 'transcribed'
            WHERE id = ?
            """, (transcript, podcast_id))
        conn.commit()
    finally:
        conn.close()


def save_podcast_ai_tasks(podcast_id: int, listening: Dict, speaking: Dict, writing: Dict):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE podcasts
        SET listening_data = ?, speaking_data = ?, writing_data = ?
        WHERE id = ?
        """, (json.dumps(listening, ensure_ascii=False),
              json.dumps(speaking, ensure_ascii=False),
              json.dumps(writing, ensure_ascii=False),
              podcast_id))
        conn.commit()
    finally:
        conn.close()


# ------------------ VOCABULARY (SRS) ------------------ #

SRS_INTERVALS = {
    1: 1,
    2: 4,
    3: 7,
    4: 14,
    5: 30
}

def add_vocabulary_word(word: str, translation: str = "", definition: str = "", ipa: str = "",
                        example: str = "", collocations: str = "", source: str = "") -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        word_clean = word.strip().lower()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        next_review = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        cursor.execute("SELECT * FROM vocabulary WHERE word = ?", (word_clean,))
        existing = cursor.fetchone()
        if existing:
            return dict(existing)

        cursor.execute("""
        INSERT INTO vocabulary (word, translation, definition, ipa, example, collocations, source, interval_stage, interval_days, next_review_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
        """, (word_clean, translation, definition, ipa, example, collocations, source, next_review, created_at))
        word_id = cursor.lastrowid
        if word_id:
            cursor.execute("SELECT * FROM vocabulary WHERE id = ?", (word_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
        cursor.execute("SELECT * FROM vocabulary WHERE word = ?", (word_clean,))
        row = cursor.fetchone()
        return dict(row) if row else {"word": word_clean, "status": "added"}
    finally:
        conn.close()


def review_vocabulary_card(word_id: int, is_correct: bool) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vocabulary WHERE id = ?", (word_id,))
        row = cursor.fetchone()
        if not row:
            return {}

        current_stage = row["interval_stage"]
        review_count = row["review_count"] + 1
        today = datetime.now()

        if is_correct:
            if current_stage < 5:
                new_stage = current_stage + 1
                interval_days = SRS_INTERVALS[new_stage]
                next_date = (today + timedelta(days=interval_days)).strftime("%Y-%m-%d")
                is_learned = 0
            else:
                new_stage = 6
                interval_days = 999
                next_date = (today + timedelta(days=365)).strftime("%Y-%m-%d")
                is_learned = 1
                cursor.execute("UPDATE user_stats SET words_learned = words_learned + 1 WHERE id = 1")
        else:
            new_stage = 1
            interval_days = 1
            next_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
            is_learned = 0

        last_reviewed = today.strftime("%Y-%m-%d %H:%M")

        cursor.execute("""
        UPDATE vocabulary
        SET interval_stage = ?, interval_days = ?, review_count = ?, next_review_date = ?, last_reviewed_date = ?, is_learned = ?
        WHERE id = ?
        """, (new_stage, interval_days, review_count, next_date, last_reviewed, is_learned, word_id))
        conn.commit()

        cursor.execute("SELECT * FROM vocabulary WHERE id = ?", (word_id,))
        return dict(cursor.fetchone())
    finally:
        conn.close()


def get_vocabulary_by_stage(stage: Optional[int] = None, only_due: bool = False) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")

        query = "SELECT * FROM vocabulary WHERE 1=1"
        params = []

        if stage is not None:
            if stage == 6:
                query += " AND is_learned = 1"
            else:
                query += " AND interval_stage = ? AND is_learned = 0"
                params.append(stage)

        if only_due:
            query += " AND next_review_date <= ? AND is_learned = 0"
            params.append(today_str)

        query += " ORDER BY id DESC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def get_vocabulary_counts_by_intervals() -> Dict[str, int]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")

        counts = {
            "stage_1": 0,
            "stage_2": 0,
            "stage_3": 0,
            "stage_4": 0,
            "stage_5": 0,
            "learned": 0,
            "due_today": 0,
            "total": 0
        }

        cursor.execute("SELECT interval_stage, is_learned, COUNT(*) as count FROM vocabulary GROUP BY interval_stage, is_learned")
        for r in cursor.fetchall():
            if r["is_learned"] == 1:
                counts["learned"] += r["count"]
            else:
                st = r["interval_stage"]
                if 1 <= st <= 5:
                    counts[f"stage_{st}"] += r["count"]

        cursor.execute("SELECT COUNT(*) as count FROM vocabulary WHERE next_review_date <= ? AND is_learned = 0", (today_str,))
        counts["due_today"] = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM vocabulary")
        counts["total"] = cursor.fetchone()["count"]

        return counts
    finally:
        conn.close()


# ------------------ MISTAKES ------------------ #

def add_mistake(error_text: str, corrected_text: str, explanation: str,
                error_type: str = "grammar", source_type: str = "speaking", source_title: str = "") -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        INSERT INTO mistakes (error_text, corrected_text, explanation, error_type, source_type, source_title, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (error_text.strip(), corrected_text.strip(), explanation.strip(), error_type, source_type, source_title, created_at))
        mistake_id = cursor.lastrowid

        cursor.execute("UPDATE user_stats SET mistakes_logged = mistakes_logged + 1 WHERE id = 1")
        conn.commit()
        return mistake_id
    finally:
        conn.close()


def get_mistakes_list(error_type: str = "all", is_resolved: Optional[int] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT * FROM mistakes WHERE 1=1"
        params = []

        if error_type != "all":
            query += " AND error_type = ?"
            params.append(error_type)
        if is_resolved is not None:
            query += " AND is_resolved = ?"
            params.append(is_resolved)

        query += " ORDER BY id DESC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


# ------------------ SENTENCE STRUCTURES & SENTENCES ------------------ #

def add_sentence_structure(pattern: str, name: str, hint: str, example: str, original_sentence: str, source: str) -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        INSERT INTO sentence_structures (pattern, name, hint, example, original_sentence, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (pattern.strip(), name.strip(), hint.strip(), example.strip(), original_sentence.strip(), source.strip(), created_at))
        struct_id = cursor.lastrowid
        conn.commit()
        return struct_id
    finally:
        conn.close()


def get_all_sentence_structures() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sentence_structures ORDER BY id DESC")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def save_user_sentence(structure_or_word: str, pattern_hint: str, user_sentence: str,
                       ai_feedback: str, band_score: float, corrected_sentence: str) -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        INSERT INTO sentences (structure_or_word, pattern_hint, user_sentence, ai_feedback, band_score, corrected_sentence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (structure_or_word, pattern_hint, user_sentence, ai_feedback, band_score, corrected_sentence, created_at))
        s_id = cursor.lastrowid
        cursor.execute("UPDATE user_stats SET sentences_written = sentences_written + 1 WHERE id = 1")
        conn.commit()
        return s_id
    finally:
        conn.close()


def get_sentences_history() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sentences ORDER BY id DESC LIMIT 50")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


# ------------------ DICTATIONS ------------------ #

def save_dictation(title: str, topic: str, transcript: str, audio_filename: str, connected_speech_notes: str = "") -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        INSERT INTO dictations (title, topic, transcript, audio_filename, connected_speech_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (title, topic, transcript, audio_filename, connected_speech_notes, created_at))
        d_id = cursor.lastrowid
        conn.commit()
        return d_id
    finally:
        conn.close()


def get_dictations_list() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM dictations ORDER BY id DESC")
        return [dict(r) for r in cursor.fetchall()]
    finally:
        conn.close()


def update_dictation_result(dictation_id: int, accuracy_rate: float):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        status = "completed" if accuracy_rate >= 90.0 else "in_progress"
        cursor.execute("""
        UPDATE dictations
        SET accuracy_rate = MAX(accuracy_rate, ?), status = ?
        WHERE id = ?
        """, (accuracy_rate, status, dictation_id))
        if status == "completed":
            cursor.execute("UPDATE user_stats SET dictations_done = dictations_done + 1 WHERE id = 1")
        conn.commit()
    finally:
        conn.close()


# ------------------ STUDY PLANS ------------------ #

def save_study_plan(lesson_number: int, title: str, description: str, tasks: List[Dict[str, Any]]) -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        cursor.execute("""
        INSERT INTO study_plans (lesson_number, title, description, tasks_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (lesson_number, title, description, json.dumps(tasks, ensure_ascii=False), created_at))
        plan_id = cursor.lastrowid
        conn.commit()
        return plan_id
    finally:
        conn.close()


def get_all_study_plans() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM study_plans ORDER BY lesson_number ASC")
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["tasks"] = json.loads(d["tasks_json"])
            except Exception:
                d["tasks"] = []
            rows.append(d)
        return rows
    finally:
        conn.close()


def toggle_study_plan_task(plan_id: int, task_id: str, is_done: bool) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM study_plans WHERE id = ?", (plan_id,))
        row = cursor.fetchone()
        if not row:
            return {}

        tasks = json.loads(row["tasks_json"])
        for t in tasks:
            if t.get("id") == task_id:
                t["completed"] = is_done

        all_done = all(t.get("completed", False) for t in tasks) if tasks else False
        completed_at = datetime.now().strftime("%Y-%m-%d %H:%M") if all_done else None

        cursor.execute("""
        UPDATE study_plans
        SET tasks_json = ?, is_completed = ?, completed_at = ?
        WHERE id = ?
        """, (json.dumps(tasks, ensure_ascii=False), 1 if all_done else 0, completed_at, plan_id))

        if all_done and row["is_completed"] == 0:
            cursor.execute("UPDATE user_stats SET lessons_done = lessons_done + 1 WHERE id = 1")

        conn.commit()
        return {"plan_id": plan_id, "is_completed": all_done, "tasks": tasks}
    finally:
        conn.close()


# ------------------ SETTINGS ------------------ #

def get_all_settings() -> Dict[str, str]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM settings")
        return {r["key"]: r["value"] for r in cursor.fetchall()}
    finally:
        conn.close()


def update_settings(new_settings: Dict[str, str]):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for k, v in new_settings.items():
            cursor.execute("""
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (k, str(v)))
        conn.commit()
    finally:
        conn.close()


# ------------------ UNIVERSAL ITEM DELETION ------------------ #

def delete_article(article_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_podcast(podcast_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM podcasts WHERE id = ?", (podcast_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_vocabulary_word(word_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM vocabulary WHERE id = ?", (word_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_mistake(mistake_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM mistakes WHERE id = ?", (mistake_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_sentence_structure(sentence_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sentence_structures WHERE id = ?", (sentence_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_sentence_history_item(history_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_sentences WHERE id = ?", (history_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_study_plan(plan_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM study_plans WHERE id = ?", (plan_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_dictation(dictation_id: int) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM dictations WHERE id = ?", (dictation_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# ------------------ AI BUG FIXER & SYSTEM DIAGNOSTICS ------------------ #

def diagnose_system_health() -> Dict[str, Any]:
    """
    Deep health diagnostics for all tables, tasks counts, audio cache and settings.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        issues = []

        # 1. Articles check
        cursor.execute("SELECT id, title, listening_data FROM articles")
        articles = cursor.fetchall()
        art_legacy_count = 0
        for a in articles:
            if a["listening_data"]:
                try:
                    data = json.loads(a["listening_data"])
                    tot = len(data.get("true_false_not_given", [])) + len(data.get("multiple_choice", [])) + len(data.get("summary_completion", [])) + len(data.get("matching_information", []))
                    if tot < 20:
                        art_legacy_count += 1
                except Exception:
                    art_legacy_count += 1
            else:
                art_legacy_count += 1
        
        if art_legacy_count > 0:
            issues.append({
                "component": "Articles",
                "severity": "warning",
                "message": f"{art_legacy_count} ta artiklda 20 ta IELTS topshiriqlari to'liq emas yoki eski formatda.",
                "fix_action": "regenerate_article_tasks"
            })

        # 2. Podcasts check
        cursor.execute("SELECT id, title, listening_data, transcript FROM podcasts")
        podcasts = cursor.fetchall()
        pod_legacy_count = 0
        for p in podcasts:
            if p["listening_data"]:
                try:
                    data = json.loads(p["listening_data"])
                    tot = len(data.get("true_false_not_given", [])) + len(data.get("multiple_choice", [])) + len(data.get("summary_completion", [])) + len(data.get("matching_information", []))
                    if tot < 20:
                        pod_legacy_count += 1
                except Exception:
                    pod_legacy_count += 1
            else:
                pod_legacy_count += 1

        if pod_legacy_count > 0:
            issues.append({
                "component": "Podcasts",
                "severity": "warning",
                "message": f"{pod_legacy_count} ta podkastda 20 ta IELTS topshiriqlari to'liq emas.",
                "fix_action": "regenerate_podcast_tasks"
            })

        # 3. Settings & LLM check
        cursor.execute("SELECT key, value FROM settings")
        settings = {r["key"]: r["value"] for r in cursor.fetchall()}
        provider = settings.get("llm_provider", "gemini")

        # 4. User stats check
        cursor.execute("SELECT * FROM user_stats WHERE id = 1")
        stats = cursor.fetchone()
        if not stats:
            issues.append({
                "component": "UserStats",
                "severity": "error",
                "message": "Foydalanuvchi statistikasi bazada topilmadi.",
                "fix_action": "init_user_stats"
            })

        return {
            "status": "healthy" if len(issues) == 0 else "needs_repair",
            "total_articles": len(articles),
            "total_podcasts": len(podcasts),
            "llm_provider": provider,
            "issues_found": len(issues),
            "issues": issues
        }
    finally:
        conn.close()


# ------------------ IELTS AI USTOZ (COACH) ------------------ #

def save_coach_message(role: str, mode: str, content: str, meta: Optional[Dict] = None) -> int:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        meta_str = json.dumps(meta or {}, ensure_ascii=False)
        cursor.execute("""
        INSERT INTO coach_conversations (role, mode, content, meta_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (role, mode, content, meta_str, now_str))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_coach_history(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT id, role, mode, content, meta_json, created_at
        FROM coach_conversations
        ORDER BY id ASC
        LIMIT ?
        """, (limit,))
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["meta"] = json.loads(d["meta_json"])
            except Exception:
                d["meta"] = {}
            rows.append(d)
        return rows
    finally:
        conn.close()


def clear_coach_history() -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM coach_conversations")
        conn.commit()
        return True
    finally:
        conn.close()
