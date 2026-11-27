import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {seasonalArtwork} from './seasonal.mjs';
const root=resolve(process.argv[2]??'../lumen-seasonal-work');
assert.equal((await seasonalArtwork(root,undefined,'fr',new Date('2026-11-30T23:00:00Z'))).event.id,'advent-2026','Default date comes from the native Paris clock');
assert.equal((await seasonalArtwork(root,undefined,'fr',new Date('2026-12-24T23:00:00Z'))).event,null,'Default date ends the event automatically');
for(const [lang,title] of Object.entries({fr:'Défi de l’Avent',en:'Advent Challenge',es:'Reto de Adviento'})){
 const p=await seasonalArtwork(root,'2026-12-24',lang);
 assert.equal(p.title,title);assert.equal(p.event.id,'advent-2026');assert.ok(p.previewLabel);
}
assert.equal((await seasonalArtwork(root,'2026-12-25')).event,null);
await assert.rejects(()=>seasonalArtwork(root,'2026-02-30'));
await assert.rejects(()=>seasonalArtwork('/missing/native/source','2026-12-01'));
console.log('Studio: native config and automatic clock, three languages, end boundary, missing-source fail closed OK');
