const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Get the full session log for a session
// Returns DJ, all contributing artists, and the aggregate mix stats
async function getSessionLog(sessionId) {
  // Get session + DJ
  const sessionResult = await pool.query(
    `SELECT s.*, u.stripe_account_id as dj_stripe_account
     FROM sessions s
     JOIN users u ON u.id = s.dj_id
     WHERE s.id = $1`,
    [sessionId]
  )
  const session = sessionResult.rows[0]

  // Get all slices, grouped by track/artist
  // Sum duration per artist — that's their proportional weight
  const slicesResult = await pool.query(
    `SELECT
       u.id as artist_id,
       u.stripe_account_id,
       SUM(sl.duration_ms) as total_ms,
       AVG(sl.edit_rate) as avg_edit_rate,
       AVG(sl.descriptor_distance) as avg_descriptor_distance
     FROM slices sl
     JOIN tracks t ON t.id = sl.track_id
     JOIN users u ON u.id = t.artist_id
     WHERE sl.session_id = $1
     GROUP BY u.id, u.stripe_account_id`,
    [sessionId]
  )

  const artists = slicesResult.rows.map(row => ({
    artistId: row.artist_id,
    stripeAccountId: row.stripe_account_id,
    slices: parseInt(row.total_ms) // using duration as weight
  }))

  return {
    dj: { stripeAccountId: session.dj_stripe_account },
    artists,
    editRate: slicesResult.rows[0]?.avg_edit_rate || 0,
    descriptorDistance: slicesResult.rows[0]?.avg_descriptor_distance || 0,
    mode: session.mode
  }
}

// Open a session when the DJ starts playing
async function openSession(djId, venue, mode) {
  const result = await pool.query(
    `INSERT INTO sessions (dj_id, venue, mode) VALUES ($1, $2, $3) RETURNING *`,
    [djId, venue, mode]
  )
  return result.rows[0]
}

// Log the follow graph state whenever it changes
async function logFollowState(sessionId, followGraph) {
  const { leader, follower, weight } = followGraph
  await pool.query(
    `INSERT INTO follow_states (session_id, leader, follower, weight)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, leader, follower, weight]
  )
}

// Get the average follow graph state for a session up to a given time
// Used by the split equation to apply ▲▼⬢ weighting
async function getFollowAverage(sessionId, upToTime = null) {
  const timeFilter = upToTime ? `AND recorded_at <= $2` : ''
  const params = upToTime ? [sessionId, upToTime] : [sessionId]

  const result = await pool.query(
    `SELECT leader, follower, AVG(weight) as avg_weight
     FROM follow_states
     WHERE session_id = $1 ${timeFilter}
     GROUP BY leader, follower`,
    params
  )
  return result.rows  // array of { leader, follower, avg_weight }
}

// Log a slice as EBYS plays it
async function logSlice(sessionId, trackId, durationMs, editRate, descriptorDistance) {
  await pool.query(
    `INSERT INTO slices (session_id, track_id, duration_ms, edit_rate, descriptor_distance)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, trackId, durationMs, editRate, descriptorDistance]
  )
}

// Get artist contributions by duration — what % of the set did each artist's tracks occupy?
// upToTime: for web tips (cut at exact tip moment). null = full session (venue).
//
// Note: follow-weighted variant (duration × avg follow weight per time window) was considered
// but dropped in favour of pure duration — simpler, more predictable for artists.
// The follow_states table and logFollowState() are kept for potential future use.
async function getWeightedContributions(sessionId, upToTime = null) {
  const timeFilter = upToTime ? `AND sl.played_at <= $2` : ''
  const params = upToTime ? [sessionId, upToTime] : [sessionId]

  const result = await pool.query(
    `SELECT
       u.id                    AS artist_id,
       u.stripe_account_id,
       SUM(sl.duration_ms)     AS total_ms
     FROM slices sl
     JOIN tracks t ON t.id = sl.track_id
     JOIN users  u ON u.id = t.artist_id
     WHERE sl.session_id = $1 ${timeFilter}
     GROUP BY u.id, u.stripe_account_id
     ORDER BY total_ms DESC`,
    params
  )

  // Normalize to proportions (0.0 to 1.0, sums to 1.0)
  const totalMs = result.rows.reduce((sum, r) => sum + parseFloat(r.total_ms), 0)

  return result.rows.map(row => ({
    artistId: row.artist_id,
    stripeAccountId: row.stripe_account_id,
    proportion: parseFloat(row.total_ms) / totalMs
  }))
}

// Log a periodic system state ping from EBYS
// Fired every 4 bars (calculated from BPM) — captures state from manual or probabilistic changes
async function logPing(sessionId, bpm, segLengths, simultaneousN) {
  await pool.query(
    `INSERT INTO pings (session_id, bpm, seg_voc, seg_mel, seg_bas, seg_drm, simultaneous_n)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, bpm, segLengths.VOC, segLengths.MEL, segLengths.BAS, segLengths.DRM, simultaneousN]
  )
}

// Get avg segment lengths per stem and avg simultaneous N from ping log
// upToTime: for web tips (cut at tip moment). null = full session (venue).
async function getAvgSessionStats(sessionId, upToTime = null) {
  const timeFilter = upToTime ? `AND recorded_at <= $2` : ''
  const params = upToTime ? [sessionId, upToTime] : [sessionId]

  const result = await pool.query(
    `SELECT
       AVG(seg_voc)        AS avg_voc,
       AVG(seg_mel)        AS avg_mel,
       AVG(seg_bas)        AS avg_bas,
       AVG(seg_drm)        AS avg_drm,
       AVG(simultaneous_n) AS avg_n,
       COUNT(*) FILTER (WHERE simultaneous_n > 1)::float / NULLIF(COUNT(*), 0) AS stem_divergence_ratio
     FROM pings
     WHERE session_id = $1 ${timeFilter}`,
    params
  )

  const row = result.rows[0]
  return {
    segmentLengths: {
      VOC: parseFloat(row?.avg_voc) || 8,
      MEL: parseFloat(row?.avg_mel) || 8,
      BAS: parseFloat(row?.avg_bas) || 8,
      DRM: parseFloat(row?.avg_drm) || 8
    },
    avgN: parseFloat(row?.avg_n) || 1.0,
    stemDivergenceRatio: parseFloat(row?.stem_divergence_ratio) || 0.0
  }
}

// Close a session (end of venue set)
async function closeSession(sessionId) {
  await pool.query(
    `UPDATE sessions SET status = 'closed', closed_at = NOW() WHERE id = $1`,
    [sessionId]
  )
}

// Get all pending venue tips for a session (to batch split on close)
async function getPendingVenueTips(sessionId) {
  const result = await pool.query(
    `SELECT * FROM tips
     WHERE session_id = $1 AND mode = 'venue' AND status = 'pending'`,
    [sessionId]
  )
  return result.rows
}

// Record a payout
async function recordPayout(tipId, userId, amountCents, stripeTransferId) {
  await pool.query(
    `INSERT INTO payouts (tip_id, user_id, amount_cents, stripe_transfer_id)
     VALUES ($1, $2, $3, $4)`,
    [tipId, userId, amountCents, stripeTransferId]
  )
}

// Mark a tip as split
async function markTipSplit(tipId) {
  await pool.query(
    `UPDATE tips SET status = 'split' WHERE id = $1`,
    [tipId]
  )
}

module.exports = {
  openSession,
  getSessionLog,
  getWeightedContributions,
  getAvgSessionStats,
  logSlice,
  logFollowState,
  logPing,
  getFollowAverage,
  closeSession,
  getPendingVenueTips,
  recordPayout,
  markTipSplit
}
