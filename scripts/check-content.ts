import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { questions, presentQuestion, questionBank } from '../src/content';
import { chapters, levels } from '../src/content/levels';
import { getOpeningStory, getLevelStory } from '../src/content/stories';
import type { Question } from '../src/domain/types';

export interface AuditResult { errors: string[]; summary: Record<string, number> }

export function auditContent(items: readonly Question[] = questions): AuditResult {
  const errors: string[] = [];
  const ids = new Set(items.map(q => q.id));
  if (items.length !== 84 || ids.size !== 84) errors.push('題庫必須有84個不重複題目ID。');
  const main = items.filter(q => q.slot <= 5).length;
  const variations = items.filter(q => q.slot > 5).length;
  if (main !== 60 || variations !== 24) errors.push('主要情境必須60題、變式必須24題。');
  if (levels.length !== 12 || chapters.length !== 6 || questionBank.schemaVersion !== 2) errors.push('需要第2版題庫、12關和6個主題。');
  for (const mode of ['starter', 'advanced']) if (levels.filter(level => level.mode === mode).length !== 6) errors.push(mode + '必須各有6關。');
  for (let level = 1; level <= 12; level++) {
    const slots = items.filter(q => q.levelId === level).map(q => q.slot).sort((a, b) => a - b);
    if (slots.join(',') !== '1,2,3,4,5,6,7') errors.push(`第${level}關必須各有slot1–7。`);
    const mission = levels.find(item => item.id === level);
    if (mission?.mode !== (level <= 6 ? 'starter' : 'advanced') || mission.chapterId !== (level - 1) % 6 + 1) errors.push(`第${level}關的難度或主題不符。`);
  }
  const answerPositions = new Set<number>();
  for (const q of items) {
    const prefix = `${q.id}：`;
    if (q.id !== `V2L${String(q.levelId).padStart(2, '0')}Q${String(q.slot).padStart(2, '0')}`) errors.push(prefix + 'ID與关卡/題次不符。');
    if (!q.prompt.trim() || !q.objective.trim() || !q.explanation.trim() || !q.hint.trim()) errors.push(prefix + '題幹、目標、解析或提示缺漏。');
    if (q.prompt.length > 70 || q.hint.length > 60 || q.explanation.length > 100) errors.push(prefix + '超過生活化題目閱讀預算。');
    if (!q.source || !q.source.units.length || !q.source.pages.trim() || !['textbook', 'extension', 'mixed'].includes(q.source.label)) errors.push(prefix + '缺少有效來源。');
    else {
      if (q.source.units.some(unit => !Number.isInteger(unit) || unit < 1 || unit > 18)) errors.push(prefix + '教材單元超出1–18。');
      const pageNumbers = q.source.pages.match(/\d+/g)?.map(Number) ?? [];
      if (!pageNumbers.length || pageNumbers.some(page => page < 1 || page > 185)) errors.push(prefix + '來源需使用教材印刷頁碼1–185。');
      for (const range of q.source.pages.matchAll(/(\d+)\s*[–－-]\s*(\d+)/g)) if (Number(range[1]) > Number(range[2])) errors.push(prefix + '教材頁碼範圍倒置。');
    }
    if ((q.levelId === 4 || q.levelId === 10) && q.source.label !== 'extension') errors.push(prefix + '深偽必須標為倫理延伸，不宣稱原教材有深偽內容。');
    if (q.slot > 5) {
      const expected = `V2L${String(q.levelId).padStart(2, '0')}Q${q.slot === 6 ? '03' : '05'}`;
      if (q.variantOf !== expected || !ids.has(expected) || q.variantOf === q.id) errors.push(prefix + '變式需指向同關第3或第5個主題。');
    } else if (q.variantOf !== undefined) errors.push(prefix + '主要題不可被標為變式。');
    const mission = levels.find(item => item.id === q.levelId);
    if (!mission) { errors.push(prefix + '不存在的關卡。'); continue; }
    const p = presentQuestion(q, mission.mode);
    if (p.choices.length !== 4) errors.push(prefix + '需要4個可直接選取的選項。');
    for (const choice of p.choices) {
      if (!choice.text.trim() || !choice.feedback.trim()) errors.push(prefix + '選項或針對性回饋為空。');
      if (choice.text.length > 30) errors.push(prefix + '選項超過30字。');
    }
    const actions = Object.keys(p.valid);
    if (!actions.length) errors.push(prefix + '沒有正確選項。');
    for (const [action, reasons] of Object.entries(p.valid)) {
      const position = Number(action);
      answerPositions.add(position);
      if (!Number.isInteger(position) || !p.choices[position] || reasons.join(',') !== '0') errors.push(prefix + '單步判定表不合法。');
    }
    if (p.kind === 'tradeoff' && actions.length < 2) errors.push(prefix + '取捨題必須接受至少兩個完整方案。');
    for (const evidence of p.evidence) if (!evidence.title.trim() || !evidence.body.trim()) errors.push(prefix + '證據卡有空白。');
  }
  if (items.length === 84 && answerPositions.size !== 4) errors.push('正確答案位置必須分布在A–D。');
  if (!items.some(q => q.levelId === 12 && q.slot === 3 && Object.keys(q.valid).length >= 2)) errors.push('最後合作關需接受至少兩個完整合理方案。');
  return { errors, summary: { questions: items.length, uniqueIds: ids.size, main, variations, levels: levels.length, beginnerLevels: 6, advancedLevels: 6, modes: 2, tradeoffs: items.filter(q => q.kind === 'tradeoff').length } };
}

function speechText(raw: string) { return raw.replace(/\bAI\b/g, '人工智慧').replace(/★/g, '').replace(/／/g, '，'); }
function speechFile(text: string) { return createHash('sha256').update('zh-TW-HsiaoChenNeural-rate-6-pitch-2-v2:' + text).digest('hex').slice(0, 20) + '.mp3'; }

/** One narration per actual mission difficulty, generated from the same editable bank. */
export function expectedAudio() {
  const index: Record<string, string> = {};
  const utterances = new Map<string, string>();
  const add = (key: string, raw: string) => {
    const text = speechText(raw);
    const file = speechFile(text);
    index[key] = '/audio/' + file;
    utterances.set(file, text);
  };
  for (const beat of [...getOpeningStory(), ...levels.flatMap(level => getLevelStory(level.id))]) {
    add('story.' + beat.id, beat.speaker + '：' + beat.text);
  }
  for (const level of levels) add(`level.${level.id}`, level.title + '。' + level.intro + '。這一關，' + level.objective);
  for (const chapter of chapters) add(`chapter.${chapter.id}`, chapter.title + '。' + chapter.description);
  for (const q of questions) {
    const mode = levels.find(level => level.id === q.levelId)!.mode;
    const p = presentQuestion(q, mode);
    const key = `${q.id}.${mode}`;
    add(key + '.prompt', p.prompt + '。' + p.evidence.map(e => e.title + '。' + e.body).join('。') + '。' + p.choices.map((choice, i) => `選項 ${'ABCD'[i]}。` + choice.text).join('。'));
    add(key + '.hint', p.hint);
    add(key + '.explanation', p.explanation);
    p.choices.forEach((choice, i) => add(`${key}.choice.${i}`, choice.feedback));
    p.evidence.forEach((evidence, i) => add(`${key}.evidence.${i}`, evidence.body));
  }
  return { index, utterances };
}
export function auditAudio(options: { root?: string; indexOverride?: Record<string, string> } = {}): AuditResult {
  const root = resolve(options.root ?? process.cwd());
  const audioRoot = resolve(root, 'public/audio');
  const errors: string[] = [];
  const expected = expectedAudio();
  let index: Record<string, string>;
  try { index = options.indexOverride ?? JSON.parse(readFileSync(resolve(audioRoot, 'index.json'), 'utf8')); }
  catch { return { errors: ['缺少或無法讀取public/audio/index.json，請先生成音訊清單。'], summary: { keys: 0, clips: 0, bytes: 0 } }; }
  if (!index || typeof index !== 'object' || Array.isArray(index)) return { errors: ['音訊索引格式不正確。'], summary: { keys: 0, clips: 0, bytes: 0 } };
  for (const [key, url] of Object.entries(expected.index)) if (index[key] !== url) errors.push(`${key}音訊未對應最新題目文字。`);
  for (const key of Object.keys(index)) if (!(key in expected.index)) errors.push(`${key}是未被題庫使用的音訊鍵。`);
  let bytes = 0;
  const files = new Set<string>();
  for (const url of new Set(Object.values(index))) {
    if (typeof url !== 'string' || !/^\/audio\/[a-f0-9]{20}\.mp3$/.test(url)) { errors.push('音訊路徑格式不正確：' + String(url)); continue; }
    const path = resolve(root, 'public', url.slice(1));
    if (dirname(path) !== audioRoot) { errors.push('音訊路徑越出public/audio。'); continue; }
    try {
      const stat = statSync(path);
      if (!stat.isFile() || stat.size <= 500) errors.push(`${url}缺少有效的音檔內容。`);
      else {
        const data = readFileSync(path);
        if (data.subarray(0, 3).toString() !== 'ID3' && !(data[0] === 0xff && (data[1] & 0xe0) === 0xe0)) errors.push(`${url}沒有MP3檔頭。`);
        bytes += stat.size;
        files.add(url.slice('/audio/'.length));
      }
    } catch { errors.push(`${url}檔案不存在或不能讀取。`); }
  }
  const transcriptPath = resolve(root, '.audio-work/utterances.json');
  if (existsSync(transcriptPath)) {
    try {
      const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8')) as { file: string; text: string }[];
      if (!Array.isArray(transcript) || transcript.length !== expected.utterances.size) errors.push('生成用語音文字清單數量不同。');
      else for (const item of transcript) if (expected.utterances.get(item.file) !== item.text || speechFile(item.text) !== item.file) errors.push(`${item.file}的朗讀文字或hash與目前題庫不符。`);
    } catch { errors.push('無法讀取生成用語音文字清單。'); }
  }
  try {
    for (const file of readdirSync(audioRoot)) if (/^[a-f0-9]{20}\.mp3$/.test(file) && !files.has(file)) errors.push(`${file}是無引用舊音檔，應從離線包移除。`);
  } catch { errors.push('音訊資料夾無法讀取。'); }
  return { errors, summary: { keys: Object.keys(index).length, clips: files.size, bytes, megabytes: Math.round(bytes / 1024 / 1024 * 10) / 10 } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = auditContent();
  const audio = auditAudio();
  const errors = [...content.errors, ...audio.errors];
  console.log(JSON.stringify({ content: content.summary, audio: audio.summary, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
