import { useMemo, useRef, useState } from 'react'
import type { Answer, AppData, Word } from '../core/model.ts'
import { localDate, masteryFor } from '../core/model.ts'
import { applyInfiniteAnswer, completeDaily } from '../core/operations.ts'
import { answerFor, dailyQuestions, infiniteQuestion, quizAvailability } from '../core/quiz.ts'
import type { Question } from '../core/quiz.ts'
import type { Save, Speak } from './appTypes.ts'

type Mode = 'morning' | 'night' | 'infinite'
interface ResultItem { question: Question; choice: Word; answer: Answer; before: number }

export function QuizPage({ data, save, speak }: { data: AppData; save: Save; speak: Speak }) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [question, setQuestion] = useState<Question | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<ResultItem | null>(null)
  const [results, setResults] = useState<ResultItem[]>([])
  const [finished, setFinished] = useState(false)
  const used = useRef(new Set<string>())
  const sessionId = useRef(crypto.randomUUID())
  const startDate = useRef(localDate())
  const availability = quizAvailability()
  const completed = (dailyMode: 'morning' | 'night') => data.dailyRecords.some((record) => record.startDate === localDate() && record.mode === dailyMode)
  const start = (nextMode: Mode) => {
    startDate.current = localDate(); sessionId.current = crypto.randomUUID(); used.current = new Set(); setResults([]); setFinished(false); setFeedback(null); setIndex(0); setMode(nextMode)
    if (nextMode === 'infinite') { const next = infiniteQuestion(data, used.current); setQuestion(next) }
    else { const list = dailyQuestions(data, nextMode, startDate.current); if (list.length !== 10) { alert('安全な4択を10問作れませんでした。単語を増やすか、重複する訳を確認してください。'); setMode(null); return } setQuestions(list); setQuestion(list[0]) }
  }
  const choose = async (choice: Word) => {
    if (!question || feedback) return
    const answer = answerFor(question, choice)
    const item = { question, choice, answer, before: masteryFor(data, question.word.chinese)[question.direction] }
    setFeedback(item); setResults((current) => [...current, item])
    if (mode === 'infinite') await save((draft) => applyInfiniteAnswer(draft, sessionId.current, results.length + 1, answer), answer.correct ? '正解。暗記度を保存しました。' : '不正解。暗記度を保存しました。')
  }
  const next = async (finishInfinite = false) => {
    if (!feedback || !mode) return
    if (mode === 'infinite') {
      used.current.add(feedback.answer.key)
      if (finishInfinite) { setFinished(true); setQuestion(null); setFeedback(null); return }
      const nextQuestion = infiniteQuestion(data, used.current)
      if (!nextQuestion) { setFinished(true); setQuestion(null); return }
      setQuestion(nextQuestion); setFeedback(null); setIndex((value) => value + 1); return
    }
    if (index === 9) {
      const finalResults = [...results]
      await save((draft) => completeDaily(draft, { id: sessionId.current, startDate: startDate.current, mode, completedAt: new Date().toISOString() }, finalResults.map((item) => item.answer)), `${mode === 'morning' ? '朝' : '夜'}の10問を完了しました。`)
      setFinished(true); setQuestion(null); setFeedback(null); return
    }
    setIndex((value) => value + 1); setQuestion(questions[index + 1]); setFeedback(null)
  }
  if (finished) return <QuizResults results={results} speak={speak}/>
  if (!mode || !question) return <><div className="page-heading"><div><p className="eyebrow">PRACTICE</p><h1>単語クイズ</h1><p>すべて4択です。</p></div></div><div className="quiz-modes"><section className="card mode-card morning"><h2>☀️ 朝の10問</h2><p>0:00〜11:59に開始できます。</p><button disabled={!availability.morning || completed('morning')} onClick={() => start('morning')}>{completed('morning') ? '今日は完了済み' : availability.morning ? '始める' : '今は開始できません'}</button></section><section className="card mode-card night"><h2>🌙 夜の10問</h2><p>15:00〜23:59に開始。朝の間違いを優先します。</p><button disabled={!availability.night || completed('night')} onClick={() => start('night')}>{completed('night') ? '今日は完了済み' : availability.night ? '始める' : '今は開始できません'}</button></section><section className="card mode-card infinite"><h2>🚂 無限列車編</h2><p>いつでも、好きなだけ。回答ごとに暗記度を保存します。</p><button onClick={() => start('infinite')}>始める</button></section></div>{availability.waiting && <p className="notice">12:00〜14:59は朝夜の新規開始時間外です。無限列車編は開始できます。</p>}</>
  return <section className="quiz-screen"><div className="quiz-progress"><span>{mode === 'infinite' ? `${index + 1}問目` : `${index + 1} / 10`}</span><span>{question.direction === 'ja-zh' ? '日本語 → 中国語' : '中国語 → 日本語'}</span></div><article className="card question-card"><p className="eyebrow">問題</p>{question.direction === 'ja-zh' ? <h1>{question.word.meanings.join('・')}</h1> : <div><h1 lang="zh-CN">{question.word.chinese}</h1><p className="pinyin">{question.word.pinyin}</p><button className="icon-button" onClick={() => speak(question.word.chinese)}>🔊</button></div>}<div className="choices">{question.choices.map((choice) => <button disabled={!!feedback} className={feedback ? (choice.id === question.word.id ? 'correct' : choice.id === feedback.choice.id ? 'incorrect' : '') : ''} key={choice.id} onClick={() => void choose(choice)}>{question.direction === 'ja-zh' ? <><strong lang="zh-CN">{choice.chinese}</strong><small>{choice.pinyin}</small><span className="choice-speak" onClick={(event) => { event.stopPropagation(); speak(choice.chinese) }}>🔊</span></> : choice.meanings.join('・')}</button>)}</div></article>{feedback && <article className={`card feedback ${feedback.answer.correct ? 'is-correct' : 'is-incorrect'}`}><h2>{feedback.answer.correct ? '正解！' : '不正解'}</h2><p><strong lang="zh-CN">{question.word.chinese}</strong>　{question.word.pinyin}</p><p>{question.word.meanings.join('・')}</p><p>選んだ回答：{question.direction === 'ja-zh' ? feedback.choice.chinese : feedback.choice.meanings.join('・')}</p><p>暗記度：{feedback.before}% → {Math.max(0, Math.min(100, feedback.before + (feedback.answer.correct ? 5 : -5)))}%</p><button onClick={() => speak(question.word.chinese)}>🔊 読み上げる</button><div className="actions"><button className="primary-button" onClick={() => void next(false)}>{mode !== 'infinite' && index === 9 ? '結果を見る' : '次の問題へ'}</button>{mode === 'infinite' && <button onClick={() => void next(true)}>終了して結果を見る</button>}</div></article>}</section>
}

function QuizResults({ results, speak }: { results: ResultItem[]; speak: Speak }) {
  const correct = results.filter((item) => item.answer.correct).length
  const mistakes = useMemo(() => results.filter((item) => !item.answer.correct), [results])
  return <><section className="card results"><p className="eyebrow">RESULT</p><h1>クイズ結果</h1><div className="score"><strong>{correct}</strong><span>/ {results.length} 正解</span></div><p>正答率 {results.length ? Math.round(correct / results.length * 100) : 0}%</p></section>{mistakes.length > 0 && <><h2>間違えた単語</h2>{mistakes.map((item, index) => <details className="card" key={`${item.answer.key}-${index}`}><summary><span lang="zh-CN">{item.question.word.chinese}</span>　{item.question.word.meanings.join('・')}</summary><p>{item.question.word.pinyin}</p><p>選んだ回答：{item.question.direction === 'ja-zh' ? item.choice.chinese : item.choice.meanings.join('・')}</p><p>正解：{item.question.direction === 'ja-zh' ? item.question.word.chinese : item.question.word.meanings.join('・')}</p><div className="actions"><button onClick={() => speak(item.question.word.chinese)}>🔊</button><a className="primary-button" href={`#word/${item.question.word.id}`}>単語詳細</a></div></details>)}</>}<a className="primary-button wide" href="#home">ホームに戻る</a></>
}
