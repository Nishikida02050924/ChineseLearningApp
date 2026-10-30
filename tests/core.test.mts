import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyData, masteryFor, masteryKey, overallMastery, localDate } from '../src/core/model.ts'
import { addVerificationWord, applyInfiniteAnswer, completeDaily, installInitialWords } from '../src/core/operations.ts'
import { assertData } from '../src/core/storage.ts'
import { chooseChineseVoice, matchesSearch, normalizeSearch } from '../src/core/language.ts'
import { generatePinyin, simplifiedSuggestion } from '../src/core/conversion.ts'
const prepared = () => {
  const data = emptyData()
  addVerificationWord(data)
  const source = data.words[0]
  data.words = Array.from({ length: 10 }, (_, i) => ({ ...structuredClone(source), id: `word-${i}`, chinese: `词${i}` }))
  return data
}
const record = { id: 'session', startDate: '2026-10-30', mode: 'morning' as const, completedAt: '2026-10-30T23:00:00+09:00' }
const answers = () => Array.from({ length: 10 }, (_, i) => ({ wordId: `word-${i}`, key: `词${i}`, direction: i < 5 ? 'ja-zh' as const : 'zh-ja' as const, correct: i !== 0 }))
test('検証データは1度だけ追加され正式導入フラグを変更しない', () => { const d = emptyData(); addVerificationWord(d); addVerificationWord(d); assert.equal(d.words.length, 1); assert.equal(d.initialization.initialDatasetId, null); assertData(d) })
test('カードのIDが異なっても同一表記は暗記度を共有', () => { const d = prepared(); d.words.push({ ...d.words[0], id: 'duplicate' }); applyInfiniteAnswer(d, 'train', 1, { wordId: 'duplicate', key: '词0', direction: 'ja-zh', correct: true }); assert.equal(masteryFor(d, d.words[0].chinese)['ja-zh'], 5); assert.equal(overallMastery(masteryFor(d, '词0')), 2.5) })
test('暗記度は0〜100、方向別、無限回答の再送は無加算', () => { const d = prepared(); const a = answers()[1]; for (let i = 1; i <= 23; i++) applyInfiniteAnswer(d, 'train', i, a); applyInfiniteAnswer(d, 'train', 23, a); assert.equal(masteryFor(d, a.key)['ja-zh'], 100); assert.equal(masteryFor(d, a.key)['zh-ja'], 0); applyInfiniteAnswer(d, 'other', 1, { ...a, correct: false }); assert.equal(masteryFor(d, a.key)['ja-zh'], 95); applyInfiniteAnswer(d, 'zero', 1, answers()[0]); assert.equal(masteryFor(d, '词0')['ja-zh'], 0); assert.equal(d.dailyRecords.length, 0) })
test('朝夜は一括適用し開始日と朝の誤答方向を保持、再送は無加算', () => { const d = prepared(); completeDaily(d, record, answers()); completeDaily(d, { ...record, id: 'other-session' }, answers()); assert.equal(d.dailyRecords.length, 1); assert.equal(d.dailyRecords[0].startDate, '2026-10-30'); assert.equal(d.dailyRecords[0].mistakes[0].direction, 'ja-zh'); assert.equal(masteryFor(d, '词1')['ja-zh'], 5); assertData(d) })
test('10語不足・同一表記の重複・方向不正を拒否', () => { const d = prepared(); assert.throws(() => completeDaily(d, record, answers().slice(0, 9))); assert.throws(() => completeDaily(d, record, answers().map((a) => ({ ...a, key: 'same' })))); assert.throws(() => completeDaily(d, record, answers().reverse())); assert.equal(d.masteries.length, 0) })
test('無限回答の飛び番号と別カードの表記を拒否', () => { const d = prepared(); assert.throws(() => applyInfiniteAnswer(d, 's', 2, answers()[1])); assert.throws(() => applyInfiniteAnswer(d, 's', 1, { ...answers()[1], key: 'wrong' })); assert.equal(d.masteries.length, 0) })
test('初期導入は冪等で既存語を保持、異なるデータセットを拒否', () => { const d = emptyData(); addVerificationWord(d); installInitialWords(d, 'initial-v1', prepared().words); installInitialWords(d, 'initial-v1', prepared().words); assert.equal(d.words.length, 11); assert.throws(() => installInitialWords(d, 'v2', [])) })
test('未知の形式・壊れたレコード・範囲外暗記度を拒否', () => { const d = prepared(); assert.throws(() => assertData({ ...d, schemaVersion: 2 })); assert.throws(() => assertData({ ...d, words: [{}] })); assert.throws(() => assertData({ ...d, masteries: [{ key: 'x', 'ja-zh': 101, 'zh-ja': 0 }] })); assert.throws(() => assertData({ ...d, settings: { speechRate: 3 } })) })
test('ピンイン検索は声調と空白を無視、üとuは区別', () => { assert(matchesSearch('ni hao', ['nǐ hǎo'])); assert(matchesSearch('nǐhǎo', ['ni hao'])); assert.equal(normalizeSearch('lǜ'), 'lv'); assert(matchesSearch('lu:', ['lǜ'])); assert(!matchesSearch('lu', ['lǜ'])); assert(matchesSearch('こんにちは', ['こんにちは'])) })
test('簡体字候補と多音字の生成を検証', () => { assert.equal(simplifiedSuggestion('學校'), '学校'); assert.equal(simplifiedSuggestion('学校'), null); assert.equal(generatePinyin('你好'), 'nǐ hǎo'); assert.equal(generatePinyin('银行'), 'yín háng'); assert.equal(generatePinyin('音乐'), 'yīn yuè'); assert.equal(generatePinyin('音樂'), 'yīn yuè'); assert.equal(generatePinyin('重庆'), 'chóng qìng') })
test('表記キーは字体を自動変更せず、ローカル日付を使う', () => { assert.notEqual(masteryKey('學'), masteryKey('学')); assert.equal(masteryKey(' 你好 '), '你好'); const date = new Date(2026, 9, 30, 0, 5); assert.equal(localDate(date), '2026-10-30') })
test('読み上げは日本語音声へ代替せず中国本土の音声を優先する', () => {
  const voices = [
    { name: 'Japanese', lang: 'ja-JP', localService: true, default: true },
    { name: 'Taiwan', lang: 'zh-TW', localService: true, default: false },
    { name: 'Mainland online', lang: 'zh-CN', localService: false, default: false },
    { name: 'Mainland local', lang: 'zh-CN', localService: true, default: false },
  ]
  assert.equal(chooseChineseVoice(voices)?.name, 'Mainland local')
  assert.equal(chooseChineseVoice(voices.slice(0, 1)), undefined)
})

test('アカウントの名前・ピンイン・端末内画像を保存し、外部画像URLを拒否する', () => {
  const data = emptyData()
  data.settings.profileName = '理央'
  data.settings.profilePinyin = 'Lǐ Yāng'
  data.settings.profileIcon = 'data:image/jpeg;base64,AA=='
  assertData(data)
  data.settings.profileIcon = 'https://example.com/profile.jpg'
  assert.throws(() => assertData(data))
})
