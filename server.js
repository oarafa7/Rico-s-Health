import express from 'express'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4173

app.use(cors())
app.use(express.json())

// Serve Vite build
app.use(express.static(join(__dirname, 'dist')))

// Claude API proxy
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const { messages, context } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const client = new Anthropic({ apiKey })
  const systemPrompt = buildSystemPrompt(context)

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    res.json({ content: response.content[0].text })
  } catch (err) {
    console.error('Claude API error:', err)
    res.status(500).json({ error: 'Failed to get response from Claude' })
  }
})

function buildSystemPrompt(context) {
  const lines = [
    "You are RICO, a knowledgeable health and performance assistant built into a personal stack tracker app.",
    "You help users understand their peptide protocols, nutrition, and supplementation.",
    "Be concise, practical, and evidence-based. Avoid medical diagnoses.",
    "",
  ]

  if (context) {
    if (context.peptides && Object.keys(context.peptides).length > 0) {
      lines.push("## User's Current Stack")
      Object.values(context.peptides).forEach(p => {
        lines.push(`- ${p.name} (${p.category}): ${p.doseLabel} per injection, ${p.days?.length || 0} days/week`)
        if (p.vialMg && p.bacMl) {
          lines.push(`  Reconstituted: ${p.vialMg}${p.unit || 'mg'} in ${p.bacMl}ml BAC water`)
        }
      })
      lines.push("")
    }

    if (context.streak != null) {
      lines.push("## Adherence")
      lines.push(`Current streak: ${context.streak} days`)
      lines.push("")
    }

    if (context.nutritionToday) {
      const n = context.nutritionToday
      const totalCals = (n.entries || []).reduce((s, e) => s + (e.protein * 4 + e.carbs * 4 + e.fat * 9), 0)
      const totalProtein = (n.entries || []).reduce((s, e) => s + (e.protein || 0), 0)
      const totalCarbs = (n.entries || []).reduce((s, e) => s + (e.carbs || 0), 0)
      const totalFat = (n.entries || []).reduce((s, e) => s + (e.fat || 0), 0)
      lines.push("## Today's Nutrition")
      lines.push(`Target: ${n.target || 0} kcal | Logged: ${Math.round(totalCals)} kcal`)
      lines.push(`Protein: ${Math.round(totalProtein)}g | Carbs: ${Math.round(totalCarbs)}g | Fat: ${Math.round(totalFat)}g`)
      lines.push("")
    }
  }

  lines.push("Answer the user's question helpfully and concisely.")
  return lines.join('\n')
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`RICO server running on port ${PORT}`)
})
