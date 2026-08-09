// Codemod: replace fontWeight with Material Roboto fontFamily tokens,
// preserving the file byte-for-byte everywhere else.
// - fontWeight '700'|'800'|'900' -> fontFamily 'Roboto_700Bold'
// - fontWeight '500'|'600'       -> fontFamily 'Roboto_500Medium'
// - other weights -> 'Roboto_400Regular'
// - style objects with fontSize but no weight/family get the regular family
// Usage: node scripts/font-codemod.js [file...]
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const WEIGHT_TO_FAMILY = {
  100: 'Roboto_400Regular',
  200: 'Roboto_400Regular',
  300: 'Roboto_400Regular',
  400: 'Roboto_400Regular',
  500: 'Roboto_500Medium',
  600: 'Roboto_500Medium',
  700: 'Roboto_700Bold',
  800: 'Roboto_700Bold',
  900: 'Roboto_700Bold',
};

function transformFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch (e) {
    console.error('parse failed:', file, e.message);
    return;
  }
  // {at, end, text} — replacement of [at, end) with text.
  const edits = [];
  traverse(ast, {
    ObjectProperty(p) {
      const key = p.node.computed ? null : p.node.key.name;
      const parent = p.parentPath;
      if (!parent.isObjectExpression()) return;
      const siblings = parent.node.properties;
      if (key === 'fontWeight' && p.node.value.type === 'StringLiteral') {
        const w = p.node.value.value;
        const family = WEIGHT_TO_FAMILY[w] ?? 'Roboto_400Regular';
        // Reuse the original quote style from the value literal.
        const quote = src.slice(p.node.value.start, p.node.value.start + 1);
        edits.push({ at: p.node.start, end: p.node.end, text: `fontFamily: ${quote}${family}${quote}` });
      } else if (key === 'fontSize') {
        const hasWeightOrFamily = siblings.some(
          (o) => !o.computed && (o.key.name === 'fontWeight' || o.key.name === 'fontFamily')
        );
        if (!hasWeightOrFamily) {
          edits.push({ at: p.node.start, end: p.node.start, text: `fontFamily: 'Roboto_400Regular', ` });
        }
      }
    },
  });
  if (edits.length === 0) {
    return;
  }
  edits.sort((a, b) => a.at - b.at);
  let out = '';
  let pos = 0;
  for (const e of edits) {
    out += src.slice(pos, e.at);
    out += e.text;
    pos = e.end;
  }
  out += src.slice(pos);
  fs.writeFileSync(file, out);
  console.log(`${edits.length} edits ->`, file);
}

const roots = [path.resolve(__dirname, '../app')];
let files = [];
if (process.argv.length > 2) {
  files = process.argv.slice(2);
} else {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.expo' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) files.push(full);
    }
  };
  roots.forEach(walk);
}
files.forEach(transformFile);
