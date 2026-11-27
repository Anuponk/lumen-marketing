// Delegate generation to the pinned native source. Never create a second plan.
import {parseArgs} from 'node:util';
import {resolve,join} from 'node:path';
import {run} from './montage.mjs';
const {values}=parseArgs({options:Object.fromEntries(['game','sha','from','to','output'].map(k=>[k,{type:'string'}]))});
if(!values.game||!values.sha||!values.from||!values.to||!values.output)throw Error('Required: --game PATH --sha HASH --from YYYY-MM-DD --to YYYY-MM-DD --output CSV');
const root=resolve(values.game);
if((await run('git',['rev-parse','HEAD'],{cwd:root})).trim()!==values.sha)throw Error('Game SHA mismatch');
if((await run('git',['status','--porcelain'],{cwd:root})).trim())throw Error('A clean pinned source is required');
await run(process.execPath,[join(root,'scripts/marketing/social-posts.mjs'),'--from='+values.from,'--to='+values.to,'--metricool='+resolve(values.output)],{cwd:root});
