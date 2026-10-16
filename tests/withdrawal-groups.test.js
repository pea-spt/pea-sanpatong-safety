import test from 'node:test';
import assert from 'node:assert/strict';
import {withdrawalGroupKey,withdrawalGroup} from '../withdrawal-groups.js';
import {attachWithdrawalEvidence} from '../withdrawal-evidence.js';
import {historyGroups} from '../history-view.js';
const bill=(id,extra={})=>({id,kind:'withdrawal',personId:'p',date:'2026-10-16',ts:1,lines:[{itemId:'a',qty:2,delta:-2}],...extra});
test('group evidence accumulates uploads across bills, days and legacy office fields',()=>{
 let s={items:{a:{qty:5}},movements:{a:bill('a'),b:bill('b',{personOfficeId:'sanpatong'}),other:bill('other',{date:'2026-10-15'})}};
 const key=withdrawalGroupKey(s.movements.a,'sanpatong');
 assert.equal(historyGroups(Object.values(s.movements),'sanpatong').length,2);
 const original=structuredClone(s);
 const record={id:'f1',movementId:'a',driveFileId:'group_file_123',evidenceGroup:key,evidenceOfficeId:'sanpatong'};
 s=attachWithdrawalEvidence(s,record);
 s=attachWithdrawalEvidence(s,{...record,id:'f2',movementId:'b',driveFileId:'group_file_456'});
 s.movements.c= bill('c');
 assert.deepEqual(withdrawalGroup(s,key,'sanpatong').bills.map(b=>b.id),['a','b','c']);
 assert.equal(withdrawalGroup(s,key,'sanpatong').files.length,2);
 assert.equal(withdrawalGroup(s,withdrawalGroupKey(s.movements.other,'sanpatong'),'sanpatong').files.length,0);
 assert.deepEqual(s.items,original.items);assert.deepEqual(s.movements.a.lines,original.movements.a.lines);
 assert.deepEqual(attachWithdrawalEvidence(s,record),s);
 // Shared evidence stays in its original person/day group when its storage bill changes.
 s.movements.a.date='2026-10-14';
 assert.equal(withdrawalGroup(s,key,'sanpatong').files.length,2);
 assert.equal(withdrawalGroup(s,withdrawalGroupKey(s.movements.a,'sanpatong'),'sanpatong').files.length,0);
 assert.throws(()=>attachWithdrawalEvidence(s,{...record,id:'late'}),/เปลี่ยน/);
});
test('old per-bill evidence and replacement versions are shown once in the shared group',()=>{
 const s={movements:{a:bill('a',{files:{old:{id:'old',driveFileId:'legacy_123'},new:{id:'new',replacesId:'old',driveFileId:'legacy_456'}},evidence:'https://example.test/proof'}),b:bill('b',{personOfficeId:'maewang',files:{x:{id:'x',driveFileId:'other_123'}}})}};
 const g=withdrawalGroup(s,withdrawalGroupKey(s.movements.a,'sanpatong'),'sanpatong');
 assert.deepEqual(g.files.map(f=>f.id),['new']);assert.deepEqual(g.links,['https://example.test/proof']);
 assert.equal(withdrawalGroupKey(bill('n',{personId:'',empId:''}),'sanpatong'),null);
});
