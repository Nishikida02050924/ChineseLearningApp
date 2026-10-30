export type Direction = 'ja-zh' | 'zh-ja'
export type SortOrder = 'newest' | 'pinyin' | 'mastery'
export interface ChineseText {
  chinese: string
  pinyin: string
  pinyinSource: 'auto' | 'manual'
}
export interface Example extends ChineseText { id: string; japanese?: string }
export interface Word extends ChineseText {
  id: string
  meanings: string[]
  genres: string[]
  partOfSpeech?: string
  examples: Example[]
  createdAt: string
  updatedAt: string
  source: 'user' | 'initial' | 'verification'
}
export interface Phrase extends ChineseText {
  id: string
  japanese?: string
  genres: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
}
export interface Mastery { key: string; 'ja-zh': number; 'zh-ja': number }
export interface Answer { wordId: string; key: string; direction: Direction; correct: boolean }
export interface DailyRecord {
  id: string
  startDate: string
  mode: 'morning' | 'night'
  completedAt: string
  mistakes: Answer[]
}
export interface AppData {
  schemaVersion: 1
  revision: number
  words: Word[]
  phrases: Phrase[]
  masteries: Mastery[]
  dailyRecords: DailyRecord[]
  answerCheckpoints: { sessionId: string; sequence: number }[]
  settings: { wordSort: SortOrder; phraseSort: 'newest' | 'favorite' | 'pinyin'; speechRate: 1 | 0.75 }
  initialization: { initialDatasetId: string | null; phraseDatasetId?: string | null; verificationAdded: boolean }
}
export function emptyData(): AppData {
  return {
    schemaVersion: 1, revision: 0, words: [], phrases: [], masteries: [], dailyRecords: [], answerCheckpoints: [],
    settings: { wordSort: 'newest', phraseSort: 'newest', speechRate: 1 },
    initialization: { initialDatasetId: null, phraseDatasetId: null, verificationAdded: false },
  }
}
// Chinese spelling is kept exact except for surrounding whitespace and canonical Unicode.
export const masteryKey = (chinese: string) => chinese.trim().normalize('NFC')
export function masteryFor(data: AppData, chinese: string): Mastery {
  const key = masteryKey(chinese)
  return data.masteries.find((item) => item.key === key) ?? { key, 'ja-zh': 0, 'zh-ja': 0 }
}
export const overallMastery = (value: Mastery) => (value['ja-zh'] + value['zh-ja']) / 2
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
