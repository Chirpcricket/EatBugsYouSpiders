// Split Equation
//
// Structure:
//   curator_floor  — curator always earns this just for curating
//   artist_floor   — artists always earn this just for being in the corpus
//   variable_pool  — split between curator and artists based on transformation level
//
// All values are placeholders — configurable per deployment.

const CONFIG = {
  curator_floor:  0.40,  // [40%] — always
  artist_floor:   0.10,  // [10%] — always
  variable_pool:  0.50,  // [50%] — must equal 1 - curator_floor - artist_floor

  // How much of the variable pool the curator gets at each level
  // The rest goes to the artist pool
  level_curator_variable: {
    0: 0.00,  // L0 Sequential      — curator gets [0%]   of variable
    1: 0.10,  // L1 Lightly Layered — curator gets [10%]  of variable
    2: 0.50,  // L2 Heavily Layered — curator gets [50%]  of variable
    3: 1.00,  // L3 Composed        — curator gets [100%] of variable
  }
}

// Compute variance of segment lengths across the 4 stems
// High variance = stems have very different lengths = DJ broke natural bar structure
// Low variance = stems running at similar lengths = natural playback
//
// segmentLengths: { VOC: 8, MEL: 4, BAS: 16, DRM: 8 }  (in bars)
function segmentLengthVariance(segmentLengths) {
  const values = Object.values(segmentLengths)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return variance
}

// Detect transformation level from session data streamed by EBYS
//
// N:                   number of distinct source tracks used in the set
// stemDivergenceRatio: % of set where stems drew from different source tracks simultaneously
// segmentLengths:      { VOC, MEL, BAS, DRM } — avg segment lengths per stem across the set
function detectLevel(N, stemDivergenceRatio, segmentLengths) {
  if (N <= 1) return 0                                         // L0 — sequential

  const variance = segmentLengthVariance(segmentLengths)

  if (stemDivergenceRatio >= 0.40                              // [40%] — placeholder
      && N >= 4                                                 // [4] tracks minimum — placeholder
      && variance >= 20.0) return 3                            // [20.0] variance threshold — placeholder
                                                               // L3 — composed: diverged + many sources + fractured structure

  if (stemDivergenceRatio >= 0.40) return 2                    // L2 — heavily layered

  return 1                                                      // L1 — lightly layered
}

// Main split function
//
// amountCents:        total tip amount in cents
// dj:                 { stripeAccountId }
// contributions:      [{ stripeAccountId, proportion }] — from getWeightedContributions()
//                     proportion = that artist's share of total duration (sums to 1.0)
// sessionStats:       { N, stemDivergenceRatio, segmentLengths: { VOC, MEL, BAS, DRM } }
function calculateSplit(amountCents, dj, contributions, sessionStats) {
  const { N, stemDivergenceRatio, segmentLengths } = sessionStats

  const level = detectLevel(N, stemDivergenceRatio, segmentLengths)
  const curatorVariable = CONFIG.level_curator_variable[level]

  // Curator total = floor + their share of the variable pool
  const curatorShare = CONFIG.curator_floor + (CONFIG.variable_pool * curatorVariable)

  // Artist total = floor + remaining variable pool
  const artistShare = CONFIG.artist_floor + (CONFIG.variable_pool * (1 - curatorVariable))

  const djCut = Math.floor(amountCents * curatorShare)
  const artistPool = Math.floor(amountCents * artistShare)

  // Artist split — proportional to duration % in the set
  const payouts = contributions.map(artist => ({
    stripeAccountId: artist.stripeAccountId,
    amountCents: Math.floor(artistPool * artist.proportion)
  }))

  // DJ payout
  payouts.push({
    stripeAccountId: dj.stripeAccountId,
    amountCents: djCut
  })

  return { level, payouts }
}

module.exports = { calculateSplit, detectLevel, CONFIG }
