const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

// In-memory cache keyed by date string
const cache = {};

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

async function fetchTamilMassReading(dateStr) {
  const [year, month, day] = dateStr.split('-');
  
  // Format for Catholic Gallery is tr-DDMMYY where YY is last 2 digits of year
  const yy = year.substring(2);
  const urlDate = `tr-${day}${month}${yy}`;

  const urls = [
    `https://bible.catholicgallery.org/tamil-mass-reading/${urlDate}/`,
    `https://bible.catholicgallery.org/ta-mass-reading/${urlDate}/`,
    `https://www.tamilcatholicdaily.com/dailyverse/${day}-${month}-${year}/` // Fallback
  ];

  let html = null;
  let finalUrl = null;

  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChurchBot/1.0)' },
      });
      html = resp.data;
      finalUrl = url;
      break;
    } catch (_) {
      continue;
    }
  }

  if (!html) throw new Error('Could not fetch Tamil mass reading from any source');

  const $ = cheerio.load(html);

  const pageTitle = $('h1.entry-title, .entry-title, h1').first().text().trim();
  const dateLabel = $('.entry-date, .published, time').first().text().trim();

  const sections = [];
  $('h2, h3, h4').each((_, el) => {
    const heading = $(el).text().trim();
    if (!heading) return;
    let content = '';
    let sibling = $(el).next();
    while (sibling.length && !sibling.is('h2, h3, h4')) {
      const text = sibling.text().trim();
      if (text) content += text + '\n\n';
      sibling = sibling.next();
    }
    if (content.trim()) sections.push({ heading, content: content.trim() });
  });

  let fullText = '';
  $('.entry-content p, .entry-content div').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !text.includes('Share:')) {
      fullText += text + '\n\n';
    }
  });

  return {
    date: dateStr,
    pageTitle,
    dateLabel,
    sections,
    fullText: fullText.trim(),
    sourceUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
  };
}

// GET /api/mass-reading?date=2026-05-08
router.get('/', async (req, res) => {
  try {
    const dateStr = req.query.date || getTodayKey();

    if (cache[dateStr]) {
      return res.json({ success: true, cached: true, data: cache[dateStr] });
    }

    const data = await fetchTamilMassReading(dateStr);
    cache[dateStr] = data;

    res.json({ success: true, cached: false, data });
  } catch (error) {
    console.error('Tamil mass reading fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch Tamil mass reading', error: error.message });
  }
});

module.exports = router;
