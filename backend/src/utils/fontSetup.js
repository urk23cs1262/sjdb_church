const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function generateFontConfigXml(fontsDir) {
  const normFontsDir = fontsDir.replace(/\\/g, '/');
  return `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <!-- Priority 1: Bundled backend fonts directory -->
  <dir>${normFontsDir}</dir>
  <dir prefix="relative">./</dir>
  <dir>/tmp/fonts</dir>
  
  <!-- Priority 2: User fonts directories on Linux -->
  <dir>~/.fonts</dir>
  <dir>~/.local/share/fonts</dir>

  <!-- Priority 3: System fonts on Linux if present -->
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir>/usr/share/fonts/truetype</dir>
  <dir>/usr/share/fonts/opentype</dir>

  <!-- Writable cache directory for fontconfig -->
  <cachedir>/tmp/fonts-cache</cachedir>
  <cachedir>~/.cache/fontconfig</cachedir>

  <!-- Include system font config if present -->
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>

  <!-- Prefer Noto Sans Tamil for Tamil script and fallback chains -->
  <alias>
    <family>sans-serif</family>
    <prefer>
      <family>Noto Sans Tamil</family>
      <family>Latha</family>
      <family>DejaVu Sans</family>
    </prefer>
  </alias>

  <alias>
    <family>serif</family>
    <prefer>
      <family>Noto Sans Tamil</family>
      <family>Latha</family>
      <family>DejaVu Serif</family>
    </prefer>
  </alias>

  <match target="pattern">
    <test qual="any" name="family">
      <string>Noto Sans Tamil</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>Noto Sans Tamil</string>
    </edit>
  </match>

  <match target="pattern">
    <test qual="any" name="family">
      <string>SJDBTamil</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>Noto Sans Tamil</string>
    </edit>
  </match>

  <config>
    <rescan>
      <int>30</int>
    </rescan>
  </config>
</fontconfig>
`;
}

function initFontConfig() {
  try {
    const fontsDir = path.resolve(__dirname, '../../assets/fonts');
    if (!fs.existsSync(fontsDir)) {
      console.warn('[FontSetup] Bundled fonts directory not found at:', fontsDir);
      return;
    }

    // 1. Ensure writable cache directories for fontconfig
    const cacheDir = path.join(os.tmpdir(), 'fonts-cache');
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
    }
    const homeCacheDir = path.join(os.homedir(), '.cache', 'fontconfig');
    if (!fs.existsSync(homeCacheDir)) {
      try { fs.mkdirSync(homeCacheDir, { recursive: true }); } catch (_) {}
    }

    // 2. Generate and write fonts.conf with absolute directory path
    const confXml = generateFontConfigXml(fontsDir);
    const confPath = path.join(fontsDir, 'fonts.conf');
    fs.writeFileSync(confPath, confXml, 'utf8');

    // 3. On Linux / Container environments, populate standard user font directories and user fonts.conf
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
      const userFontDirs = [
        path.join(os.homedir(), '.fonts'),
        path.join(os.homedir(), '.local', 'share', 'fonts'),
        path.join(os.tmpdir(), 'fonts')
      ];

      const fontFiles = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf') || f.endsWith('.otf'));
      for (const udir of userFontDirs) {
        try {
          if (!fs.existsSync(udir)) {
            fs.mkdirSync(udir, { recursive: true });
          }
          for (const file of fontFiles) {
            const dest = path.join(udir, file);
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(path.join(fontsDir, file), dest);
            }
          }
        } catch (_) {}
      }

      // Also place fonts.conf in ~/.fonts.conf and ~/.config/fontconfig/fonts.conf
      try {
        fs.writeFileSync(path.join(os.homedir(), '.fonts.conf'), confXml, 'utf8');
      } catch (_) {}
      try {
        const configFontDir = path.join(os.homedir(), '.config', 'fontconfig');
        if (!fs.existsSync(configFontDir)) {
          fs.mkdirSync(configFontDir, { recursive: true });
        }
        fs.writeFileSync(path.join(configFontDir, 'fonts.conf'), confXml, 'utf8');
      } catch (_) {}

      // Try running fc-cache if present on the system
      try {
        execSync(`fc-cache -f "${fontsDir}" 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
      } catch (_) {}
    }

    // 4. Set FONTCONFIG environment variables before sharp/librsvg initializes
    process.env.FONTCONFIG_PATH = fontsDir;
    process.env.FONTCONFIG_FILE = confPath;
    process.env.PANGOCAIRO_BACKEND = 'fc';

    console.log(`[FontSetup] ✅ Fontconfig initialized successfully. FONTCONFIG_PATH set to: ${fontsDir}`);

    // 5. Invalidate old cached verse images on startup to prevent serving stale tofu-box images
    try {
      const cacheDirUploads = path.resolve(__dirname, '../../uploads/cache');
      if (fs.existsSync(cacheDirUploads)) {
        const files = fs.readdirSync(cacheDirUploads);
        for (const f of files) {
          if (f.startsWith('verse_')) {
            try { fs.unlinkSync(path.join(cacheDirUploads, f)); } catch (_) {}
          }
        }
        console.log('[FontSetup] 🧹 Purged stale verse image cache');
      }
    } catch (_) {}

  } catch (err) {
    console.error('[FontSetup] ❌ Error initializing fonts:', err.message);
  }
}

// Execute immediately when imported
initFontConfig();

module.exports = { initFontConfig };

