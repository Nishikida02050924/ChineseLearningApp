import { emptyData } from './model.ts'
import type { AppData } from './model.ts'

export const DATABASE_NAME = 'ChineseLearningApp'
export const STORE_NAME = 'snapshots'
export const ROOT_KEY = 'app-v1'

// Unknown or corrupt stored data must never be replaced with an empty database.
export function assertData(value: unknown): asserts value is AppData {
  const data = value as AppData
  if (!data || data.schemaVersion !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0 ||
      !Array.isArray(data.words) || !Array.isArray(data.phrases) || !Array.isArray(data.masteries) ||
      !Array.isArray(data.dailyRecords) || !Array.isArray(data.answerCheckpoints) ||
      !data.settings || ![1, 0.75].includes(data.settings.speechRate) ||
      !(data.settings.profileName === undefined || typeof data.settings.profileName === 'string') ||
      !['newest', 'pinyin', 'mastery'].includes(data.settings.wordSort) ||
      !['newest', 'favorite', 'pinyin'].includes(data.settings.phraseSort) ||
      !data.initialization || typeof data.initialization.verificationAdded !== 'boolean' ||
      !(data.initialization.initialDatasetId === null || typeof data.initialization.initialDatasetId === 'string') ||
      !(data.initialization.phraseDatasetId === undefined || data.initialization.phraseDatasetId === null || typeof data.initialization.phraseDatasetId === 'string')) {
    throw new Error('保存データの形式を確認できません。既存データは保持しています。')
  }
  const text = (item: { chinese: string; pinyin: string; pinyinSource: string }) => item &&
    typeof item.chinese === 'string' && !!item.chinese.trim() && typeof item.pinyin === 'string' && ['auto', 'manual'].includes(item.pinyinSource)
  const strings = (items: unknown) => Array.isArray(items) && items.every((item) => typeof item === 'string' && !!item.trim())
  const stamp = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s))
  const id = (s: unknown) => typeof s === 'string' && !!s
  const unique = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length
  if (data.words.some((word) => !text(word) || !id(word.id) || !strings(word.meanings) || !word.meanings.length ||
    !strings(word.genres) || !Array.isArray(word.examples) || word.examples.some((e) => !text(e) || !id(e.id) || (e.japanese !== undefined && typeof e.japanese !== 'string')) ||
    !unique(word.examples) || !stamp(word.createdAt) || !stamp(word.updatedAt) || (word.partOfSpeech !== undefined && typeof word.partOfSpeech !== 'string') || !['user', 'initial', 'verification'].includes(word.source)) ||
    !unique(data.words) || !unique(data.phrases) ||
    data.phrases.some((p) => !text(p) || !id(p.id) || !strings(p.genres) || typeof p.favorite !== 'boolean' || !stamp(p.createdAt) || !stamp(p.updatedAt) || (p.japanese !== undefined && typeof p.japanese !== 'string') ||
      (p.examples !== undefined && (!Array.isArray(p.examples) || p.examples.some((e) => !text(e) || !id(e.id) || (e.japanese !== undefined && typeof e.japanese !== 'string')) || !unique(p.examples)))) ||
    data.masteries.some((m) => !m || !id(m.key) || ![m['ja-zh'], m['zh-ja']].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) ||
    new Set(data.masteries.map((m) => m.key)).size !== data.masteries.length ||
    data.answerCheckpoints.some((c) => !c || !id(c.sessionId) || !Number.isSafeInteger(c.sequence) || c.sequence < 1) ||
    new Set(data.answerCheckpoints.map((c) => c.sessionId)).size !== data.answerCheckpoints.length ||
    data.dailyRecords.some((r) => !r || !id(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(r.startDate) || !['morning', 'night'].includes(r.mode) || !stamp(r.completedAt) || !Array.isArray(r.mistakes) || r.mistakes.some((a) => !a || !id(a.wordId) || !id(a.key) || !['ja-zh', 'zh-ja'].includes(a.direction) || a.correct !== false)) ||
    new Set(data.dailyRecords.map((r) => `${r.startDate}:${r.mode}`)).size !== data.dailyRecords.length) {
    throw new Error('保存データの内容を確認できません。既存データは保持しています。')
  }
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('この環境では端末内保存が使えません。')); return }
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('別の画面を閉じて、保存を再試行してください。'))
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
  })
}

/** A single read/write transaction serializes other tabs and atomically commits all changes. */
export async function transact(change?: (draft: AppData) => void, databaseName = DATABASE_NAME): Promise<AppData> {
  const db = await openDatabase(databaseName)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, change ? 'readwrite' : 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(ROOT_KEY)
    let next: AppData
    let failure: unknown
    request.onsuccess = () => {
      try {
        next = request.result === undefined ? emptyData() : request.result
        assertData(next)
        if (change) { change(next); next.revision += 1; assertData(next); store.put(next, ROOT_KEY) }
      } catch (error) { failure = error; transaction.abort() }
    }
    transaction.oncomplete = () => { db.close(); resolve(next) }
    transaction.onabort = () => { db.close(); reject(failure ?? transaction.error ?? new Error('保存が中断されました。')) }
    transaction.onerror = () => { /* onabort handles request failures too. */ }
  })
}
export const loadData = () => transact()
export function storageMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return '端末の保存容量が不足しています。保存できませんでした。'
  return error instanceof Error ? `保存を確認できませんでした：${error.message}` : '端末内保存が使えません。再試行してください。'
}
