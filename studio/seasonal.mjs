// All dates, names and branding belong to the pinned LUMEN checkout. No local
// seasonal calendar or network lookup is allowed in the marketing repository.
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
export async function seasonalArtwork(gameRoot,day,locale='fr'){
 if(!day)return null;
 const source=await import(pathToFileURL(join(gameRoot,'src/campaign/seasonal-events.js')).href);
 if(!source.validDay(day))throw Error('Invalid --date');
 return source.dailyPresentation(day,locale);
}
