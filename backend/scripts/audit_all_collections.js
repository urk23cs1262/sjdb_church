const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function analyzeCollections() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  const colNames = collections.map(c => c.name).sort();

  console.log(`Total Collections in Database (${colNames.length}):\n`);

  // 1. Scan src/models
  const modelsDir = path.join(__dirname, '../src/models');
  const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
  const modelMap = new Map();

  for (const mf of modelFiles) {
    try {
      const mod = require(path.join(modelsDir, mf));
      if (mod && mod.collection && mod.collection.name) {
        modelMap.set(mod.collection.name.toLowerCase(), mf);
      }
    } catch (e) {}
  }

  // 2. Scan entire codebase for raw references to each collection name
  const srcDir = path.join(__dirname, '../src');
  function getAllFiles(dir) {
    const list = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== 'backups' && ent.name !== '.git') {
          list.push(...getAllFiles(full));
        }
      } else if (ent.name.endsWith('.js') || ent.name.endsWith('.jsx')) {
        list.push(full);
      }
    }
    return list;
  }
  const allSrcFiles = getAllFiles(srcDir);

  const results = [];

  for (const name of colNames) {
    let stats = { count: 0, size: 0 };
    try {
      stats = await db.command({ collStats: name });
    } catch (e) {
      const c = await db.collection(name).countDocuments().catch(() => 0);
      stats = { count: c, size: 0 };
    }
    const count = stats.count || 0;
    const sizeKB = ((stats.size || 0) / 1024).toFixed(1);
    const model = modelMap.get(name.toLowerCase()) || null;

    // Check code references
    let codeRefHits = 0;
    const matchingFiles = [];
    for (const f of allSrcFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes(`'${name}'`) || content.includes(`"${name}"`) || content.includes(`collection('${name}')`) || content.includes(`collection("${name}")`)) {
        codeRefHits++;
        matchingFiles.push(path.basename(f));
      }
    }

    results.push({
      name,
      count,
      sizeKB,
      hasModel: !!model,
      modelFile: model,
      codeRefs: codeRefHits,
      matchingFiles: matchingFiles.slice(0, 3)
    });
  }

  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();
}

analyzeCollections().catch(err => {
  console.error(err);
  process.exit(1);
});
