const { getDailySaint, fetchDailySaint } = require('../services/saintService');
const { getSaintForDate } = require('../data/catholic_saints_calendar');

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

        const today = new Date();
        const isToday = targetDate.toDateString() === today.toDateString();

        if (isToday) {
          saint = getDailySaint();
        } else {
          saint = {
            date: `${yearNum}-${monthNum}-${dayNum}`,
            day: dayNum,
            month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
            monthTa: targetDate.toLocaleDateString('ta-IN', { month: 'long' }),
            year: yearNum,
            dayOfWeek: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
            dayOfWeekTa: targetDate.toLocaleDateString('ta-IN', { weekday: 'long' }),
            saintName: fallbackSaint.name,
            englishName: fallbackSaint.name,
            tamilName: fallbackSaint.nameTa,
            name: fallbackSaint.name,
            nameTa: fallbackSaint.nameTa,
            description: fallbackSaint.description,
            descriptionTa: fallbackSaint.descriptionTa,
            image: fallbackSaint.image,
            imageSource: "liturgical_calendar",
            imageSourceUrl: fallbackSaint.link,
            imageFallback: true,
            feastDay: fallbackSaint.feastDay || targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
            source: "Vatican News / Catholic Liturgical Calendar",
            sourceUrl: `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
            link: fallbackSaint.link || `https://www.vaticannews.va/en/saints/${monthNum}/${dayNum}.html`,
            status: "Synced"
          };
        }
      }
    }

    if (!saint) {
      saint = getDailySaint();
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
      source: saint.source || "Vatican News",
      sourceUrl: saint.sourceUrl || saint.link,
      link: saint.link || saint.sourceUrl,
      saint
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const refreshSaint = async (req, res) => {
  try {
    console.log(' Manually requested Daily Saint sync from Admin Panel...');
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
      source: saint.source || "Vatican News",
      sourceUrl: saint.sourceUrl || saint.link,
      link: saint.link || saint.sourceUrl,
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
    const vaticanUrl = `https://www.vaticannews.va/en/saints/${month}/${day}.html`;

    res.json({
      success: true,
      currentDate: saint ? saint.date : `${today.getFullYear()}-${month}-${day}`,
      status: saint ? saint.status : 'Synced',
      lastSynced: saint ? saint.lastSynced : null,
      name: saint ? (saint.saintName || saint.name) : 'Unknown',
      link: saint ? (saint.sourceUrl || saint.link) : vaticanUrl,
      sourceUrl: vaticanUrl,
      image: saint ? saint.image : null,
      imageSource: saint ? saint.imageSource : 'vatican',
      imageSourceUrl: saint ? saint.imageSourceUrl : vaticanUrl,
      imageFallback: saint ? saint.imageFallback : false
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSaint, refreshSaint, getSaintStatus };
