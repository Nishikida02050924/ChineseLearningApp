import { transact } from '../src/core/storage.ts'
import { addVerificationWord, applyInfiniteAnswer, completeDaily } from '../src/core/operations.ts'
import { masteryFor } from '../src/core/model.ts'
const database = `ChineseLearningApp-verification-${crypto.randomUUID()}`
const output = document.querySelector('#results')!
const lines: string[] = []
const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); lines.push(`PASS ${message}`); output.textContent = lines.join('\n') }
try {
  await transact(addVerificationWord, database)
  const first = await transact(undefined, database)
  check(first.words.length === 1, '検証語を再読み込みで取得')
  await Promise.all(Array.from({ length: 6 }, () => transact(addVerificationWord, database)))
  check((await transact(undefined, database)).words.length === 1, '同時初期化でも重複なし')
  await transact((d) => { d.settings.speechRate = 0.75 }, database)
  check((await transact(undefined, database)).settings.speechRate === 0.75, '設定の永続保存')
  const word = first.words[0]
  const answer = { wordId: word.id, key: word.chinese, direction: 'ja-zh' as const, correct: true }
  await Promise.all(Array.from({ length: 5 }, () => transact((d) => applyInfiniteAnswer(d, 'train', 1, answer), database)))
  check(masteryFor(await transact(undefined, database), word.chinese)['ja-zh'] === 5, '同時再送でも暗記度は1回だけ加算')
  await transact((d) => { d.words = Array.from({ length: 10 }, (_, i) => ({ ...word, id: `w${i}`, chinese: `词${i}` })) }, database)
  const answers = Array.from({ length: 10 }, (_, i) => ({ wordId: `w${i}`, key: `词${i}`, direction: i < 5 ? 'ja-zh' as const : 'zh-ja' as const, correct: true }))
  const record = { id: 'morning', startDate: '2026-10-30', mode: 'morning' as const, completedAt: new Date().toISOString() }
  let rejected = false
  try { await transact((d) => completeDaily(d, record, answers.map((a, i) => i === 9 ? { ...a, wordId: 'missing' } : a)), database) } catch { rejected = true }
  const rollback = await transact(undefined, database)
  check(rejected && rollback.dailyRecords.length === 0 && masteryFor(rollback, '词0')['ja-zh'] === 0, '途中失敗は暗記度と完了記録の両方をロールバック')
  await Promise.all(Array.from({ length: 5 }, () => transact((d) => completeDaily(d, record, answers), database)))
  const completed = await transact(undefined, database)
  check(completed.dailyRecords.length === 1 && masteryFor(completed, '词0')['ja-zh'] === 5, '朝夜の同時完了でもスタンプ・暗記度は1回だけ保存')
  const before = JSON.stringify(completed)
  try { await transact((d) => { d.settings.speechRate = 0.75; throw new DOMException('capacity', 'QuotaExceededError') }, database) } catch { /* expected injected failure */ }
  check(JSON.stringify(await transact(undefined, database)) === before, '保存中の例外で既存データを保持')
  lines.push('全7項目に成功'); output.textContent = lines.join('\n')
} catch (error) { output.textContent = `${lines.join('\n')}\nFAIL ${String(error)}` }
