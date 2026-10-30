import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { DataPage } from './components/DataPage.tsx'
import { AccountPage } from './components/AccountPage.tsx'
import { LearningCalendar } from './components/Calendar.tsx'
import { QuizPage } from './components/QuizPage.tsx'
import type { AppData } from './core/model.ts'
import { speakChinese } from './core/language.ts'
import { installPrototypeWords, installStarterPhrases } from './core/operations.ts'
import { loadData, storageMessage, transact } from './core/storage.ts'
import './PrototypeApp.css'

const wordPages = () => import('./components/WordPages.tsx')
const phrasePages = () => import('./components/PhrasePages.tsx')
const WordList = lazy(() => wordPages().then((module) => ({ default: module.WordList })))
const WordDetail = lazy(() => wordPages().then((module) => ({ default: module.WordDetail })))
const WordForm = lazy(() => wordPages().then((module) => ({ default: module.WordForm })))
const PhraseList = lazy(() => phrasePages().then((module) => ({ default: module.PhraseList })))
const PhraseForm = lazy(() => phrasePages().then((module) => ({ default: module.PhraseForm })))

const nav = [{ id: 'home', label: 'ホーム', mark: '⌂' }, { id: 'words', label: '単語帳', mark: '字' }, { id: 'phrases', label: 'フレーズ帳', mark: '話' }, { id: 'quiz', label: 'クイズ', mark: '✓' }, { id: 'account', label: 'アカウント', mark: '人' }]
const route = () => {
  const path = (location.hash.replace(/^#/, '') || 'home').split('/')
  return path[0] === 'phrase' ? ['phrases', ...path.slice(1)] : path
}

export default function PrototypeApp() {
  const [path, setPath] = useState(route)
  const [data, setData] = useState<AppData | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setStatus('オフライン用ファイルを準備できませんでした。オンラインで再度開いてください。') })
  const refresh = useCallback(async () => {
    try {
      let next = await loadData()
      const { INITIAL_DATASET_ID, initialWords } = await import('./data/initialWords.ts')
      const { INITIAL_PHRASE_DATASET_ID, initialPhrases } = await import('./data/initialPhrases.ts')
      if (next.initialization.initialDatasetId !== INITIAL_DATASET_ID || next.initialization.phraseDatasetId !== INITIAL_PHRASE_DATASET_ID) {
        next = await transact((draft) => {
          installPrototypeWords(draft, INITIAL_DATASET_ID, initialWords)
          installStarterPhrases(draft, INITIAL_PHRASE_DATASET_ID, initialPhrases)
        })
      }
      setData((current) => !current || next.revision >= current.revision ? next : current); setError('')
    } catch (cause) { setError(storageMessage(cause)) }
  }, [])
  // Loading IndexedDB is the external synchronization performed by this effect.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const change = () => { setPath(route()); setStatus(''); scrollTo({ top: 0, behavior: 'smooth' }); speechSynthesis?.cancel() }
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    addEventListener('hashchange', change); addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible)
    return () => { removeEventListener('hashchange', change); removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); speechSynthesis?.cancel() }
  }, [refresh])
  const save = useCallback(async (change: (draft: AppData) => void, message: string) => {
    if (busy) return null
    setBusy(true)
    try { const next = await transact(change); setData(next); setError(''); setStatus(message); return next }
    catch (cause) { setError(storageMessage(cause)); return null }
    finally { setBusy(false) }
  }, [busy])
  const speak = useCallback((text: string) => {
    setStatus('')
    if (data) speakChinese(text, data.settings.speechRate, setStatus)
  }, [data])
  const page = path[0]
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#home"><span className="brand-mark" lang="zh-CN">学</span><span>中国語のじかん<small>Chinese Learning App</small></span></a><a className="header-link" href="#data">保存・復元</a></header>
    <main id="main-content">
      {error && <div className="error" role="alert">{error}<button onClick={() => void refresh()}>再読み込み</button></div>}
      {status && <p className="status" role="status">{status}</p>}
      {needRefresh && <section className="notice update"><p>新しいバージョンがあります。</p><button onClick={() => void updateServiceWorker(true)}>アプリを更新</button></section>}
      {!data ? <section className="card"><h1>データを準備しています</h1><p>初回は250語を端末内に保存します。</p></section> : <>
        <Suspense fallback={<section className="card">画面を読み込んでいます。</section>}>
          {page === 'home' && <Home data={data}/>} {page === 'words' && <WordList data={data} save={save} speak={speak}/>} {page === 'word' && path[1] && <WordDetail data={data} id={path[1]} save={save} speak={speak}/>} {page === 'word-new' && <WordForm data={data} save={save}/>} {page === 'word-edit' && <WordForm data={data} id={path[1]} save={save}/>} {page === 'phrases' && <PhraseList data={data} save={save} speak={speak}/>} {page === 'phrase-new' && <PhraseForm data={data} save={save}/>} {page === 'phrase-edit' && <PhraseForm data={data} id={path[1]} save={save}/>} {page === 'quiz' && <QuizPage data={data} save={save} speak={speak}/>} {page === 'account' && <AccountPage data={data} save={save}/>} {page === 'data' && <DataPage data={data} save={save}/>}
        </Suspense>
        <section className="card compact-settings"><h2>読み上げ速度</h2><div className="actions"><button aria-pressed={data.settings.speechRate === 1} onClick={() => void save((draft) => { draft.settings.speechRate = 1 }, '通常速度を保存しました。')}>通常 1.0倍</button><button aria-pressed={data.settings.speechRate === .75} onClick={() => void save((draft) => { draft.settings.speechRate = .75 }, 'ゆっくり速度を保存しました。')}>ゆっくり 0.75倍</button></div></section>
        <footer>データはこの端末のブラウザー内に保存されます。<br/>{offlineReady ? 'オフライン用ファイルの準備ができました。' : '初回のオフライン準備中です。'}</footer>
      </>}
    </main>
    <nav className="bottom-nav" aria-label="メインメニュー">{nav.map((item) => <a href={'#' + item.id} key={item.id} aria-current={page === item.id || (item.id === 'words' && page.startsWith('word')) || (item.id === 'phrases' && page.startsWith('phrase')) ? 'page' : undefined}>{item.id === 'account' && data?.settings.profileIcon ? <img className="nav-avatar" src={data.settings.profileIcon} alt=""/> : <span>{item.mark}</span>}{item.label}</a>)}</nav>
    {busy && <div className="saving" role="status">保存中…</div>}
  </div>
}

function Home({ data }: { data: AppData }) {
  return <>
    <section className="welcome"><p className="eyebrow">少しずつ、言葉をふやそう</p><h1>今日も、中国語に<br/>ふれてみよう。</h1><p>250語から始める、あなただけの学習ノート。</p><span className="hello" lang="zh-CN">你好<span>nǐ hǎo</span></span></section>
    <div className="home-cards"><a className="home-card words" href="#words"><span className="home-icon">字</span><div><h2>単語帳</h2><p>{data.words.length}語 · 登録、検索、例文</p></div><b>→</b></a><a className="home-card phrases" href="#phrases"><span className="home-icon">話</span><div><h2>フレーズ帳</h2><p>{data.phrases.length}件 · 使いたい一言</p></div><b>→</b></a><a className="home-card quiz" href="#quiz"><span className="home-icon">✓</span><div><h2>単語クイズ</h2><p>朝・夜・無限列車編</p></div><b>→</b></a></div>
    <div className="section-title"><div><p className="eyebrow">LEARNING CALENDAR</p><h2>学習カレンダー</h2></div><a href="#data">バックアップ</a></div><LearningCalendar records={data.dailyRecords}/>
  </>
}
