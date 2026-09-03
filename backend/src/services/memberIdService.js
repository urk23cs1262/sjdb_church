const User = require('../models/User');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config/memberIdConfig.json');

// Default configuration
let config = {
  prefix: 'SJDB_M',
  padLength: 2,
  familyPrefix: 'SJDB_FAM-',
  familyPadLength: 2
};

// Load config from file if exists
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = { ...config, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading member/family ID config:', err.message);
  }
  return config;
}

// Save config to file
function saveConfig(newConfig) {
  try {
    config = { ...config, ...newConfig };
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving member/family ID config:', err.message);
  }
}

// Get current format metadata
function getMemberIdFormat() {
  loadConfig();
  const prefix = config.prefix || 'SJDB_M';
  const padLength = config.padLength || 2;
  const familyPrefix = config.familyPrefix || 'SJDB_FAM-';
  const familyPadLength = config.familyPadLength || 2;

  return {
    prefix,
    padLength,
    familyPrefix,
    familyPadLength,
    sample: formatMemberId(1, prefix, padLength),
    familySample: formatMemberId(1, familyPrefix, familyPadLength)
  };
}

// Helper to format a number into ID string
function formatMemberId(num, prefix = config.prefix, padLength = config.padLength) {
  const padded = String(num).padStart(padLength, '0');
  return `${prefix}${padded}`;
}

/**
 * Generates the next sequential Parish Member ID (e.g. SJDB_M01)
 */
async function generateNextMemberId() {
  loadConfig();
  const prefix = config.prefix || 'SJDB_M';
  const padLength = config.padLength || 2;

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

  const users = await User.find({ parishMemberId: { $exists: true, $ne: null } })
    .select('parishMemberId')
    .lean();

  let maxNum = 0;
  users.forEach(u => {
    if (u.parishMemberId) {
      const match = u.parishMemberId.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return formatMemberId(nextNum, prefix, padLength);
}

/**
 * Generates the next sequential Family Member ID (e.g. SJDB_FAM-01)
 */
async function generateNextFamilyId() {
  loadConfig();
  const familyPrefix = config.familyPrefix || 'SJDB_FAM-';
  const familyPadLength = config.familyPadLength || 2;

  const escapedPrefix = familyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');

  const users = await User.find({ familyId: { $exists: true, $ne: null } })
    .select('familyId')
    .lean();

  let maxNum = 0;
  users.forEach(u => {
    if (u.familyId) {
      const match = u.familyId.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return formatMemberId(nextNum, familyPrefix, familyPadLength);
}

/**
 * Automatically assigns unique sequential Member IDs and Family IDs to any users missing one.
 * Members sharing the SAME familyName get the EXACT SAME Family ID!
 */
async function autoAssignMemberIds() {
  loadConfig();
  try {
    const allUsers = await User.find({}).sort({ createdAt: 1 });
    const seenMemberIds = new Set();
    const familyMap = new Map(); // familyName.toLowerCase() -> familyId string
    let memberNum = 1;
    let familyNum = 1;
    let updatedCount = 0;

    const prefix = config.prefix || 'SJDB_M';
    const padLength = config.padLength || 2;
    const familyPrefix = config.familyPrefix || 'SJDB_FAM-';
    const familyPadLength = config.familyPadLength || 2;

    // First pass: store existing familyIds by familyName
    for (const u of allUsers) {
      const normFamName = (u.familyName || '').trim().toLowerCase();
      if (u.familyId && normFamName && !familyMap.has(normFamName)) {
        familyMap.set(normFamName, u.familyId);
      }
    }

    for (const u of allUsers) {
      let updateObj = {};

      // 1. Parish Member ID
      const currentMemberId = (u.parishMemberId || '').trim();
      if (!currentMemberId || seenMemberIds.has(currentMemberId.toUpperCase())) {
        let newId = formatMemberId(memberNum, prefix, padLength);
        while (seenMemberIds.has(newId.toUpperCase())) {
          memberNum++;
          newId = formatMemberId(memberNum, prefix, padLength);
        }
        updateObj.parishMemberId = newId;
        seenMemberIds.add(newId.toUpperCase());
        memberNum++;
      } else {
        seenMemberIds.add(currentMemberId.toUpperCase());
      }

      // 2. Family ID: users under the SAME familyName share the SAME Family ID!
      const currentFamilyId = (u.familyId || '').trim();
      const normFamName = (u.familyName || u.name || '').trim().toLowerCase();

      if (!currentFamilyId) {
        if (normFamName && familyMap.has(normFamName)) {
          updateObj.familyId = familyMap.get(normFamName);
        } else {
          let newFamId = formatMemberId(familyNum, familyPrefix, familyPadLength);
          updateObj.familyId = newFamId;
          if (normFamName) familyMap.set(normFamName, newFamId);
          familyNum++;
        }
      } else if (normFamName && !familyMap.has(normFamName)) {
        familyMap.set(normFamName, currentFamilyId);
      }

      if (Object.keys(updateObj).length > 0) {
        await User.updateOne({ _id: u._id }, { $set: updateObj });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(` Auto-assigned unique Parish Member & shared Family IDs for ${updatedCount} users`);
    } else {
      console.log(' All users already have unique Parish Member & shared Family IDs');
    }
  } catch (err) {
    console.error(' Error auto-assigning member/family IDs:', err.message);
  }
}

/**
 * Regenerates Member IDs AND Family IDs for ALL existing users with new prefix & padding format.
 * All members sharing the SAME familyName get the EXACT SAME Family ID!
 */
async function regenerateAllMemberIds(newPrefix, newPadLength = 2, newFamilyPrefix, newFamilyPadLength = 2) {
  const prefix = (newPrefix || 'SJDB_M').trim();
  const padLength = parseInt(newPadLength, 10) || 2;
  const familyPrefix = (newFamilyPrefix || 'SJDB_FAM-').trim();
  const familyPadLength = parseInt(newFamilyPadLength, 10) || 2;

  // Save new format configuration
  saveConfig({ prefix, padLength, familyPrefix, familyPadLength });

  const allUsers = await User.find({}).sort({ createdAt: 1 });
  let memberNum = 1;
  let familyNum = 1;
  const familyMap = new Map(); // familyName.toLowerCase() -> familyId
  const updatedUsers = [];

  for (const u of allUsers) {
    const newMemberId = formatMemberId(memberNum, prefix, padLength);
    
    // Group by familyName so members of the same family get the SAME Family ID!
    const normFamName = (u.familyName || u.name || '').trim().toLowerCase();
    let assignedFamilyId;

    if (normFamName && familyMap.has(normFamName)) {
      assignedFamilyId = familyMap.get(normFamName);
    } else {
      assignedFamilyId = formatMemberId(familyNum, familyPrefix, familyPadLength);
      if (normFamName) familyMap.set(normFamName, assignedFamilyId);
      familyNum++;
    }
    
    await User.updateOne(
      { _id: u._id },
      { $set: { parishMemberId: newMemberId, familyId: assignedFamilyId } }
    );

    updatedUsers.push({
      id: u._id,
      name: u.name,
      parishMemberId: newMemberId,
      familyId: assignedFamilyId
    });

    memberNum++;
  }

  console.log(` Successfully regenerated Member & Family IDs for all ${allUsers.length} users (Shared Family IDs applied)`);
  return {
    success: true,
    totalUpdated: allUsers.length,
    newFormat: `${prefix}${String(1).padStart(padLength, '0')}`,
    newFamilyFormat: `${familyPrefix}${String(1).padStart(familyPadLength, '0')}`,
    updatedUsers
  };
}

/**
 * Resolves the family ID for a given familyName.
 * If another user has this exact familyName (case-insensitive), returns their existing familyId.
 * If no user has this familyName, generates the next new unique sequential familyId.
 */
async function resolveFamilyIdForName(familyName, excludeUserId = null) {
  if (!familyName || !familyName.trim()) {
    return { familyId: '', isExisting: false, familyName: '' };
  }
  const cleanName = familyName.trim();
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = {
    familyName: { $regex: new RegExp(`^${escaped}$`, 'i') },
    familyId: { $exists: true, $ne: '' }
  };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const existing = await User.findOne(query).select('familyId familyName').lean();
  if (existing && existing.familyId) {
    return {
      familyId: existing.familyId,
      isExisting: true,
      familyName: existing.familyName
    };
  }

  // If no other user has this familyName, check if the current user itself already had a valid familyId
  if (excludeUserId) {
    const currentUser = await User.findById(excludeUserId).select('familyId familyName').lean();
    if (currentUser && currentUser.familyName && currentUser.familyName.trim().toLowerCase() === cleanName.toLowerCase() && currentUser.familyId) {
      return {
        familyId: currentUser.familyId,
        isExisting: false,
        familyName: cleanName
      };
    }
  }

  const nextFamId = await generateNextFamilyId();
  return {
    familyId: nextFamId,
    isExisting: false,
    familyName: cleanName
  };
}

module.exports = {
  getMemberIdFormat,
  generateNextMemberId,
  generateNextFamilyId,
  autoAssignMemberIds,
  regenerateAllMemberIds,
  resolveFamilyIdForName
};
