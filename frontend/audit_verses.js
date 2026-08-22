const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'src/assets/daily-verses-400.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

console.log(`Total verses in file: ${data.verses.length}`);

let issues = 0;
data.verses.forEach((v, index) => {
  if (!v.en || !v.ta || v.en.trim() === '' || v.ta.trim() === '') {
    console.log(`Issue at index ${index} (day ${v.day}, ref: ${v.ref}): missing en or ta`);
    issues++;
  }
  if (v.en === v.ta) {
    console.log(`Issue at index ${index} (day ${v.day}, ref: ${v.ref}): en and ta are identical!`);
    issues++;
  }
  // Ensure verseTextEn and verseTextTa match en and ta
  v.verseTextEn = v.en;
  v.verseTextTa = v.ta;
});

console.log(`Audit complete. Found ${issues} issues.`);

// Save back cleaned file
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Synchronized verseTextEn and verseTextTa for all 400 entries.');
