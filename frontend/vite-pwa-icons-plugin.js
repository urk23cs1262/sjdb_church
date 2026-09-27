/* eslint-env node */
import path from 'path';
import fs from 'fs';
import { syncPwaIcons } from './scripts/sync-pwa-icons.js';

export function pwaIconsPlugin() {
  const rootDir = process.cwd();
  const sourceImage = path.resolve(rootDir, 'src/assets/sjdb_image.png');
  const assetsDir = path.resolve(rootDir, 'src/assets');

  return {
    name: 'vite-plugin-pwa-icons',

    async buildStart() {
      try {
        await syncPwaIcons();
      } catch (err) {
        console.warn('[PWA Icons Plugin] Notice in buildStart:', err.message);
      }
    },

    configureServer(server) {
      // Sync on server start
      syncPwaIcons().catch(err => {
        console.warn('[PWA Icons Plugin] Notice on server start:', err.message);
      });

      // Watch for changes to sjdb_image.png or assets folder
      let debounceTimer = null;
      const onImageChange = (eventType, filename) => {
        if (!filename) return;
        const baseName = path.basename(filename).toLowerCase();
        if (baseName !== 'sjdb_image.png') return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          console.log(`[PWA Icons Plugin] Detected ${eventType} on ${filename}. Regenerating installed app icons...`);
          try {
            const updated = await syncPwaIcons(true);
            if (updated) {
              console.log('[PWA Icons Plugin] Installed app icons successfully updated.');
              if (server && server.ws) {
                server.ws.send({ type: 'full-reload' });
              }
            }
          } catch (err) {
            console.error('[PWA Icons Plugin] Error synchronizing icons:', err.message);
          }
        }, 500);
      };

      try {
        if (fs.existsSync(sourceImage)) {
          fs.watch(sourceImage, onImageChange);
        }
        if (fs.existsSync(assetsDir)) {
          fs.watch(assetsDir, onImageChange);
        }
      } catch (err) {
        console.warn('[PWA Icons Plugin] Could not attach file watcher:', err.message);
      }
    }
  };
}

export default pwaIconsPlugin;
