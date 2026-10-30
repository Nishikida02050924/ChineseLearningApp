import { useState } from 'react'
import type { DailyRecord } from '../core/model.ts'
const pad = (n: number) => String(n).padStart(2, '0')
export function LearningCalendar({ records }: { records: DailyRecord[] }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const year = month.getFullYear(), monthIndex = month.getMonth(), days = new Date(year, monthIndex + 1, 0).getDate(), offset = new Date(year, monthIndex, 1).getDay()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)]
  return <section className="card calendar"><div className="calendar-head"><button aria-label="前の月" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>←</button><h2>{year}年 {monthIndex + 1}月</h2><button aria-label="次の月" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>→</button></div><div className="calendar-grid weekdays">{['日','月','火','水','木','金','土'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => { if (!day) return <span className="calendar-day blank" key={`blank-${index}`}/>; const date = `${year}-${pad(monthIndex + 1)}-${pad(day)}`; const daily = records.filter((record) => record.startDate === date); return <span className="calendar-day" key={date}><b>{day}</b><small>{daily.some((r) => r.mode === 'morning') ? '☀️' : ''}{daily.some((r) => r.mode === 'night') ? '🌙' : ''}</small></span> })}</div></section>
}
