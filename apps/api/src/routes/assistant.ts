import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/errors.js'
import { logger } from '../lib/logger.js'

const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(1_500),
})

const assistantInstruction = [
  'You are Neev, a concise red brick marketplace assistant.',
  'Use only this context: NCR East demo marketplace, fresh stock, explicit freight, contractors, and home builders.',
  'Never claim a delivery guarantee or invent live inventory, pricing, suppliers, or payment status.',
  'Ask for quantity, delivery area, and whether the brick is for structure or a visible facade when that context is missing.',
  'Keep answers practical and under 120 words.',
].join(' ')

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>
    }
  }>
}

function extractText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const candidates = (payload as GeminiPayload).candidates
  const parts = candidates?.[0]?.content?.parts
  if (!parts) return ''
  return parts
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join(' ')
    .trim()
}

export const assistantRouter = Router()

assistantRouter.post('/chat', async (request, response, next) => {
  const { message } = assistantRequestSchema.parse(request.body)

  if (!env.GEMINI_API_KEY) {
    response.status(503).json({ error: 'Assistant unavailable', requestId: String(request.id) })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const providerResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: assistantInstruction }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
        }),
      },
    )

    if (!providerResponse.ok) {
      logger.warn({ event: 'assistant.provider_rejected', requestId: String(request.id), status: providerResponse.status }, 'Gemini request rejected')
      throw new HttpError(502, 'Assistant provider unavailable')
    }

    const text = extractText(await providerResponse.json())
    if (!text) throw new HttpError(502, 'Assistant provider unavailable')
    response.json({ data: { text } })
  } catch (error) {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    logger.warn({ event: 'assistant.provider_error', requestId: String(request.id), err: error }, 'Gemini request failed')
    next(new HttpError(502, 'Assistant provider unavailable'))
  } finally {
    clearTimeout(timeout)
  }
})
