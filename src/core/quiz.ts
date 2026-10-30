import type { Answer, AppData, Direction, Word } from './model.ts'
import { masteryFor, masteryKey } from './model.ts'

export interface Question { word: Word; direction: Direction; choices: Word[] }
export const quizAvailability = (date = new Date()) => {
  const hour = date.getHours()
  return { morning: hour < 12, night: hour >= 15, waiting: hour >= 12 && hour < 15 }
}
const random = <T,>(items: T[]) => [...items].sort(() => Math.random() - .5)
const meanings = (word: Word) => word.meanings.map((m) => m.trim().toLowerCase()).filter(Boolean)
const overlaps = (a: Word, b: Word) => meanings(a).some((m) => meanings(b).some((n) => m === n || (m.length > 2 && (m.includes(n) || n.includes(m)))))
export function makeQuestion(word: Word, direction: Direction, words: Word[]): Question | null {
  const pool = words.filter((candidate) => masteryKey(candidate.chinese) !== masteryKey(word.chinese) && !overlaps(word, candidate))
  const sameGenre = random(pool.filter((candidate) => candidate.genres.some((g) => word.genres.includes(g))))
  const others = random(pool.filter((candidate) => !sameGenre.includes(candidate)))
  const distractors = [...sameGenre, ...others].slice(0, 3)
  return distractors.length === 3 ? { word, direction, choices: random([word, ...distractors]) } : null
}
function weighted(words: Word[], data: AppData): Word[] {
  return random(words.flatMap((word) => Array.from({ length: Math.max(1, 21 - Math.floor((masteryFor(data, word.chinese)['ja-zh'] + masteryFor(data, word.chinese)['zh-ja']) / 10)) }, () => word)))
}
export function dailyQuestions(data: AppData, mode: 'morning' | 'night', date: string): Question[] {
  const unique = [...new Map(data.words.map((word) => [masteryKey(word.chinese), word])).values()]
  const morning = mode === 'night' ? data.dailyRecords.find((record) => record.startDate === date && record.mode === 'morning') : undefined
  const used = new Set<string>()
  const choose = (direction: Direction) => {
    const result: Word[] = []
    for (const mistake of morning?.mistakes.filter((item) => item.direction === direction) ?? []) {
      const word = unique.find((item) => masteryKey(item.chinese) === mistake.key)
      if (word && !used.has(masteryKey(word.chinese)) && result.length < 5) { result.push(word); used.add(masteryKey(word.chinese)) }
    }
    for (const word of weighted(unique, data)) if (!used.has(masteryKey(word.chinese)) && result.length < 5) { result.push(word); used.add(masteryKey(word.chinese)) }
    return result
  }
  const selected = [...choose('ja-zh'), ...choose('zh-ja')]
  if (selected.length < 10) return []
  return selected.map((word, index) => makeQuestion(word, index < 5 ? 'ja-zh' : 'zh-ja', unique)).filter((item): item is Question => !!item)
}
export function infiniteQuestion(data: AppData, used: Set<string>): Question | null {
  const unique = [...new Map(data.words.map((word) => [masteryKey(word.chinese), word])).values()]
  const available = unique.filter((word) => !used.has(masteryKey(word.chinese)))
  const source = available.length ? available : unique
  const word = weighted(source, data)[0]
  return word ? makeQuestion(word, Math.random() < .5 ? 'ja-zh' : 'zh-ja', unique) : null
}
export const answerFor = (question: Question, choice: Word): Answer => ({ wordId: question.word.id, key: masteryKey(question.word.chinese), direction: question.direction, correct: masteryKey(choice.chinese) === masteryKey(question.word.chinese) })
