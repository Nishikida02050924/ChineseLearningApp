import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { matchesSearch, speakChinese } from './core/language.ts'
import { masteryFor, overallMastery } from './core/model.ts'
import type { AppData, ChineseText } from './core/model.ts'
import { addVerificationWord } from './core/operations.ts'
import { loadData, storageMessage, transact } from './core/storage.ts'
import './App.css'

const ChineseInput = lazy(() => import('./components/ChineseInput.tsx').then((module) => ({ default: module.ChineseInput })))

const pages = [{ id: 'home', label: 'ホーム', mark: '⌂' }, { id: 'words', label: '単語帳', mark: '字' }, { id: 'phrases', label: 'フレーズ帳', mark: '話' }, { id: 'quiz', label: 'クイズ', mark: '✓' }] as const
type Page = typeof pages[number]['id']
function readPage(): Page { return pages.find((page) => `#${page.id}` === window.location.hash)?.id ?? 'home' }

function App() {
  const [page, setPage] = useState<Page>(readPage)
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [input, setInput] = useState<ChineseText>({ chinese: '', pinyin: '', pinyinSource: 'auto' })
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setStatus('オフライン用の準備ができませんでした。オンラインで再度開いてください。') })
  const refresh = useCallback(() => loadData().then((next) => {
    setData((previous) => !previous || next.revision >= previous.revision ? next : previous)
    setError('')
  }).catch((err: unknown) => setError(storageMessage(err))), [])
  useEffect(() => {
    void refresh()
    const navigate = () => { setPage(readPage()); setQuery(''); window.speechSynthesis?.cancel() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); window.speechSynthesis?.cancel() }
  }, [refresh])
  async function save(change: (draft: AppData) => void, success: string) {
    if (busy) return
    setBusy(true)
    try { setData(await transact(change)); setError(''); setStatus(success) }
    catch (err) { setError(storageMessage(err)) }
    finally { setBusy(false) }
  }
  const speak = (chinese: string) => { if (data) speakChinese(chinese, data.settings.speechRate, setStatus) }
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#home"><span className="brand-mark" lang="zh-CN">学</span><span>中国語のじかん<small>Chinese Learning App</small></span></a><span className="badge">開発中 · 土台</span></header>
    <main id="main-content">
      {error && <div className="error" role="alert">{error}<button disabled={busy} onClick={() => void refresh()}>再読み込み</button></div>}
      <p className="status" role="status">{status}</p>
      {needRefresh && <section className="notice">新しいバージョンがあります。入力の確認後に更新してください。<button onClick={() => void updateServiceWorker(true).catch(() => setStatus('更新に失敗しました。再試行してください。'))}>アプリを更新</button></section>}
      {!data ? <section className="card"><h1>保存領域を確認しています</h1><p>読み込めない場合は、上の再読み込みをお試しください。</p></section> : <>
        {page === 'home' && <>
          <section className="welcome"><p className="eyebrow">少しずつ、言葉をふやそう</p><h1>今日も、中国語に<br />ふれてみよう。</h1><p>自分のペースで続ける、あなただけの学習ノート。</p><span className="hello" lang="zh-CN">你好<span>nǐ hǎo</span></span></section>
          <div className="destination-grid">{pages.slice(1).map((item, i) => <a className={`destination tone-${i}`} key={item.id} href={`#${item.id}`}><span className="destination-mark">{item.mark}</span><h2>{item.label}</h2><p>{['覚えたい言葉を集める', '使いたい一言を残す', '少しずつ定着させる'][i]}</p><span aria-hidden="true">→</span></a>)}</div>
          <section className="card"><h2>アプリの準備状況</h2><p>画面移動・端末内保存・入力の土台を用意しました。単語の登録編集やクイズは次の工程で追加します。</p><div className="stats"><span>単語 <strong>{data.words.length}</strong></span><span>フレーズ <strong>{data.phrases.length}</strong></span></div><p className="muted">正式な初期200語はまだ入っていません。検証用の1語だけを任意で追加できます。</p><button disabled={busy || data.initialization.verificationAdded} onClick={() => void save(addVerificationWord, '検証用「你好」を端末内に保存しました。単語帳で確認できます。')}>{data.initialization.verificationAdded ? '検証用の1語は追加済み' : '保存確認用に「你好」を追加'}</button></section>
          <section className="card"><h2>中国語入力の動作確認</h2><p className="muted">この入力欄は保存しません。画面を開き直すと空になります。字体の候補とピンインの手動修正を試せます。</p><Suspense fallback={<p>入力用の辞書を読み込んでいます。</p>}><ChineseInput value={input} onChange={setInput} /></Suspense><button disabled={!input.chinese.trim()} onClick={() => speak(input.chinese)}>入力した中国語を読み上げる</button><p className="muted">多音字などの読みは自動生成の候補です。必要に応じて修正してください。</p></section>
        </>}
        {page === 'words' && <><p className="eyebrow">WORDS</p><h1>単語帳</h1><p>気になる言葉を、ひとつずつ。</p><section className="card"><label htmlFor="word-search">中国語・日本語・ピンインで検索</label><input id="word-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：你好 / ni hao" /><label htmlFor="word-sort">並び順</label><select id="word-sort" disabled={busy} value={data.settings.wordSort} onChange={(e) => { const sort = e.target.value as AppData['settings']['wordSort']; void save((draft) => { draft.settings.wordSort = sort }, '並び順を保存しました。') }}><option value="newest">登録が新しい順</option><option value="pinyin">ピンイン順</option><option value="mastery">暗記度が低い順</option></select></section>
          {data.words.filter((word) => matchesSearch(query, [word.chinese, word.pinyin, ...word.meanings])).sort((a, b) => data.settings.wordSort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : data.settings.wordSort === 'pinyin' ? a.pinyin.localeCompare(b.pinyin, 'zh-Latn') : overallMastery(masteryFor(data, a.chinese)) - overallMastery(masteryFor(data, b.chinese))).map((word) => <article className="card word-card" key={word.id}>{word.source === 'verification' && <span className="badge">保存確認用データ</span>}<h2 lang="zh-CN">{word.chinese}</h2><p className="pinyin">{word.pinyin}</p>{word.meanings.map((meaning, i) => <p key={i}>{meaning}</p>)}<p className="muted">総合暗記度 {overallMastery(masteryFor(data, word.chinese))}%</p><button onClick={() => speak(word.chinese)}>読み上げる</button></article>)}
          <p className="muted">追加・編集・例文・ジャンル絞り込みは03で実装します。検索結果がない場合は検索語を変えるか、ホームから検証用の1語を追加してください。</p></>}
        {page === 'phrases' && <><p className="eyebrow">PHRASES</p><h1>フレーズ帳</h1><section className="card"><h2>使いたい一言を、ここに。</h2><p>フレーズの追加・編集・例文コピーは05で実装します。現在 {data.phrases.length} 件です。</p><a href="#words">単語帳へ →</a></section></>}
        {page === 'quiz' && <><p className="eyebrow">PRACTICE</p><h1>クイズ</h1><section className="card"><h2>朝の10問・夜の10問・無限列車編</h2><p>3つのモードは06で実装します。現在はクイズを開始できません。</p><p className="muted">暗記度の共有・一括保存・二重保存防止の処理を用意しています。</p><a href="#home">ホームへ →</a></section></>}
        <section className="card settings"><h2>共通の読み上げ速度</h2><div className="actions">{([1, 0.75] as const).map((rate) => <button key={rate} disabled={busy} aria-pressed={data.settings.speechRate === rate} onClick={() => void save((draft) => { draft.settings.speechRate = rate }, '読み上げ速度を保存しました。')}>{rate === 1 ? '通常 1.0倍' : 'ゆっくり 0.75倍'}</button>)}</div><p className="muted">音声はボタンを押したときだけ再生します。利用できる中国語音声とオフラインでの再生は端末によって異なります。</p></section>
        <footer>データはこのブラウザー内に保存されます。<br />{offlineReady ? 'オフライン用ファイルの準備ができました。' : 'オフライン利用は本番配信で確認します。'}<br />ブラウザーのデータ削除で学習データも消えるため、バックアップ機能は08で追加します。</footer>
      </>}
    </main>
    <nav className="bottom-nav" aria-label="メインメニュー">{pages.map((item) => <a href={`#${item.id}`} key={item.id} aria-current={page === item.id ? 'page' : undefined}><span aria-hidden="true">{item.mark}</span>{item.label}</a>)}</nav>
  </div>
}
export default App
