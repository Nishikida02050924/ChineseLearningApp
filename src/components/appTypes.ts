import type { AppData } from '../core/model.ts'
export type Save = (change: (draft: AppData) => void, message: string) => Promise<AppData | null>
export type Speak = (text: string) => void
