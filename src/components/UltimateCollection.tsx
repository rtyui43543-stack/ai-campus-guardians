import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Flame, HeartHandshake, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';
import { allUltimateSpells, getUltimateCardKey, getUltimateCardMode, type UltimateSpell, type UltimateSpellCategory } from '../content/ultimateSpells';
import { appAssetUrl } from '../platform/urls';
import { getChapter } from '../content/levels';
import type { Mode } from '../domain/types';
import { CARD_LAYOUT, composeUltimateCard } from './ultimateCardLayout';
import '../styles/ultimate-collection.css';

export interface UltimateCollectionRecord {
  readonly ultimateId: number;
  readonly unlockedAt: string;
  readonly questionId?: string;
  readonly mode?: Mode;
}

export interface UltimateCollectionProps {
  readonly cards: readonly UltimateCollectionRecord[];
  readonly initialMode?: Mode;
}

const categoryNames: Readonly<Record<UltimateSpellCategory, string>> = {
  attack: '法術攻擊', defense: '防禦守護', support: '恢復支援',
};
const categoryIcons = { attack: Flame, defense: ShieldCheck, support: HeartHandshake };

/** Every theme has a separate first-tier and upgraded collectible. */
export function unlockedUltimateIds(cards: readonly UltimateCollectionRecord[], mode: Mode = 'starter'): ReadonlySet<number> {
  const known = new Set(allUltimateSpells.map(spell => spell.id));
  return new Set(cards.filter(card => getUltimateCardMode(card) === mode).map(card => card.ultimateId).filter(id => known.has(id)));
}

export function UltimateCardTitle({ name }: { name: string }) {
  return <svg className="ultimate-card-title-layer" viewBox={`0 0 ${CARD_LAYOUT.width} ${CARD_LAYOUT.height}`} aria-hidden="true" focusable="false">
    <text x={CARD_LAYOUT.titleX} y={CARD_LAYOUT.titleY} textAnchor="middle" dominantBaseline="central"
      fontSize={CARD_LAYOUT.titleSize} fontWeight="900" fill={CARD_LAYOUT.titleColor}
      stroke={CARD_LAYOUT.titleOutline} strokeWidth="2" paintOrder="stroke">{name}</text>
  </svg>;
}

/** Fetch goes through the service worker; the resulting local Blob also downloads offline. */
export function createUltimateCardDownloader(spell: UltimateSpell) {
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  return {
    download(parent?: HTMLElement): Promise<void> {
      if (pending) return pending;
      controller = new AbortController();
      const signal = controller.signal;
      pending = (async () => {
        const response = await fetch(appAssetUrl(spell.artPath), { signal });
        if (!response.ok) throw new Error('收藏卡圖片尚未準備好。');
        const blob = await response.blob();
        if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) throw new Error('收藏卡圖片未能完整讀取。');
        if (signal.aborted) throw new DOMException('下載已取消。', 'AbortError');
        const composed = await composeUltimateCard(blob, spell.name, signal);
        const objectUrl = URL.createObjectURL(composed);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `小羽收藏卡-${spell.mode === 'advanced' ? '進階' : '初階'}-${spell.name}.png`;
        anchor.style.display = 'none';
        try {
          (parent ?? document.body).appendChild(anchor);
          anchor.click();
        } finally {
          anchor.remove();
          // Keep the URL alive while browsers finish beginning their download.
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
        }
      })().finally(() => { pending = null; controller = null; });
      return pending;
    },
    cancel() { controller?.abort(); },
  };
}

function CardModal({ spell, unlockedAt, onClose }: {
  spell: UltimateSpell; unlockedAt: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const busy = useRef(false);
  const mounted = useRef(false);
  const downloader = useMemo(() => createUltimateCardDownloader(spell), [spell]);
  useEffect(() => {
    mounted.current = true;
    const current = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    current?.showModal();
    closeRef.current?.focus();
    return () => {
      mounted.current = false;
      downloader.cancel();
      current?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [downloader]);
  const downloadCard = async () => {
    if (busy.current) return;
    busy.current = true;
    setDownloadState('loading');
    try {
      await downloader.download(ref.current ?? undefined);
      if (mounted.current) setDownloadState('success');
    } catch {
      if (mounted.current) setDownloadState('error');
    } finally { busy.current = false; }
  };
  const Icon = categoryIcons[spell.category];
  const date = new Date(unlockedAt);
  return <dialog ref={ref} className="ultimate-card-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ultimate-card-modal-content">
      <button ref={closeRef} className="ultimate-card-modal-close" type="button" onClick={onClose} aria-label="關閉收藏卡"><X size={24} /></button>
      <div className="ultimate-card-large-art"><img src={appAssetUrl(spell.artPath)} alt={`小羽施放${spell.name}的專屬收藏卡`} /><UltimateCardTitle name={spell.name} /></div>
      <div className="ultimate-card-modal-info"><span className={`ultimate-category ${spell.category}`}><Icon size={20} />{categoryNames[spell.category]}</span>
        <span className={'ultimate-tier ' + spell.mode}>{spell.mode === 'advanced' ? 'Lv.2 進階升級' : 'Lv.1 初階技能'}</span>
        <h2 id={titleId}>{spell.name}</h2>
        {spell.mode === 'advanced' && <div className="ultimate-upgrade-explanation"><strong>{spell.baseName} → {spell.name}</strong><p>{spell.upgradeDescription}</p></div>}
        <p>{spell.description}</p>
        <p className="ultimate-collected-at">{Number.isNaN(date.getTime()) ? '已加入收藏' : `收藏日期：${date.toLocaleDateString('zh-TW')}`}</p>
        <button type="button" className="ultimate-card-download" onClick={downloadCard} disabled={downloadState === 'loading'} aria-busy={downloadState === 'loading'}><Download size={21} />{downloadState === 'loading' ? '準備圖片中…' : '下載收藏卡圖片'}</button>
        {downloadState === 'error' && <p className="ultimate-card-download-error" role="alert">圖片未能下載。請確認離線內容已完整下載，或點下方「查看原圖」長按圖片保存。</p>}
        {downloadState === 'success' && <p className="ultimate-card-download-status" role="status">已送出圖片下載。若瀏覽器沒有儲存，可點「查看原圖」後保存。</p>}
        {(downloadState === 'error' || downloadState === 'success') && <a className="ultimate-card-view-original" href={appAssetUrl(spell.artPath)} target="_blank" rel="noopener noreferrer">查看原圖</a>}
        <p className="ultimate-card-download-note">卡圖已包含在離線內容，沒有網路也能查看與下載。</p>
      </div>
    </div>
  </dialog>;
}

export function UltimateCollection({ cards, initialMode = 'starter' }: UltimateCollectionProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => { setMode(initialMode); setSelectedKey(null); }, [initialMode]);
  const headingId = useId();
  const unlocked = unlockedUltimateIds(cards, mode);
  const total = unlockedUltimateIds(cards, 'starter').size + unlockedUltimateIds(cards, 'advanced').size;
  const visibleSpells = allUltimateSpells.filter(spell => spell.mode === mode);
  const selected = allUltimateSpells.find(spell => `${spell.mode}:${spell.id}` === selectedKey && cards.some(card => getUltimateCardKey(card) === selectedKey));
  const selectedRecord = selected ? cards.find(card => getUltimateCardKey(card) === selectedKey) : undefined;
  return <section className="ultimate-collection" aria-labelledby={headingId}>
    <div className="ultimate-collection-heading"><div><span className="ultimate-collection-eyebrow"><Sparkles size={20} />小羽的專屬魔法收藏</span><h2 id={headingId}>我的必殺技收藏卡</h2></div><strong>{total}<span>／12 張</span></strong></div>
    <p className="ultimate-collection-rule">主要挑戰答對一題集 1 點能量，答錯或超時扣 1 點。集滿 3 點後，下一題答對就會自動施放必殺技，另外加 10 分，解鎖這個主題的收藏卡！</p>
    <p className="ultimate-collection-note">每關能量從 0 開始；同一張卡只收藏一次，重新挑戰仍能獲得施放獎勵。初階與進階分別收藏，進階不用先集齊初階卡。</p>
    <div className="ultimate-tier-tabs" role="group" aria-label="選擇必殺技等級">{(['starter', 'advanced'] as Mode[]).map(tier => <button type="button" key={tier} aria-pressed={mode === tier} onClick={() => setMode(tier)}><span>{tier === 'starter' ? 'Lv.1 初階魔法' : 'Lv.2 進階升級'}</span><b>{unlockedUltimateIds(cards, tier).size}／6 張</b></button>)}</div>
    <p className="ultimate-tier-summary">{mode === 'advanced' ? '六種魔法升級！進階必殺技展開半屏或全屏演出，完成施放就能收藏升級卡。' : '從六種生活主題學會魔法，在初階挑戰施放必殺技，收集你的第一套魔法卡。'}</p>
    <div className="ultimate-collection-grid">{visibleSpells.map(spell => {
      const isUnlocked = unlocked.has(spell.id);
      const Icon = categoryIcons[spell.category];
      return <article className={`ultimate-collection-card ${spell.mode} ${isUnlocked ? 'unlocked' : 'locked'}`} key={`${mode}:${spell.id}`}>
        {isUnlocked ? <button type="button" className="ultimate-card-art-button" onClick={() => setSelectedKey(`${mode}:${spell.id}`)} aria-label={`查看收藏卡：${spell.name}`}>
          <img src={appAssetUrl(spell.artPath)} alt={`小羽施放${spell.name}`} loading="lazy" /><UltimateCardTitle name={spell.name} /><span className="ultimate-card-open-hint">查看收藏卡</span>
        </button> : <div className="ultimate-card-locked-art" aria-label={`${spell.name}尚未解鎖`}><LockKeyhole size={44} aria-hidden="true" /><strong>{mode === 'advanced' ? '等待升級魔法' : '等待你的魔法'}</strong><span>挑戰{mode === 'advanced' ? '進階' : '初階'}第 {spell.id} 關<br />施放必殺技後解鎖</span></div>}
        <div className="ultimate-card-details"><span className={`ultimate-category ${spell.category}`}><Icon size={18} />{categoryNames[spell.category]}</span><span className={'ultimate-tier ' + mode}>{mode === 'advanced' ? 'Lv.2 升級' : 'Lv.1 初階'}</span><h3>{spell.name}</h3><p>{getChapter(spell.id).title} · {mode === 'advanced' ? '進階' : '初階'}第 {spell.id} 關</p>
          {mode === 'advanced' && <div className="ultimate-upgrade-explanation"><strong>升級自：{spell.baseName}</strong><p>{spell.upgradeDescription}</p></div>}<p>{spell.description}</p>
          <span className={`ultimate-card-status ${isUnlocked ? 'collected' : ''}`}>{isUnlocked ? '已收藏 · 點卡片查看' : '尚未解鎖'}</span></div>
      </article>;
    })}</div>
    {selected && selectedRecord && <CardModal key={selectedKey} spell={selected} unlockedAt={selectedRecord.unlockedAt} onClose={() => setSelectedKey(null)} />}
  </section>;
}
