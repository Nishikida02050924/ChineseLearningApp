import { generatePinyin } from '../core/conversion.ts'
import type { Phrase } from '../core/model.ts'

type PhraseRow = [string, string, string[]]

const rows: PhraseRow[] = [
  ['我叫A。', '私はAといいます。（A＝名前）', ['自己紹介', '文法テンプレート']],
  ['我来自A。', '私はA出身です。（A＝出身地）', ['自己紹介', '文法テンプレート']],
  ['我住在A。', '私はAに住んでいます。（A＝場所）', ['自己紹介', '文法テンプレート']],
  ['我今年A岁。', '私は今年A歳です。（A＝年齢）', ['自己紹介', '文法テンプレート']],
  ['我是A年级的学生。', '私はA年生です。（A＝学年）', ['自己紹介', '文法テンプレート']],
  ['我的专业是A。', '私の専攻はAです。', ['自己紹介', '文法テンプレート']],
  ['我的兴趣是A。', '私の趣味はAです。', ['自己紹介', '文法テンプレート']],
  ['我喜欢A。', '私はAが好きです。', ['自己紹介', '文法テンプレート']],
  ['我正在学习A。', '私はAを勉強しています。', ['自己紹介', '文法テンプレート']],
  ['很高兴认识你。', '知り合えてうれしいです。', ['自己紹介', '友達との会話']],
  ['你叫什么名字？', 'あなたの名前は何ですか。', ['友達との会話', '質問']],
  ['你来自哪里？', 'どこの出身ですか。', ['友達との会話', '質問']],
  ['你住在哪里？', 'どこに住んでいますか。', ['友達との会話', '質問']],
  ['你喜欢什么？', '何が好きですか。', ['友達との会話', '質問']],
  ['你最近怎么样？', '最近どうですか。', ['友達との会話', '質問']],
  ['你有时间吗？', '時間はありますか。', ['友達との会話', '質問']],
  ['周末一起去A吧。', '週末に一緒にAへ行こう。', ['友達との会話', '文法テンプレート']],
  ['我觉得A很有趣。', '私はAが面白いと思います。', ['友達との会話', '文法テンプレート']],
  ['因为A，所以B。', 'Aなので、Bです。', ['基本文法', '文法テンプレート']],
  ['虽然A，但是B。', 'Aですが、Bです。', ['基本文法', '文法テンプレート']],
]

const createdAt = '2026-10-30T00:00:00.000Z'
export const INITIAL_PHRASE_DATASET_ID = 'starter-phrases-v1-introduction'
export const initialPhrases: Phrase[] = rows.map(([chinese, japanese, genres], index) => ({
  id: `initial-phrase-${String(index + 1).padStart(3, '0')}`,
  chinese,
  pinyin: generatePinyin(chinese),
  pinyinSource: 'auto',
  japanese,
  genres,
  favorite: false,
  createdAt,
  updatedAt: createdAt,
}))
