const fs = require('fs');
const path = 'app/(tabs)/tasks.tsx';
let c = fs.readFileSync(path, 'utf8');

// Fix 1: Add applyLocalCompletions to import
c = c.replace(
  /skipTaskInstance,[\s\n]*\} from '\.\.\/\.\.\/lib\/tasks';/,
  "skipTaskInstance,\n    applyLocalCompletions,\n    saveLocalCompletion,\n} from '../../lib/tasks';"
);

// Fix 2: Apply local completions in loadData
c = c.replace(
  'setInstances(instanceData || []);',
  'const withLocal = await applyLocalCompletions(instanceData || []);\n      setInstances(withLocal);'
);

fs.writeFileSync(path, c);
console.log('applyLocalCompletions added:', c.includes('applyLocalCompletions'));
console.log('withLocal added:', c.includes('withLocal'));
console.log('Done ✅');
