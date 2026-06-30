const express = require('express')
const router = express.Router()
const { logSlice, logFollowState, logPing, openSession, closeSession } = require('../db/queries')

// EBYS opens a session when the DJ starts playing
// POST /slices/session/open
// Body: { djId, venue, mode: 'web' | 'venue' }
router.post('/session/open', async (req, res) => {
  const { djId, venue, mode } = req.body

  try {
    const session = await openSession(djId, venue, mode)
    res.json({ sessionId: session.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// EBYS streams a slice every time it plays one
// POST /slices/log
// Body: {
//   sessionId,
//   trackId,
//   durationMs,
//   editRate,
//   descriptorDistance
// }
router.post('/log', async (req, res) => {
  const { sessionId, trackId, durationMs, editRate, descriptorDistance } = req.body

  try {
    await logSlice(sessionId, trackId, durationMs, editRate, descriptorDistance)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// EBYS streams the follow graph state whenever it changes
// This captures who is following who at any given moment
// POST /slices/follow
// Body: {
//   sessionId,
//   followGraph: {
//     leader: 'stemA',
//     follower: 'stemB',
//     weight: 0.7       // how strongly follower is tracking leader (0-1)
//   }
// }
router.post('/follow', async (req, res) => {
  const { sessionId, followGraph } = req.body

  try {
    await logFollowState(sessionId, followGraph)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// EBYS pings the backend every 4 bars (calculated from current BPM)
// Captures full system state regardless of what caused it — manual command or probabilistic engine
//
// ping_interval_ms = (4 bars × 4 beats × 60000) / BPM
//   120 BPM → every 8s
//    90 BPM → every 10.6s
//    60 BPM → every 16s
//
// POST /slices/ping
// Body: {
//   sessionId,
//   bpm,
//   segLengths: { VOC: 4, MEL: 8, BAS: 16, DRM: 4 },
//   simultaneousN: 3   ← distinct tracks playing across stems right now
// }
router.post('/ping', async (req, res) => {
  const { sessionId, bpm, segLengths, simultaneousN } = req.body

  try {
    await logPing(sessionId, bpm, segLengths, simultaneousN)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// DJ closes the session at end of set
// Triggers batch split for all pending venue tips
// POST /slices/session/close
// Body: { sessionId }
router.post('/session/close', async (req, res) => {
  const { sessionId } = req.body

  try {
    await closeSession(sessionId)

    // Trigger batch split for venue tips
    const response = await fetch(`http://localhost:${process.env.PORT}/tips/close-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })

    const result = await response.json()
    res.json({ closed: true, tipsSplit: result.settled })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


module.exports = router
