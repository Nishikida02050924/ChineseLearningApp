const targets = await (await fetch('http://127.0.0.1:9223/json')).json()
const page = targets.find((target) => target.type === 'page' && target.url.startsWith('http://127.0.0.1:5173/'))
if (!page) throw new Error('確認用のアプリ画面が見つかりません。')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

const expression = `new Promise((resolve) => {
  const read = () => speechSynthesis.getVoices().map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
  }))
  const voices = read()
  if (voices.length) return resolve(voices)
  speechSynthesis.addEventListener('voiceschanged', () => resolve(read()), { once: true })
  setTimeout(() => resolve(read()), 2500)
})`

socket.send(JSON.stringify({
  id: 1,
  method: 'Runtime.evaluate',
  params: { expression, awaitPromise: true, returnByValue: true },
}))

const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('音声一覧の取得がタイムアウトしました。')), 5000)
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== 1) return
    clearTimeout(timer)
    resolve(message)
  })
})

if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text)
const voices = result.result.result.value
console.log(JSON.stringify(voices, null, 2))

if (!voices.some((voice) => /^zh(?:[-_]|$)/i.test(voice.lang))) {
  throw new Error('Chromeが中国語音声を認識していません。')
}

socket.send(JSON.stringify({
  id: 2,
  method: 'Runtime.evaluate',
  params: {
    expression: `new Promise((resolve) => {
      const button = document.querySelector('button[aria-label="你好を読み上げる"]')
      if (!button) return resolve('読み上げボタンが見つかりません。')
      button.click()
      setTimeout(() => resolve(document.querySelector('.status')?.textContent ?? ''), 100)
    })`,
    awaitPromise: true,
    returnByValue: true,
  },
}))

const playback = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('再生確認がタイムアウトしました。')), 5000)
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== 2) return
    clearTimeout(timer)
    resolve(message)
  })
})

socket.close()
if (playback.result?.exceptionDetails) throw new Error(playback.result.exceptionDetails.text)
console.log(playback.result.result.value)
