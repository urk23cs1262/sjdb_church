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

        const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
        if (isToday) {
          saint = getDailySaint();
          const hasShortBio = !saint || !saint.description || saint.description.length < 250;
          const hasMissingSecondaryImages = saint?.saints && saint.saints.length > 1 && saint.saints.some(s => !s.image && !s.imageUrl);
          const hasMissingSecondaryBio = saint?.saints && saint.saints.length > 1 && saint.saints.some(s => !s.description || s.description.length < 200);
          const isStaleMissingStructure = !saint?.primarySaint || !saint?.otherSaints || !saint?.primaryCelebration;
          const isStaleRosary = currentIST.endsWith('-10-07') && (
            !saint?.primarySaint?.name?.includes('Rosary') ||
            !saint?.saintName?.includes('Rosary') ||
            !saint?.description?.includes('Holy Rosary originated in 1212') ||
            !saint?.primarySaint?.sourceUrl?.includes('memorial-of-our-lady-of-the-rosary')
          );
          const isStale = forceRefresh ||
            !saint ||
            saint.date !== currentIST ||
            isStaleMissingStructure ||
            isStaleRosary ||
            (currentIST.endsWith('-09-26') && (saint.saintName?.includes('Nilus') || saint.name?.includes('Nilus'))) ||
            saint.source?.includes('Catholic Readings') ||
            saint.sourceUrl?.includes('catholicreadings.org') ||
            saint.saintName?.includes('Slomsek Our') ||
            saint.image?.includes('imimg.com') ||
            saint.image?.includes('metroprin') ||
            saint.image?.includes('Superdome') ||
            saint.image?.includes('Rossano_NILO') ||
            saint.imageFallback ||
            hasMissingSecondaryImages ||
            hasMissingSecondaryBio ||
            hasShortBio;
          if (isStale) {
            saint = await fetchDailySaint(undefined, true);
          }
        } else {
          saint = await fetchDailySaint(requestedDateKey, forceRefresh);
        }
      }
    }

    if (!saint) {
      const currentIST = getISTDateParts().dateKey;
      const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
      saint = getDailySaint();
      const hasShortBio = !saint || !saint.description || saint.description.length < 250;
      const hasMissingSecondaryImages = saint?.saints && saint.saints.length > 1 && saint.saints.some(s => !s.image && !s.imageUrl);
      const hasMissingSecondaryBio = saint?.saints && saint.saints.length > 1 && saint.saints.some(s => !s.description || s.description.length < 200);
      const isStaleMissingStructure = !saint?.primarySaint || !saint?.otherSaints || !saint?.primaryCelebration;
      const isStaleRosary = currentIST.endsWith('-10-07') && (
        !saint?.primarySaint?.name?.includes('Rosary') ||
        !saint?.saintName?.includes('Rosary') ||
        !saint?.description?.includes('Holy Rosary originated in 1212') ||
        !saint?.primarySaint?.sourceUrl?.includes('memorial-of-our-lady-of-the-rosary')
      );
      const isStale = forceRefresh ||
        !saint ||
        saint.date !== currentIST ||
        isStaleMissingStructure ||
        isStaleRosary ||
        (currentIST.endsWith('-09-26') && (saint.saintName?.includes('Nilus') || saint.name?.includes('Nilus'))) ||
        saint.source?.includes('Catholic Readings') ||
        saint.sourceUrl?.includes('catholicreadings.org') ||
        saint.saintName?.includes('Slomsek Our') ||
        saint.image?.includes('imimg.com') ||
        saint.image?.includes('metroprin') ||
        saint.image?.includes('Superdome') ||
        saint.image?.includes('Rossano_NILO') ||
        saint.imageFallback ||
        hasMissingSecondaryImages ||
        hasMissingSecondaryBio ||
        hasShortBio;
      if (isStale) {
        saint = await fetchDailySaint(undefined, true);
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
      primaryCelebration: saint.primaryCelebration || {
        name: saint.primarySaint?.name || saint.saintName || saint.name,
        type: saint.primarySaint?.celebrationType || saint.primarySaint?.type || saint.feastType || "Memorial",
        description: saint.primarySaint?.description || saint.description,
        image: saint.primarySaint?.image || saint.image,
        sourceUrl: saint.primarySaint?.sourceUrl || saint.sourceUrl || saint.link,
        source: saint.primarySaint?.source || "Vatican News"
      },
      primarySaint: saint.primarySaint || {
        name: saint.saintName || saint.name,
        title: saint.feastTitle || saint.saintName,
        celebrationType: saint.feastType || null,
        feastName: saint.saintName || saint.name,
        description: saint.description,
        image: saint.image,
        source: saint.source || "Vatican News"
      },
      otherSaints: saint.otherSaints || [],
      source: saint.source || "Vatican News",
      sourceUrl: saint.primaryCelebration?.sourceUrl || saint.primarySaint?.sourceUrl || saint.sourceUrl || saint.link || VATICAN_NEWS_DEFAULT_URL,
      link: saint.primaryCelebration?.sourceUrl || saint.primarySaint?.sourceUrl || saint.link || saint.sourceUrl || VATICAN_NEWS_DEFAULT_URL,
      saints: saint.saints || saint.allSaints || [],
      allSaints: saint.allSaints || saint.saints || [],
      saint
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refreshSaint = async (req, res) => {
  try {
    console.log('🔄 Manually requested Daily Saint sync from Admin Panel...');
    await fetchDailySaint(undefined, true);
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
      primaryCelebration: saint.primaryCelebration || {
        name: saint.primarySaint?.name || saint.saintName || saint.name,
        type: saint.primarySaint?.celebrationType || saint.primarySaint?.type || saint.feastType || "Memorial",
        description: saint.primarySaint?.description || saint.description,
        image: saint.primarySaint?.image || saint.image,
        sourceUrl: saint.primarySaint?.sourceUrl || saint.sourceUrl || saint.link,
        source: saint.primarySaint?.source || "Vatican News"
      },
      primarySaint: saint.primarySaint || {
        name: saint.saintName || saint.name,
        title: saint.feastTitle || saint.saintName,
        celebrationType: saint.feastType || null,
        feastName: saint.saintName || saint.name,
        description: saint.description,
        image: saint.image,
        source: saint.source || "Vatican News"
      },
      otherSaints: saint.otherSaints || [],
      source: saint.source || "Vatican News",
      sourceUrl: saint.primaryCelebration?.sourceUrl || saint.primarySaint?.sourceUrl || saint.sourceUrl || saint.link || VATICAN_NEWS_DEFAULT_URL,
      link: saint.primaryCelebration?.sourceUrl || saint.primarySaint?.sourceUrl || saint.link || saint.sourceUrl || VATICAN_NEWS_DEFAULT_URL,
      saints: saint.saints || saint.allSaints || [],
      allSaints: saint.allSaints || saint.saints || [],
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
      primarySaint: saint?.primarySaint || null,
      otherSaints: saint?.otherSaints || [],
      saints: saint ? (saint.saints || saint.allSaints || []) : [],
      allSaints: saint ? (saint.allSaints || saint.saints || []) : []
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
