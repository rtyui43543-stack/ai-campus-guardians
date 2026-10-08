import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { auditAudio, auditContent, auditLegacyReview, auditLegacyFinal, expectedAudio } from '../../scripts/check-content';
import { buildQuestionCSV, buildQuestionHTML, buildQuestionMarkdown } from '../../scripts/export-questions';
import { buildTeacherGuide } from '../../scripts/export-teacher-guide';
import { questionBank, questionById, questions, legacyReviewQuestions, legacyFinalQuestions, getQuestions, getQuestionsForHistory } from './index';
import { levels } from './levels';
import { allUltimateSpells } from './ultimateSpells';
import { getOpeningStory, getLevelStory } from './stories';
import { chooseAction, requiresReason, startSession, submitAction } from '../domain/engine';

function csvRows(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  return rows;
}

describe('12 everyday ethics missions, two final missions and teacher answer exports', () => {
  it('provides 60 main and 30 final questions while keeping 24 archived reviews out of playable content', () => {
    expect(auditContent().errors).toEqual([]);
    expect(auditContent().summary).toMatchObject({ questions: 90, uniqueIds: 90, main: 60, final: 30, variations: 0, legacyVariations: 24, legacyFinals: 30, beginnerLevels: 6, advancedLevels: 6, finalLevels: 2, tradeoffs: 1 });
    for (let theme = 1; theme <= 6; theme++) {
      const pair = levels.filter(level => level.chapterId === theme && !level.finalBoss);
      expect(pair.map(level => level.mode)).toEqual(['starter', 'advanced']);
      expect(pair[0].id + 6).toBe(pair[1].id);
      expect(getQuestions(pair[0].id).map(q => q.prompt)).not.toEqual(getQuestions(pair[1].id).map(q => q.prompt));
    }
    expect(legacyReviewQuestions).toHaveLength(24);
    expect(auditLegacyReview().errors).toEqual([]);
    expect(questionById.size).toBe(144);
    expect(questions.some(q => q.variantOf)).toBe(false);
    expect(getQuestions(1, true).map(q => q.id)).toEqual(['V2L01Q06', 'V2L01Q07']);
    expect(getQuestions(13, true)).toEqual([]);
  });

  it('uses fifteen independent new scenarios from all six themes in each final mission', () => {
    const main = questions.filter(q => q.levelId <= 12);
    for (const level of levels.filter(level => level.finalBoss)) {
      const finalQuestions = getQuestions(level.id);
      expect(finalQuestions.map(q => q.slot)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
      expect(new Set(finalQuestions.map(q => q.themeId))).toEqual(new Set([1,2,3,4,5,6]));
      expect([1,2,3,4,5,6].map(theme => finalQuestions.filter(q => q.themeId === theme).length)).toEqual([3,3,2,2,2,3]);
      for (const final of finalQuestions) {
        expect(final.id).toMatch(/^V3F(13|14)Q\d{2}$/);
        expect(final.copiedFrom).toBeUndefined();
        expect(main.some(original => original.prompt === final.prompt), final.id).toBe(false);
        expect(main.some(original => JSON.stringify(original.choices) === JSON.stringify(final.choices)), final.id).toBe(false);
      }
    }
  });

  it('rejects copied prompts and complete option sets even when punctuation or order changes', () => {
    const target = questions.find(q => q.levelId === 13)!;
    const original = questions[0];
    const duplicate = { ...target, prompt: ' ' + original.prompt.replace('？', '?? '), choices: [...original.choices].reverse() };
    const result = auditContent(questions.map(q => q.id === target.id ? duplicate : q)).errors.join('\n');
    expect(result).toContain('題幹不可與其他正式題重複');
    expect(result).toContain('整組選項');
  });

  it('preserves the exact replaced edition only for continuing sessions and historical answers', () => {
    expect(auditLegacyFinal().errors).toEqual([]);
    expect(legacyFinalQuestions).toHaveLength(30);
    for (const levelId of [13,14]) {
      const archive = getQuestionsForHistory(levelId, false, `V2L${levelId}Q01`);
      expect(archive).toHaveLength(15);
      expect(archive.every(q => q.id.startsWith(`V2L${levelId}`))).toBe(true);
      expect(getQuestions(levelId).every(q => q.id.startsWith(`V3F${levelId}`))).toBe(true);
      expect(getQuestionsForHistory(levelId, false, `V3F${levelId}Q01`)).toEqual(getQuestions(levelId));
      for (const q of archive) expect(questionById.get(q.id)).toEqual(q);
    }
  });

  it('keeps each choice directly answerable within the child reading budget', () => {
    for (const q of questions) {
      const level = levels.find(level => level.id === q.levelId)!;
      expect(q.prompt.length, q.id).toBeLessThanOrEqual(70);
      expect(q.choices).toHaveLength(4);
      q.choices.forEach(c => expect(c.text.length, q.id).toBeLessThanOrEqual(30));
      if (!level.finalBoss) expect(requiresReason(startSession(level.id, level.mode))).toBe(false);
    }
  });

  it('rejects missing choice feedback, illegal answers and a review pointing to itself', () => {
    const original = questionById.get('V2L01Q06')!;
    const broken = { ...original, variantOf: original.id, valid: { 9: [0] }, choices: original.choices.map((c, i) => i === 0 ? { ...c, feedback: '' } : c) };
    const errors = auditLegacyReview([broken]).errors.join('\n');
    expect(errors).toContain('變式需指向');
    expect(errors).toContain('判定表不合法');
    expect(errors).toContain('針對性回饋為空');
  });

  it('accepts both complete participation plans and rejects excluding students without equipment', () => {
    const scene = { ...startSession(12, 'advanced'), questionIds: ['V2L12Q03'], index: 0 };
    expect(submitAction(chooseAction(scene, 1)).success).toBe(true);
    expect(submitAction(chooseAction(scene, 3)).success).toBe(true);
    expect(submitAction(chooseAction(scene, 0)).success).toBe(false);
    expect(submitAction(chooseAction(scene, 2)).success).toBe(false);
  });

  it('marks all deepfake cases as extensions and avoids treating appearance or a detector as proof', () => {
    expect(questions.filter(q => q.levelId === 4 || q.levelId === 10).every(q => q.source.label === 'extension')).toBe(true);
    const visual = questionById.get('V2L04Q06')!;
    expect(visual.choices[1].text).toContain('查原來源');
    const detector = questionById.get('V2L10Q03')!;
    expect(detector.choices[3].text).toContain('先不指控');
    expect(detector.explanation).toContain('可能出錯');
    expect(questionBank.notes.join('')).toContain('不宣稱原教材');
  });

  it('exports current main/final choices and answers without archived review rows and with an Excel UTF-8 BOM', () => {
    const csv = buildQuestionCSV();
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const rows = csvRows(csv); const header = rows.shift()!;
    expect(rows).toHaveLength(90);
    for (const row of rows) {
      const q = questionBank.questions.find(q => q.id === row[header.indexOf('題目ID')])!;
      expect(row[header.indexOf('題目')]).toBe(q.prompt);
      q.choices.forEach((choice, i) => expect(row[header.indexOf('選項' + 'ABCD'[i])]).toBe(choice.text));
      expect(row[header.indexOf('正確選項')]).toBe(q.correct.map(i => 'ABCD'[i]).join('、'));
    }
    for (const legacy of [...legacyReviewQuestions, ...legacyFinalQuestions]) expect(rows.some(row => row[header.indexOf('題目ID')] === legacy.id)).toBe(false);
    expect(buildQuestionHTML()).toContain('綜合第15題');
    expect(buildQuestionHTML()).not.toContain('複習第');
  });

  it('preserves commas, quotes and line breaks during CSV editing and escapes HTML content', () => {
    const modified = structuredClone(questionBank);
    modified.questions[0].prompt = '提問,"含引號"\n<新行>'; 
    const row = csvRows(buildQuestionCSV(modified))[1];
    expect(row[7]).toBe(modified.questions[0].prompt);
    const html = buildQuestionHTML(modified);
    expect(html).toContain('&quot;含引號&quot;');
    expect(html).toContain('&lt;新行&gt;');
    expect(html).not.toContain('<新行>');
  });

  it('keeps downloadable teacher files synchronized with the canonical editable JSON', () => {
    for (const folder of ['docs/題庫與答案', 'public/teacher']) {
      expect(readFileSync(folder + '/question-list.csv', 'utf8')).toBe(buildQuestionCSV());
      expect(readFileSync(folder + '/question-list.md', 'utf8')).toBe(buildQuestionMarkdown());
      expect(readFileSync(folder + '/question-list.html', 'utf8')).toBe(buildQuestionHTML());
      expect(JSON.parse(readFileSync(folder + '/question-bank.json', 'utf8'))).toEqual(questionBank);
    }
  });

  it('derives teacher spell effects from both current spell tiers and explains final boss damage separately', () => {
    const guide = buildTeacherGuide();
    for (const spell of allUltimateSpells) {
      expect(guide).toContain(spell.name);
      expect(guide).toContain(spell.description);
      expect(guide).toContain(spell.effectDescription);
    }
    expect(guide).toContain('最終魔王的基本反擊20HP');
    expect(guide).toContain('連續答錯達2次');
    expect(guide).toContain('單次原始傷害最多30HP');
    expect(guide).toContain('主題魔王攻擊12HP／最終魔王20HP');
    expect(guide).not.toContain('最終題保留<code>copiedFrom</code>');
    expect(guide).toContain('V3F13Q01–15');
  });

  it('generates only the mission’s actual difficulty narration and speaks all four choices', () => {
    const { index, utterances } = expectedAudio();
    expect(index['V2L01Q01.starter.prompt']).toBeTruthy();
    expect(index['V2L01Q01.advanced.prompt']).toBeUndefined();
    expect(index['V2L07Q01.advanced.prompt']).toBeTruthy();
    expect(Object.keys(index).some(key => key.includes('.reason'))).toBe(false);
    const firstFile = index['V2L01Q01.starter.prompt'].slice('/audio/'.length);
    expect(utterances.get(firstFile)).toContain('選項 D。');
  });

  it('has every current narration key linked to a matching offline MP3', () => {
    const result = auditAudio();
    expect(result.errors).toEqual([]);
    expect(result.summary.keys).toBe(906);
    expect(result.summary.clips).toBe(696);
  });

  it('includes 46 offline story narrations, new final clips, and preserved keys for the old final edition', () => {
    const { index, utterances } = expectedAudio();
    const offlineIndex = JSON.parse(readFileSync('public/audio/index.json', 'utf8')) as Record<string, string>;
    const beats = [...getOpeningStory(), ...levels.flatMap(level => getLevelStory(level.id))];
    const storyKeys = Object.keys(index).filter(key => key.startsWith('story.'));
    expect(storyKeys).toHaveLength(46);
    expect(storyKeys.sort()).toEqual(beats.map(beat => 'story.' + beat.id).sort());
    expect(Object.keys(index).filter(key => !key.startsWith('story.'))).toHaveLength(860);
    for (const beat of beats) {
      const key = 'story.' + beat.id;
      expect(offlineIndex[key], beat.id).toBe(index[key]);
      const file = index[key].slice('/audio/'.length);
      expect(utterances.get(file), beat.id).toBe(beat.speaker + '：' + beat.text.replace(/\bAI\b/g, '人工智慧'));
    }
    for (const level of levels.filter(level => level.finalBoss)) for (const final of legacyFinalQuestions.filter(q => q.levelId === level.id)) {
      expect(index[`${final.id}.${level.mode}.prompt`]).toBe(index[`${final.copiedFrom}.${level.mode}.prompt`]);
      expect(index[`${final.id}.${level.mode}.explanation`]).toBe(index[`${final.copiedFrom}.${level.mode}.explanation`]);
    }
    const mainPrompts = new Set(questions.filter(q => q.levelId <= 12).map(q => index[`${q.id}.${levels.find(l => l.id === q.levelId)!.mode}.prompt`]));
    for (const q of questions.filter(q => q.levelId >= 13)) expect(mainPrompts.has(index[`${q.id}.${levels.find(l => l.id === q.levelId)!.mode}.prompt`]), q.id).toBe(false);
    for (const legacy of legacyReviewQuestions) expect(Object.keys(index).some(key => key.startsWith(legacy.id + '.'))).toBe(false);
  });

  it('detects an existing MP3 attached to the wrong question text', () => {
    const { index } = expectedAudio();
    const broken = { ...index, 'V2L07Q01.advanced.prompt': index['V2L01Q01.starter.prompt'] };
    expect(auditAudio({ indexOverride: broken }).errors).toContain('V2L07Q01.advanced.prompt音訊未對應最新題目文字。');
  });
});
