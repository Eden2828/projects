import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const defaultConfig: GenerationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
}

export function getGeminiModel(config?: Partial<GenerationConfig>): GenerativeModel {
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: { ...defaultConfig, ...config },
  })
}

export function getGeminiFastModel(config?: Partial<GenerationConfig>): GenerativeModel {
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { ...defaultConfig, temperature: 0.3, ...config },
  })
}

export async function generateText(prompt: string, fast = false): Promise<string> {
  const model = fast ? getGeminiFastModel() : getGeminiModel()
  const result = await model.generateContent(prompt)
  return result.response.text()
}

export async function generateJSON<T>(prompt: string, fast = false): Promise<T> {
  const model = fast
    ? getGeminiFastModel({ responseMimeType: 'application/json' } as GenerationConfig)
    : getGeminiModel({ responseMimeType: 'application/json' } as GenerationConfig)

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  return JSON.parse(text) as T
}

export async function streamChat(
  history: Array<{ role: 'user' | 'model'; parts: string }>,
  newMessage: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const model = getGeminiModel({ temperature: 0.8 })
  const chat = model.startChat({
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts }],
    })),
  })

  const result = await chat.sendMessageStream(newMessage)
  let fullText = ''

  for await (const chunk of result.stream) {
    const chunkText = chunk.text()
    fullText += chunkText
    onChunk(chunkText)
  }

  return fullText
}
