const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../frontend/src');

// Regex to match unicode emoji ranges
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{200D}]|[\u{FE0F}]/u;

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = walkDir(srcDir);
const filesWithEmojis = [];

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
    filesWithEmojis.push({ filePath, count: matches.length, matches });
  }
}

console.log(`Found ${filesWithEmojis.length} files containing emojis:\n`);
filesWithEmojis.forEach(f => {
  const rel = path.relative(path.resolve(__dirname, '../..'), f.filePath);
  console.log(`- ${rel} (${f.count} emojis)`);
});
