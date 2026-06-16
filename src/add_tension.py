#!/usr/bin/env python3
"""
add_tension.py — compute tension fields for every slice in analysis_library.json

For each stem of each track:
  1. Assign each slice to a bar using downbeats_ms
  2. Average all 6 descriptors per bar  (T = MFCC RMS of M0–M5)
  3. Sliding-window slope across bars
  4. Normalize each descriptor's slopes to [0, 1]
  5. Write tension_C/E/F/P/H/T back to each slice

Usage:
  python3 add_tension.py                    # process all tracks
  python3 add_tension.py "trackname"        # process one track (partial name match)
  python3 add_tension.py --window 6         # change window size (default 4)
"""

import json, math, sys, os, re

ANALYSIS_PATH  = os.path.join(os.path.dirname(__file__), 'MAX/analysis_library.json')
DOWNBEATS_PATH = os.path.join(os.path.dirname(__file__), 'downbeats.json')
WINDOW         = 4   # number of bars in the slope window (half = floor(w/2))

# Stem suffixes to strip when matching analysis track → downbeats track
STEM_SUFFIXES = ['_vocals.wav', '_melody.wav', '_bass.wav', '_drums.wav',
                 '_vocals',     '_melody',     '_bass',     '_drums']

DESCRIPTORS = ['C', 'E', 'F', 'P', 'H', 'T']

# ── helpers ───────────────────────────────────────────────────────────────────

def strip_stem_suffix(name):
    for suf in STEM_SUFFIXES:
        if name.endswith(suf):
            return name[:-len(suf)]
    return name

def slice_T(s):
    """Timbre = RMS of MFCC coefficients M0–M5."""
    vals = [s.get(f'M{i}', 0.0) for i in range(6)]
    return math.sqrt(sum(v * v for v in vals) / len(vals))

def get_descriptor(s, d):
    if d == 'T':
        return slice_T(s)
    return float(s.get(d, 0.0))

def assign_bar(time_ms, downbeats_ms):
    """Return bar index (0-based) for a slice at time_ms."""
    bar = 0
    for i, db in enumerate(downbeats_ms):
        if time_ms >= db:
            bar = i
        else:
            break
    return bar

def sliding_slope(values, w):
    """
    For each position b, slope[b] = values[b+half] - values[b-half].
    Edges are clamped (use nearest available index).
    """
    n    = len(values)
    half = w // 2
    slopes = []
    for b in range(n):
        lo = max(0, b - half)
        hi = min(n - 1, b + half)
        slopes.append(values[hi] - values[lo])
    return slopes

def normalize(slopes):
    """Rescale list to [0, 1]. Returns list of same length."""
    lo, hi = min(slopes), max(slopes)
    span = hi - lo
    if span == 0:
        return [0.0] * len(slopes)
    return [(v - lo) / span for v in slopes]

# ── core ──────────────────────────────────────────────────────────────────────

def process_stem(slices_dict, metadata, downbeats_ms, w):
    """
    slices_dict : { "slice_0001": { time, C, E, F, P, H, M0..M5 }, ... }
    metadata    : { stemDurMs, ... }
    downbeats_ms: [ms, ms, ...]
    w           : window size

    Mutates slices_dict in place — adds tension_C/E/F/P/H/T to each slice.
    time field is normalized 0–1; multiply by stemDurMs to get absolute ms.
    """
    n_bars = len(downbeats_ms)
    if n_bars == 0:
        print('    ⚠  no downbeats — skipping stem')
        return

    dur_ms = float(metadata.get('stemDurMs', 0.0))
    if dur_ms == 0:
        print('    ⚠  stemDurMs missing — skipping stem')
        return

    # 1. Assign each slice to a bar
    slice_keys = sorted(slices_dict.keys())
    bar_of = {}   # slice_key → bar index
    for key in slice_keys:
        s = slices_dict[key]
        time_ms = float(s.get('time', 0.0)) * dur_ms
        bar_of[key] = assign_bar(time_ms, downbeats_ms)

    # 2. Per-bar average for each descriptor
    bar_sums  = [{d: 0.0 for d in DESCRIPTORS} for _ in range(n_bars)]
    bar_counts = [0] * n_bars
    for key in slice_keys:
        b = bar_of[key]
        s = slices_dict[key]
        for d in DESCRIPTORS:
            bar_sums[b][d] += get_descriptor(s, d)
        bar_counts[b] += 1

    bar_avgs = []
    for b in range(n_bars):
        cnt = bar_counts[b] if bar_counts[b] > 0 else 1
        bar_avgs.append({d: bar_sums[b][d] / cnt for d in DESCRIPTORS})

    # 3 & 4. Slope + normalize per descriptor
    tension_per_bar = {}
    for d in DESCRIPTORS:
        raw_values = [bar_avgs[b][d] for b in range(n_bars)]
        slopes     = sliding_slope(raw_values, w)
        normed     = normalize(slopes)
        tension_per_bar[d] = normed   # index = bar index

    # 5. Write back to each slice
    for key in slice_keys:
        b = bar_of[key]
        s = slices_dict[key]
        for d in DESCRIPTORS:
            s[f'tension_{d}'] = round(tension_per_bar[d][b], 4)

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    # Parse args
    filter_name = None
    w = WINDOW
    args = sys.argv[1:]
    for a in args:
        if a.startswith('--window'):
            try:
                w = int(a.split('=')[-1]) if '=' in a else int(args[args.index(a)+1])
            except (IndexError, ValueError):
                pass
        elif not a.startswith('--'):
            filter_name = a.lower()

    print(f'Loading analysis library from {ANALYSIS_PATH}')
    with open(ANALYSIS_PATH) as f:
        lib = json.load(f)

    print(f'Loading downbeats from {DOWNBEATS_PATH}')
    with open(DOWNBEATS_PATH) as f:
        beats_db = json.load(f)

    track_keys = list(lib.keys())
    if filter_name:
        track_keys = [k for k in track_keys if filter_name in k.lower()]
        print(f'Filtering to {len(track_keys)} matching track(s)')

    changed = 0
    for track_key in track_keys:
        base_name = strip_stem_suffix(track_key)

        # Find matching downbeats entry (exact or partial)
        beats_entry = beats_db.get(base_name)
        if beats_entry is None:
            # Try partial match
            for bk in beats_db:
                if base_name in bk or bk in base_name:
                    beats_entry = beats_db[bk]
                    break
        if beats_entry is None:
            print(f'  ⚠  no downbeats found for "{base_name}" — skipping')
            continue

        downbeats_ms = beats_entry.get('downbeats_ms', [])
        print(f'\n{track_key}  ({len(downbeats_ms)} bars, window={w})')

        track_data = lib[track_key]
        for stem_name, stem_data in track_data.items():
            slices_dict = stem_data.get('slices', {})
            metadata    = stem_data.get('metadata', {})
            if not slices_dict:
                continue
            print(f'  [{stem_name}]  {len(slices_dict)} slices')
            process_stem(slices_dict, metadata, downbeats_ms, w)
            changed += 1

    if changed == 0:
        print('\nNothing processed — check track name filter or downbeats.json coverage.')
        return

    print(f'\nSaving {ANALYSIS_PATH} ...')
    with open(ANALYSIS_PATH, 'w') as f:
        json.dump(lib, f)
    print(f'Done. tension_C/E/F/P/H/T written to all slices.')

if __name__ == '__main__':
    main()
