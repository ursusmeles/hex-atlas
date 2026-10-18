// Fixed demonstration topology. Regenerate changes dressing, not these terrain assignments.
const radius = 3,
  waterKeys = new Set(['1,-3', '1,-2', '0,-1', '0,0', '-1,1', '-1,2', '-2,3']);
const mountainKeys = new Set(['-2,-1', '-1,-2', '-2,0', '0,-3']);
const villageKey = '1,1';
const forestKeys = new Set([
  '-3,0',
  '-3,1',
  '-3,2',
  '-2,1',
  '-2,2',
  '-1,0',
  '-1,-1',
  '0,2',
  '1,2',
  '2,1',
  '2,-1',
  '2,-2',
  '3,-2',
  '3,-3',
]);

export { radius, waterKeys, mountainKeys, villageKey, forestKeys };
