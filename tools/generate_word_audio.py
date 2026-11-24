"""Batch-generate per-word MP3 audio with Edge neural voices (free, no key).

Output:
  renderer/audio/words/female/<slug>.mp3   (en-US-EmmaMultilingualNeural)
  renderer/audio/words/male/<slug>.mp3     (en-US-AndrewMultilingualNeural)
  renderer/audio/words/index.json          (word -> {f: file, m: file})

Re-runnable: existing non-empty files are skipped.
Usage:
  python tools/generate_word_audio.py                # full build
  python tools/generate_word_audio.py --only abandon,accommodate
  python tools/generate_word_audio.py --voice female # single voice
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import time

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILES = ["renderer/data/kaoyan-v7.1.json", "renderer/data/zhuanshengben-3000.json"]
OUT_DIR = os.path.join(ROOT, "renderer", "audio", "words")

VOICES = {
    "female": "en-US-EmmaMultilingualNeural",
    "male": "en-US-AndrewMultilingualNeural",
}
RATE = "+0%"
CONCURRENCY = 16
RETRIES = 4

# Words whose raw form confuses TTS; map to a clean spoken form.
SPECIAL_TEXT = {
    "a.m.": "A M",
    "p.m.": "P M",
    "o’clock": "o'clock",
    "café": "cafe",
    "doctor/dr.": "doctor",
    "mr/mrs/ms": "mister, missus, miss",
}
ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff"), None)


def load_words():
    words = set()
    for rel in DATA_FILES:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
            for row in json.load(fh):
                w = str(row.get("word") or "").strip().lower()
                if w:
                    words.add(w)
    return sorted(words)


def tts_text(word):
    if word in SPECIAL_TEXT:
        return SPECIAL_TEXT[word]
    text = word.translate(ZERO_WIDTH).replace("’", "'")
    text = text.replace("/", " or ")
    text = re.sub(r"\(([^)]*)\)", r", \1", text)
    return re.sub(r"\s+", " ", text).strip()


def slug(word):
    base = re.sub(r"[^a-z0-9]+", "-", word).strip("-")[:32] or "w"
    digest = hashlib.sha1(word.encode("utf-8")).hexdigest()[:8]
    return f"{base}_{digest}"


async def synth_one(sem, voice_key, voice, word, path, proxy=None):
    if os.path.isfile(path) and os.path.getsize(path) > 1024:
        return True
    text = tts_text(word)
    for attempt in range(RETRIES):
        async with sem:
            try:
                await edge_tts.Communicate(text, voice, rate=RATE, proxy=proxy).save(path)
                if os.path.getsize(path) > 1024:
                    return True
            except Exception:
                pass
        await asyncio.sleep(1.2 * (attempt + 1))
    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass
    print(f"  FAILED: {word} ({voice_key})", flush=True)
    return False


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated words to generate")
    ap.add_argument("--voice", choices=list(VOICES), help="only this voice")
    ap.add_argument("--proxy", help="e.g. http://127.0.0.1:7890")
    ap.add_argument("--concurrency", type=int, default=CONCURRENCY)
    args = ap.parse_args()

    words = load_words()
    if args.only:
        wanted = [w.strip().lower() for w in args.only.split(",") if w.strip()]
        unknown = [w for w in wanted if w not in set(words)]
        if unknown:
            print("not in decks:", unknown)
        words = wanted

    voices = {args.voice: VOICES[args.voice]} if args.voice else dict(VOICES)
    for key in voices:
        os.makedirs(os.path.join(OUT_DIR, key), exist_ok=True)

    index_path = os.path.join(OUT_DIR, "index.json")
    index = {"version": 1, "voices": VOICES, "words": {}}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as fh:
            old = json.load(fh)
        index["words"] = old.get("words", {})

    jobs = []
    sem = asyncio.Semaphore(args.concurrency)
    for word in words:
        name = slug(word) + ".mp3"
        entry = index["words"].setdefault(word, {})
        for key, voice in voices.items():
            path = os.path.join(OUT_DIR, key, name)
            jobs.append((synth_one(sem, key, voice, word, path, args.proxy), key, name, entry))

    total = len(jobs)
    print(f"{total} clips to build ({len(words)} words x {len(voices)} voices)", flush=True)
    started = time.time()
    done = 0
    failed = 0
    for coro, key, name, entry in jobs:
        ok = await coro
        if ok:
            entry["f" if key == "female" else "m"] = name
            entry["generatedAt"] = time.strftime("%Y-%m-%d")
        else:
            failed += 1
        done += 1
        if done % 200 == 0 or done == total:
            elapsed = time.time() - started
            rate = done / elapsed if elapsed else 0
            eta = (total - done) / rate if rate else 0
            print(f"{done}/{total}  {elapsed:.0f}s elapsed  ETA {eta:.0f}s  failed={failed}", flush=True)

    index["words"] = {w: e for w, e in sorted(index["words"].items()) if e}
    index["generatedAt"] = time.strftime("%Y-%m-%d")
    with open(index_path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))

    size = 0
    count = 0
    for key in voices:
        folder = os.path.join(OUT_DIR, key)
        for name in os.listdir(folder):
            size += os.path.getsize(os.path.join(folder, name))
            count += 1
    print(f"done: {count} files, {size / 1048576:.1f} MB, failed={failed}", flush=True)
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())