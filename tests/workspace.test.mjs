import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'tripwhisper-tests-'));
try{
 for(const name of ['journey','replan','health','workspace']){const text=readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');const out=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/journey['"]/g,"from './journey.mjs'").replace(/from ['"]\.\/replan['"]/g,"from './replan.mjs'").replace(/from ['"]\.\/health['"]/g,"from './health.mjs'");writeFileSync(join(dir,name+'.mjs'),out)}
 const {generate,initialProfile,adjust}=await import(pathToFileURL(join(dir,'journey.mjs')));
 const {previewBooking,regenerateWithBookings,parseMoney,createExpense,dailyExpenses}=await import(pathToFileURL(join(dir,'workspace.mjs')));
 const j=generate(initialProfile);const input={date:initialProfile.date,name:'音乐会',address:'Teatro alla Scala, Milano',time:'19:30',end:'21:00',cost:'38.90',url:'https://www.teatroallascala.org/'};
 const added=previewBooking(j,input,'test');assert.equal(j.days[0].stops.length+1,added.next.days[0].stops.length);assert.equal(j.version,1);
 const replanned=regenerateWithBookings({...initialProfile,slow:true},[],added.next);
 const booking=replanned.days[0].stops.find(s=>s.kind==='我的预订');assert.equal(booking.time,'19:30');assert.equal(booking.cost,38.9);assert.equal(booking.locked,true);
 assert.deepEqual(adjust(replanned,0,'rain').days[0].stops.find(s=>s.kind==='我的预订'),booking);
 assert.throws(()=>previewBooking(j,{...input,time:'10:00',end:'11:00'},'bad'),/冲突/);
 assert.throws(()=>previewBooking(j,{...input,time:'11:35',end:'12:00'},'buffer'),/冲突/);
 assert.throws(()=>previewBooking(j,{...input,url:'javascript:alert(1)'},'bad'));
 assert.throws(()=>regenerateWithBookings({...initialProfile,date:'2026-11-01'},[],added.next),/日期/);
 assert.throws(()=>generate({...initialProfile,budget:NaN}));
 assert.throws(()=>generate({...initialProfile,date:'2026-02-31'}));
 assert.equal(parseMoney('0.10')+parseMoney('0.20'),30);
 assert.throws(()=>parseMoney('-1'));assert.throws(()=>parseMoney('1.234'));
 const eur=createExpense({date:'2026-10-12',name:'午餐',category:'餐饮',currency:'EUR',amount:'12.50',rate:'8'},'1');
 const cny=createExpense({date:'2026-10-12',name:'交通',category:'交通',currency:'CNY',amount:'80',rate:'8'},'2');
 assert.equal(cny.eurMinor,1000);assert.equal(dailyExpenses([eur,cny])['2026-10-12'],2250);
 assert.throws(()=>createExpense({date:'2026-10-12',name:'午餐',category:'餐饮',currency:'EUR',amount:'12',rate:'0'},'3'));
 console.log('PASS: booking preservation/regeneration, collisions and buffers, URL safety, dates, decimal money, EUR/CNY conversion, daily totals');
}finally{rmSync(dir,{recursive:true,force:true})}
