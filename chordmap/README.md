# ChordMap V0.3 — URL / Upload Full-Song Chord Mapper

ChordMap turns a full song into an interactive chord timeline and downloadable chord-map image.

## V0.3 features

- Paste a **direct audio URL** (MP3/WAV/M4A/FLAC/OGG/AAC)
- Or upload an audio file (80 MB limit)
- Estimate BPM and musical key
- Beat-synchronous chord timeline
- Expanded chord vocabulary: major, minor, 7, maj7, m7, sus2, sus4, dim, aug
- Conservative slash-chord / inversion hints
- Beat-level smoothing to reduce isolated chord flicker
- Repeated song sections (Section A/B/C...) plus cautious semantic hints
- Native audio player with synchronized chord + section highlighting
- Instant transpose from -11 to +11 semitones
- Download analysis JSON
- Build and download a **full-song PNG chord map** (no 6-row truncation)
- Remote URL SSRF guard and streamed 80 MB download cap
- Temporary audio is deleted after analysis
- `/health` deployment health endpoint

## URL boundary

ChordMap does **not** bypass YouTube, Spotify, Apple Music, SoundCloud, DRM, or platform restrictions. Ordinary player-page URLs are not direct audio files. Use audio you are authorized to analyze, a public direct audio URL, or upload a file.

## Run locally

Python 3.11+ recommended.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000`.

For formats your system libsndfile cannot decode, install ffmpeg locally:

```bash
brew install ffmpeg
```

## Tests

```bash
pytest -q
```

## Accuracy boundary

V0.3 is a signal-processing baseline, not a large trained chord-recognition model. Rich chord qualities and inversions are harder than major/minor recognition, so confidence should be treated as a hint rather than ground truth. Section letters are safer than semantic Verse/Chorus naming.
