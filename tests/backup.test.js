import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectBackup} from '../backup.js';
import {emptyOffice,applyMovement} from '../domain.js';
function fixture(){let s=emptyOffice();s.items.i={name:'หมวก',unit:'ใบ',qty:0,active:true};s=applyMovement(s,{id:'r',kind:'receipt',lines:[{itemId:'i',qty:5}]});return {schemaVersion:1,environment:'live',exportedAt:'2026-10-12T10:00:00Z',offices:{sanpatong:{path:'office',data:s}}};}
test('backup roundtrip preserves balances and does not mutate input',()=>{const b=fixture(),saved=JSON.stringify(b);assert.equal(inspectBackup(JSON.parse(saved))[0].items,1);assert.equal(JSON.stringify(b),saved);});
test('backup rejects mismatched balances and missing ledger references',()=>{const b=fixture();b.offices.sanpatong.data.items.i.qty=6;assert.throws(()=>inspectBackup(b),/ยอดคลัง/);delete b.offices.sanpatong.data.items.i;assert.throws(()=>inspectBackup(b),/อุปกรณ์/);});
test('backup rejects wrong environment paths and unsupported format',()=>{const b=fixture();b.environment='qa';assert.throws(()=>inspectBackup(b),/เส้นทาง/);assert.throws(()=>inspectBackup({}),/version/);});
