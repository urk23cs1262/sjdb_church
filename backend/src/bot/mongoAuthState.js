/**
 * SJDB Connect — MongoDB Auth State Adapter for Baileys
 * 
 * Stores Baileys WhatsApp authentication credentials directly in MongoDB Atlas.
 * This ensures WhatsApp session persistence when deployed on Render or any cloud provider,
 * so you NEVER have to scan a QR code again when the server restarts or redeploys!
 */

const mongoose = require('mongoose');
const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

const authKeySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "creds" or "pre-key-1"
  data: { type: String, required: true }, // Encoded JSON string
}, { timestamps: true });

const AuthKey = mongoose.models.BaileysAuth || mongoose.model('BaileysAuth', authKeySchema);

async function useMongoDBAuthState() {
  const readData = async (id) => {
    try {
      const doc = await AuthKey.findById(id);
      if (doc && doc.data) {
        return JSON.parse(doc.data, BufferJSON.reviver);
      }
    } catch (err) {
      console.error(`Error reading Baileys auth key ${id}:`, err.message);
    }
    return null;
  };

  const writeData = async (id, data) => {
    try {
      if (data === null || data === undefined) {
        await AuthKey.findByIdAndDelete(id);
      } else {
        await AuthKey.findByIdAndUpdate(
          id,
          { _id: id, data: JSON.stringify(data, BufferJSON.replacer) },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      console.error(`Error writing Baileys auth key ${id}:`, err.message);
    }
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(writeData(key, value));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData('creds', creds)
  };
}

async function clearMongoDBAuthState() {
  try {
    await AuthKey.deleteMany({});
    console.log(' Cleared all Baileys auth keys from MongoDB');
  } catch (err) {
    console.error('Failed to clear Baileys auth keys:', err.message);
  }
}

module.exports = { useMongoDBAuthState, clearMongoDBAuthState };
