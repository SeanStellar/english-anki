"""Batch-generate per-word MP3 audio locally with Kokoro-82M (offline, Apache-2.0).

Same output layout as generate_word_audio.py:
  renderer/audio/words/female/<slug>.mp3  (af_heart)
  renderer/audio/words/male/<slug>.mp3    (am_michael)
  renderer/audio/words/index.json

Re-runnable: existing files are skipped. Index is flushed every 300 clips.
Usage:
  python tools/generate_word_audio_kokoro.py
  python tools/generate_word_audio_kokoro.py --voice female --only abandon,able
"""
import argparse
import json
import os
import sys
import time

import lameenc
import numpy as np
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate_word_audio import OUT_DIR, load_words, slug, tts_text  # noqa: E402

MODEL = os.path.join(HERE, "kokoro-models", "kokoro-v1.0.onnx")
VOICES_BIN = os.path.join(HERE, "kokoro-models", "voices-v1.0.bin")
VOICES = {"female": "af_heart", "male": "am_michael"}
SPEED = 1.0
BITRATE = 48
SILENCE = 0.0015  # -56 dBFS trim threshold


def trim_silence(samples, sr, pad=0.02):
    loud = np.abs(samples) > SILENCE
    if not loud.any():
        return samples
    pad_n = int(sr * pad)
    start = max(0, int(np.argmax(loud)) - pad_n)
    end = min(len(samples), len(samples) - int(np.argmax(loud[::-1])) + pad_n)
    return samples[start:end]


def write_mp3(path, samples, sr):
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    with open(path, "wb") as fh:
        fh.write(enc.encode(pcm.tobytes()) + enc.flush())


def flush_index(index):
    index["words"] = {w: e for w, e in sorted(index["words"].items()) if e}
    index["generatedAt"] = time.strftime("%Y-%m-%d")
    payload = {"words": index["words"]}
    tmp = os.path.join(OUT_DIR, "index.json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, os.path.join(OUT_DIR, "index.json"))
    js_path = os.path.join(HERE, "..", "renderer", "data", "word-audio-index.js")
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.write("window.WORD_AUDIO_INDEX=")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated words to generate")
    ap.add_argument("--voice", choices=list(VOICES))
    ap.add_argument("--speed", type=float, default=SPEED)
    args = ap.parse_args()

    words = load_words()
    if args.only:
        words = [w.strip().lower() for w in args.only.split(",") if w.strip()]

    voices = {args.voice: VOICES[args.voice]} if args.voice else dict(VOICES)
    for key in voices:
        os.makedirs(os.path.join(OUT_DIR, key), exist_ok=True)

    index_path = os.path.join(OUT_DIR, "index.json")
    index = {"version": 1, "engine": "kokoro-82m", "voices": VOICES, "words": {}}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as fh:
            old = json.load(fh)
        if old.get("engine") == "kokoro-82m":
            index["words"] = old.get("words", {})
        # switching engines: rebuild index from scratch

    print("loading kokoro...", flush=True)
    kokoro = Kokoro(MODEL, VOICES_BIN)

    total = len(words) * len(voices)
    done = 0
    started = time.time()
    for key, voice in voices.items():
        for word in words:
            name = slug(word) + ".mp3"
            path = os.path.join(OUT_DIR, key, name)
            entry = index["words"].setdefault(word, {})
            slot = "f" if key == "female" else "m"
            done += 1
            if os.path.isfile(path) and os.path.getsize(path) > 1024:
                entry[slot] = name
                continue
            samples, sr = kokoro.create(tts_text(word), voice=voice, speed=args.speed, lang="en-us")
            write_mp3(path, trim_silence(np.asarray(samples), sr), sr)
            entry[slot] = name
            entry["generatedAt"] = time.strftime("%Y-%m-%d")
            if done % 300 == 0:
                elapsed = time.time() - started
                rate = done / elapsed if elapsed else 0
                eta = (total - done) / rate if rate else 0
                print(f"{done}/{total}  {elapsed:.0f}s  ETA {eta:.0f}s", flush=True)
                flush_index(index)

    flush_index(index)
    size = 0
    count = 0
    for key in voices:
        folder = os.path.join(OUT_DIR, key)
        for name in os.listdir(folder):
            size += os.path.getsize(os.path.join(folder, name))
            count += 1
    print(f"done: {count} files, {size / 1048576:.1f} MB")


if __name__ == "__main__":
    main()