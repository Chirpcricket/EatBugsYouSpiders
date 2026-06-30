const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express()

app.use(express.json())

// Stripe webhooks need raw body
app.use('/webhook', express.raw({ type: 'application/json' }))

const tipsRouter = require('./routes/tips')
const accountsRouter = require('./routes/accounts')

app.use('/tips', tipsRouter)
app.use('/accounts', accountsRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`EBYS backend running on port ${PORT}`))
