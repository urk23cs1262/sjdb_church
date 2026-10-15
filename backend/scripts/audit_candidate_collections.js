const fs = require('fs');
const path = require('path');

const candidates = [
  'test_chunks',
  'families',
  'saints',
  'dailycatholiccontents',
  'userdevotionalprogresses',
  'birthdaydeliverylogs',
  'dailynotificationjobs'
];

const searchDirs = [
  path.join(__dirname, '../src'),
  path.join(__dirname, '../../frontend/src')
];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(f)) {
        getAllFiles(full, fileList);
      }
    } else {
      if (['.js', '.jsx', '.ts', '.tsx', '.json'].includes(path.extname(f))) {
        fileList.push(full);
      }
    }
  }
  return fileList;
}

const allFiles = [];
searchDirs.forEach(d => getAllFiles(d, allFiles));
console.log(`Auditing ${candidates.length} candidate collections across ${allFiles.length} source files...\n`);

const results = {};
candidates.forEach(c => results[c] = []);

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(path.join(__dirname, '../../'), file).replace(/\\/g, '/');

  for (const c of candidates) {
    // Regex for exact collection name usage in queries or strings
    const regex = new RegExp(`['"\`\\/]${c}['"\`\\/]|model\\(['"\`]${c}|collection\\(['"\`]${c}|from\\s+['"\`].*${c}`, 'gi');
    let match;
    const lines = content.split('\n');
    lines.forEach((line, lineIdx) => {
      if (line.toLowerCase().includes(c.toLowerCase())) {
        // Filter out false positives like generic english word "families" or "saints"
        const isDbUsage =
          line.includes(`'${c}'`) ||
          line.includes(`"${c}"`) ||
          line.includes(`\`${c}\``) ||
          line.includes(`collection('${c}')`) ||
          line.includes(`model('${c}'`) ||
          line.includes(`/${c}/`) ||
          line.includes(`/${c}`) ||
          line.includes(`.${c}`);

        if (isDbUsage) {
          results[c].push({
            file: relPath,
            line: lineIdx + 1,
            snippet: line.trim().slice(0, 120)
          });
        }
      }
    });
  }
}

console.log('================================================================');
console.log('AUDIT REPORT: CODEBASE REFERENCES TO CANDIDATE COLLECTIONS');
console.log('================================================================');

for (const [coll, hits] of Object.entries(results)) {
  console.log(`\nCollection: "${coll}"`);
  if (hits.length === 0) {
    console.log(`  -> 0 code references found in backend or frontend.`);
    console.log(`  -> Classification: GENUINELY UNUSED / ORPHANED.`);
  } else {
    console.log(`  -> Found ${hits.length} reference(s):`);
    hits.forEach(h => console.log(`     [${h.file}:${h.line}] ${h.snippet}`));
  }
}
