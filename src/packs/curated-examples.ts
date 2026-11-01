// One editorial shortlist feeds agent recommendations and the New Kage picker.
// Capability demonstrations stay available separately; they are not all good default page shapes.
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from './examples.ts';

export const RECOMMENDED_EXAMPLES = [
  { id: 'review-brief', use: 'Default: a readable verdict, facts, findings with evidence and fixes, next action, verified checks and order of work.' },
  { id: 'research-brief', use: 'A sourced argument that needs quotations, figures and references.' },
  { id: 'growth-lab', use: 'A calculator when changing an assumption must change the result.' },
  { id: 'event-planner', use: 'A task that needs validated reader input and a submitted result.' },
  { id: 'signal-field-guide', use: 'A handbook that readers revisit by chapter and search.' },
] as const;

/** Keep the full library addressable for existing references and focused component work. */
export function allExamples(system = 'core') {
  return [...freeFlowExamples(system), ...expressiveExamples(system), ...richExamples(system), ...appExamples(system), ...connectedExamples(system), ...chartExamples(system), ...contentExamples(system)];
}

/** Fail loudly if a curated entry is renamed rather than silently losing a recommendation. */
export function recommendedExamples(system = 'core') {
  const docs = new Map(allExamples(system).map(doc => [doc.id, doc]));
  return RECOMMENDED_EXAMPLES.map(entry => {
    const doc = docs.get(entry.id);
    if (!doc) throw new Error(`missing recommended example: ${entry.id}`);
    return doc;
  });
}
