const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]/u;

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === 'scratch' || file === '.system_generated') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = walkDir(rootDir);

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches = [];

  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      matches.push({ lineNum: idx + 1, text: line.trim() });
    }
  });

  if (matches.length > 0) {
    const rel = path.relative(rootDir, filePath);
    console.log(`\n=== ${rel} (${matches.length}) ===`);
    matches.forEach(m => {
      console.log(`  Line ${m.lineNum}: ${m.text}`);
    });
  }
}
