import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, Tag } from 'lucide-react';
import type { Question } from '../domain/types';

export function EvidenceVisual({ question }: { question: Question }) {
  if (question.levelId === 3 && question.slot <= 4) return <FruitLab slot={question.slot} />;
  if (question.levelId === 4 && question.slot === 2) return <RouteDiagram />;
  if (question.levelId === 7 && question.slot <= 3) return <PlantGuide slot={question.slot} />;
  return null;
}
function Fruit({ index, label }: { index: number; label: string }) {
  return <span role="img" aria-label={label} className="fruit-photo"
    style={{ backgroundPosition: ((index % 3) * 50) + '% ' + (Math.floor(index / 3) * 100) + '%' }} />;
}
function FruitLab({ slot }: { slot: number }) {
  const [labels, setLabels] = useState<string[]>(['', '', '']);
  const [tested, setTested] = useState(false);
  const [newPhotos, setNewPhotos] = useState(false);
  const actual = ['蘋果', '蘋果', '橘子'];
  const correct = labels.every((label, i) => label === actual[i]);
  return <div className="visual-evidence fruit-lab"><div className="visual-evidence-heading"><Tag size={15} /><b>{slot === 1 ? '先試試，替圖卡貼名稱' : slot === 3 ? '看看助手，在哪裡誤判' : slot === 4 ? '學過的圖卡，和新圖卡' : '找找看，哪些特徵一樣？'}</b><span>原創圖卡 · 學習模擬</span></div>
    <div className="fruit-cards">{[0, 1, 2].map(i => <div className="fruit-card" key={i}>
      <Fruit index={slot === 4 && newPhotos ? i + 3 : i} label={['紅蘋果', '綠蘋果', '橘子'][i] + (newPhotos ? '，新角度' : '')} />
      {slot === 1 ? <select aria-label={'圖卡 ' + (i + 1) + ' 的水果名稱'} value={labels[i]} onChange={e => {
        setLabels(labels.map((old, j) => j === i ? e.target.value : old)); setTested(false);
      }}><option value="">選一個標記</option><option>蘋果</option><option>橘子</option></select>
        : <small>{slot === 3 ? ['學過：蘋果', '助手判斷：橘子', '學過：橘子'][i] : slot === 4 ? newPhotos ? '新的角度與光線' : '練過的圖卡' : ['紅色・有果梗', '綠色・有果梗', '橙色・顆粒表皮'][i]}</small>}
    </div>)}</div>
    {slot === 1 && <div className="fruit-lab-actions"><button className="text-button" disabled={labels.some(label => !label)} onClick={() => setTested(true)}><Check size={14} />核對標記</button>
      {tested && <p role="status">{correct ? '標記相符！不同顏色的蘋果，都叫蘋果。' : '再看看果梗、形狀與表皮。紅色和綠色這兩張，都是蘋果。'}</p>}</div>}
    {slot === 4 && <button className="text-button" onClick={() => setNewPhotos(!newPhotos)}><RotateCcw size={14} />{newPhotos ? '回到練過的圖卡' : '換一組沒練過的圖卡'}</button>}
    {slot === 3 && <p className="visual-note">綠蘋果仍是蘋果。這裡呈現的是助手的模擬誤判。</p>}
  </div>;
}
function RouteDiagram() {
  return <div className="visual-evidence"><div className="visual-evidence-heading"><ArrowRight size={15} /><b>先取餐，再送達</b><span>路線示意 · 非按比例</span></div>
    <div className="route-diagrams">{[{ title: '甲', first: 3, second: 4 }, { title: '乙', first: 1, second: 8 }].map(route => <div className="route-line" key={route.title}><b>{route.title}</b><span className="route-node">門口</span><span className="route-link">{route.first} 格<ArrowRight size={13} /></span><span className="route-node kitchen">廚房<br /><small>取餐</small></span><span className="route-link">{route.second} 格<ArrowRight size={13} /></span><span className="route-node">乙班<br /><small>送達</small></span></div>)}
      <div className="route-line invalid"><b>丙</b><span className="route-node">門口</span><span className="route-link">2 格<ArrowRight size={13} /></span><span className="route-node">乙班</span><em>沒有經過廚房</em></div>
    </div>
  </div>;
}
function Plant({ petals, pointed, flower = true }: { petals: number; pointed: boolean; flower?: boolean }) {
  return <svg className="plant-diagram" viewBox="0 0 140 150" role="img" aria-label={(pointed ? '尖葉' : '圓葉') + (flower ? '，' + petals + ' 片花瓣' : '，缺少花朵的觀察')}>
    <path d="M70 132 Q65 95 70 62" fill="none" stroke="#78966b" strokeWidth="4" strokeLinecap="round" />
    {pointed ? <><path d="M69 108 Q28 110 24 78 Q58 77 69 108" fill="#afcda2" /><path d="M70 92 Q109 100 119 61 Q89 65 70 92" fill="#91b885" /></>
      : <><ellipse cx="48" cy="105" rx="23" ry="15" transform="rotate(24 48 105)" fill="#afcda2" /><ellipse cx="91" cy="88" rx="23" ry="16" transform="rotate(-27 91 88)" fill="#91b885" /></>}
    {flower && <g>{Array.from({ length: petals }, (_, i) => <ellipse key={i} cx="70" cy="31" rx="12" ry="21" transform={'rotate(' + (i * 360 / petals) + ' 70 54)'} fill="#fbefd0" stroke="#ddbd80" strokeWidth="1.5" />)}<circle cx="70" cy="54" r="9" fill="#d6a54f" /></g>}
    <ellipse cx="70" cy="139" rx="30" ry="4" fill="#cad4bb" opacity=".35" />
  </svg>;
}
function PlantGuide({ slot }: { slot: number }) {
  const [open, setOpen] = useState(slot !== 3);
  return <div className="visual-evidence"><div className="visual-evidence-heading"><Tag size={15} /><b>{slot === 3 ? '照片還看不清楚' : '內建原創圖鑑'}</b><span>虛構物種 · 學習模擬</span></div>
    {slot === 3 && <div className="uncertain-plant"><span className="blurred-plant"><Plant petals={5} pointed={false} flower={false} /></span><p>照片模糊，沒有拍到花。<br />現在還無法核對全部特徵。</p></div>}
    <button className="text-button guide-toggle" onClick={() => setOpen(!open)}>{open ? '收起圖鑑' : '打開圖鑑，比一比'}<ArrowRight size={14} /></button>
    {open && <div className="plant-guide">{[{ name: '星葉草', petals: 3, pointed: false }, { name: '月輪草', petals: 5, pointed: false }, { name: '尖雲草', petals: 5, pointed: true }].map(plant => <div key={plant.name}><Plant petals={plant.petals} pointed={plant.pointed} /><b>{plant.name}</b><small>{plant.pointed ? '尖葉' : '圓葉'} · {plant.petals} 片花瓣</small></div>)}</div>}
    <p className="visual-note">圖鑑僅用於這個故事，不能拿來判斷真實植物。</p>
  </div>;
}
