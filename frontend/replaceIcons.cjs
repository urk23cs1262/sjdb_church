const fs = require('fs');
const path = require('path');

const logoCode = '<div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-gold-400/50 shadow-gold"><img src={churchLogo} alt="Logo" className="w-full h-full object-cover" /></div>';

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Replace common hero GiChurch in page headers
      const targetPattern = /<GiChurch className="text-gold-300 text-6xl mx-auto mb-4" \/>/g;
      if (targetPattern.test(content)) {
        content = content.replace(targetPattern, logoCode);
        changed = true;
      }
      
      // Home page specific
      if (file === 'Home.jsx') {
        const homeTarget = /<div className="w-24 h-24 rounded-full bg-white\/10 backdrop-blur-sm border-2 border-gold-400\/50 flex items-center justify-center animate-float shadow-gold-lg">\s*<GiChurch className="text-gold-300 text-5xl" \/>\s*<\/div>/;
        if (homeTarget.test(content)) {
          content = content.replace(homeTarget, '<div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border-2 border-gold-400/50 flex items-center justify-center animate-float shadow-gold-lg overflow-hidden p-1">\n              <img src={heroBgImage} alt="Logo" className="w-full h-full object-cover rounded-full" />\n            </div>');
          changed = true;
        }
      }

      // Loader specific
      if (file === 'Loader.jsx') {
        const loaderTarget = /<GiChurch className="text-gold-300 text-4xl" \/>/;
        if (loaderTarget.test(content)) {
          content = content.replace(loaderTarget, '<div className="w-12 h-12 rounded-full overflow-hidden border border-gold-400/50"><img src={churchLogo} alt="Logo" className="w-full h-full object-cover" /></div>');
          changed = true;
        }
      }

      if (changed) {
        // Add import if not exists
        if (!content.includes('churchLogo') && file !== 'Home.jsx') {
          let depth = '../../';
          if (fullPath.includes('pages\\public') || fullPath.includes('pages\\auth') || fullPath.includes('pages\\admin') || fullPath.includes('pages\\user')) depth = '../../';
          if (fullPath.includes('components\\common')) depth = '../../';
          
          content = content.replace(/(import .* from 'react-icons\/.*?';)/, `$1\nimport churchLogo from '${depth}assets/image.png';`);
        }
        
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

const baseDir = 'c:/Users/arnda/OneDrive/Desktop/rc/frontend/src';
processDir(path.join(baseDir, 'pages'));
processDir(path.join(baseDir, 'components'));
