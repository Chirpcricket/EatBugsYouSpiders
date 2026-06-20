# Split Script — How Tips Are Divided

When a listener tips a mix, the payment is split automatically between the curator and the contributing artists. This document defines how that split is calculated.

---

## Bottom Up

The system is bottom up. Artists are the raw material. The curator shapes from what exists. The tip flows back down to the source. Value originates at the track level, rises through curation, returns to where it came from.

---

## What EBYS Knows at Tip Time

EBYS has full visibility into the mix at every moment:

- Which slices are playing across all 4 stems (vocals, melody, bass, drums)
- Which track each slice came from
- How many distinct tracks are contributing
- How rapidly EBYS has been switching between sources
- How spectrally different those sources are from each other
- Which stem each track contributed to, and how heavily weighted that stem was
- Which track the other tracks adapted to — who led, who followed

---

## How Leadership Is Determined

Leadership in EBYS is emergent — not declared by a single command, but felt through two mechanisms working together:

- **`setTrackWeight`** — makes a stem louder and more dominant in the mix
- **`setMatchProb`** — controls how tightly a stem's next slice must match the end state of another stem's last slice

The stem being chased is the leader. The stem doing the chasing is the follower. At any moment, the leader is the stem with the highest active weight that others are matching against. EBYS knows this in real time — it's the signal that drives the artist split.

---

## The Curator's Share

The more EBYS authored the mix, the more the curator earns.

```
curator_share = (1 - 1/N) × edit_rate_normalized × avg_descriptor_distance
```

Where:
- **N** = number of distinct source tracks. Single track = 0 curator share.
- **edit_rate_normalized** = how frequently EBYS switched between sources.
- **avg_descriptor_distance** = how spectrally different the combined slices were.

The remaining `(1 - curator_share)` goes to the artists.

---

## The Artist Split

The split is weighted by stem weight at the moment of the tip — not slice count. What matters is the hierarchy of the mix at that exact second: who's leading, who's following.

**The leader** — the track with the highest active stem weight, whose state the other stems are matching against — earns the largest share. The tip is for the direction the mix was going, and the leader set that direction.

**Supporting tracks** — stems actively following the leader via match probability — split the remainder proportionally by their weight.

**Briefly featured tracks** — present but not structurally central at tip time — earn the smallest share.

The default is leader-weighted. But this is configurable per deployment — a label or community radio can adjust the distribution to reflect their own values about usage vs. contribution.

### The Role at the Moment of the Tip

The mix is a fire — leaders interchange constantly. A track that was texture in one slice leads the next. The split is calculated at the moment the tip is sent, not across the whole session.

Over many tips across many sessions, the economy balances itself. No track is permanently the worker or permanently the leader. The math is local to the tip, the fairness is global over time.

---

## Open Questions

- Exact weighting ratio between leader and followers — how much more does the leader earn?
- How to handle ties — two stems at equal weight at tip time?
- Should briefly featured tracks earn anything, or only tracks actively playing at tip time?
