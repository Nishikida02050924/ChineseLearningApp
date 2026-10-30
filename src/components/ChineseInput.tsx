import { useId, useRef, useState } from 'react'
import type { ChineseText } from '../core/model.ts'
import { generatePinyin, simplifiedSuggestion } from '../core/conversion.ts'

export function ChineseInput({ value, onChange }: { value: ChineseText; onChange: (next: ChineseText) => void }) {
  const id = useId()
  const lastGenerated = useRef(value.chinese)
  const [pending, setPending] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  function regenerate(chinese: string) {
    try {
      const auto = generatePinyin(chinese)
      lastGenerated.current = chinese
      if (value.pinyinSource === 'manual') { setPending(auto); onChange({ ...value, chinese }) }
      else onChange({ chinese, pinyin: auto, pinyinSource: 'auto' })
      setSuggestion(simplifiedSuggestion(chinese))
      setMessage('')
    } catch { setMessage('自動変換が使えません。入力は保持しています。ピンインを手動で入力してください。') }
  }
  return <div className="input-stack">
    <label htmlFor={`${id}-chinese`}>中国語</label>
    <input id={`${id}-chinese`} lang="zh-CN" value={value.chinese} placeholder="例：你好" onChange={(e) => { onChange({ ...value, chinese: e.target.value }); setPending(null); setSuggestion(null) }} onBlur={() => { if (lastGenerated.current !== value.chinese) regenerate(value.chinese) }} />
    {suggestion && <div className="notice">簡体字の候補：<span lang="zh-CN">{suggestion}</span><div className="actions"><button type="button" onClick={() => { regenerate(suggestion); setSuggestion(null) }}>簡体字に置き換える</button><button type="button" onClick={() => setSuggestion(null)}>元の表記を保持</button></div></div>}
    <label htmlFor={`${id}-pinyin`}>ピンイン（手動修正できます）</label>
    <input id={`${id}-pinyin`} value={value.pinyin} onChange={(e) => { setPending(null); onChange({ ...value, pinyin: e.target.value, pinyinSource: 'manual' }) }} />
    {pending !== null && <div className="notice" role="group" aria-label="手動ピンインの保護">手動修正したピンインがあります。自動生成候補：{pending || '（空欄）'}<div className="actions"><button type="button" onClick={() => { onChange({ ...value, pinyin: pending, pinyinSource: 'auto' }); setPending(null) }}>上書き</button><button type="button" onClick={() => setPending(null)}>維持</button></div></div>}
    {message && <p role="status">{message}</p>}
  </div>
}
