import type { AppData } from './model.ts'
import { assertData } from './storage.ts'
export interface BackupEnvelope { app: 'ChineseLearningApp'; exportedAt: string; data: AppData }
export function makeBackup(data: AppData): BackupEnvelope { return { app: 'ChineseLearningApp', exportedAt: new Date().toISOString(), data: structuredClone(data) } }
export function parseBackup(text: string): AppData {
  if (text.length > 15_000_000) throw new Error('ファイルが大きすぎます。15MB以下のバックアップを選んでください。')
  const parsed = JSON.parse(text) as Partial<BackupEnvelope>
  if (parsed.app !== 'ChineseLearningApp' || typeof parsed.exportedAt !== 'string' || !parsed.data) throw new Error('このアプリのバックアップではありません。')
  assertData(parsed.data)
  return parsed.data
}
