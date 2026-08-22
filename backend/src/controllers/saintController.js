const { getDailySaint, fetchDailySaint } = require('../services/saintService');

const getSaint = async (req, res) => {
  try {
    const saint = getDailySaint();
    if (!saint) {
      return res.status(404).json({ success: false, message: 'Saint details not available yet' });
    }
    // Return flat properties requested by user as well as nested saint object for full backwards compatibility
    res.json({
      success: true,
      date: saint.date,
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
      feastDay: saint.feastDay,
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
    res.json({
      success: true,
      date: saint.date,
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
      feastDay: saint.feastDay,
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
