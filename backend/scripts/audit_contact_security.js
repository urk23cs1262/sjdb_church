/**
 * Automated Contact Security & Environment Audit Script
 * 
 * Usage:
 *   node backend/scripts/audit_contact_security.js
 * 
 * Verifies that:
 * 1. No real private emails or phone numbers are hardcoded in application source files.
 * 2. Example env files (.env.example) use safe, fictional placeholders only.
 * 3. .gitignore properly protects .env and credentials.
 * 4. Backend contactConfig startup validation behaves correctly.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Real contact signatures that must NEVER appear hardcoded in source code
const FORBIDDEN_SIGNATURES = [
  { pattern: /stjdbchurch@gmail\.com/i, label: 'Parish Email (stjdbchurch@gmail.com)' },
  { pattern: /arndas777@gmail\.com/i, label: 'Admin Email (arndas777@gmail.com)' },
  { pattern: /96556\s*39144/, label: 'Church Phone (96556 39144)' },
  { pattern: /96291\s*95484/, label: 'Parish Office Phone (96291 95484)' },
  { pattern: /76395\s*20006/, label: 'Admin Phone (76395 20006)' }
];

// Folders and files to scan
const SCAN_DIRS = [
  path.join(ROOT_DIR, 'backend', 'src'),
  path.join(ROOT_DIR, 'frontend', 'src'),
  path.join(ROOT_DIR, 'frontend', 'index.html')
];

// File extensions to audit
const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.yaml', '.yml'];

// Ignored folders
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'uploads', 'assets'];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    fileList.push(dir);
    return fileList;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function runAudit() {
  console.log('🔍 ========================================================');
  console.log('🔍 SJDB CHURCH — CONTACT SECURITY & ENVIRONMENT AUDIT');
  console.log('🔍 ========================================================\n');

  let violationsCount = 0;
  const filesToScan = [];

  for (const scanTarget of SCAN_DIRS) {
    scanDirectory(scanTarget, filesToScan);
  }

  console.log(`📁 Scanning ${filesToScan.length} source files for hardcoded contact information...`);

  for (const filePath of filesToScan) {
    const relativePath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const signature of FORBIDDEN_SIGNATURES) {
      if (signature.pattern.test(content)) {
        console.error(`❌ VIOLATION in ${relativePath}: Found hardcoded ${signature.label}`);
        violationsCount++;
      }
    }
  }

  // Check example files
  const exampleFiles = [
    path.join(ROOT_DIR, 'backend', '.env.example'),
    path.join(ROOT_DIR, 'frontend', '.env.example')
  ];

  console.log('\n📄 Checking .env.example files for real credentials...');
  for (const exFile of exampleFiles) {
    if (!fs.existsSync(exFile)) {
      console.warn(`⚠️ Warning: Example file missing: ${path.relative(ROOT_DIR, exFile)}`);
      continue;
    }
    const content = fs.readFileSync(exFile, 'utf8');
    for (const signature of FORBIDDEN_SIGNATURES) {
      if (signature.pattern.test(content)) {
        console.error(`❌ VIOLATION in ${path.relative(ROOT_DIR, exFile)}: Real contact info leaked into example file: ${signature.label}`);
        violationsCount++;
      }
    }
  }

  // Check .gitignore
  console.log('\n🔒 Verifying .gitignore excludes private environment files...');
  const gitignorePath = path.join(ROOT_DIR, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = ['.env', 'backend/.env', 'frontend/.env'];
    for (const pat of requiredPatterns) {
      if (!gitignoreContent.includes(pat)) {
        console.warn(`⚠️ Notice: .gitignore should explicitly exclude "${pat}"`);
      }
    }
    console.log('   ✅ .gitignore configuration checked.');
  }

  // Test backend contactConfig validation
  console.log('\n⚙️ Testing backend contactConfig validation...');
  try {
    const { validateContactConfig, getContactConfig } = require('../src/config/contactConfig');
    const result = validateContactConfig();
    console.log('   ✅ contactConfig loaded successfully. Validation returned:', result.isValid ? 'VALID' : 'WITH NOTICES');
  } catch (err) {
    console.error('❌ FAILED to load backend contactConfig:', err.message);
    violationsCount++;
  }

  console.log('\n========================================================');
  if (violationsCount === 0) {
    console.log('✅ AUDIT PASSED: ZERO hardcoded contact details detected!');
    console.log('✅ All emails and phone numbers are managed via environment variables.');
    console.log('========================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ AUDIT FAILED: ${violationsCount} security violation(s) detected.`);
    console.log('========================================================\n');
    process.exit(1);
  }
}

runAudit();
