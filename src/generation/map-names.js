import rules from '../data/world-rules.json' with { type: 'json' };
import { randomFor } from './seed.js';

export const NAME_WORDS = rules;
export function nameModifiers(modifiers) {
  const counts = { M: 0, LW: 0, DW: 0, W: 0, PL: 0, F: 0 };
  for (const modifier of modifiers) {
    const negative = modifier.startsWith('-');
    const code = negative ? modifier.slice(1) : modifier;
    if (!(code in counts)) throw new RangeError(`Unknown name modifier: ${modifier}`);
    counts[code] += negative ? -1 : 1;
  }
  return Object.fromEntries(
    Object.entries(counts).map(([code, count]) => [
      code,
      Math.max(0.3, Math.min(3.2, 2.1 ** count)),
    ]),
  );
}

export function generateMapName(seed) {
  const random = randomFor(seed, 'map-name');
  const adjective = rules.adjectives[Math.floor(random() * rules.adjectives.length)];
  const noun = rules.nouns[Math.floor(random() * rules.nouns.length)];
  const modifiers = [...adjective.modifiers, ...noun.modifiers];
  return {
    name: `The ${adjective.word.toLowerCase()} ${noun.word.toLowerCase()}`,
    naming: {
      adjective: adjective.word,
      noun: noun.word,
      modifiers,
      weights: nameModifiers(modifiers),
    },
  };
}
