import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { Progress } from '../domain/types';
import '../styles/reset-progress.css';

export function ResetProgress({ progress, onReset, onExportBackup }: {
  progress: Progress; onReset: () => Promise<void>; onExportBackup: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <section className="surface reset-progress-section" aria-labelledby="reset-progress-heading">
    <div className="reset-progress-title"><RotateCcw size={27} /><h2 id="reset-progress-heading">全域進度重置</h2></div>
    <p>想從零開始體驗完整冒險？可以一起重置初階、進階的學習進度，再從封面與開場故事出發。</p>
    <p className="reset-progress-keep"><ShieldCheck size={22} />已下載的離線內容、音樂與動態偏好會保留。</p>
    <button className="button reset-progress-entry" onClick={() => setOpen(true)}><RotateCcw size={22} />從零開始・重置全部進度</button>
    {open && <ResetProgressDialog completed={progress.completed.length} onClose={() => setOpen(false)} onReset={onReset} onExportBackup={onExportBackup} />}
  </section>;
}

export function ResetProgressDialog({ completed, onClose, onReset, onExportBackup }: {
  completed: number; onClose: () => void; onReset: () => Promise<void>; onExportBackup: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal(); cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);
  const reset = async () => {
    if (!confirmed || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await onReset(); onClose(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : '重置未能保存，原進度仍保留。請再試一次。');
      busyRef.current = false; setBusy(false);
    }
  };
  return <dialog ref={dialogRef} className="reset-progress-dialog" aria-labelledby="reset-confirm-title" aria-describedby="reset-confirm-description"
    onCancel={event => { event.preventDefault(); if (!busyRef.current) onClose(); }}>
    <div className="reset-confirm-top"><h2 id="reset-confirm-title">確定要重置全部學習進度嗎？</h2><button type="button" className="reset-close" disabled={busy} aria-label="取消進度重置" onClick={onClose}><X size={25} /></button></div>
    <p id="reset-confirm-description">目前完成 {completed}／14 關。重置會清除這台裝置上兩組關卡的以下紀錄：</p>
    <ul className="reset-clear-list">
      <li>全部 14 關的通關進度與最終魔王解鎖</li>
      <li>所有闖關成績、逐題作答與待練習紀錄</li>
      <li>初階與進階必殺技、收藏卡與能力徽章</li>
      <li>守護提案、故事觀看標記及中途挑戰存檔</li>
    </ul>
    <p className="reset-retain-note"><ShieldCheck size={24} />離線下載內容及使用偏好會保留，不需重新下載。</p>
    <button type="button" className="button reset-backup" disabled={busy} onClick={onExportBackup}><Download size={23} />先匯出目前進度備份</button>
    <label className="reset-confirm-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>我了解紀錄將清空；需要時只能用先前匯出的備份還原。</span></label>
    {error && <p className="reset-error" role="alert">{error}</p>}
    <div className="reset-confirm-actions"><button ref={cancelRef} type="button" className="button reset-cancel" disabled={busy} onClick={onClose}>取消，保留進度</button>
      <button type="button" className="button reset-confirm" disabled={!confirmed || busy} onClick={() => { void reset(); }}>{busy ? '正在保存重置…' : '確認重置・回到封面'}</button></div>
  </dialog>;
}
