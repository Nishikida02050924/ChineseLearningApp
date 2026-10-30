import { useEffect, useMemo, useState } from 'react'
import type { AppData, Example, Word } from '../core/model.ts'
import { masteryFor, overallMastery } from '../core/model.ts'
import { matchesSearch } from '../core/language.ts'
import { ChineseInput } from './ChineseInput.tsx'
import type { Save, Speak } from './appTypes.ts'

const split = (text: string) => text.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
const emptyWord = (): Word => ({ id: crypto.randomUUID(), chinese: '', pinyin: '', pinyinSource: 'auto', meanings: [''], genres: [], partOfSpeech: '', examples: [], source: 'user', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
const emptyExample = (): Example => ({ id: crypto.randomUUID(), chinese: '', pinyin: '', pinyinSource: 'auto', japanese: '' })

export function WordList({ data, save, speak }: { data: AppData; save: Save; speak: Speak }) {
  const [query, setQuery] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const genres = useMemo(() => [...new Set(data.words.flatMap((word) => word.genres))].sort((a, b) => a.localeCompare(b, 'ja')), [data.words])
  const words = data.words.filter((word) => matchesSearch(query, [word.chinese, word.pinyin, ...word.meanings]) && (!selectedGenres.length || selectedGenres.some((genre) => genre === 'ジャンルなし' ? !word.genres.length : word.genres.includes(genre))))
    .sort((a, b) => data.settings.wordSort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : data.settings.wordSort === 'pinyin' ? a.pinyin.localeCompare(b.pinyin) : overallMastery(masteryFor(data, a.chinese)) - overallMastery(masteryFor(data, b.chinese)))
  const toggle = (genre: string) => setSelectedGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre])
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORDS</p><h1>単語帳</h1><p>{data.words.length}語を保存中</p></div><a className="primary-button" href="#word-new">＋ 単語を追加</a></div>
    <section className="card filters"><label htmlFor="word-search">中国語・日本語・ピンインで検索</label><input id="word-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：你好 / ni hao" />
      <label htmlFor="word-sort">並び順</label><select id="word-sort" value={data.settings.wordSort} onChange={(e) => void save((draft) => { draft.settings.wordSort = e.target.value as AppData['settings']['wordSort'] }, '並び順を保存しました。')}><option value="newest">登録が新しい順</option><option value="pinyin">ピンイン順</option><option value="mastery">暗記度が低い順</option></select>
      <div className="chips">{[...genres, 'ジャンルなし'].map((genre) => <button type="button" className="chip" aria-pressed={selectedGenres.includes(genre)} key={genre} onClick={() => toggle(genre)}>{genre}</button>)}</div>
    </section>
    <p className="result-count">{words.length}件</p>
    {words.map((word) => { const mastery = masteryFor(data, word.chinese); return <article className="card word-card" key={word.id}><div className="card-row"><button className="text-card-button" onClick={() => { location.hash = `word/${word.id}` }}><h2 lang="zh-CN">{word.chinese}</h2><p className="pinyin">{word.pinyin}</p>{word.meanings.map((meaning) => <p key={meaning}>{meaning}</p>)}</button><button className="icon-button" aria-label={`${word.chinese}を読み上げる`} onClick={() => speak(word.chinese)}>🔊</button></div><div className="chips">{word.genres.map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div><div className="mastery"><span>日→中 {mastery['ja-zh']}%</span><span>中→日 {mastery['zh-ja']}%</span><strong>総合 {overallMastery(mastery)}%</strong></div></article> })}
    {!words.length && <section className="card empty"><h2>該当する単語がありません</h2><p>検索語やジャンルを変えてください。</p></section>}
  </>
}

export function WordDetail({ data, id, save, speak }: { data: AppData; id: string; save: Save; speak: Speak }) {
  const word = data.words.find((item) => item.id === id)
  if (!word) return <section className="card"><h1>単語が見つかりません</h1><a href="#words">単語帳へ戻る</a></section>
  const mastery = masteryFor(data, word.chinese)
  const copy = async (example: Example) => {
    const duplicate = data.phrases.find((phrase) => phrase.chinese.trim() === example.chinese.trim())
    // oxlint-disable-next-line react/immutability
    if (duplicate && !confirm('同じ中国語のフレーズがあります。別のフレーズとして登録しますか？')) { location.hash = '#phrases'; return }
    // oxlint-disable-next-line react/purity
    const now = new Date().toISOString()
    await save((draft) => draft.phrases.push({ id: crypto.randomUUID(), chinese: example.chinese, pinyin: example.pinyin, pinyinSource: example.pinyinSource, japanese: example.japanese, genres: [...word.genres], favorite: false, createdAt: now, updatedAt: now }), '例文をフレーズ帳にコピーしました。')
  }
  return <><a className="back-link" href="#words">← 単語帳へ</a><article className="card detail-card"><div className="card-row"><div><h1 lang="zh-CN">{word.chinese}</h1><p className="pinyin">{word.pinyin}</p></div><button className="icon-button" onClick={() => speak(word.chinese)}>🔊</button></div>{word.meanings.map((meaning) => <p className="meaning" key={meaning}>{meaning}</p>)}<div className="chips">{word.genres.map((genre) => <span className="tag" key={genre}>{genre}</span>)}{word.partOfSpeech && <span className="tag neutral">{word.partOfSpeech}</span>}</div><div className="mastery large"><span>日→中 {mastery['ja-zh']}%</span><span>中→日 {mastery['zh-ja']}%</span><strong>総合 {overallMastery(mastery)}%</strong></div><div className="actions"><a className="primary-button" href={`#word-edit/${word.id}`}>編集</a><button className="danger" onClick={() => { if (confirm(`「${word.chinese}」を削除しますか？暗記度は安全のため保持します。`)) void save((draft) => { draft.words = draft.words.filter((item) => item.id !== word.id) }, '単語を削除しました。').then(() => { location.hash = '#words' }) }}>削除</button></div></article>
    <h2>例文</h2>{word.examples.map((example) => <article className="card example-card" key={example.id}><div className="card-row"><div><h3 lang="zh-CN">{example.chinese}</h3><p className="pinyin">{example.pinyin}</p><p>{example.japanese || '日本語訳なし'}</p></div><button className="icon-button" onClick={() => speak(example.chinese)}>🔊</button></div><button onClick={() => void copy(example)}>フレーズ帳へコピー</button></article>)}{!word.examples.length && <p className="muted">例文はまだありません。</p>}</>
}

export function WordForm({ data, id, save }: { data: AppData; id?: string; save: Save }) {
  const original = id ? data.words.find((item) => item.id === id) : undefined
  const seed = useMemo(() => structuredClone(original ?? emptyWord()), [original])
  const [word, setWord] = useState<Word>(seed)
  const baseline = JSON.stringify(seed)
  const dirty = JSON.stringify(word) !== baseline
  useEffect(() => { const stop = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; addEventListener('beforeunload', stop); return () => removeEventListener('beforeunload', stop) }, [dirty])
  const leave = () => { if (!dirty || confirm('未保存の変更を破棄して戻りますか？')) location.hash = original ? `#word/${original.id}` : '#words' }
  const updateExample = (index: number, example: Example) => setWord((current) => ({ ...current, examples: current.examples.map((item, i) => i === index ? example : item) }))
  const move = (index: number, offset: number) => setWord((current) => { const examples = [...current.examples]; const target = index + offset; if (target < 0 || target >= examples.length) return current; [examples[index], examples[target]] = [examples[target], examples[index]]; return { ...current, examples } })
  const submit = async () => {
    const meanings = word.meanings.map((item) => item.trim()).filter(Boolean)
    if (!word.chinese.trim() || !meanings.length) { alert('中国語と日本語訳を入力してください。'); return }
    if (!word.pinyin.trim()) { alert('ピンインを入力または自動生成してください。'); return }
    if (word.examples.some((example) => !example.chinese.trim() || !example.pinyin.trim())) { alert('例文の中国語とピンインを確認してください。'); return }
    const duplicate = data.words.find((item) => item.id !== word.id && item.chinese.trim() === word.chinese.trim())
    if (duplicate && !confirm(`同じ表記「${word.chinese}」があります。別カードとして保存しますか？暗記度は共有されます。`)) { location.hash = `#word/${duplicate.id}`; return }
    const finalWord = { ...word, chinese: word.chinese.trim(), meanings, genres: word.genres.map((item) => item.trim()).filter(Boolean), updatedAt: new Date().toISOString() }
    await save((draft) => { const index = draft.words.findIndex((item) => item.id === finalWord.id); if (index >= 0) draft.words[index] = finalWord; else draft.words.push(finalWord) }, original ? '単語を更新しました。' : '単語を登録しました。')
    location.hash = `#word/${finalWord.id}`
  }
  return <><button className="back-link as-button" onClick={leave}>← {original ? '詳細へ' : '単語帳へ'}</button><section className="card form-card"><h1>{original ? '単語を編集' : '単語を追加'}</h1><ChineseInput value={word} onChange={(value) => setWord((current) => ({ ...current, ...value }))}/><label>日本語訳（複数は「、」区切り）</label><textarea value={word.meanings.join('、')} onChange={(e) => setWord((current) => ({ ...current, meanings: split(e.target.value) }))}/><label>ジャンル（複数は「、」区切り）</label><input value={word.genres.join('、')} onChange={(e) => setWord((current) => ({ ...current, genres: split(e.target.value) }))}/><label>品詞（任意）</label><input value={word.partOfSpeech ?? ''} onChange={(e) => setWord((current) => ({ ...current, partOfSpeech: e.target.value }))}/><h2>例文</h2>{word.examples.map((example, index) => <div className="nested-card" key={example.id}><ChineseInput value={example} onChange={(value) => updateExample(index, { ...example, ...value })}/><label>日本語訳（任意）</label><input value={example.japanese ?? ''} onChange={(e) => updateExample(index, { ...example, japanese: e.target.value })}/><div className="actions"><button onClick={() => move(index, -1)} disabled={index === 0}>↑ 上へ</button><button onClick={() => move(index, 1)} disabled={index === word.examples.length - 1}>↓ 下へ</button><button className="danger" onClick={() => setWord((current) => ({ ...current, examples: current.examples.filter((item) => item.id !== example.id) }))}>削除</button></div></div>)}<button onClick={() => setWord((current) => ({ ...current, examples: [...current.examples, emptyExample()] }))}>＋ 例文を追加</button><div className="form-actions"><button className="primary-button" onClick={() => void submit()}>保存</button><button onClick={leave}>戻る</button></div></section></>
}
