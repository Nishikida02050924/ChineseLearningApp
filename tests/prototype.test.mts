import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialWords, INITIAL_DATASET_ID } from '../src/data/initialWords.ts'
import { initialPhrases, INITIAL_PHRASE_DATASET_ID } from '../src/data/initialPhrases.ts'
import { emptyData, masteryKey } from '../src/core/model.ts'
import { installPrototypeWords, installStarterPhrases } from '../src/core/operations.ts'
import { dailyQuestions, makeQuestion, quizAvailability } from '../src/core/quiz.ts'
import { makeBackup, parseBackup } from '../src/core/backup.ts'
import { assertData } from '../src/core/storage.ts'

test('初期教材は重複のない250語で基本動詞・時間表現・例文を持つ', () => {
  assert.equal(initialWords.length, 250)
  assert.equal(new Set(initialWords.map((word) => word.id)).size, 250)
  assert.equal(new Set(initialWords.map((word) => word.chinese)).size, 250)
  for (const required of ['我', '聊天', '为什么', '是', '有', '要', '会', '能', '做', '给', '找', '等', '回', '买', '用', '喝', '现在', '刚才', '前天', '后天', '今年', '去年', '下周', '上午', '中午', '点']) {
    assert.ok(initialWords.some((word) => word.chinese === required), `会話用の必須語がありません: ${required}`)
  }
  for (const word of initialWords) {
    assert(word.chinese && word.pinyin && word.meanings.length && word.genres.length && word.partOfSpeech)
    assert(word.examples.length >= 1)
    assert(word.examples.every((example) => example.chinese && example.pinyin && example.japanese))
  }
  const negativeExamples = initialWords.flatMap((word) => word.examples.filter((example) => example.usage === 'negative'))
  assert.ok(negativeExamples.length >= 20)
  assert.ok(initialWords.find((word) => word.chinese === '是')?.examples.some((example) => example.chinese === '我不是老师。'))
  assert.ok(initialWords.find((word) => word.chinese === '吃饭')?.examples.some((example) => example.chinese === '我还没吃饭。'))
})

test('旧200語を友達との会話・自己紹介版へ安全に更新し、ユーザー語を保持する', () => {
  const data = emptyData()
  data.initialization.initialDatasetId = 'starter-200-v1'
  data.words.push({ ...structuredClone(initialWords[0]), id: 'user-word', chinese: '用户词', source: 'user' })
  data.words.push({ ...structuredClone(initialWords[1]), id: 'old-initial', source: 'initial' })
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  assert.equal(data.initialization.initialDatasetId, INITIAL_DATASET_ID)
  assert.ok(data.words.some((word) => word.id === 'user-word'))
  assert.equal(data.words.filter((word) => word.source === 'initial').length, 250)
})

test('会話版200語から250語版へ更新し、編集・ユーザー語・暗記度を保持して否定例を追加する', () => {
  const data = emptyData()
  data.initialization.initialDatasetId = 'starter-200-v2-friends'
  const oldWords = structuredClone(initialWords.slice(0, 200)).map((word) => ({ ...word, examples: word.examples.filter((example) => example.usage !== 'negative').map((example) => ({ ...example, usage: undefined })) }))
  data.words.push(...oldWords)
  data.words[0].meanings = ['編集した意味']
  const editedWord = data.words.find((word) => word.chinese === '知道')
  assert(editedWord)
  editedWord.chinese = '編集した中国語'
  data.words.push({ ...structuredClone(initialWords[0]), id: 'user-word-v2', chinese: '用户词', source: 'user' })
  data.masteries.push({ key: '吃饭', 'ja-zh': 40, 'zh-ja': 35 })
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  assert.equal(data.words.filter((word) => word.source === 'initial').length, 250)
  assert.equal(data.words[0].meanings[0], '編集した意味')
  assert.equal(editedWord.chinese, '編集した中国語')
  assert.equal(editedWord.examples.some((example) => example.usage === 'negative'), false)
  assert.ok(data.words.some((word) => word.id === 'user-word-v2'))
  assert.deepEqual(data.masteries[0], { key: '吃饭', 'ja-zh': 40, 'zh-ja': 35 })
  assert.ok(data.words.find((word) => word.chinese === '吃饭')?.examples.some((example) => example.usage === 'negative'))
  assertData(data)
})

test('自己紹介と基本文法のフレーズテンプレートを一度だけ追加する', () => {
  assert.equal(initialPhrases.length, 31)
  assert.ok(initialPhrases.some((phrase) => phrase.chinese === '我叫A。'))
  assert.ok(initialPhrases.some((phrase) => phrase.chinese === '因为A，所以B。'))
  assert.ok(initialPhrases.some((phrase) => phrase.chinese === '好久不见！' && phrase.genres.includes('挨拶')))
  assert.ok(initialPhrases.some((phrase) => phrase.chinese === '我吃饭。'))
  assert.ok(initialPhrases.every((phrase) => phrase.examples?.length === 2))
  const data = emptyData()
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  assert.equal(data.phrases.length, 31)
  assert.equal(data.initialization.phraseDatasetId, INITIAL_PHRASE_DATASET_ID)
  assertData(data)
})

test('旧フレーズ教材へ具体例を追加し、編集した本文は保持する', () => {
  const data = emptyData()
  data.initialization.phraseDatasetId = 'starter-phrases-v1-introduction'
  data.phrases.push({ ...structuredClone(initialPhrases[0]), chinese: '編集済みの本文', examples: undefined })
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  assert.equal(data.phrases[0].chinese, '編集済みの本文')
  assert.equal(data.phrases[0].examples?.length, 2)
  assert.equal(data.initialization.phraseDatasetId, INITIAL_PHRASE_DATASET_ID)
})

test('例文版から挨拶版へ更新し、既存の編集とお気に入りを保持する', () => {
  const data = emptyData()
  data.initialization.phraseDatasetId = 'starter-phrases-v2-examples'
  data.phrases.push(...structuredClone(initialPhrases.slice(0, 20)))
  data.phrases[0].chinese = '編集した本文'
  data.phrases[0].japanese = '編集した訳'
  data.phrases[0].favorite = true
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  assert.equal(data.phrases.length, 31)
  assert.equal(data.phrases[0].chinese, '編集した本文')
  assert.equal(data.phrases[0].japanese, '編集した訳')
  assert.equal(data.phrases[0].favorite, true)
  assert.ok(data.phrases.some((phrase) => phrase.chinese === '晚安！'))
  assert.equal(data.initialization.phraseDatasetId, INITIAL_PHRASE_DATASET_ID)
})

test('挨拶版から基本動詞版へ更新し、我吃饭を一度だけ追加する', () => {
  const data = emptyData()
  data.initialization.phraseDatasetId = 'starter-phrases-v3-greetings'
  data.phrases.push(...structuredClone(initialPhrases.slice(0, 30)))
  data.phrases[0].favorite = true
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  installStarterPhrases(data, INITIAL_PHRASE_DATASET_ID, initialPhrases)
  assert.equal(data.phrases.length, 31)
  assert.equal(data.phrases.filter((phrase) => phrase.chinese === '我吃饭。').length, 1)
  assert.equal(data.phrases[0].favorite, true)
  assertData(data)
})

test('初期教材は一度だけ入り、02の検証データだけを除く', () => {
  const data = emptyData()
  data.words.push({ ...structuredClone(initialWords[0]), id: 'verification', source: 'verification' })
  data.initialization.verificationAdded = true
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  assert.equal(data.words.length, 250)
  assert.equal(data.initialization.initialDatasetId, INITIAL_DATASET_ID)
  assertData(data)
})

test('4択は正解1件、同一表記と同一訳を誤答へ入れない', () => {
  const question = makeQuestion(initialWords[0], 'ja-zh', initialWords)
  assert(question)
  assert.equal(question.choices.length, 4)
  assert.equal(question.choices.filter((word) => masteryKey(word.chinese) === masteryKey(question.word.chinese)).length, 1)
  assert.equal(new Set(question.choices.map((word) => word.chinese)).size, 4)
})

test('朝夜は重複しない10語、前後5方向で成立する', () => {
  const data = emptyData(); installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  const morning = dailyQuestions(data, 'morning', '2026-10-30')
  assert.equal(morning.length, 10)
  assert.equal(new Set(morning.map((question) => question.word.chinese)).size, 10)
  assert(morning.slice(0, 5).every((question) => question.direction === 'ja-zh'))
  assert(morning.slice(5).every((question) => question.direction === 'zh-ja'))
})

test('開始可能時間の境界が仕様どおり', () => {
  const at = (hour: number, minute: number) => quizAvailability(new Date(2026, 9, 30, hour, minute))
  assert.equal(at(11, 59).morning, true); assert.equal(at(12, 0).morning, false)
  assert.equal(at(14, 59).night, false); assert.equal(at(15, 0).night, true)
  assert.equal(at(23, 59).night, true); assert.equal(at(0, 0).morning, true)
})

test('バックアップは往復し、不正形式を拒否する', () => {
  const data = emptyData(); installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  data.settings.profileName = '理央'; data.settings.profilePinyin = 'Lǐ Yāng'; data.settings.profileIcon = 'data:image/jpeg;base64,AA=='
  const restored = parseBackup(JSON.stringify(makeBackup(data)))
  assert.equal(restored.words.length, 250)
  assert.equal(restored.initialization.initialDatasetId, INITIAL_DATASET_ID)
  assert.equal(restored.settings.profileName, '理央')
  assert.equal(restored.settings.profilePinyin, 'Lǐ Yāng')
  assert.equal(restored.settings.profileIcon, 'data:image/jpeg;base64,AA==')
  assert.throws(() => parseBackup('{"hello":"world"}'))
})
