-- EBYS Database Schema

-- Artists and DJs
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255),
  email         VARCHAR(255) UNIQUE,
  stripe_account_id VARCHAR(255),  -- Stripe Connect account
  solana_wallet VARCHAR(255),      -- for CRKT conversion (optional)
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Tracks in the EBYS corpus
CREATE TABLE tracks (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255),
  artist_id     INTEGER REFERENCES users(id),
  fingerprint   VARCHAR(255) UNIQUE,  -- audio fingerprint
  created_at    TIMESTAMP DEFAULT NOW()
);

-- A session = one DJ set
CREATE TABLE sessions (
  id            SERIAL PRIMARY KEY,
  dj_id         INTEGER REFERENCES users(id),
  venue         VARCHAR(255),         -- null if web radio
  mode          VARCHAR(50),          -- 'web' or 'venue'
  status        VARCHAR(50) DEFAULT 'active',  -- 'active' or 'closed'
  started_at    TIMESTAMP DEFAULT NOW(),
  closed_at     TIMESTAMP
);

-- Every slice EBYS plays gets logged
CREATE TABLE slices (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER REFERENCES sessions(id),
  track_id      INTEGER REFERENCES tracks(id),
  duration_ms   INTEGER,              -- how long this slice played
  edit_rate     FLOAT,                -- descriptor state at this moment
  descriptor_distance FLOAT,
  played_at     TIMESTAMP DEFAULT NOW()
);

-- Follow graph state — logged whenever it changes during a set
-- Captures the leader/follower relationship between stems over time
CREATE TABLE follow_states (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER REFERENCES sessions(id),
  leader      VARCHAR(255),   -- stem name e.g. 'VOC', 'BAS'
  follower    VARCHAR(255),
  weight      FLOAT,          -- how strongly follower tracks leader (0-1)
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Periodic system state ping — fired every 4 bars (based on current BPM)
-- Captures full state regardless of what caused it: manual command or probabilistic engine
-- Used to compute avg segment length variance (L3) and avg simultaneous N
CREATE TABLE pings (
  id             SERIAL PRIMARY KEY,
  session_id     INTEGER REFERENCES sessions(id),
  bpm            FLOAT,
  seg_voc        FLOAT,   -- current setSegmentBars for VOC stem (in bars)
  seg_mel        FLOAT,   -- current setSegmentBars for MEL stem
  seg_bas        FLOAT,   -- current setSegmentBars for BAS stem
  seg_drm        FLOAT,   -- current setSegmentBars for DRM stem
  simultaneous_n FLOAT,   -- distinct tracks playing across stems right now
  recorded_at    TIMESTAMP DEFAULT NOW()
);

-- Tips from listeners
CREATE TABLE tips (
  id                        SERIAL PRIMARY KEY,
  session_id                INTEGER REFERENCES sessions(id),
  amount_cents              INTEGER,
  stripe_payment_intent_id  VARCHAR(255) UNIQUE,
  tip_direction             VARCHAR(10) DEFAULT 'equal',  -- 'up' (▲), 'down' (▼), 'equal' (⬢)
  status                    VARCHAR(50) DEFAULT 'pending', -- 'pending', 'split', 'failed'
  mode                      VARCHAR(50),  -- 'web' or 'venue'
  created_at                TIMESTAMP DEFAULT NOW()
);

-- Record of each payout after split runs
CREATE TABLE payouts (
  id            SERIAL PRIMARY KEY,
  tip_id        INTEGER REFERENCES tips(id),
  user_id       INTEGER REFERENCES users(id),
  amount_cents  INTEGER,
  stripe_transfer_id VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW()
);
