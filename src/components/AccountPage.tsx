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
  const [name, setName] = useState(data.settings.profileName ?? '')
  const [pinyin, setPinyin] = useState(data.settings.profilePinyin ?? '')
  const [icon, setIcon] = useState(data.settings.profileIcon ?? '')
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
    await save((draft) => {
      draft.settings.profileName = name.trim()
      draft.settings.profilePinyin = pinyin.trim()
      if (icon) draft.settings.profileIcon = icon
      else delete draft.settings.profileIcon
    }, 'アカウントを保存しました。')
  }
  const initial = name.trim().slice(0, 1) || '人'

  return <>
    <div className="page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>アカウント</h1><p>この端末で使うプロフィール</p></div></div>
    <section className="card account-card">
      <div className="account-preview">{icon ? <img src={icon} alt="プロフィール画像"/> : <span aria-hidden="true">{initial}</span>}</div>
      <label className="file-button">{processing ? '画像を加工中…' : 'アイコン画像を選ぶ'}<input type="file" accept="image/*" disabled={processing} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>
      {icon && <button type="button" onClick={() => setIcon('')}>画像を外す</button>}
      {imageError && <p className="error" role="alert">{imageError}</p>}
      <label htmlFor="account-name">名前</label>
      <input id="account-name" value={name} maxLength={50} placeholder="例：理央" onChange={(event) => setName(event.target.value)}/>
      <label htmlFor="account-pinyin">名前のピンイン</label>
      <input id="account-pinyin" value={pinyin} maxLength={100} placeholder="例：Lǐ Yāng" onChange={(event) => setPinyin(event.target.value)}/>
      {(name.trim() || pinyin.trim()) && <div className="profile-name-preview"><strong>{name.trim() || '名前未設定'}</strong>{pinyin.trim() && <span>{pinyin.trim()}</span>}</div>}
      <button className="primary-button wide" disabled={processing} onClick={() => void store()}>アカウントを保存</button>
    </section>
    <section className="card"><h2>保存について</h2><p>名前・ピンイン・画像はこの端末のブラウザー内だけに保存され、外部には送信されません。</p><a href="#data">バックアップと復元を開く</a></section>
  </>
}
