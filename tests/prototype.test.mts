import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialWords, INITIAL_DATASET_ID } from '../src/data/initialWords.ts'
import { emptyData, masteryKey } from '../src/core/model.ts'
import { installPrototypeWords } from '../src/core/operations.ts'
import { dailyQuestions, makeQuestion, quizAvailability } from '../src/core/quiz.ts'
import { makeBackup, parseBackup } from '../src/core/backup.ts'
import { assertData } from '../src/core/storage.ts'

test('初期教材は重複のない200語で全項目と例文を持つ', () => {
  assert.equal(initialWords.length, 200)
  assert.equal(new Set(initialWords.map((word) => word.id)).size, 200)
  assert.equal(new Set(initialWords.map((word) => word.chinese)).size, 200)
  for (const word of initialWords) {
    assert(word.chinese && word.pinyin && word.meanings.length && word.genres.length && word.partOfSpeech)
    assert(word.examples.length >= 1)
    assert(word.examples.every((example) => example.chinese && example.pinyin && example.japanese))
  }
})

test('初期教材は一度だけ入り、02の検証データだけを除く', () => {
  const data = emptyData()
  data.words.push({ ...structuredClone(initialWords[0]), id: 'verification', source: 'verification' })
  data.initialization.verificationAdded = true
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  installPrototypeWords(data, INITIAL_DATASET_ID, initialWords)
  assert.equal(data.words.length, 200)
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
  const restored = parseBackup(JSON.stringify(makeBackup(data)))
  assert.equal(restored.words.length, 200)
  assert.equal(restored.initialization.initialDatasetId, INITIAL_DATASET_ID)
  assert.throws(() => parseBackup('{"hello":"world"}'))
})
