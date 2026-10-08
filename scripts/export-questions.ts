import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionBank } from '../src/content';
import { sourceLabels } from '../src/content/levels';
import { auditContent } from './check-content';

type Bank = typeof questionBank;
const letters = 'ABCD';
const modeName = (mode: string) => mode === 'starter' ? '初階' : '進階';
const levelLabel = (level: Bank['levels'][number]) => level.finalBoss ? `${modeName(level.mode)}最終關` : `${modeName(level.mode)}第 ${(level.id - 1) % 6 + 1} 關`;
const questionLabel = (slot: number, finalBoss = false) => `${finalBoss ? '綜合' : '主要'}第${slot}題`;
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const sourceText = (q: Bank['questions'][number]) => `${sourceLabels[q.source.label as keyof typeof sourceLabels]}；教材單元 ${q.source.units.join('、')}，印刷 p${q.source.pages}`;
const answerLetters = (q: Bank['questions'][number]) => q.correct.map(i => letters[i]).join('、');

export function buildQuestionCSV(bank: Bank = questionBank) {
  const header = ['難度', '關卡編號', '主題', '關卡名稱', '題目類型', '題目ID', '題次', '題目', '選項A', '選項B', '選項C', '選項D', '正確選項', '正確答案文字', '解析', '提示', '選項A回饋', '選項B回饋', '選項C回饋', '選項D回饋', '教材單元', '印刷頁碼', '來源標籤', '原主要題ID', '學習目標'];
  const rows = bank.questions.map(q => {
    const level = bank.levels.find(level => level.id === q.levelId)!;
    const chapter = bank.chapters.find(chapter => chapter.id === (q.themeId ?? level.chapterId))!;
    return [modeName(level.mode), q.levelId, chapter.title, level.title, level.finalBoss ? '最終綜合挑戰' : '主要挑戰', q.id, q.slot, q.prompt,
      ...q.choices.map(choice => choice.text), answerLetters(q), q.correct.map(i => q.choices[i].text).join('／'), q.explanation, q.hint,
      ...q.choices.map(choice => choice.feedback), q.source.units.join('、'), q.source.pages, sourceLabels[q.source.label as keyof typeof sourceLabels], q.copiedFrom ?? '', q.objective];
  });
  const cell = (value: string | number | undefined) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return '\ufeff' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function buildQuestionMarkdown(bank: Bank = questionBank) {
  const out = [`# ${bank.title}：教師題庫與答案`, '', '本表由遊戲使用的 question-bank.json 自動產生。初階與進階各6個主題關＋1個最終關；主題關各5題，最終關各15題，共90題現行正式挑戰。歷史複習題不列入本表。', '', '每題直接選一個選項即可。列出多個正確字母的題目，表示其中每個選項都是完整合理方案，學生選其中一個就能通過。', '', '## 編修方式', '', '修改 src/content/question-bank.json 的 prompt、choices、correct、hint、explanation。correct 使用 0=A、1=B、2=C、3=D。保持 ID、levelId、slot 的對應關係；最終題保留 copiedFrom 原主要題ID及 themeId 原主題。歷史複習封存在 legacy-review-bank.json，不能作為新挑戰題目。', '', '修改後執行 npm run content:export、npm run audio:manifest、npm run audio:generate，更新語音後執行 npm run content:check、npm run build。這份 CSV 與 HTML 是檢視與編修對照表，遊戲的正式資料來源是 JSON；直接修改匯出的 CSV 不會自動改動遊戲。', '', '## 來源與範圍', '', ...bank.notes.map(note => '- ' + note), '', '深偽題的單元三頁碼只對應聲音辨識的教材背景；深偽查證本身屬倫理延伸。生成式 AI 學習誠實、資料最少化及公平也按題目標為延伸。所有案例為原創虛構學習情境。', '', '## 正確選項速查', '', '| 難度 | 關卡 | 名稱 | 題數 | 正確選項（依題次） |', '|---|---|---|---|---|'];
  for (const level of bank.levels) {
    const qs = bank.questions.filter(q => q.levelId === level.id);
    out.push(`| ${modeName(level.mode)} | ${level.id} | ${level.title} | ${qs.length} | ${qs.map(answerLetters).join('／')} |`);
  }
  for (const level of bank.levels) {
    const chapter = bank.chapters.find(chapter => chapter.id === level.chapterId)!;
    out.push('', `## ${levelLabel(level)}（關卡 ${level.id}）：${level.title}`, '', `**主題：${level.finalBoss ? '六主題綜合' : chapter.title}**　${level.objective}`, '');
    for (const q of bank.questions.filter(q => q.levelId === level.id)) {
      out.push(`### ${questionLabel(q.slot, level.finalBoss)}　${q.id}`, '', q.prompt, '', ...q.choices.map((choice, i) => `- ${letters[i]}．${choice.text}`), '', `**正確選項：${answerLetters(q)}**`, '', `解析：${q.explanation}`, '', `提示：${q.hint}`, '', '各選項回饋：', '', ...q.choices.map((choice, i) => `- ${letters[i]}：${choice.feedback}`), '', `來源：${sourceText(q)}`, ...(q.copiedFrom ? ['', `原主要題：${q.copiedFrom}；主題 ${q.themeId}`] : []), '');
    }
  }
  out.push('## 倫理延伸參考', '', ...bank.references.map(reference => 'url' in reference ? `- [${reference.title}](${reference.url})` : '- ' + reference.title), '');
  return out.join('\n');
}

export function buildQuestionHTML(bank: Bank = questionBank) {
  const summary = bank.levels.map(level => {
    const qs = bank.questions.filter(q => q.levelId === level.id);
    return `<tr><td>${modeName(level.mode)}</td><td><a href="#level-${level.id}">${level.id}．${escapeHtml(level.title)}</a></td><td>${qs.length}</td><td>${qs.map(answerLetters).join('／')}</td></tr>`;
  }).join('');
  const missions = bank.levels.map(level => {
    const chapter = bank.chapters.find(chapter => chapter.id === level.chapterId)!;
    const content = bank.questions.filter(q => q.levelId === level.id).map(q => `<article><h3>${questionLabel(q.slot, level.finalBoss)} <small>${q.id}</small></h3><p class="prompt">${escapeHtml(q.prompt)}</p><ol type="A">${q.choices.map(choice => `<li>${escapeHtml(choice.text)}</li>`).join('')}</ol><p class="correct">正確選項：<strong>${answerLetters(q)}</strong></p><p><b>解析：</b>${escapeHtml(q.explanation)}</p><p><b>提示：</b>${escapeHtml(q.hint)}</p><div class="feedback">${q.choices.map((choice, i) => `<p><b>${letters[i]} 回饋：</b>${escapeHtml(choice.feedback)}</p>`).join('')}</div><p class="source">${escapeHtml(sourceText(q))}${q.copiedFrom ? `；原主要題 ${q.copiedFrom}，主題 ${q.themeId}` : ''}</p></article>`).join('');
    return `<section id="level-${level.id}"><h2>${levelLabel(level)}（關卡 ${level.id}）：${escapeHtml(level.title)}</h2><p><b>${escapeHtml(level.finalBoss ? '六主題綜合' : chapter.title)}</b>　${escapeHtml(level.objective)}</p>${content}</section>`;
  }).join('');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 校園守護隊：教師題庫與答案</title><style>body{margin:0;background:#eef3ef;color:#243f3b;font:16px/1.7 "Microsoft JhengHei",sans-serif}main{max-width:940px;margin:24px auto;padding:32px;background:white;border-radius:16px}h1{font-size:28px}h2{margin-top:38px;border-bottom:2px solid #80aaa0;padding-bottom:8px}h3{margin:0;font-size:17px}small,.source{font-size:12px;color:#657a73}article{border:1px solid #cddbd4;border-radius:10px;margin:20px 0;padding:20px;break-inside:avoid}.prompt{font-weight:700}.correct{padding:8px 14px;background:#e4f4e9;color:#236549;border-radius:6px}.feedback{font-size:14px}.feedback p{margin:6px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #d7e2dc}button,a{color:#246d5c}button{padding:10px 16px;background:#e7f4ed;border:1px solid #83b29e;border-radius:8px;cursor:pointer}a{text-decoration:none}@media print{body{background:white;font-size:12px}main{max-width:none;margin:0;padding:0}button{display:none}h1{font-size:20px}h2{font-size:17px;break-before:page}article{margin:12px 0;padding:12px}.feedback{font-size:11px}.source{font-size:10px}a{color:inherit}}@media(max-width:600px){main{margin:0;padding:18px;border-radius:0}h1{font-size:24px}td,th{padding:6px;font-size:13px}}</style></head><body><main><button onclick="window.print()">列印題目與答案</button><h1>${escapeHtml(bank.title)}<br>教師題庫與答案</h1><p>初階與進階各6個主題關＋1個最終關；主題關各5題，最終關各15題，共90題現行正式挑戰。每題選一個選項即可；若列出多個正確字母，表示每個方案各自完整合理。</p><p>此檔由正式題庫 JSON 自動產生。要修改遊戲，請編修 question-bank.json；correct 使用 0=A、1=B、2=C、3=D。CSV 是編修對照清單，修改 CSV 不會自動改動遊戲。</p><p>編修後重新匯出題表、生成最新語音、檢查內容和建置離線包。完整命令與注意事項見 question-list.md。</p><ul>${bank.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul><h2>正確選項速查</h2><table><thead><tr><th>難度</th><th>關卡</th><th>題數</th><th>正確選項（依題次）</th></tr></thead><tbody>${summary}</tbody></table>${missions}<h2>倫理延伸參考</h2><ul>${bank.references.map(reference => `<li>${'url' in reference ? `<a href="${escapeHtml(reference.url!)}">${escapeHtml(reference.title)}</a>` : escapeHtml(reference.title)}</li>`).join('')}</ul></main></body></html>`;
}

export function exportQuestions(root = process.cwd()) {
  const result = auditContent();
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const outputs: Record<string, string> = {
    'question-bank.json': JSON.stringify(questionBank, null, 2) + '\n',
    'question-list.csv': buildQuestionCSV(),
    'question-list.md': buildQuestionMarkdown(),
    'question-list.html': buildQuestionHTML(),
  };
  for (const folder of ['docs/題庫與答案', 'public/teacher']) {
    mkdirSync(resolve(root, folder), { recursive: true });
    for (const [name, content] of Object.entries(outputs)) writeFileSync(resolve(root, folder, name), content, 'utf8');
  }
  return Object.keys(outputs);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log('Teacher exports: ' + exportQuestions().join(', '));
