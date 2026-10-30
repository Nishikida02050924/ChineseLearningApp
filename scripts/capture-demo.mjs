import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outputDir = process.argv[2]
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5173/ChineseLearningApp/'
const port = process.argv[4] ?? '9222'
if (!outputDir) throw new Error('出力先フォルダーを指定してください。')
await mkdir(outputDir, { recursive: true })

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
const target = targets.find((item) => item.type === 'page')
if (!target?.webSocketDebuggerUrl) throw new Error('撮影用ブラウザーへ接続できません。')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})
let sequence = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  if (message.error) reject(new Error(message.error.message))
  else resolve(message.result)
})
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = (expression) => command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
const waitFor = async (selector) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    if (result.result?.value) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`画面の準備が完了しませんでした: ${selector}`)
}
const navigate = async (hash, selector) => {
  await command('Page.navigate', { url: `${baseUrl}${hash}` })
  await waitFor(selector)
  await new Promise((resolve) => setTimeout(resolve, 250))
}
const capture = async (name) => {
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await writeFile(path.join(outputDir, name), Buffer.from(result.data, 'base64'))
}

await command('Page.enable')
await command('Runtime.enable')
await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

await navigate('#home', '.welcome')
await capture('home.png')

await navigate('#words', '.word-card')
await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === '動詞'); button?.click(); const label = [...document.querySelectorAll('.muted')].find((item) => item.textContent.trim() === '品詞'); label?.scrollIntoView({ block: 'start' }); return true })()`)
await new Promise((resolve) => setTimeout(resolve, 200))
await capture('verbs.png')

await navigate('#word/initial-201', '.detail-card')
await evaluate(`(() => { const label = [...document.querySelectorAll('.tag.neutral')].find((item) => item.textContent.trim() === '否定文'); label?.scrollIntoView({ block: 'center' }); return true })()`)
await new Promise((resolve) => setTimeout(resolve, 200))
await capture('negative.png')

await navigate('#phrase/initial-phrase-031', '.detail-card')
await capture('phrase.png')

await navigate('#account', '.account-status-card')
await capture('account-status.png')
await evaluate(`document.querySelector('[aria-label="プロフィールを編集"]')?.click()`)
await waitFor('.account-edit-card')
await capture('account-edit.png')

socket.close()
