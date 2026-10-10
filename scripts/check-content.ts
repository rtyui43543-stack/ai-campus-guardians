import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { questions, legacyReviewQuestions, legacyFinalQuestions, legacyReasoningQuestions, legacyFiveQuestionQuestions, questionById, presentQuestion, questionBank } from '../src/content';
import { chapters, levels } from '../src/content/levels';
import { getOpeningStory, getLevelStory } from '../src/content/stories';
import type { Question } from '../src/domain/types';

export interface AuditResult { errors: string[]; summary: Record<string, number> }

export function auditContent(items: readonly Question[] = questions): AuditResult {
  const errors: string[] = [];
  const ids = new Set(items.map(q => q.id));
  if (items.length !== 84 || ids.size !== 84) errors.push('現行題庫必須有84個不重複題目ID。');
  const main = items.filter(q => !levels.find(level => level.id === q.levelId)?.finalBoss).length;
  const finals = items.filter(q => levels.find(level => level.id === q.levelId)?.finalBoss).length;
  const variations = items.filter(q => q.variantOf !== undefined).length;
  if (main !== 54 || finals !== 30 || variations !== 0) errors.push('主題關必須54題、最終關必須30題，現行題庫不提供複習變式。');
  if (levels.length !== 14 || chapters.length !== 6 || questionBank.schemaVersion !== 2) errors.push('需要第2版題庫、14關和6個主題。');
  for (const mode of ['starter', 'advanced']) {
    if (levels.filter(level => level.mode === mode && !level.finalBoss).length !== 6) errors.push(mode + '必須各有6個主題關。');
    if (levels.filter(level => level.mode === mode && level.finalBoss).length !== 1) errors.push(mode + '必須各有1個最終關。');
  }
  for (let level = 1; level <= 12; level++) {
    const slots = items.filter(q => q.levelId === level).map(q => q.slot).sort((a, b) => a - b);
    const count = level <= 6 ? 4 : 5;
    if (slots.join(',') !== Array.from({ length: count }, (_, i) => i + 1).join(',')) errors.push(`第${level}關必須各有slot1–${count}。`);
    const mission = levels.find(item => item.id === level);
    if (mission?.mode !== (level <= 6 ? 'starter' : 'advanced') || mission.chapterId !== (level - 1) % 6 + 1) errors.push(`第${level}關的難度或主題不符。`);
  }
  for (const level of levels.filter(item => item.finalBoss)) {
    const qs = items.filter(q => q.levelId === level.id);
    if (qs.map(q => q.slot).sort((a, b) => a - b).join(',') !== Array.from({ length: 15 }, (_, i) => i + 1).join(',')) errors.push(`最終關${level.id}必須有slot1–15。`);
    if (level.id !== (level.mode === 'starter' ? 13 : 14) || level.chapterId !== 6) errors.push(`最終關${level.id}的難度或設定不符。`);
    if ([3,3,2,2,2,3].some((count, index) => qs.filter(q => q.themeId === index + 1).length !== count)) errors.push(`最終關${level.id}的六主題題數必須為3、3、2、2、2、3。`);
  }
  const answerPositions = new Set<number>();
  for (const q of items) {
    const prefix = `${q.id}：`;
    const expectedId = `${q.levelId >= 13 ? 'V4F' : q.levelId <= 6 ? 'V5L' : 'V4L'}${String(q.levelId).padStart(2, '0')}Q${String(q.slot).padStart(2, '0')}`;
    if (q.id !== expectedId) errors.push(prefix + 'ID與關卡/題次不符。');
    if (!q.prompt.trim() || !q.objective.trim() || !q.explanation.trim() || !q.hint.trim()) errors.push(prefix + '題幹、目標、解析或提示缺漏。');
    if (q.prompt.length > 70 || q.hint.length > 60 || q.explanation.length > 100) errors.push(prefix + '超過生活化題目閱讀預算。');
    if (!q.source || !q.source.units.length || !q.source.pages.trim() || !['textbook', 'extension', 'mixed'].includes(q.source.label)) errors.push(prefix + '缺少有效來源。');
    else {
      if (q.source.units.some(unit => !Number.isInteger(unit) || unit < 1 || unit > 18)) errors.push(prefix + '教材單元超出1–18。');
      const pageNumbers = q.source.pages.match(/\d+/g)?.map(Number) ?? [];
      if (!pageNumbers.length || pageNumbers.some(page => page < 1 || page > 185)) errors.push(prefix + '來源需使用教材印刷頁碼1–185。');
      for (const range of q.source.pages.matchAll(/(\d+)\s*[–－-]\s*(\d+)/g)) if (Number(range[1]) > Number(range[2])) errors.push(prefix + '教材頁碼範圍倒置。');
    }
    const mission = levels.find(item => item.id === q.levelId);
    if (!mission) { errors.push(prefix + '不存在的關卡。'); continue; }
    if ((q.levelId === 4 || q.levelId === 10 || q.themeId === 4) && q.source.label !== 'extension') errors.push(prefix + '深偽必須標為倫理延伸，不宣稱原教材有深偽內容。');
    if (q.variantOf !== undefined) errors.push(prefix + '現行正式題不可被標為複習變式。');
    if (mission.finalBoss) {
      if (q.copiedFrom !== undefined) errors.push(prefix + '最終題必須是獨立新情境，不可沿用主要題。');
      if (!Number.isInteger(q.themeId) || q.themeId! < 1 || q.themeId! > 6) errors.push(prefix + '最終題需要有效的獨立主題編號。');
      const normalized = (text: string) => text.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
      const otherQuestions = items.filter(item => item.id !== q.id);
      if (otherQuestions.some(item => normalized(item.prompt) === normalized(q.prompt))) errors.push(prefix + '最終題題幹不可與其他正式題重複。');
      const answers = q.choices.map(choice => normalized(choice.text)).sort().join('|');
      if (otherQuestions.some(item => item.choices.map(choice => normalized(choice.text)).sort().join('|') === answers)) errors.push(prefix + '最終題不可沿用其他正式題的整組選項。');
    }
    const p = presentQuestion(q, mission.mode);
    if (p.choices.length !== 4) errors.push(prefix + '需要4個可直接選取的選項。');
    for (const choice of p.choices) {
      if (!choice.text.trim() || !choice.feedback.trim()) errors.push(prefix + '選項或針對性回饋為空。');
      if (choice.text.length > 30) errors.push(prefix + '選項超過30字。');
      if (!choice.action?.trim() || !choice.rationale?.trim()) errors.push(prefix + '每個選項都需要具體做法與理由。');
      else if (choice.text !== `${choice.action}，${choice.rationale}`) errors.push(prefix + '選項文字必須與做法及理由一致。');
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
  errors.push(...auditLegacyReview().errors);
  errors.push(...auditLegacyFinal().errors);
  errors.push(...auditLegacyReasoning().errors);
  errors.push(...auditLegacyFiveQuestion().errors);
  return { errors, summary: { questions: items.length, uniqueIds: ids.size, main, final: finals, variations, legacyVariations: legacyReviewQuestions.length, legacyFinals: legacyFinalQuestions.length, legacyReasoning: legacyReasoningQuestions.length, legacyFiveQuestion: legacyFiveQuestionQuestions.length, levels: levels.length, beginnerLevels: 6, advancedLevels: 6, finalLevels: 2, modes: 2, tradeoffs: items.filter(q => q.kind === 'tradeoff').length } };
}

/** Retain every original starter choice and its five-question denominator. */
export function auditLegacyFiveQuestion(items: readonly Question[] = legacyFiveQuestionQuestions): AuditResult {
  const errors: string[] = [];
  if (items.length !== 30 || new Set(items.map(q => q.id)).size !== 30) errors.push('初階五題版應封存完整30題。');
  for (let level = 1; level <= 6; level++) {
    if (items.filter(q => q.levelId === level).map(q => q.slot).join(',') !== '1,2,3,4,5') errors.push(`歷史初階第${level}關應保留完整五題題序。`);
  }
  for (const q of items) {
    const expected = `V4L${String(q.levelId).padStart(2, '0')}Q${String(q.slot).padStart(2, '0')}`;
    if (q.levelId > 6 || q.id !== expected || questions.some(current => current.id === q.id)) errors.push(q.id + '：初階五題版不可進入新開題庫。');
  }
  return { errors, summary: { legacyFiveQuestion: items.length } };
}

/** Keep each prior edition separate; never reinterpret old chosen indices. */
export function auditLegacyReasoning(items: readonly Question[] = legacyReasoningQuestions): AuditResult {
  const errors: string[] = [];
  if (items.length !== 90 || new Set(items.map(q => q.id)).size !== 90) errors.push('做法理由改版前應封存完整90題。');
  for (const level of levels) {
    const archived = items.filter(q => q.levelId === level.id);
    const count = level.finalBoss ? 15 : 5;
    if (archived.map(q => q.slot).join(',') !== Array.from({ length: count }, (_, i) => i + 1).join(',')) errors.push(`歷史第${level.id}關應保留完整題序。`);
  }
  for (const q of items) {
    const expected = `${q.levelId >= 13 ? 'V3F' : 'V2L'}${String(q.levelId).padStart(2, '0')}Q${String(q.slot).padStart(2, '0')}`;
    if (q.id !== expected || questions.some(current => current.id === q.id)) errors.push(q.id + '：舊版選項不可進入新開題庫。');
  }
  return { errors, summary: { legacyReasoning: items.length } };
}

/** The replaced final edition is immutable historical source material, never new-play content. */
export function auditLegacyFinal(items: readonly Question[] = legacyFinalQuestions): AuditResult {
  const errors: string[] = [];
  const ids = new Set(items.map(q => q.id));
  if (items.length !== 30 || ids.size !== 30) errors.push('歷史最終關封存應保留30個不重複題目ID。');
  for (const levelId of [13,14]) if (items.filter(q => q.levelId === levelId).map(q => q.slot).sort((a,b) => a-b).join(',') !== Array.from({length:15}, (_,i)=>i+1).join(',')) errors.push(`歷史最終關${levelId}應保留完整15題。`);
  for (const q of items) {
    if (q.id !== `V2L${q.levelId}Q${String(q.slot).padStart(2, '0')}` || questions.some(item => item.id === q.id)) errors.push(q.id + '：封存最終題不可進入現行題庫。');
    const original = questionById.get(q.copiedFrom ?? '');
    if (!original || original.prompt !== q.prompt || JSON.stringify(original.choices) !== JSON.stringify(q.choices) || JSON.stringify(original.valid) !== JSON.stringify(q.valid)) errors.push(q.id + '：封存答案應保留原版內容。');
  }
  return { errors, summary: { legacyFinals: items.length, uniqueIds: ids.size } };
}

/** Archived answers remain resolvable without reintroducing a playable review bank. */
export function auditLegacyReview(items: readonly Question[] = legacyReviewQuestions): AuditResult {
  const errors: string[] = [];
  const ids = new Set(items.map(q => q.id));
  if (items.length !== 24 || ids.size !== 24) errors.push('歷史複習封存應保留24個不重複題目ID。');
  for (let level = 1; level <= 12; level++) {
    if (items.filter(q => q.levelId === level).map(q => q.slot).sort().join(',') !== '6,7') errors.push(`歷史第${level}關應保留slot6、7。`);
  }
  for (const q of items) {
    const prefix = `${q.id}：`;
    const expected = `V2L${String(q.levelId).padStart(2, '0')}Q${q.slot === 6 ? '03' : '05'}`;
    if (q.variantOf !== expected || !questionById.has(expected) || q.variantOf === q.id) errors.push(prefix + '歷史變式需指向同關第3或第5個主題。');
    if (questions.some(item => item.id === q.id)) errors.push(prefix + '歷史題不可回到現行題庫。');
    if (q.choices.some(choice => !choice.text.trim() || !choice.feedback.trim())) errors.push(prefix + '選項或針對性回饋為空。');
    for (const [action, reasons] of Object.entries(q.valid)) if (!Number.isInteger(Number(action)) || !q.choices[Number(action)] || reasons.join(',') !== '0') errors.push(prefix + '單步判定表不合法。');
  }
  return { errors, summary: { legacyQuestions: items.length, uniqueIds: ids.size } };
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
  // Saved sessions use the exact text and narration from their editorial edition.
  for (const q of [...questions, ...legacyReasoningQuestions, ...legacyFinalQuestions, ...legacyFiveQuestionQuestions]) {
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
