import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createProgress } from '../domain/engine';
import { ResetProgress, ResetProgressDialog } from './ResetProgress';

describe('reset progress confirmation', () => {
  it('shows a separate settings entry without resetting or exporting on initial render', () => {
    const onReset = vi.fn(async () => {}), onExportBackup = vi.fn();
    const progress = createProgress(); const snapshot = structuredClone(progress);
    const html = renderToStaticMarkup(<ResetProgress progress={progress} onReset={onReset} onExportBackup={onExportBackup} />);
    expect(html).toContain('全域進度重置'); expect(html).toContain('從零開始・重置全部進度');
    expect(html).not.toContain('<dialog');
    expect(onReset).not.toHaveBeenCalled(); expect(onExportBackup).not.toHaveBeenCalled();
    expect(progress).toEqual(snapshot);
  });

  it('explains the full scope, offers backup and cancel, and disables destructive confirmation until acknowledged', () => {
    const onReset = vi.fn(async () => {});
    const html = renderToStaticMarkup(<ResetProgressDialog completed={13} onClose={() => {}} onReset={onReset} onExportBackup={() => {}} />);
    for (const text of ['13／14 關', '全部 14 關', '所有闖關成績', '初階與進階必殺技', '中途挑戰存檔', '先匯出目前進度備份', '取消，保留進度', '離線下載內容及使用偏好會保留']) expect(html).toContain(text);
    expect(html).toMatch(/class="button reset-confirm" disabled=""/);
    expect(html).toContain('type="checkbox"');
    expect(onReset).not.toHaveBeenCalled();
  });
});
