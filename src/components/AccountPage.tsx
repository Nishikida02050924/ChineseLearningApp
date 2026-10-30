import { useState } from 'react'
import type { AppData } from '../core/model.ts'
import type { Save } from './appTypes.ts'
import './AccountPage.css'

const PROFILE_IMAGE_SIZE = 256
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

async function prepareProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください。')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('画像は8MB以下のものを選んでください。')
  const url = URL.createObjectURL(file)
  try {
    const image = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('画像を読み込めませんでした。別の画像を試してください。'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = PROFILE_IMAGE_SIZE
    canvas.height = PROFILE_IMAGE_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('この端末では画像を加工できません。')
    const scale = Math.max(PROFILE_IMAGE_SIZE / image.naturalWidth, PROFILE_IMAGE_SIZE / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.fillStyle = '#f3ead9'
    context.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE)
    context.drawImage(image, (PROFILE_IMAGE_SIZE - width) / 2, (PROFILE_IMAGE_SIZE - height) / 2, width, height)
    return canvas.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function AccountPage({ data, save }: { data: AppData; save: Save }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(data.settings.profileName ?? '')
  const [pinyin, setPinyin] = useState(data.settings.profilePinyin ?? '')
  const [icon, setIcon] = useState(data.settings.profileIcon ?? '')
  const [speechRate, setSpeechRate] = useState(data.settings.speechRate)
  const [imageError, setImageError] = useState('')
  const [processing, setProcessing] = useState(false)

  const selectImage = async (file?: File) => {
    setImageError('')
    if (!file) return
    setProcessing(true)
    try { setIcon(await prepareProfileImage(file)) }
    catch (cause) { setImageError(cause instanceof Error ? cause.message : '画像を読み込めませんでした。') }
    finally { setProcessing(false) }
  }
  const store = async () => {
    const saved = await save((draft) => {
      draft.settings.profileName = name.trim()
      draft.settings.profilePinyin = pinyin.trim()
      draft.settings.speechRate = speechRate
      if (icon) draft.settings.profileIcon = icon
      else delete draft.settings.profileIcon
    }, '')
    if (saved) setEditing(false)
  }
  const startEditing = () => {
    setName(data.settings.profileName ?? '')
    setPinyin(data.settings.profilePinyin ?? '')
    setIcon(data.settings.profileIcon ?? '')
    setSpeechRate(data.settings.speechRate)
    setImageError('')
    setEditing(true)
  }
  const cancelEditing = () => {
    setImageError('')
    setEditing(false)
  }
  const savedName = data.settings.profileName?.trim() ?? ''
  const savedPinyin = data.settings.profilePinyin?.trim() ?? ''
  const initial = (editing ? name : savedName).trim().slice(0, 1) || '人'
  const displayedIcon = editing ? icon : (data.settings.profileIcon ?? '')

  return <>
    <div className="page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>アカウント</h1><p>この端末で使うプロフィール</p></div></div>
    {!editing ? <section className="card account-status-card">
      <button className="account-edit-button" type="button" aria-label="プロフィールを編集" title="プロフィールを編集" onClick={startEditing}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm12.5-16.5 4 4 1-1a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0l-1 1Z"/></svg></button>
      <div className="account-preview">{displayedIcon ? <img src={displayedIcon} alt="プロフィール画像"/> : <span aria-hidden="true">{initial}</span>}</div>
      <div className="account-identity"><strong>{savedName || 'プロフィール未設定'}</strong>{savedPinyin && <span>{savedPinyin}</span>}{!savedName && <small>鉛筆から設定できます</small>}</div>
      <div className="account-status-row"><span>読み上げ</span><strong>{data.settings.speechRate === .75 ? 'ゆっくり 0.75倍' : '通常 1.0倍'}</strong></div>
    </section> : <section className="card account-card account-edit-card">
      <div className="account-avatar-editor"><div className="account-preview">{displayedIcon ? <img src={displayedIcon} alt="プロフィール画像"/> : <span aria-hidden="true">{initial}</span>}</div>{icon && <button className="remove-avatar" type="button" aria-label="画像を外す" title="画像を外す" onClick={() => setIcon('')}>×</button>}</div>
      <label className="file-button">{processing ? '画像を加工中…' : '画像を変更'}<input type="file" accept="image/*" disabled={processing} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>
      {imageError && <p className="error" role="alert">{imageError}</p>}
      <label htmlFor="account-name">名前</label>
      <input id="account-name" value={name} maxLength={50} placeholder="例：理央" onChange={(event) => setName(event.target.value)}/>
      <label htmlFor="account-pinyin">名前のピンイン</label>
      <input id="account-pinyin" value={pinyin} maxLength={100} placeholder="例：Lǐ Yāng" onChange={(event) => setPinyin(event.target.value)}/>
      <fieldset className="account-rate"><legend>読み上げ速度</legend><div className="actions"><button type="button" aria-pressed={speechRate === 1} onClick={() => setSpeechRate(1)}>通常 1.0倍</button><button type="button" aria-pressed={speechRate === .75} onClick={() => setSpeechRate(.75)}>ゆっくり 0.75倍</button></div></fieldset>
      <div className="form-actions account-edit-actions"><button type="button" onClick={cancelEditing}>キャンセル</button><button className="primary-button" disabled={processing} onClick={() => void store()}>完了</button></div>
    </section>}
  </>
}
