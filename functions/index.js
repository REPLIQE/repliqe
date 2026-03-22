const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const axios = require('axios')

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')

/** Join all `text` blocks from Anthropic Messages API (there may be several; order is preserved). */
function extractAnthropicReplyText(data) {
  const blocks = data?.content
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

function anthropicErrorMessage(err) {
  const d = err.response?.data
  if (d && typeof d === 'object') {
    if (typeof d.error === 'string') return d.error
    if (d.error && typeof d.error.message === 'string') return d.error.message
    if (typeof d.message === 'string') return d.message
  }
  return err.message || 'Anthropic request failed'
}

async function anthropicGenerateCoachText(apiKey, prompt) {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  )
  const text = extractAnthropicReplyText(response.data)
  if (!text) {
    console.error('Anthropic empty content:', JSON.stringify(response.data?.content))
    throw Object.assign(new Error('Empty model response'), { isEmptyModel: true })
  }
  return text
}

const callableOptions = {
  secrets: [anthropicKey],
  region: 'europe-west1',
}

/**
 * Preferred client entry: Firebase SDK callable — works reliably on mobile/PWA (avoids raw fetch to cloudfunctions.net).
 */
exports.generateCoachProgrammeCallable = onCall(callableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to use REPLIQE Coach.')
  }
  const prompt = request.data?.prompt
  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing prompt')
  }

  let apiKey
  try {
    apiKey = anthropicKey.value()
  } catch (e) {
    console.error('ANTHROPIC_API_KEY secret:', e.message)
    throw new HttpsError('failed-precondition', 'Server configuration error')
  }
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Server configuration error')
  }

  try {
    const text = await anthropicGenerateCoachText(apiKey, prompt)
    return { text }
  } catch (err) {
    if (err.isEmptyModel) {
      throw new HttpsError('internal', 'Empty model response')
    }
    const message = anthropicErrorMessage(err)
    console.error('Anthropic error (callable):', message, err.response?.status, err.response?.data)
    throw new HttpsError('internal', message)
  }
})

/** REPLIQE Coach — HTTP + CORS (legacy / external clients). Prefer generateCoachProgrammeCallable from the app. */
exports.generateCoachProgramme = onRequest(
  {
    secrets: [anthropicKey],
    region: 'europe-west1',
    cors: true,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*')
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.set(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
      )
      res.set('Access-Control-Max-Age', '86400')
      res.status(204).send('')
      return
    }

    let body = req.body
    if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) {
      try {
        body = JSON.parse((req.rawBody && req.rawBody.toString()) || '{}')
      } catch {
        body = {}
      }
    }
    const { prompt } = body
    if (!prompt || typeof prompt !== 'string') {
      res.set('Access-Control-Allow-Origin', '*')
      res.status(400).json({ error: 'Missing prompt' })
      return
    }

    let apiKey
    try {
      apiKey = anthropicKey.value()
    } catch (e) {
      console.error('ANTHROPIC_API_KEY secret:', e.message)
      res.set('Access-Control-Allow-Origin', '*')
      res.status(500).json({ error: 'Server misconfiguration: API key not available' })
      return
    }
    if (!apiKey) {
      res.set('Access-Control-Allow-Origin', '*')
      res.status(500).json({ error: 'Server misconfiguration: empty API key' })
      return
    }

    try {
      const text = await anthropicGenerateCoachText(apiKey, prompt)
      res.set('Access-Control-Allow-Origin', '*')
      res.json({ text })
    } catch (err) {
      if (err.isEmptyModel) {
        res.set('Access-Control-Allow-Origin', '*')
        res.status(502).json({ error: 'Empty model response' })
        return
      }
      const message = anthropicErrorMessage(err)
      console.error('Anthropic error:', message, err.response?.status, err.response?.data)
      res.set('Access-Control-Allow-Origin', '*')
      const st = err.response?.status
      const outStatus = typeof st === 'number' && st >= 400 && st < 600 ? st : 500
      res.status(outStatus).json({ error: message })
    }
  }
)

/** @deprecated Use generateCoachProgramme — kept so old app builds keep working until everyone updates. */
exports.generateQoreProgramme = exports.generateCoachProgramme
