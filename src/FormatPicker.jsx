const outputs = ['Video', 'Short film', 'Animation', 'Still image', 'Carousel', '3D render', 'Audio', 'Presentation', 'Mixed media', 'Other']
const ratios = [
  ['9:16', 'Vertical'], ['16:9', 'Widescreen'], ['1:1', 'Square'], ['4:5', 'Social portrait'],
  ['3:2', 'Landscape'], ['2:3', 'Portrait'], ['21:9', 'Cinematic'], ['A4 portrait', 'Print portrait'],
  ['A4 landscape', 'Print landscape'], ['Flexible', 'Decide together'],
]
const durations = ['6s', '15s', '30s', '60s', '2–5 min', 'Flexible']

export function normalizeFormat(value = '', contentType = '') {
  const source = `${value} ${contentType}`.toLowerCase()
  if (!source.trim()) return ''
  const output = outputs.find(item => source.includes(item.toLowerCase()))
    || (/(film|movie)/.test(source) ? 'Short film' : /(photo|image|graphic|poster)/.test(source) ? 'Still image' : /(motion|animated)/.test(source) ? 'Animation' : /(video|reel|clip)/.test(source) ? 'Video' : 'Other')
  const ratio = ratios.find(([item]) => source.includes(item.toLowerCase()))?.[0] || 'Flexible'
  const duration = durations.find(item => source.includes(item.toLowerCase()))
    || (/(\b30\s*(second|sec)\b)/.test(source) ? '30s' : /(\b15\s*(second|sec)\b)/.test(source) ? '15s' : '')
  return [output, ratio, duration].filter(Boolean).join(' · ')
}

export function formatComplete(value) {
  const [output, ratio] = value.split(' · ')
  return outputs.includes(output) && ratios.some(([item]) => item === ratio)
}

export default function FormatPicker({ value, onChange, id = 'format', optional = false }) {
  const [output = '', ratio = '', duration = ''] = value.split(' · ')
  const change = (nextOutput, nextRatio, nextDuration = duration) => {
    const parts = [nextOutput, nextRatio, nextDuration]
    while (parts.length && !parts.at(-1)) parts.pop()
    onChange(parts.join(' · '))
  }
  return <div className="format-picker" id={id}>
    <fieldset><legend>Output format {optional && <small>(optional)</small>}</legend><div className="format-options">{outputs.map(item => <button type="button" key={item} className={output === item ? 'selected' : ''} aria-pressed={output === item} onClick={() => change(item, ratio)}>{item}</button>)}</div></fieldset>
    <fieldset><legend>Aspect ratio {optional && <small>(optional)</small>}</legend><div className="format-options">{ratios.map(([item, label]) => <button type="button" key={item} className={ratio === item ? 'selected' : ''} aria-pressed={ratio === item} onClick={() => change(output, item)}><strong>{item}</strong><small>{label}</small></button>)}</div></fieldset>
    <fieldset><legend>Duration <small>(optional)</small></legend><div className="format-options">{durations.map(item => <button type="button" key={item} className={duration === item ? 'selected' : ''} aria-pressed={duration === item} onClick={() => change(output, ratio, duration === item ? '' : item)}>{item}</button>)}</div></fieldset>
  </div>
}
