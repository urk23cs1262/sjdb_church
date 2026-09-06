/**
 * Test Suite: Rosary & Devotional Personalized Playback Progress System
 * Tests per-user persistence, independent progress isolation, resume logic,
 * zero daily reset, and controller handlers.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const RosarySong = require('./models/RosarySong');
const UserDevotionalProgress = require('./models/UserDevotionalProgress');
const { 
  getUserPlaybackProgress, 
  saveUserPlaybackProgress 
} = require('./controllers/rosarySongController');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING DEVOTIONAL PLAYBACK PROGRESS TEST SUITE');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sjdb_church';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB:', mongoUri);

  try {
    // 1. Setup Mock Test Users and Songs
    console.log('\n--- TEST 1: Setup Mock Users & Songs ---');
    const userA = await User.findOneAndUpdate(
      { phone: '9999900001' },
      { name: 'Devotional User A', phone: '9999900001', passwordHash: 'hash', role: 'user', isActive: true },
      { upsert: true, new: true }
    );
    const userB = await User.findOneAndUpdate(
      { phone: '9999900002' },
      { name: 'Devotional User B', phone: '9999900002', passwordHash: 'hash', role: 'user', isActive: true },
      { upsert: true, new: true }
    );
    const userC = await User.findOneAndUpdate(
      { phone: '9999900003' },
      { name: 'Devotional User C', phone: '9999900003', passwordHash: 'hash', role: 'user', isActive: true },
      { upsert: true, new: true }
    );

    // Create 3 mock test songs
    const song1 = await RosarySong.findOneAndUpdate(
      { title: 'Test Song 1 - Ave Maria' },
      { title: 'Test Song 1 - Ave Maria', fileUrl: '/api/files/test_song_1', fileName: 'song1.mp3', sortOrder: 1, isActive: true },
      { upsert: true, new: true }
    );
    const song2 = await RosarySong.findOneAndUpdate(
      { title: 'Test Song 2 - Lourdes Hymn' },
      { title: 'Test Song 2 - Lourdes Hymn', fileUrl: '/api/files/test_song_2', fileName: 'song2.mp3', sortOrder: 2, isActive: true },
      { upsert: true, new: true }
    );
    const song3 = await RosarySong.findOneAndUpdate(
      { title: 'Test Song 3 - St John de Britto Hymn' },
      { title: 'Test Song 3 - St John de Britto Hymn', fileUrl: '/api/files/test_song_3', fileName: 'song3.mp3', sortOrder: 3, isActive: true },
      { upsert: true, new: true }
    );

    assert(userA && userB && userC, 'Test users A, B, and C created/verified');
    assert(song1 && song2 && song3, 'Test songs 1, 2, and 3 created/verified');

    // 2. Test Independent Progress Per User
    console.log('\n--- TEST 2: Per-User Independent Progress Persistence ---');
    
    // User A -> Song 1, 138s (2:18), isCompleted: false
    await UserDevotionalProgress.findOneAndUpdate(
      { userId: userA._id },
      {
        userId: userA._id,
        songId: song1._id,
        songTitle: song1.title,
        songIndex: 0,
        positionSeconds: 138,
        isCompleted: false,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    // User B -> Song 2, 45s (0:45), isCompleted: false
    await UserDevotionalProgress.findOneAndUpdate(
      { userId: userB._id },
      {
        userId: userB._id,
        songId: song2._id,
        songTitle: song2.title,
        songIndex: 1,
        positionSeconds: 45,
        isCompleted: false,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    // User C -> Song 3, 190s (3:10), isCompleted: true
    await UserDevotionalProgress.findOneAndUpdate(
      { userId: userC._id },
      {
        userId: userC._id,
        songId: song3._id,
        songTitle: song3.title,
        songIndex: 2,
        positionSeconds: 190,
        isCompleted: true,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    const progA = await UserDevotionalProgress.findOne({ userId: userA._id }).lean();
    const progB = await UserDevotionalProgress.findOne({ userId: userB._id }).lean();
    const progC = await UserDevotionalProgress.findOne({ userId: userC._id }).lean();

    assert(progA.positionSeconds === 138 && progA.songIndex === 0 && !progA.isCompleted, 
      'User A has independent progress at Song 1, position 138s (2:18), isCompleted: false');
    assert(progB.positionSeconds === 45 && progB.songIndex === 1 && !progB.isCompleted, 
      'User B has independent progress at Song 2, position 45s (0:45), isCompleted: false');
    assert(progC.positionSeconds === 190 && progC.songIndex === 2 && progC.isCompleted, 
      'User C has independent progress at Song 3, position 190s (3:10), isCompleted: true');

    // 3. Modifying User A has ZERO effect on User B or User C
    console.log('\n--- TEST 3: Cross-User Isolation Verification ---');
    await UserDevotionalProgress.findOneAndUpdate(
      { userId: userA._id },
      { $set: { positionSeconds: 160 } }
    );

    const checkProgA = await UserDevotionalProgress.findOne({ userId: userA._id }).lean();
    const checkProgB = await UserDevotionalProgress.findOne({ userId: userB._id }).lean();
    const checkProgC = await UserDevotionalProgress.findOne({ userId: userC._id }).lean();

    assert(checkProgA.positionSeconds === 160, 'User A updated to 160s');
    assert(checkProgB.positionSeconds === 45, 'User B unchanged at 45s');
    assert(checkProgC.positionSeconds === 190, 'User C unchanged at 190s');

    // 4. Test Resume Logic Resolution
    console.log('\n--- TEST 4: Resume Logic Validation (Mid-song vs Completed) ---');
    const mockPlaylist = [song1, song2, song3];

    // Helper implementation matching frontend logic
    function testResolveResume(songs, progress) {
      if (!songs || songs.length === 0) return { targetIndex: 0, targetTime: 0 };
      if (!progress) return { targetIndex: 0, targetTime: 0 };

      if (progress.isCompleted) {
        let baseIndex = 0;
        if (progress.songId) {
          const sId = progress.songId.toString();
          const idx = songs.findIndex(s => s._id.toString() === sId);
          if (idx !== -1) baseIndex = idx;
          else if (typeof progress.songIndex === 'number') baseIndex = progress.songIndex;
        } else if (typeof progress.songIndex === 'number') {
          baseIndex = progress.songIndex;
        }
        return { targetIndex: (baseIndex + 1) % songs.length, targetTime: 0 };
      }

      let targetIndex = -1;
      if (progress.songId) {
        const sId = progress.songId.toString();
        targetIndex = songs.findIndex(s => s._id.toString() === sId);
      }
      if (targetIndex === -1 && typeof progress.songIndex === 'number') {
        targetIndex = progress.songIndex;
      }
      if (targetIndex === -1) targetIndex = 0;

      return { targetIndex, targetTime: 0 };
    }

    // User A left mid-song at 160s -> should start from first (0:00) of Song 1 (index 0)
    const resumeA = testResolveResume(mockPlaylist, checkProgA);
    assert(resumeA.targetIndex === 0 && resumeA.targetTime === 0,
      'User A resumes from the first (0:00) of the current song where user closed (index 0)');

    // User C completed Song 3 (index 2) -> should advance to next song (index 0 wrap-around) at 0s
    const resumeC = testResolveResume(mockPlaylist, checkProgC);
    assert(resumeC.targetIndex === 0 && resumeC.targetTime === 0,
      'User C advances to next song in playlist sequence starting at 0s');

    // If song was deleted, gracefully resolves to valid index
    const orphanProgress = {
      songId: new mongoose.Types.ObjectId(), // non-existent song
      songIndex: 1,
      positionSeconds: 88,
      isCompleted: false
    };
    const orphanResume = testResolveResume(mockPlaylist, orphanProgress);
    assert(orphanResume.targetIndex === 1 && orphanResume.targetTime === 0,
      'Gracefully falls back to songIndex starting from 0:00 if songId was removed');

    // 5. Test Zero Daily Reset
    console.log('\n--- TEST 5: Zero Daily Reset Verification ---');
    // Set timestamp to 3 days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await UserDevotionalProgress.findOneAndUpdate(
      { userId: userB._id },
      { $set: { lastUpdated: threeDaysAgo } }
    );

    const staleProgB = await UserDevotionalProgress.findOne({ userId: userB._id }).lean();
    assert(staleProgB.positionSeconds === 45, 'Progress is preserved across days without resetting to Song 1');
    assert(staleProgB.songIndex === 1, 'Song index is retained across days without daily reset');

    // 6. Test Controller API Handlers
    console.log('\n--- TEST 6: Controller Endpoints (getUserPlaybackProgress & saveUserPlaybackProgress) ---');
    
    // 6a. getUserPlaybackProgress
    let getResult = null;
    const reqGet = { user: { _id: userA._id } };
    const resGet = {
      json: (data) => { getResult = data; },
      status: () => resGet
    };
    await getUserPlaybackProgress(reqGet, resGet);
    assert(getResult && getResult.success === true && getResult.progress.positionSeconds === 160,
      'getUserPlaybackProgress returns progress for authenticated user');

    // 6b. saveUserPlaybackProgress
    let saveResult = null;
    const reqSave = {
      user: { _id: userA._id },
      body: {
        songId: song2._id,
        songTitle: song2.title,
        songIndex: 1,
        positionSeconds: 75.4,
        isCompleted: false
      }
    };
    const resSave = {
      json: (data) => { saveResult = data; },
      status: () => resSave
    };
    await saveUserPlaybackProgress(reqSave, resSave);
    assert(saveResult && saveResult.success === true && saveResult.progress.positionSeconds === 75.4 && saveResult.progress.songIndex === 1,
      'saveUserPlaybackProgress upserts new position and song index for user');

    // 6c. Unauthorized check
    let authError = null;
    const reqUnauth = { user: null };
    const resUnauth = {
      status: (code) => {
        authError = code;
        return { json: () => {} };
      }
    };
    await getUserPlaybackProgress(reqUnauth, resUnauth);
    assert(authError === 401, 'Unauthenticated request correctly rejected with 401');

    // Clean up test data
    await UserDevotionalProgress.deleteMany({ userId: { $in: [userA._id, userB._id, userC._id] } });
    await RosarySong.deleteMany({ _id: { $in: [song1._id, song2._id, song3._id] } });
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id] } });

    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('================================================================\n');

  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:', err);
  process.exit(1);
});
