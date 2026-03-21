const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const axios = require('axios')

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')

exports.generateQoreProgramme = onRequest(
  {
    secrets: [anthropicKey],
    region: 'europe-west1',
    cors: true,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*')
      res.set('Access-Control-Allow-Methods', 'POST')
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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
    if (!prompt) {
      res.set('Access-Control-Allow-Origin', '*')
      res.status(400).json({ error: 'Missing prompt' })
      return
    }

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': anthropicKey.value(),
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
        }
      )
      res.set('Access-Control-Allow-Origin', '*')
      res.json({ text: response.data.content[0].text })
    } catch (err) {
      console.error('Anthropic error:', err.message)
      res.set('Access-Control-Allow-Origin', '*')
      res.status(500).json({ error: err.message })
    }
  }
)
