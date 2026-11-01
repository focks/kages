// The same curated shortlist is shown to people and recommended to agents.
import type { KageDoc } from '../engine/types.ts';
import { recommendedExamples } from './curated-examples.ts';

/** Fresh recommended documents come first; a blank page remains an explicit choice. */
export function starterDocs(): KageDoc[] {
  return [...recommendedExamples(), { kages: '1.0', id: 'blank', title: 'Blank reading page', system: 'core@1', root: 'root', blocks: { root: { type: 'page', props: { width: 'reading' } } } }];
}
