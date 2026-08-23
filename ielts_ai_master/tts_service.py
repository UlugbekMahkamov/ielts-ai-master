"""
Microsoft Edge Neural TTS Service for IELTS AI Master.
Provides high-fidelity, native British/American accent audio generation
for Dictation, Articles, Podcasts, and Vocabulary pronunciation.
"""

import os
import asyncio
import hashlib
from typing import Optional

TMP_DIR = "/tmp" if os.path.exists("/tmp") and os.access("/tmp", os.W_OK) else os.path.dirname(os.path.abspath(__file__))
AUDIO_CACHE_DIR = os.path.join(TMP_DIR, "audio_cache")
try:
    os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
except Exception:
    pass

# Recommended high quality voices
VOICES = {
    "british_male": "en-GB-RyanNeural",
    "british_female": "en-GB-SoniaNeural",
    "american_male": "en-US-GuyNeural",
    "american_female": "en-US-JennyNeural",
    "australian_female": "en-AU-NatashaNeural"
}


async def generate_speech_file(text: str, voice: str = "en-GB-RyanNeural", rate: str = "+0%", pitch: str = "+0Hz") -> str:
    """
    Generates an MP3 file using edge-tts. Returns the relative filename.
    """
    import edge_tts

    # Create a unique hash for caching
    hash_key = hashlib.md5(f"{text}_{voice}_{rate}_{pitch}".encode("utf-8")).hexdigest()
    filename = f"{hash_key}.mp3"
    filepath = os.path.join(AUDIO_CACHE_DIR, filename)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return filename

    try:
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
        await communicate.save(filepath)
        return filename
    except Exception as e:
        print(f"Error generating Edge TTS: {e}")
        # Return empty string if failed, frontend can fallback to Web Speech Synthesis
        return ""


def get_audio_path(filename: str) -> Optional[str]:
    filepath = os.path.join(AUDIO_CACHE_DIR, filename)
    if os.path.exists(filepath):
        return filepath
    return None
