import { useMemo, useState } from 'react'
import type { AppData, Phrase } from '../core/model.ts'
import { matchesSearch } from '../core/language.ts'
import { ChineseInput } from './ChineseInput.tsx'
import type { Save, Speak } from './appTypes.ts'

const split = (text: string) => text.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)
const newPhrase = (): Phrase => ({ id: crypto.randomUUID(), chinese: '', pinyin: '', pinyinSource: 'auto', japanese: '', genres: [], favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

export function PhraseList({ data, save, speak }: { data: AppData; save: Save; speak: Speak }) {
  const [query, setQuery] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [favorites, setFavorites] = useState(false)
  const allGenres = useMemo(() => [...new Set(data.phrases.flatMap((phrase) => phrase.genres))].sort(), [data.phrases])
  const toggle = (genre: string) => setGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre])
  const phrases = data.phrases.filter((phrase) => matchesSearch(query, [phrase.chinese, phrase.pinyin, phrase.japanese ?? '']) && (!genres.length || genres.some((genre) => genre === 'ジャンルなし' ? !phrase.genres.length : phrase.genres.includes(genre))) && (!favorites || phrase.favorite))
    .sort((a, b) => data.settings.phraseSort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : data.settings.phraseSort === 'favorite' ? Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt) : a.pinyin.localeCompare(b.pinyin))
  return <><div className="page-heading"><div><p className="eyebrow">PHRASES</p><h1>フレーズ帳</h1><p>{data.phrases.length}件を保存中</p></div><a className="primary-button" href="#phrase-new">＋ フレーズを追加</a></div><section className="card filters"><label htmlFor="phrase-search">中国語・日本語・ピンインで検索</label><input id="phrase-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}/><label htmlFor="phrase-sort">並び順</label><select id="phrase-sort" value={data.settings.phraseSort} onChange={(e) => void save((draft) => { draft.settings.phraseSort = e.target.value as AppData['settings']['phraseSort'] }, '並び順を保存しました。')}><option value="newest">新しい順</option><option value="favorite">お気に入り優先</option><option value="pinyin">ピンイン順</option></select><div className="chips"><button className="chip" aria-pressed={favorites} onClick={() => setFavorites(!favorites)}>★ お気に入りのみ</button>{[...allGenres, 'ジャンルなし'].map((genre) => <button className="chip" aria-pressed={genres.includes(genre)} key={genre} onClick={() => toggle(genre)}>{genre}</button>)}</div></section><p className="result-count">{phrases.length}件</p>{phrases.map((phrase) => <article className="card phrase-card" key={phrase.id}><div className="card-row"><div><h2 lang="zh-CN">{phrase.chinese}</h2><p className="pinyin">{phrase.pinyin}</p><p>{phrase.japanese || <a href={`#phrase-edit/${phrase.id}`}>日本語訳を追加</a>}</p></div><div className="vertical-actions"><button className="icon-button" onClick={() => void save((draft) => { const target = draft.phrases.find((item) => item.id === phrase.id); if (target) target.favorite = !target.favorite }, phrase.favorite ? 'お気に入りを解除しました。' : 'お気に入りに追加しました。')} aria-label="お気に入り">{phrase.favorite ? '★' : '☆'}</button><button className="icon-button" onClick={() => speak(phrase.chinese)}>🔊</button><a className="icon-link" href={`#phrase-edit/${phrase.id}`}>編集</a></div></div><div className="chips">{phrase.genres.map((genre) => <span className="tag" key={genre}>{genre}</span>)}</div></article>)}{!phrases.length && <section className="card empty"><h2>フレーズがありません</h2><p>単語の例文からコピーするか、新しく登録できます。</p></section>}</>
}

export function PhraseForm({ data, id, save }: { data: AppData; id?: string; save: Save }) {
  const original = id ? data.phrases.find((item) => item.id === id) : undefined
  const seed = useMemo(() => structuredClone(original ?? newPhrase()), [original])
  const [phrase, setPhrase] = useState<Phrase>(seed)
  const dirty = JSON.stringify(seed) !== JSON.stringify(phrase)
  const leave = () => { if (!dirty || confirm('未保存の変更を破棄して戻りますか？')) location.hash = '#phrases' }
  const submit = async () => {
    if (!phrase.chinese.trim() || !phrase.pinyin.trim()) { alert('中国語とピンインを入力してください。'); return }
    const duplicate = data.phrases.find((item) => item.id !== phrase.id && item.chinese.trim() === phrase.chinese.trim())
    if (duplicate && !confirm('同じ中国語のフレーズがあります。別のフレーズとして保存しますか？')) { location.hash = `#phrase-edit/${duplicate.id}`; return }
    const final = { ...phrase, chinese: phrase.chinese.trim(), genres: phrase.genres.filter(Boolean), updatedAt: new Date().toISOString() }
    await save((draft) => { const index = draft.phrases.findIndex((item) => item.id === final.id); if (index >= 0) draft.phrases[index] = final; else draft.phrases.push(final) }, original ? 'フレーズを更新しました。' : 'フレーズを登録しました。')
    location.hash = '#phrases'
  }
  return <><button className="back-link as-button" onClick={leave}>← フレーズ帳へ</button><section className="card form-card"><h1>{original ? 'フレーズを編集' : 'フレーズを追加'}</h1><ChineseInput value={phrase} onChange={(value) => setPhrase((current) => ({ ...current, ...value }))}/><label>日本語訳（任意）</label><input value={phrase.japanese ?? ''} onChange={(e) => setPhrase((current) => ({ ...current, japanese: e.target.value }))}/><label>ジャンル（複数は「、」区切り）</label><input value={phrase.genres.join('、')} onChange={(e) => setPhrase((current) => ({ ...current, genres: split(e.target.value) }))}/><label className="check-row"><input type="checkbox" checked={phrase.favorite} onChange={(e) => setPhrase((current) => ({ ...current, favorite: e.target.checked }))}/> お気に入り</label><div className="form-actions"><button className="primary-button" onClick={() => void submit()}>保存</button>{original && <button className="danger" onClick={() => { if (confirm('このフレーズを削除しますか？')) void save((draft) => { draft.phrases = draft.phrases.filter((item) => item.id !== phrase.id) }, 'フレーズを削除しました。').then(() => { location.hash = '#phrases' }) }}>削除</button>}<button onClick={leave}>戻る</button></div></section></>
}
