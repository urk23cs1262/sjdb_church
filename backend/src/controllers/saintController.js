const { getDailySaint, fetchDailySaint, getISTDateParts, buildVaticanNewsUrl } = require('../services/saintService');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

const VATICAN_NEWS_DEFAULT_URL = "https://www.vaticannews.va/en/saints.html";

const getSaint = async (req, res) => {
  try {
    const { date: reqDateStr } = req.query;
    let saint = null;

    if (reqDateStr) {
      const parts = String(reqDateStr).split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const monthNum = String(targetDate.getMonth() + 1).padStart(2, "0");
        const dayNum = String(targetDate.getDate()).padStart(2, "0");
        const yearNum = targetDate.getFullYear();
        const fallbackSaint = getSaintForDate(targetDate);

        const currentIST = getISTDateParts().dateKey;
        const requestedDateKey = `${yearNum}-${monthNum}-${dayNum}`;
        const isToday = requestedDateKey === currentIST;

        if (isToday) {
          saint = getDailySaint();
          const isStale = !saint ||
            saint.date !== currentIST ||
            saint.source === 'Catholic Liturgical Calendar' ||
            saint.source?.includes('Catholic Readings') ||
            saint.sourceUrl?.includes('catholicreadings.org') ||
            saint.saintName?.includes('Slomsek Our') ||
            saint.image?.includes('imimg.com') ||
            saint.image?.includes('metroprin') ||
            saint.image?.includes('Superdome') ||
            saint.imageFallback;
          if (isStale) {
            saint = await fetchDailySaint();
          }
        } else {
          saint = await fetchDailySaint(requestedDateKey);
        }
      }
    }

    if (!saint) {
      const currentIST = getISTDateParts().dateKey;
      saint = getDailySaint();
      const isStale = !saint ||
        saint.date !== currentIST ||
        saint.source === 'Catholic Liturgical Calendar' ||
        saint.source?.includes('Catholic Readings') ||
        saint.sourceUrl?.includes('catholicreadings.org') ||
        saint.saintName?.includes('Slomsek Our') ||
        saint.image?.includes('imimg.com') ||
        saint.image?.includes('metroprin') ||
        saint.image?.includes('Superdome') ||
        saint.imageFallback;
      if (isStale) {
        saint = await fetchDailySaint();
      }
    }

    if (!saint) {
      return res.status(404).json({ success: false, message: 'Saint details not available yet' });
    }

    const d = new Date(saint.date || new Date());
    const day = saint.day || String(d.getDate()).padStart(2, "0");
    const month = saint.month || d.toLocaleDateString('en-US', { month: 'long' });
    const monthTa = saint.monthTa || d.toLocaleDateString('ta-IN', { month: 'long' });
    const year = saint.year || d.getFullYear();
    const dayOfWeek = saint.dayOfWeek || d.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfWeekTa = saint.dayOfWeekTa || d.toLocaleDateString('ta-IN', { weekday: 'long' });

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      success: true,
      date: saint.date,
      day,
      month,
      monthTa,
      year,
      dayOfWeek,
      dayOfWeekTa,
      saintName: saint.saintName || saint.name,
      englishName: saint.englishName || saint.name,
      tamilName: saint.tamilName || saint.nameTa,
      name: saint.name || saint.saintName,
      nameTa: saint.nameTa || saint.tamilName,
      description: saint.description,
      descriptionTa: saint.descriptionTa,
      image: saint.image,
      imageSource: saint.imageSource || (saint.imageFallback ? 'fallback' : 'vatican'),
      imageSourceUrl: saint.imageSourceUrl || saint.sourceUrl || saint.link,
      imageFallback: typeof saint.imageFallback === 'boolean' ? saint.imageFallback : false,
      feastDay: saint.feastDay || `${month} ${day}`,
      feastTitle: saint.feastTitle || null,
      feastTitleTa: saint.feastTitleTa || null,
      feastType: saint.feastType || null,
      feastTypeTa: saint.feastTypeTa || null,
      hasFeastInfo: Boolean(saint.hasFeastInfo),
      source: saint.source || "Vatican News",
      sourceUrl: saint.sourceUrl || saint.link || VATICAN_NEWS_DEFAULT_URL,
      link: saint.link || saint.sourceUrl || VATICAN_NEWS_DEFAULT_URL,
      allSaints: saint.allSaints || [],
      saint
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refreshSaint = async (req, res) => {
  try {
    console.log('🔄 Manually requested Daily Saint sync from Admin Panel...');
    await fetchDailySaint();
    const saint = getDailySaint();
    const d = new Date(saint.date || new Date());
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const monthTa = d.toLocaleDateString('ta-IN', { month: 'long' });
    const year = d.getFullYear();
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfWeekTa = d.toLocaleDateString('ta-IN', { weekday: 'long' });

    res.json({
      success: true,
      date: saint.date,
      day,
      month,
      monthTa,
      year,
      dayOfWeek,
      dayOfWeekTa,
      saintName: saint.saintName || saint.name,
      englishName: saint.englishName || saint.name,
      tamilName: saint.tamilName || saint.nameTa,
      name: saint.name || saint.saintName,
      nameTa: saint.nameTa || saint.tamilName,
      description: saint.description,
      descriptionTa: saint.descriptionTa,
      image: saint.image,
      imageSource: saint.imageSource || (saint.imageFallback ? 'fallback' : 'vatican'),
      imageSourceUrl: saint.imageSourceUrl || saint.sourceUrl || saint.link,
      imageFallback: typeof saint.imageFallback === 'boolean' ? saint.imageFallback : false,
      feastDay: saint.feastDay || `${month} ${day}`,
      feastTitle: saint.feastTitle || null,
      feastTitleTa: saint.feastTitleTa || null,
      feastType: saint.feastType || null,
      feastTypeTa: saint.feastTypeTa || null,
      hasFeastInfo: Boolean(saint.hasFeastInfo),
      source: saint.source || "Vatican News",
      sourceUrl: saint.sourceUrl || saint.link || VATICAN_NEWS_DEFAULT_URL,
      link: saint.link || saint.sourceUrl || VATICAN_NEWS_DEFAULT_URL,
      allSaints: saint.allSaints || [],
      saint
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSaintStatus = async (req, res) => {
  try {
    const saint = getDailySaint();
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const vaticanDateUrl = buildVaticanNewsUrl(month, day);

    res.json({
      success: true,
      currentDate: saint ? saint.date : `${today.getFullYear()}-${month}-${day}`,
      status: saint ? saint.status : 'Synced',
      lastSynced: saint ? saint.lastSynced : null,
      name: saint ? (saint.saintName || saint.name) : 'Unknown',
      link: saint ? (saint.sourceUrl || saint.link) : vaticanDateUrl,
      sourceUrl: saint ? (saint.sourceUrl || saint.link) : vaticanDateUrl,
      image: saint ? saint.image : null,
      imageSource: saint ? saint.imageSource : 'vatican',
      imageSourceUrl: saint ? saint.imageSourceUrl : vaticanDateUrl,
      imageFallback: saint ? saint.imageFallback : false,
      feastTitle: saint ? (saint.feastTitle || null) : null,
      feastTitleTa: saint ? (saint.feastTitleTa || null) : null,
      feastType: saint ? (saint.feastType || null) : null,
      feastTypeTa: saint ? (saint.feastTypeTa || null) : null,
      hasFeastInfo: Boolean(saint && saint.hasFeastInfo),
      allSaints: saint ? (saint.allSaints || []) : []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const searchSaintImage = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Saint name is required' });
    }
    const { searchAndApplySaintImage } = require('../services/saintService');
    const result = await searchAndApplySaintImage(name.trim());
    if (result && result.url) {
      return res.json({
        success: true,
        image: result.url,
        imageSource: result.source || 'wikipedia',
        imageSourceUrl: result.sourceUrl,
        imageFallback: false
      });
    }
    const { DIGNIFIED_FALLBACK_IMAGE } = require('../services/saintImageResolver');
    return res.json({
      success: true,
      image: DIGNIFIED_FALLBACK_IMAGE,
      imageSource: 'liturgical_fallback',
      imageFallback: true
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSaint, refreshSaint, getSaintStatus, searchSaintImage };
