export function normalizeSearch(text: string): string {
  // Keep ü distinct from u, while accepting common keyboard spelling v/u:.
  return text.toLowerCase().replace(/u:/g, 'v').normalize('NFD')
    .replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').normalize('NFC')
}
export function matchesSearch(query: string, fields: string[]): boolean {
  const normalized = normalizeSearch(query)
  return fields.some((field) => normalizeSearch(field).includes(normalized))
}

export function chooseChineseVoice<T extends Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService' | 'default'>>(voices: T[]): T | undefined {
  const chinese = voices.filter((voice) => /^zh(?:[-_]|$)/i.test(voice.lang))
  return chinese.find((voice) => /^zh[-_]CN$/i.test(voice.lang) && voice.localService)
    ?? chinese.find((voice) => /^zh[-_]CN$/i.test(voice.lang))
    ?? chinese.find((voice) => /^zh[-_](?:SG|Hans)/i.test(voice.lang))
    ?? chinese.find((voice) => voice.localService)
    ?? chinese[0]
}

export function speakChinese(text: string, rate: 1 | 0.75, report: (message: string) => void): () => void {
  if (!('speechSynthesis' in window)) { report('この環境では読み上げが使えません。'); return () => {} }
  const engine = window.speechSynthesis
  let active = true
  let timeout = 0

  const play = (voice: SpeechSynthesisVoice) => {
    if (!active) return
    const utterance = new SpeechSynthesisUtterance(text)
    // Always request Mandarin explicitly and only assign a verified Chinese
    // voice. Letting the browser choose here can make Japanese voices read the
    // Han characters with Japanese readings.
    utterance.lang = 'zh-CN'
    utterance.voice = voice
    utterance.rate = rate
    utterance.onerror = (event) => { if (!['interrupted', 'canceled'].includes(event.error)) report('中国語音声を再生できませんでした。端末の音量と音声設定を確認してください。') }
    engine.cancel()
    engine.speak(utterance)
  }

  const tryPlay = () => {
    const voice = chooseChineseVoice(engine.getVoices())
    if (!voice) return false
    window.clearTimeout(timeout)
    engine.removeEventListener('voiceschanged', onVoicesChanged)
    play(voice)
    return true
  }
  const onVoicesChanged = () => { void tryPlay() }

  if (!tryPlay()) {
    engine.addEventListener('voiceschanged', onVoicesChanged)
    timeout = window.setTimeout(() => {
      engine.removeEventListener('voiceschanged', onVoicesChanged)
      if (active && !tryPlay()) report('このブラウザーでは中国語音声を利用できません。Google ChromeまたはMicrosoft Edgeで開いてください。')
    }, 1200)
  }

  return () => {
    active = false
    window.clearTimeout(timeout)
    engine.removeEventListener('voiceschanged', onVoicesChanged)
    engine.cancel()
  }
}
