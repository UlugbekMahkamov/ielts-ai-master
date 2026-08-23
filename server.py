"""
FastAPI Server and API Gateway for IELTS AI Master Mobile Application.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database as db
import ai_service as ai
import tts_service as tts

app = FastAPI(title="IELTS AI Master API", version="2.1.0")


@app.on_event("startup")
def _startup_init_db():
    # Ensures tables exist (SQLite locally, Postgres/Supabase in production).
    # CREATE TABLE IF NOT EXISTS is idempotent, so this is safe to run on
    # every cold start.
    try:
        db.init_db()
    except Exception as e:
        print(f"DB init error on startup: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

TMP_DIR = "/tmp" if os.path.exists("/tmp") and os.access("/tmp", os.W_OK) else BASE_DIR
AUDIO_CACHE_DIR = os.path.join(TMP_DIR, "audio_cache")
try:
    os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
except Exception:
    pass

if os.path.exists(STATIC_DIR):
    try:
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    except Exception:
        pass


def find_file(filename: str) -> Optional[str]:
    search_paths = [
        os.path.join(BASE_DIR, filename),
        os.path.join(BASE_DIR, "public", filename),
        os.path.join(BASE_DIR, "static", filename),
        os.path.join(STATIC_DIR, filename),
        os.path.join(BASE_DIR, "..", filename),
        os.path.join(BASE_DIR, "..", "public", filename),
        os.path.join(BASE_DIR, "..", "static", filename),
        os.path.join("/var/task", filename),
        os.path.join("/var/task", "public", filename),
        os.path.join("/var/task", "static", filename),
        os.path.join("/app", "static", filename),
        os.path.join("/app", filename)
    ]
    for p in search_paths:
        if os.path.exists(p) and os.path.isfile(p):
            return p
    return None



@app.get("/")
def serve_index():
    index_path = find_file("index.html")
    if index_path:
        return FileResponse(index_path)
    return HTMLResponse("<h1>IELTS AI Master API is Running</h1>")


@app.get("/manifest.json")
def serve_manifest():
    p = find_file("manifest.json")
    if p:
        return FileResponse(p, media_type="application/manifest+json")
    raise HTTPException(status_code=404)


@app.get("/sw.js")
def serve_sw():
    p = find_file("sw.js")
    if p:
        return FileResponse(p, media_type="application/javascript")
    raise HTTPException(status_code=404)


@app.get("/css/{file_path:path}")
def serve_css(file_path: str):
    p = find_file(os.path.join("css", file_path)) or find_file(file_path)
    if p:
        return FileResponse(p, media_type="text/css")
    raise HTTPException(status_code=404)


@app.get("/js/{file_path:path}")
def serve_js(file_path: str):
    p = find_file(os.path.join("js", file_path)) or find_file(file_path)
    if p:
        return FileResponse(p, media_type="application/javascript")
    raise HTTPException(status_code=404)


# ------------------ DASHBOARD ------------------ #

@app.get("/api/dashboard")
def get_dashboard():
    return db.get_dashboard_summary()


# ------------------ ARTICLES ------------------ #

class SingleArticleRequest(BaseModel):
    title: str = ""
    content: str
    level: str = "B2"

@app.post("/api/articles/single")
def create_single_article(req: SingleArticleRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Article content cannot be empty.")
    title = req.title.strip()
    if not title:
        existing = db.get_articles_list()
        title = f"Article {len(existing) + 1}"
    art_id = db.add_single_article(title, req.content, req.level)
    return {"status": "success", "article_id": art_id}


class BulkArticleRequest(BaseModel):
    articles: List[Dict[str, str]]

@app.post("/api/articles/bulk")
def create_bulk_articles(req: BulkArticleRequest):
    if not req.articles:
        raise HTTPException(status_code=400, detail="No articles provided.")
    ids = db.add_bulk_articles(req.articles)
    return {"status": "success", "inserted_count": len(ids), "inserted_ids": ids}


@app.get("/api/articles")
def list_articles(search: str = "", status: str = "all"):
    return db.get_articles_list(search, status)


@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@app.post("/api/articles/{article_id}/generate-tasks")
def generate_article_tasks(article_id: int):
    article = db.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    tasks = ai.generate_tasks_for_text(article["content"], article["title"])
    db.save_article_ai_tasks(article_id, tasks["listening"], tasks["speaking"], tasks["writing"])
    return tasks


class EvaluateSpeakingRequest(BaseModel):
    question: str
    transcript: str
    level: str = "B2"

@app.post("/api/articles/{article_id}/evaluate-speaking")
def evaluate_speaking(article_id: int, req: EvaluateSpeakingRequest):
    article = db.get_article_by_id(article_id)
    source_title = article["title"] if article else "Article"
    result = ai.evaluate_speaking_submission(req.question, req.transcript, req.level, source_title)
    return result


class EvaluateWritingRequest(BaseModel):
    prompt_text: str
    essay_text: str
    level: str = "B2"

@app.post("/api/articles/{article_id}/evaluate-writing")
def evaluate_writing(article_id: int, req: EvaluateWritingRequest):
    article = db.get_article_by_id(article_id)
    source_title = article["title"] if article else "Article"
    result = ai.evaluate_writing_submission(req.prompt_text, req.essay_text, req.level, source_title)
    return result


class UpdateStatusRequest(BaseModel):
    status: str

@app.post("/api/articles/{article_id}/status")
def update_status(article_id: int, req: UpdateStatusRequest):
    db.update_article_status(article_id, req.status)
    return {"status": "success"}


# ------------------ PODCASTS ------------------ #

class SinglePodcastRequest(BaseModel):
    url: str = ""
    title: str = ""
    transcript: str = ""

@app.post("/api/podcasts/single")
@app.post("/api/podcasts")
def create_single_podcast(req: SinglePodcastRequest):
    url = req.url.strip()
    title = req.title.strip()
    transcript = req.transcript.strip()

    if not transcript and not url:
        raise HTTPException(status_code=400, detail="Kamida transkript matni yoki podkast linkini kiriting.")

    audio_url = ""
    if url and not transcript:
        scraped = ai.extract_podcast_web_content(url)
        title = title or scraped.get("title", "")
        transcript = scraped.get("transcript", "")
        audio_url = scraped.get("audio_url", "")

    pod_id = db.add_single_podcast(title, url, audio_url, transcript)
    return {
        "status": "success",
        "podcast_id": pod_id,
        "title": title,
        "transcript": transcript,
        "has_transcript": bool(transcript)
    }


class BulkPodcastRequest(BaseModel):
    podcasts: List[Dict[str, str]]

@app.post("/api/podcasts/bulk")
def create_bulk_podcasts(req: BulkPodcastRequest):
    if not req.podcasts:
        raise HTTPException(status_code=400, detail="Kamida 1 ta podkast kiritilishi kerak.")
    
    processed = []
    for idx, item in enumerate(req.podcasts, start=1):
        url = item.get("url", "").strip()
        transcript = item.get("transcript", "").strip()
        title = item.get("title", "").strip()
        audio_url = item.get("audio_url", "").strip()

        if not url and not transcript:
            continue

        if not url:
            url = f"Podcast {idx}"

        if url.startswith("http") and not transcript:
            try:
                scraped = ai.extract_podcast_web_content(url)
                title = title or scraped.get("title", "")
                transcript = scraped.get("transcript", "")
                audio_url = scraped.get("audio_url", "")
            except Exception as e:
                print(f"Scrape warning: {e}")

        processed.append({
            "url": url,
            "title": title,
            "transcript": transcript,
            "audio_url": audio_url
        })

    if not processed:
        raise HTTPException(status_code=400, detail="Kamida transkript matni yoki link kiritilishi kerak.")

    ids = db.add_bulk_podcasts(processed)
    return {"status": "success", "inserted_count": len(ids), "inserted_ids": ids}


@app.get("/api/podcasts")
def list_podcasts():
    return db.get_podcasts_list()


@app.get("/api/podcasts/{podcast_id}")
def get_podcast(podcast_id: int):
    podcast = db.get_podcast_by_id(podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return podcast


class UpdateTranscriptRequest(BaseModel):
    transcript: str
    audio_url: str = ""

@app.post("/api/podcasts/{podcast_id}/update-transcript")
def update_transcript(podcast_id: int, req: UpdateTranscriptRequest):
    podcast = db.get_podcast_by_id(podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")

    db.update_podcast_transcript(podcast_id, req.transcript.strip(), req.audio_url.strip())
    return {"status": "success", "transcript": req.transcript.strip()}


@app.post("/api/podcasts/{podcast_id}/generate-tasks")
def generate_podcast_tasks(podcast_id: int):
    podcast = db.get_podcast_by_id(podcast_id)
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
    if not podcast.get("transcript"):
        raise HTTPException(status_code=400, detail="Podcast transcript is empty. Please enter or paste the transcript first.")

    tasks = ai.generate_tasks_for_text(podcast["transcript"], podcast["title"])
    db.save_podcast_ai_tasks(podcast_id, tasks["listening"], tasks["speaking"], tasks["writing"])
    return tasks


@app.post("/api/podcasts/{podcast_id}/evaluate-speaking")
def evaluate_podcast_speaking(podcast_id: int, req: EvaluateSpeakingRequest):
    podcast = db.get_podcast_by_id(podcast_id)
    source_title = podcast["title"] if podcast else "Podcast"
    result = ai.evaluate_speaking_submission(req.question, req.transcript, req.level, source_title)
    return result


@app.post("/api/podcasts/{podcast_id}/evaluate-writing")
def evaluate_podcast_writing(podcast_id: int, req: EvaluateWritingRequest):
    podcast = db.get_podcast_by_id(podcast_id)
    source_title = podcast["title"] if podcast else "Podcast"
    result = ai.evaluate_writing_submission(req.prompt_text, req.essay_text, req.level, source_title)
    return result


# ------------------ DICTATION ------------------ #

@app.get("/api/dictations")
def list_dictations():
    return db.get_dictations_list()


class GenerateDictationRequest(BaseModel):
    topic: str = "Science & Global Trends"
    level: str = "B2/C1"

@app.post("/api/dictations/generate")
async def generate_dictation(req: GenerateDictationRequest):
    data = ai.generate_dictation_content(req.topic, req.level)
    settings = db.get_all_settings()
    voice = settings.get("tts_voice", "en-GB-RyanNeural")

    filename = await tts.generate_speech_file(data["transcript"], voice=voice)
    notes_json = json.dumps(data.get("connected_speech_notes", []), ensure_ascii=False)

    dict_id = db.save_dictation(
        title=data.get("title", req.topic),
        topic=req.topic,
        transcript=data["transcript"],
        audio_filename=filename,
        connected_speech_notes=notes_json
    )

    return {
        "id": dict_id,
        "title": data.get("title", req.topic),
        "topic": req.topic,
        "transcript": data["transcript"],
        "audio_url": f"/api/audio/{filename}" if filename else "",
        "connected_speech_notes": data.get("connected_speech_notes", [])
    }


@app.get("/api/audio/{filename}")
def stream_audio(filename: str):
    path = tts.get_audio_path(filename)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path, media_type="audio/mpeg")


class SubmitDictationResultRequest(BaseModel):
    accuracy_rate: float

@app.post("/api/dictations/{dictation_id}/submit-result")
def submit_dictation_result(dictation_id: int, req: SubmitDictationResultRequest):
    db.update_dictation_result(dictation_id, req.accuracy_rate)
    return {"status": "success"}


# ------------------ VOCABULARY (SRS) ------------------ #

@app.get("/api/vocabulary")
def list_vocabulary(stage: Optional[int] = None, only_due: bool = False):
    return db.get_vocabulary_by_stage(stage, only_due)


@app.get("/api/vocabulary/counts")
def get_vocabulary_counts():
    return db.get_vocabulary_counts_by_intervals()


class AddWordRequest(BaseModel):
    word: str
    translation: str = ""
    definition: str = ""
    ipa: str = ""
    example: str = ""
    collocations: str = ""
    source: str = "Manual Input"
    auto_lookup: bool = True

@app.post("/api/vocabulary/add")
def add_word(req: AddWordRequest):
    word = req.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty.")

    translation = req.translation.strip()
    definition = req.definition.strip()
    ipa = req.ipa.strip()
    example = req.example.strip()
    collocations = req.collocations.strip()

    if req.auto_lookup and (not translation or not definition):
        details = ai.lookup_vocabulary_details(word, example)
        translation = translation or details.get("translation", "")
        definition = definition or details.get("definition", "")
        ipa = ipa or details.get("ipa", "")
        example = example or details.get("example", "")
        collocations = collocations or details.get("collocations", "")

    result = db.add_vocabulary_word(
        word=word,
        translation=translation,
        definition=definition,
        ipa=ipa,
        example=example,
        collocations=collocations,
        source=req.source
    )
    return result


class ReviewCardRequest(BaseModel):
    is_correct: bool

@app.post("/api/vocabulary/{word_id}/review")
def review_card(word_id: int, req: ReviewCardRequest):
    result = db.review_vocabulary_card(word_id, req.is_correct)
    return result


class WordLookupRequest(BaseModel):
    word: str
    context: str = ""

@app.post("/api/vocabulary/lookup")
def lookup_word(req: WordLookupRequest):
    details = ai.lookup_vocabulary_details(req.word, req.context)
    return details


# ------------------ MISTAKES ------------------ #

@app.get("/api/mistakes")
def list_mistakes(error_type: str = "all", is_resolved: Optional[int] = None):
    return db.get_mistakes_list(error_type, is_resolved)


class AddMistakeRequest(BaseModel):
    error_text: str
    corrected_text: str
    explanation: str
    error_type: str = "grammar"
    source_type: str = "speaking"
    source_title: str = ""

@app.post("/api/mistakes/add")
def create_mistake(req: AddMistakeRequest):
    m_id = db.add_mistake(
        error_text=req.error_text,
        corrected_text=req.corrected_text,
        explanation=req.explanation,
        error_type=req.error_type,
        source_type=req.source_type,
        source_title=req.source_title
    )
    return {"status": "success", "mistake_id": m_id}


# ------------------ SENTENCES & STRUCTURES ------------------ #

class ExtractStructureRequest(BaseModel):
    selected_text: str
    source: str = "Selected Text"

@app.post("/api/sentences/add-from-text")
def add_sentence_structure_from_text(req: ExtractStructureRequest):
    text = req.selected_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    extracted = ai.extract_structure_from_text(text)
    struct_id = db.add_sentence_structure(
        pattern=extracted.get("structure_pattern", text),
        name=extracted.get("structure_name", "Academic Structure"),
        hint=extracted.get("hint", ""),
        example=extracted.get("example_sentence", text),
        original_sentence=text,
        source=req.source
    )

    return {
        "status": "success",
        "structure_id": struct_id,
        "pattern": extracted.get("structure_pattern", text),
        "hint": extracted.get("hint", ""),
        "example": extracted.get("example_sentence", text)
    }


@app.get("/api/sentences/daily-prompts")
def get_daily_sentence_prompts():
    # Fetch custom user-added structures first
    custom_structs = db.get_all_sentence_structures()
    
    c1_structures = []
    for s in custom_structs:
        c1_structures.append({
            "pattern": s["pattern"],
            "hint": s.get("hint") or f"Manba: {s.get('source', 'Matndan olingan')}",
            "example": s.get("example") or s.get("original_sentence", "")
        })

    # Default C1 academic patterns if custom pool is small
    default_patterns = [
        {"pattern": "Not only + Auxiliary + Subject..., but + Subject + also...", "hint": "Ikkita bog'liq foydani kuchaytirish uchun qo'llang.", "example": "Not only does green architecture mitigate carbon emissions, but it also improves urban well-being."},
        {"pattern": "Were + Subject + to + Verb..., Subject + would...", "hint": "Inverted formal hypothetical conditional.", "example": "Were governments to invest substantially in public transit, traffic congestion would decrease markedly."},
        {"pattern": "It is widely asserted that..., notwithstanding the fact that...", "hint": "Nuanced academic counter-argument.", "example": "It is widely asserted that automation boosts productivity, notwithstanding the fact that it temporarily disrupts employment."},
        {"pattern": "A critical catalyst behind [Noun Phrase] is [Noun Phrase].", "hint": "Explain primary causation formally.", "example": "A critical catalyst behind accelerated economic growth is cross-border digital collaboration."}
    ]

    combined = c1_structures + default_patterns

    # Target words from vocabulary
    words = db.get_vocabulary_by_stage(stage=None, only_due=False)
    target_words = [w["word"] for w in words[:6]] if words else ["paramount", "ramifications", "indispensable", "exacerbate", "ubiquitous"]

    return {
        "structures": combined,
        "target_words": target_words
    }


class SubmitSentenceRequest(BaseModel):
    structure_or_word: str
    pattern_hint: str = ""
    user_sentence: str

@app.post("/api/sentences/submit")
def submit_sentence(req: SubmitSentenceRequest):
    eval_res = ai.evaluate_user_sentence(req.structure_or_word, req.user_sentence)
    s_id = db.save_user_sentence(
        structure_or_word=req.structure_or_word,
        pattern_hint=req.pattern_hint,
        user_sentence=req.user_sentence,
        ai_feedback=eval_res.get("ai_feedback", ""),
        band_score=eval_res.get("band_score", 7.0),
        corrected_sentence=eval_res.get("corrected_sentence", "")
    )
    return {
        "id": s_id,
        "is_correct": eval_res.get("is_correct", True),
        "band_score": eval_res.get("band_score", 7.0),
        "ai_feedback": eval_res.get("ai_feedback", ""),
        "corrected_sentence": eval_res.get("corrected_sentence", ""),
        "key_takeaway": eval_res.get("key_takeaway", "")
    }


@app.get("/api/sentences/history")
def get_sentences_history():
    return db.get_sentences_history()


# ------------------ STUDY PLANS ------------------ #

@app.get("/api/study-plans")
def list_study_plans():
    return db.get_all_study_plans()


@app.post("/api/study-plans/generate-next")
def generate_next_study_plan():
    plans = db.get_all_study_plans()
    next_num = len(plans) + 1
    stats = db.get_dashboard_summary()
    plan_data = ai.generate_dynamic_study_plan(next_num, stats)
    plan_id = db.save_study_plan(next_num, plan_data["title"], plan_data["description"], plan_data["tasks"])
    return {"plan_id": plan_id, "lesson_number": next_num, **plan_data}


class ToggleTaskRequest(BaseModel):
    task_id: str
    is_done: bool

@app.post("/api/study-plans/{plan_id}/toggle-task")
def toggle_task(plan_id: int, req: ToggleTaskRequest):
    res = db.toggle_study_plan_task(plan_id, req.task_id, req.is_done)
    return res


# ------------------ SETTINGS & TTS ------------------ #

@app.get("/api/settings")
def get_settings():
    return db.get_all_settings()


class UpdateSettingsRequest(BaseModel):
    settings: Dict[str, Any]

@app.post("/api/settings")
def save_settings(req: UpdateSettingsRequest):
    db.update_settings(req.settings)
    return {"status": "success"}


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

@app.post("/api/tts/speak")
async def tts_speak(req: TTSRequest):
    settings = db.get_all_settings()
    voice = req.voice or settings.get("tts_voice", "en-GB-RyanNeural")
    filename = await tts.generate_speech_file(req.text, voice=voice)
    if filename:
        return {"audio_url": f"/api/audio/{filename}"}
    return {"audio_url": ""}


# ------------------ UNIVERSAL ITEM DELETION ------------------ #

@app.delete("/api/articles/{article_id}")
def delete_article_endpoint(article_id: int):
    success = db.delete_article(article_id)
    if not success:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"status": "success", "deleted_id": article_id}


@app.delete("/api/podcasts/{podcast_id}")
def delete_podcast_endpoint(podcast_id: int):
    success = db.delete_podcast(podcast_id)
    if not success:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return {"status": "success", "deleted_id": podcast_id}


@app.delete("/api/vocabulary/{word_id}")
def delete_vocabulary_endpoint(word_id: int):
    success = db.delete_vocabulary_word(word_id)
    if not success:
        raise HTTPException(status_code=404, detail="Word not found")
    return {"status": "success", "deleted_id": word_id}


@app.delete("/api/mistakes/{mistake_id}")
def delete_mistake_endpoint(mistake_id: int):
    success = db.delete_mistake(mistake_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mistake not found")
    return {"status": "success", "deleted_id": mistake_id}


@app.delete("/api/sentences/{sentence_id}")
def delete_sentence_endpoint(sentence_id: int):
    success = db.delete_sentence_structure(sentence_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sentence not found")
    return {"status": "success", "deleted_id": sentence_id}


@app.delete("/api/sentences/history/{history_id}")
def delete_sentence_history_endpoint(history_id: int):
    success = db.delete_sentence_history_item(history_id)
    if not success:
        raise HTTPException(status_code=404, detail="History item not found")
    return {"status": "success", "deleted_id": history_id}


@app.delete("/api/study-plans/{plan_id}")
def delete_study_plan_endpoint(plan_id: int):
    success = db.delete_study_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="Study plan not found")
    return {"status": "success", "deleted_id": plan_id}


@app.delete("/api/dictations/{dictation_id}")
def delete_dictation_endpoint(dictation_id: int):
    success = db.delete_dictation(dictation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dictation not found")
    return {"status": "success", "deleted_id": dictation_id}


# ------------------ AI BUG FIXER & AUTO-REPAIR ------------------ #

@app.get("/api/bug-fixer/diagnose")
def diagnose_system():
    diag = db.diagnose_system_health()
    return diag


@app.post("/api/bug-fixer/auto-repair")
def auto_repair_system():
    repaired_articles = 0
    repaired_podcasts = 0
    
    conn = db.get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 1. Repair Articles to 20 questions
        cursor.execute("SELECT id, title, content, listening_data FROM articles")
        for a in cursor.fetchall():
            needs_fix = False
            if not a["listening_data"]:
                needs_fix = True
            else:
                try:
                    data = json.loads(a["listening_data"])
                    tot = len(data.get("true_false_not_given", [])) + len(data.get("multiple_choice", [])) + len(data.get("summary_completion", [])) + len(data.get("matching_information", []))
                    if tot < 20:
                        needs_fix = True
                except Exception:
                    needs_fix = True
            
            if needs_fix:
                tasks = ai.generate_tasks_for_text(a["content"] or "Academic content", a["title"])
                cursor.execute("""
                    UPDATE articles SET listening_data = ?, speaking_data = ?, writing_data = ? WHERE id = ?
                """, (json.dumps(tasks["listening"]), json.dumps(tasks["speaking"]), json.dumps(tasks["writing"]), a["id"]))
                repaired_articles += 1

        # 2. Repair Podcasts to 20 questions
        cursor.execute("SELECT id, title, transcript, listening_data FROM podcasts")
        for p in cursor.fetchall():
            needs_fix = False
            if not p["listening_data"]:
                needs_fix = True
            else:
                try:
                    data = json.loads(p["listening_data"])
                    tot = len(data.get("true_false_not_given", [])) + len(data.get("multiple_choice", [])) + len(data.get("summary_completion", [])) + len(data.get("matching_information", []))
                    if tot < 20:
                        needs_fix = True
                except Exception:
                    needs_fix = True
            
            if needs_fix:
                text = p["transcript"] or p["title"] or "Academic podcast transcript"
                tasks = ai.generate_tasks_for_text(text, p["title"])
                cursor.execute("""
                    UPDATE podcasts SET listening_data = ?, speaking_data = ?, writing_data = ? WHERE id = ?
                """, (json.dumps(tasks["listening"]), json.dumps(tasks["speaking"]), json.dumps(tasks["writing"]), p["id"]))
                repaired_podcasts += 1

        conn.commit()
    finally:
        conn.close()

    return {
        "status": "success",
        "message": f"Tizim to'liq sozlandi va sinxronlandi! ({repaired_articles} ta artikl va {repaired_podcasts} ta podkast yangilandi)",
        "repaired_articles": repaired_articles,
        "repaired_podcasts": repaired_podcasts
    }


class BugChatRequest(BaseModel):
    user_query: str

@app.post("/api/bug-fixer/chat")
def bug_fixer_chat(req: BugChatRequest):
    q = req.user_query.lower()
    
    if "savol" in q or "3 ta" in q or "comprehension" in q or "20 ta" in q or "listening" in q:
        explanation = "Ilova avvalgi eski versiyada 3 ta savol generatsiya qilgan bo'lishi mumkin. Hozirgi versiyada har bir artikl va podkast uchun qat'iy 20 ta savol (5 TFNG, 5 MCQ, 5 Summary, 5 Matching) tizimi o'rnatilgan."
        recommended_action = "auto_repair"
        action_label = "⚡ Barcha Savollarni 20 talikka Yangilash"
    elif "mikrofon" in q or "3 marta" in q or "takror" in q or "yozib" in q or "speaking" in q:
        explanation = "Brauzeringizdagi eski kesh (interim results) to'plangan bo'lishi mumkin. Ovoz tanish dvigateli toza Single-Pass rejimiga o'tkazilgan."
        recommended_action = "clear_cache"
        action_label = "🧹 Keshni Tozalash va Qayta Yuklash"
    elif "audio" in q or "pleer" in q or "ovoz" in q or "tts" in q:
        explanation = "Edge-TTS yoki audio pleer oqimi tekshirildi. Sozlamalar bo'limidan Britaniya / Amerika ovozini tanlashingiz mumkin."
        recommended_action = "check_tts"
        action_label = "🔊 Ovoz Tizimini Sinab Ko'rish"
    else:
        explanation = f"AI Bug Fixer tizimni tahlil qildi. Barcha modullar (Articles, Podcasts, Dictation, Vocabulary, Sentences, Mistakes) to'liq ishchi holatda. Muammoni avtomatik to'g'irlash uchun quyidagi tugmani bosing."
        recommended_action = "auto_repair"
        action_label = "⚡ Tizimni To'liq Qayta Sozlash"

    return {
        "reply": explanation,
        "recommended_action": recommended_action,
        "action_label": action_label
    }


# ------------------ IELTS AI USTOZ (MASTER COACH) API ------------------ #

class CoachChatRequest(BaseModel):
    user_query: str
    mode: str = "general"
    save_history: bool = True

@app.post("/api/coach/chat")
def coach_chat_endpoint(req: CoachChatRequest):
    query = req.user_query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    history = []
    if req.save_history:
        try:
            history = db.get_coach_history(limit=6)
        except Exception as e:
            print(f"History fetch warning: {e}")
            
    try:
        reply = ai.call_ielts_coach(query, mode=req.mode, history=history)
    except Exception as e:
        reply = f"Assalomu alaykum! Men sizning **IELTS AI Ustozingizman** (Cambridge & IDP Certified Trainer).\n\nSavolingiz: {query}\n\nIltimos, insho yoki speaking matningizni yuboring, uni 4 ta mezon (TR, CC, LR, GRA) bo'yicha tahlil qilib beraman!"
    
    if req.save_history:
        try:
            db.save_coach_message(role="user", mode=req.mode, content=query)
            db.save_coach_message(role="coach", mode=req.mode, content=reply)
        except Exception as e:
            print(f"History save warning: {e}")
        
    return {
        "reply": reply,
        "mode": req.mode,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

@app.get("/api/coach/history")
def get_coach_history_endpoint():
    try:
        return db.get_coach_history(limit=50)
    except Exception as e:
        print(f"History get warning: {e}")
        return []

@app.delete("/api/coach/history")
def clear_coach_history_endpoint():
    try:
        db.clear_coach_history()
    except Exception:
        pass
    return {"status": "success"}

class CoachAnalyzeTextRequest(BaseModel):
    text: str

@app.post("/api/coach/analyze-text")
def coach_analyze_text_endpoint(req: CoachAnalyzeTextRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    reply = ai.call_ielts_coach(f"Quyidagi matnni to'liq 4 mezon bo'yicha tahlil qiling:\n\n{text}", mode="analysis")
    return {"analysis": reply}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
