import { useState } from 'react'
import type { AppData } from '../core/model.ts'
import { makeBackup, parseBackup } from '../core/backup.ts'
import type { Save } from './appTypes.ts'

export function DataPage({ data, save }: { data: AppData; save: Save }) {
  const [incoming, setIncoming] = useState<AppData | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const download = () => {
    const blob = new Blob([JSON.stringify(makeBackup(data), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `ChineseLearningApp-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const select = async (file?: File) => {
    setIncoming(null); setError(''); setFileName(file?.name ?? '')
    if (!file) return
    try { setIncoming(parseBackup(await file.text())) } catch (cause) { setError(cause instanceof Error ? cause.message : 'ファイルを読み込めませんでした。') }
  }
  const restore = async () => {
    if (!incoming) return
    if (!confirm(`現在のデータ（単語${data.words.length}語・フレーズ${data.phrases.length}件）を、選択したバックアップ（単語${incoming.words.length}語・フレーズ${incoming.phrases.length}件）で全て置き換えます。先に現在のバックアップを書き出しましたか？`)) return
    await save((draft) => Object.assign(draft, structuredClone(incoming)), 'バックアップを復元しました。')
    setIncoming(null); setFileName('')
  }
  return <><div className="page-heading"><div><p className="eyebrow">DATA</p><h1>データ管理</h1><p>学習データはこのブラウザー内にあります。</p></div></div><section className="card"><h2>JSONバックアップを書き出す</h2><p>単語・例文・フレーズ・暗記度・朝夜の記録・設定を1つのファイルに保存します。</p><button className="primary-button" onClick={download}>バックアップを保存</button></section><section className="card"><h2>バックアップから復元</h2><p>内容を検査してから、現在のデータを全置換します。選択しただけでは変更しません。</p><label className="file-button">JSONファイルを選ぶ<input type="file" accept="application/json,.json" onChange={(e) => void select(e.target.files?.[0])}/></label>{fileName && <p>選択：{fileName}</p>}{error && <p className="error" role="alert">{error}</p>}{incoming && <div className="notice"><p>形式を確認できました。</p><ul><li>単語：{incoming.words.length}語</li><li>フレーズ：{incoming.phrases.length}件</li><li>学習記録：{incoming.dailyRecords.length}件</li></ul><button className="danger" onClick={() => void restore()}>現在のデータを置き換えて復元</button></div>}</section><section className="card"><h2>iPhoneで使うとき</h2><ol><li>公開後のHTTPSページをSafariで開きます。</li><li>共有ボタンから「ホーム画面に追加」を選びます。</li><li>機種変更やURL変更の前に、この画面からバックアップを保存します。</li></ol><p className="muted">ブラウザーの履歴やWebサイトデータを消すと学習データも消える場合があります。</p></section></>
}
