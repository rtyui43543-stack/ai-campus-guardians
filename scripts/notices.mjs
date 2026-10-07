import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const notices=['AI 校園守護隊 · Third-party software and font notices',
  'Game artwork was generated specifically for this project. The textbook PDF and reference video are not redistributed.',
  'The Windows portable runtime has its full Node.js license in runtime/LICENSE-Node.txt.'];
for(const [path,metadata] of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b))){
  if(!path.startsWith('node_modules/')||metadata.dev) continue;
  const pkg=JSON.parse(readFileSync(resolve(path,'package.json'),'utf8'));
  const files=readdirSync(path).filter(name=>/^(licen[sc]e|ofl|copying|notice)([._-]|$)/i.test(name));
  notices.push('\n============================================================\n'+pkg.name+' '+pkg.version+' ('+(pkg.license||'see license')+')');
  for(const file of files){
    try{notices.push(file+'\n'+readFileSync(resolve(path,file),'utf8'));}catch{/* Directories are not notice files. */}
  }
  if(!files.length) notices.push('Package attribution: '+JSON.stringify(pkg.repository||pkg.homepage||pkg.name));
}
writeFileSync('public/THIRD_PARTY_NOTICES.txt',notices.join('\n\n'));
console.log('Bundled software and font notices generated.');
