const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
function loadFunctions(names, globals = {}) {
  const code = names.map(name => {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0) throw Error(`Missing function ${name}`);
    const end = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, end < 0 ? source.length : end);
  }).join('\n');
  const context = vm.createContext({ Date, Math, Number, Set, Object, Array, ...globals });
  vm.runInContext(code, context, { filename: 'renderer/app.js' });
  return context;
}
module.exports = { loadFunctions };
