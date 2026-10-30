import { masteryKey, masteryFor } from './model.ts'
import type { Answer, AppData, DailyRecord, Phrase, Word } from './model.ts'

function applyAnswer(data: AppData, answer: Answer) {
  if (!['ja-zh', 'zh-ja'].includes(answer.direction) || typeof answer.correct !== 'boolean' ||
      !data.words.some((word) => word.id === answer.wordId && masteryKey(word.chinese) === answer.key)) {
    throw new Error('回答の単語情報が一致しません。保存していません。')
  }
  const value = masteryFor(data, answer.key)
  if (!data.masteries.some((item) => item.key === value.key)) data.masteries.push(value)
  value[answer.direction] = Math.max(0, Math.min(100, value[answer.direction] + (answer.correct ? 5 : -5)))
}

/** These reducers run only inside a storage transaction; callers never persist interim answers. */
export function completeDaily(data: AppData, record: Omit<DailyRecord, 'mistakes'>, answers: Answer[]) {
  if (data.dailyRecords.some((item) => item.startDate === record.startDate && item.mode === record.mode)) return
  const date = /^\d{4}-\d{2}-\d{2}$/.test(record.startDate) && new Date(`${record.startDate}T00:00:00`)
  if (!date || Number.isNaN(date.getTime()) || !record.id || !['morning', 'night'].includes(record.mode) ||
      Number.isNaN(Date.parse(record.completedAt)) || answers.length !== 10 || new Set(answers.map((a) => a.key)).size !== 10 ||
      answers.some((answer, i) => answer.direction !== (i < 5 ? 'ja-zh' : 'zh-ja'))) {
    throw new Error('朝夜の完了には、重複しない10語・各方向5問が必要です。')
  }
  answers.forEach((answer) => applyAnswer(data, answer))
  data.dailyRecords.push({ ...record, mistakes: answers.filter((answer) => !answer.correct) })
}

export function applyInfiniteAnswer(data: AppData, sessionId: string, sequence: number, answer: Answer) {
  const checkpoint = data.answerCheckpoints.find((item) => item.sessionId === sessionId)
  if (!sessionId || !Number.isSafeInteger(sequence) || sequence < 1) throw new Error('回答番号が不正です。')
  if (checkpoint && sequence <= checkpoint.sequence) return
  if (sequence !== (checkpoint?.sequence ?? 0) + 1) throw new Error('回答の順番が一致しません。再試行してください。')
  applyAnswer(data, answer)
  if (checkpoint) checkpoint.sequence = sequence
  else data.answerCheckpoints.push({ sessionId, sequence })
}

export function installInitialWords(data: AppData, datasetId: string, words: Word[]) {
  if (data.initialization.initialDatasetId === datasetId) return
  if (!datasetId || data.initialization.initialDatasetId) throw new Error('別の初期データが導入済みです。移行手順が必要です。')
  if (new Set(words.map((word) => word.id)).size !== words.length || words.some((word) => data.words.some((existing) => existing.id === word.id))) {
    throw new Error('初期データのIDが重複しています。')
  }
  data.words.push(...words)
  data.initialization.initialDatasetId = datasetId
}

export function installPrototypeWords(data: AppData, datasetId: string, words: Word[]) {
  if (data.initialization.initialDatasetId === datasetId) return
  data.words = data.words.filter((word) => word.source !== 'verification')
  data.initialization.verificationAdded = false
  if (data.initialization.initialDatasetId === 'starter-200-v1' && datasetId === 'starter-200-v2-friends') {
    const retained = data.words.filter((word) => word.source !== 'initial')
    if (new Set(words.map((word) => word.id)).size !== words.length || words.some((word) => retained.some((existing) => existing.id === word.id))) {
      throw new Error('更新データのIDが重複しています。')
    }
    data.words = [...retained, ...words]
    data.initialization.initialDatasetId = datasetId
    return
  }
  installInitialWords(data, datasetId, words)
}

export function installStarterPhrases(data: AppData, datasetId: string, phrases: Phrase[]) {
  if (data.initialization.phraseDatasetId === datasetId) return
  if (!datasetId || (data.initialization.phraseDatasetId && data.initialization.phraseDatasetId !== datasetId)) {
    throw new Error('別のフレーズ教材が導入済みです。移行手順が必要です。')
  }
  if (new Set(phrases.map((phrase) => phrase.id)).size !== phrases.length) throw new Error('フレーズ教材のIDが重複しています。')
  const existingTexts = new Set(data.phrases.map((phrase) => phrase.chinese.trim()))
  const additions = phrases.filter((phrase) => !data.phrases.some((existing) => existing.id === phrase.id) && !existingTexts.has(phrase.chinese.trim()))
  data.phrases.push(...additions)
  data.initialization.phraseDatasetId = datasetId
}

export function addVerificationWord(data: AppData) {
  if (data.initialization.verificationAdded) return
  const now = new Date().toISOString()
  data.words.push({
    id: crypto.randomUUID(), chinese: '你好', pinyin: 'nǐ hǎo', pinyinSource: 'manual', meanings: ['こんにちは'], genres: [],
    examples: [], source: 'verification', createdAt: now, updatedAt: now,
  })
  data.initialization.verificationAdded = true
}
