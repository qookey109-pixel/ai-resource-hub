from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import librosa
import numpy as np

PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Intervals, display suffix, complexity penalty.  The small penalty prevents
# richer templates from winning merely because they contain more pitch classes.
QUALITIES: dict[str, tuple[tuple[int, ...], str, float]] = {
    "maj": ((0, 4, 7), "", 0.000),
    "min": ((0, 3, 7), "m", 0.000),
    "7": ((0, 4, 7, 10), "7", 0.018),
    "maj7": ((0, 4, 7, 11), "maj7", 0.022),
    "min7": ((0, 3, 7, 10), "m7", 0.018),
    "sus2": ((0, 2, 7), "sus2", 0.015),
    "sus4": ((0, 5, 7), "sus4", 0.015),
    "dim": ((0, 3, 6), "dim", 0.018),
    "aug": ((0, 4, 8), "aug", 0.018),
}


@dataclass
class ChordHit:
    start: float
    end: float
    chord: str
    confidence: float


def _template(root: int, intervals: tuple[int, ...]) -> np.ndarray:
    v = np.zeros(12, dtype=float)
    # Root gets a slight emphasis because it is perceptually and harmonically
    # more informative than the upper chord tones.
    for idx, interval in enumerate(intervals):
        v[(root + interval) % 12] = 1.15 if idx == 0 else 1.0
    return v / (np.linalg.norm(v) + 1e-12)


CHORD_TEMPLATES: list[tuple[str, int, str, tuple[int, ...], np.ndarray, float]] = []
for root, pitch in enumerate(PITCHES):
    for quality, (intervals, suffix, penalty) in QUALITIES.items():
        CHORD_TEMPLATES.append(
            (f"{pitch}{suffix}", root, quality, intervals, _template(root, intervals), penalty)
        )


def classify_chroma(chroma_vector: np.ndarray) -> tuple[str, float, int | None, tuple[int, ...] | None]:
    x = np.asarray(chroma_vector, dtype=float)
    if x.size != 12 or not np.isfinite(x).all() or float(x.sum()) <= 1e-9:
        return "N", 0.0, None, None
    norm = np.linalg.norm(x)
    if norm <= 1e-9:
        return "N", 0.0, None, None
    x = x / norm

    scored = []
    for name, root, quality, intervals, template, penalty in CHORD_TEMPLATES:
        raw = float(np.dot(x, template))
        scored.append((raw - penalty, raw, name, root, quality, intervals))
    scored.sort(reverse=True)

    best_adjusted, best_raw, best_name, best_root, _quality, best_intervals = scored[0]
    second_adjusted = scored[1][0] if len(scored) > 1 else 0.0
    margin = max(0.0, best_adjusted - second_adjusted)
    confidence = max(0.0, min(1.0, best_raw * 0.58 + margin * 3.2 - 0.12))

    if best_raw < 0.47:
        return "N", confidence, None, None
    return best_name, confidence, best_root, best_intervals


def _merge_hits(hits: Iterable[ChordHit], max_gap: float = 0.08) -> list[ChordHit]:
    merged: list[ChordHit] = []
    for hit in hits:
        if merged and merged[-1].chord == hit.chord and hit.start - merged[-1].end <= max_gap:
            prev = merged[-1]
            d1 = max(0.001, prev.end - prev.start)
            d2 = max(0.001, hit.end - hit.start)
            prev.end = hit.end
            prev.confidence = (prev.confidence * d1 + hit.confidence * d2) / (d1 + d2)
        else:
            merged.append(hit)
    return merged


def _estimate_key(chroma: np.ndarray) -> tuple[str, float]:
    profile_major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    profile_minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    avg = np.mean(chroma, axis=1)
    avg = (avg - avg.mean()) / (avg.std() + 1e-9)
    candidates = []
    for root in range(12):
        for mode, profile in (("major", profile_major), ("minor", profile_minor)):
            p = np.roll(profile, root)
            p = (p - p.mean()) / (p.std() + 1e-9)
            candidates.append((float(np.dot(avg, p) / 12.0), root, mode))
    candidates.sort(reverse=True)
    score, root, mode = candidates[0]
    confidence = max(0.0, min(1.0, (score + 1.0) / 2.0))
    return f"{PITCHES[root]} {mode}", confidence


def _smooth_labels(labels: list[str], confidences: list[float]) -> tuple[list[str], list[float]]:
    """Conservative 3-beat smoothing to reduce one-beat chord flicker."""
    if len(labels) < 3:
        return labels, confidences
    out = labels[:]
    conf = confidences[:]
    for i in range(1, len(labels) - 1):
        left, cur, right = labels[i - 1], labels[i], labels[i + 1]
        if left == right and cur != left and cur != "N":
            # Only replace a weak isolated hit; keep deliberate passing chords.
            if confidences[i] < max(confidences[i - 1], confidences[i + 1]) + 0.08:
                out[i] = left
                conf[i] = (confidences[i - 1] + confidences[i] + confidences[i + 1]) / 3.0
    return out, conf


def _maybe_slash_chord(
    chord: str,
    root: int | None,
    intervals: tuple[int, ...] | None,
    bass_vector: np.ndarray,
    chord_confidence: float,
) -> str:
    if chord == "N" or root is None or not intervals or chord_confidence < 0.58:
        return chord
    bass = np.asarray(bass_vector, dtype=float)
    if bass.size != 12 or not np.isfinite(bass).all() or float(bass.sum()) <= 1e-8:
        return chord
    order = np.argsort(bass)[::-1]
    bass_pc = int(order[0])
    total = float(bass.sum()) + 1e-12
    bass_share = float(bass[bass_pc] / total)
    if bass_share < 0.48 or bass_pc == root:
        return chord
    chord_tones = {(root + interval) % 12 for interval in intervals}
    if bass_pc not in chord_tones:
        return chord
    return f"{chord}/{PITCHES[bass_pc]}"


def _section_signature(features_sync: np.ndarray, start: int, end: int) -> np.ndarray:
    if end <= start:
        return np.zeros(features_sync.shape[0])
    x = np.mean(features_sync[:, start:end], axis=1)
    return x / (np.linalg.norm(x) + 1e-9)


def _sections(
    features_sync: np.ndarray,
    boundary_times: np.ndarray,
    duration: float,
    rms_sync: np.ndarray,
) -> list[dict]:
    n = features_sync.shape[1]
    if n < 8:
        return [{"start": 0.0, "end": duration, "label": "Section A", "semantic": "Full song", "confidence": 0.35}]

    target_sections = int(np.clip(round(n / 32), 2, 12))
    boundaries = librosa.segment.agglomerative(features_sync, k=target_sections)
    boundaries = np.unique(np.concatenate(([0], boundaries, [n])))

    raw = []
    for i in range(len(boundaries) - 1):
        a, b = int(boundaries[i]), int(boundaries[i + 1])
        start_t = float(boundary_times[a]) if a < len(boundary_times) else 0.0
        end_t = float(boundary_times[b]) if b < len(boundary_times) else duration
        energy = float(np.mean(rms_sync[a:b])) if b > a and rms_sync.size else 0.0
        raw.append(
            {
                "start": max(0.0, start_t),
                "end": min(duration, end_t),
                "sig": _section_signature(features_sync, a, b),
                "energy": energy,
            }
        )

    groups: list[np.ndarray] = []
    group_ids: list[int] = []
    for section in raw:
        sig = section["sig"]
        best_idx, best_sim = -1, -1.0
        for idx, g in enumerate(groups):
            sim = float(np.dot(sig, g))
            if sim > best_sim:
                best_idx, best_sim = idx, sim
        if best_sim >= 0.88:
            gid = best_idx
            groups[gid] = (groups[gid] + sig) / 2.0
            groups[gid] /= np.linalg.norm(groups[gid]) + 1e-9
        else:
            gid = len(groups)
            groups.append(sig)
        group_ids.append(gid)

    counts = {gid: group_ids.count(gid) for gid in set(group_ids)}
    group_energy = {
        gid: float(np.mean([s["energy"] for s, g in zip(raw, group_ids) if g == gid]))
        for gid in counts
    }
    repeated = [gid for gid, c in counts.items() if c >= 2]
    # Repetition is the primary signal; energy helps distinguish chorus-like sections.
    chorus_gid = max(repeated, key=lambda g: (counts[g], group_energy[g]), default=None)

    out = []
    for idx, (section, gid) in enumerate(zip(raw, group_ids)):
        label = f"Section {chr(65 + gid)}"
        semantic = "Section"
        conf = 0.45
        section_len = section["end"] - section["start"]
        short_edge = min(20.0, duration * 0.20)
        if idx == 0 and section_len <= short_edge:
            semantic, conf = "Intro (estimated)", 0.57
        elif idx == len(raw) - 1 and section_len <= short_edge:
            semantic, conf = "Outro (estimated)", 0.57
        elif chorus_gid is not None and gid == chorus_gid:
            semantic, conf = "Chorus-like (estimated)", 0.66
        elif counts.get(gid, 0) >= 2:
            semantic, conf = "Verse/Theme-like (estimated)", 0.59
        elif 0 < idx < len(raw) - 1:
            semantic, conf = "Bridge/Transition-like (estimated)", 0.49
        out.append(
            {
                "start": round(section["start"], 3),
                "end": round(section["end"], 3),
                "label": label,
                "semantic": semantic,
                "confidence": conf,
            }
        )
    return out


def analyze_audio(path: str | Path) -> dict:
    y, sr = librosa.load(str(path), sr=22050, mono=True)
    if y.size < sr * 2:
        raise ValueError("Audio is too short; please upload at least 2 seconds.")

    # Avoid accidental clipping differences and improve harmonic feature stability.
    y = librosa.util.normalize(y)
    duration = float(librosa.get_duration(y=y, sr=sr))
    harmonic, _ = librosa.effects.hpss(y)
    hop = 1024

    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=harmonic, sr=sr, n_mfcc=8, hop_length=hop)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]

    # Low-frequency chroma for conservative inversion/slash-chord hints.
    stft = np.abs(librosa.stft(harmonic, n_fft=4096, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    stft[freqs > 330.0, :] = 0.0
    bass_chroma = librosa.feature.chroma_stft(S=stft, sr=sr, n_fft=4096, hop_length=hop)

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop, units="frames")
    tempo = float(np.asarray(tempo).reshape(-1)[0])
    beat_frames = np.asarray(beat_frames, dtype=int)

    if len(beat_frames) < 2:
        beat_frames = np.arange(0, chroma.shape[1], max(1, int(sr / hop * 0.5)), dtype=int)
    beat_frames = beat_frames[beat_frames < chroma.shape[1]]
    if len(beat_frames) < 2:
        beat_frames = np.array([0, max(1, chroma.shape[1] - 1)], dtype=int)

    boundaries = np.unique(np.concatenate(([0], beat_frames, [chroma.shape[1]]))).astype(int)
    chroma_sync = librosa.util.sync(chroma, boundaries, aggregate=np.median, pad=False)
    bass_sync = librosa.util.sync(bass_chroma, boundaries, aggregate=np.median, pad=False)
    mfcc_sync = librosa.util.sync(mfcc, boundaries, aggregate=np.mean, pad=False)
    rms_sync = librosa.util.sync(rms[np.newaxis, :], boundaries, aggregate=np.mean, pad=False)[0]

    # Structural features blend harmony and timbre, which is more useful than harmony alone.
    mfcc_norm = librosa.util.normalize(mfcc_sync, axis=1)
    structure_features = np.vstack([chroma_sync, 0.35 * mfcc_norm])

    boundary_times = librosa.frames_to_time(boundaries, sr=sr, hop_length=hop)
    boundary_times = np.clip(boundary_times, 0.0, duration)
    boundary_times[-1] = duration

    raw_names: list[str] = []
    raw_conf: list[float] = []
    roots: list[int | None] = []
    intervals_list: list[tuple[int, ...] | None] = []
    silence_floor = max(1e-5, float(np.percentile(rms_sync, 15)) * 0.55) if rms_sync.size else 1e-5

    for i in range(chroma_sync.shape[1]):
        if i < len(rms_sync) and float(rms_sync[i]) < silence_floor:
            name, conf, root, intervals = "N", 0.8, None, None
        else:
            name, conf, root, intervals = classify_chroma(chroma_sync[:, i])
        raw_names.append(name)
        raw_conf.append(conf)
        roots.append(root)
        intervals_list.append(intervals)

    names, confidences = _smooth_labels(raw_names, raw_conf)

    hits = []
    for i, name in enumerate(names):
        chord = _maybe_slash_chord(
            name,
            roots[i],
            intervals_list[i],
            bass_sync[:, i] if i < bass_sync.shape[1] else np.zeros(12),
            confidences[i],
        )
        start = float(boundary_times[i])
        end = float(boundary_times[i + 1])
        if end <= start:
            end = min(duration, start + 0.25)
        hits.append(ChordHit(start, end, chord, confidences[i]))

    merged = _merge_hits(hits)
    key, key_conf = _estimate_key(chroma)
    sections = _sections(structure_features, boundary_times, duration, rms_sync)

    quality_counts: dict[str, int] = {}
    for hit in merged:
        quality_counts[hit.chord] = quality_counts.get(hit.chord, 0) + 1
    top_chords = sorted(quality_counts.items(), key=lambda item: (-item[1], item[0]))[:8]

    return {
        "version": "0.3.0",
        "duration": round(duration, 3),
        "bpm": round(tempo, 2),
        "key": key,
        "key_confidence": round(key_conf, 3),
        "chords": [
            {
                "start": round(h.start, 3),
                "end": round(h.end, 3),
                "chord": h.chord,
                "confidence": round(h.confidence, 3),
            }
            for h in merged
        ],
        "sections": sections,
        "top_chords": [{"chord": chord, "count": count} for chord, count in top_chords],
        "notes": [
            "Chord vocabulary includes major, minor, 7, maj7, m7, sus2, sus4, dim, aug and conservative slash-chord hints.",
            "Beat-level smoothing reduces isolated one-beat flicker.",
            "Verse/chorus/bridge semantics are estimates; repeated Section A/B/C labels are the safer structural output.",
        ],
    }
