import { pinyin } from 'pinyin-pro'
import { Converter } from 'opencc-js/t2cn'
const simplify = Converter({ from: 't', to: 'cn' })
// Use simplified text only for pronunciation lookup; never rewrite the user's text here.
export const generatePinyin = (text: string) => pinyin(simplify(text), { toneType: 'symbol', type: 'array' }).join(' ')
export function simplifiedSuggestion(text: string): string | null {
  const converted = simplify(text)
  return converted === text ? null : converted
}
