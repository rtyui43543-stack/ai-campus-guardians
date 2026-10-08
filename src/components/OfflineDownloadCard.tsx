import { CheckCircle2, Download, FileCheck, Info, Pause, Play, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import type { OfflineController } from '../platform/offline';

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export function OfflineDownloadCard({ offline }: { offline: OfflineController }) {
  const { state } = offline;
  const complete = state.total > 0 && state.done === state.total && state.bytes === state.totalBytes;
  const percent = state.totalBytes ? Math.min(complete ? 100 : 99, Math.floor(state.bytes / state.totalBytes * 100)) : 0;
  const status = state.downloading ? '下載中' : state.paused ? '已暫停' : state.updateAvailable ? '新版待套用' : state.ready ? '可離線使用' : '尚未完整下載';
  return <section className={'offline-pack surface ' + (state.ready ? 'is-ready' : '')} aria-labelledby="offline-pack-title" data-testid="offline-download-card">
    <div className="offline-pack-heading"><span className="offline-pack-icon">{state.ready ? <ShieldCheck size={26} /> : <Download size={26} />}</span>
      <h2 id="offline-pack-title">把冒險帶著走</h2><span className={'offline-pack-status ' + (state.ready ? 'ready' : '')} role="status">{status}</span></div>
    <p>{state.updateAvailable ? '新版已完整下載。按下方「套用」，再關閉並重新開啟遊戲，即可使用新版。' : state.ready ? '全部內容已下載。下次從這台裝置的遊戲圖示開啟，就能直接離線遊玩。' : '先加入主畫面，再下載完整遊戲與中文朗讀；沒有網路也能挑戰十四關。'}</p>
    <div className="offline-pack-count">{state.total ? <><span>已下載 <b>{state.done.toLocaleString()} / {state.total.toLocaleString()}</b> 個檔案</span><span><b>{percent}%</b>（{mb(state.bytes)} / {mb(state.totalBytes)} MB）</span></> : <span>正在檢查這台裝置的離線內容…</span>}</div>
    <progress className="offline-pack-progress" max={state.totalBytes || 1} value={state.bytes} aria-label="完整離線內容下載進度" aria-valuetext={percent + '%，已下載 ' + state.done + ' 個檔案'} />
    {state.paused && <p className="offline-pack-note">已下載的檔案會保留，按「繼續下載」即可接著完成。</p>}
    {state.error && <p className="error-text" role="alert">{state.error}</p>}
    <div className="offline-pack-buttons"><button className="button primary" disabled={!state.supported || state.downloading} onClick={() => { void offline.download(); }}>
      {state.ready && !state.paused ? <FileCheck size={18} /> : state.paused || state.done > 0 ? <Play size={18} /> : <Download size={18} />}
      {state.downloading ? '下載中…' : state.paused ? '繼續下載' : state.ready ? '檢查與補齊內容' : state.done > 0 ? '繼續下載' : '下載離線內容'}</button>
      {state.downloading ? <button className="button secondary" onClick={() => { void offline.pause(); }}><Pause size={18} />暫停下載</button>
        : offline.installable ? <button className="button secondary" onClick={() => { void offline.install(); }}><Smartphone size={18} />加入主畫面</button>
          : <button className="button secondary" disabled={!state.supported} onClick={() => { void offline.check(); }}><FileCheck size={18} />檢查下載狀態</button>}
    </div>
    {state.updateAvailable && <div className="update-banner"><Info size={21} /><div><b>有新的遊戲版本</b><p>新版已完整準備好。套用後，下次開啟使用新版；目前進度會保留。</p></div><button className="button secondary" disabled={state.downloading} onClick={() => { void offline.applyUpdate(); }}>套用，下次開啟使用</button></div>}
    <details className="offline-install-guide" open={!state.ready && !state.updateAvailable}><summary><Smartphone size={18} />手機、平板安裝方式</summary>
      <ol><li><b>iPhone／iPad：</b>用 Safari 開啟遊戲網址，按「分享」→「加入主畫面」；如有「打開為網頁 App」，請保持開啟。</li>
        <li><b>Android：</b>用 Chrome 開啟，選瀏覽器選單中的「安裝應用程式」或「加入主畫面」。</li>
        <li>從主畫面的「校園守護隊」圖示開啟，按「下載離線內容」，保持畫面開啟，直到顯示「可離線使用」。</li>
        <li>完成後可開啟飛航模式，再重新開啟遊戲測試。<b>清除網站資料或移除 App 後，需重新下載。</b></li></ol>
    </details>
    <div className="offline-pack-footer">{state.ready ? <CheckCircle2 size={17} /> : <WifiOff size={17} />}<span>{state.ready ? '題目、3D、音效、中文朗讀與進度都可離線使用。' : '不用登入帳號。安裝圖示後，仍需完成離線內容下載。'}</span></div>
  </section>;
}
