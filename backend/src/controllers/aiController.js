const axios = require('axios');

// Fallback AI content generator for Catholic Parish Resources
function generateParishAIContent(type, title, category, extra = {}) {
  const cleanTitle = (title || '').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const catStr = (category || extra.category || '').toLowerCase();

  // 1. GALLERY
  if (type === 'gallery') {
    if (catStr === 'feast' || lowerTitle.includes('feast') || lowerTitle.includes('novena')) {
      return `A solemn moment capturing "${cleanTitle}" during St. John de Britto's Annual Feast celebration. Parishioners and devotees gather in heartfelt prayer, Holy Mass, and sacred procession to honor our patron saint.`;
    }
    if (catStr === 'events' || lowerTitle.includes('event') || lowerTitle.includes('youth') || lowerTitle.includes('choir')) {
      return `Vibrant highlights from "${cleanTitle}" at St. John de Britto's Church, Kalayarkoil. Capturing the joy, fellowship, and active participation of our parish community.`;
    }
    if (catStr === 'priests' || lowerTitle.includes('fr') || lowerTitle.includes('father') || lowerTitle.includes('priest')) {
      return `Blessed moments with clergy during "${cleanTitle}" at St. John de Britto's Church, Kalayarkoil, offering pastoral guidance, holy sacraments, and spiritual leadership to our parish family.`;
    }
    if (catStr === 'church' || lowerTitle.includes('altar') || lowerTitle.includes('shrine') || lowerTitle.includes('statue')) {
      return `A sacred view of "${cleanTitle}" at St. John de Britto's Church, Kalayarkoil. A peaceful place of prayer, divine grace, and spiritual reflection for all believers.`;
    }
    return `A cherished photograph capturing "${cleanTitle}" at St. John de Britto's Church, Kalayarkoil. Preserving moments of faith, fellowship, and sacred traditions of our parish family.`;
  }

  // 2. EVENTS
  if (type === 'events' || type === 'event') {
    if (lowerTitle.includes('feast') || lowerTitle.includes('novena') || lowerTitle.includes('britto')) {
      return `Join us for the grand celebration of ${cleanTitle} at St. John de Britto's Church, Kalayarkoil! 

We invite all parishioners, families, and devotees to gather in solemn prayer, Holy Mass, and fellowship. The feast will commence with a special Eucharistic celebration, followed by novena prayers, blessing of the faithful, and community agape.

Mass Schedule & Devotions:
• Holy Mass & Flag Hoisting
• Special Novena Prayers & Adoration
• Procession of the Holy Relic
• Fellowship & Refreshments for all attendees.

Let us come together in unity and faith to receive divine graces through the intercession of St. John de Britto!`;
    }

    if (lowerTitle.includes('youth') || lowerTitle.includes('choir') || lowerTitle.includes('meeting')) {
      return `Calling all members for ${cleanTitle} at St. John de Britto's Parish Hall!

This gathering will focus on spiritual growth, community outreach, and organizing upcoming parish ministries. All members are encouraged to attend, participate in group discussions, and share their ideas.

Program Highlights:
• Opening Prayer & Scripture Reading
• Interactive Discussion & Planning Session
• Youth / Ministry Initiatives for the upcoming month
• Closing Blessing & Tea Fellowship.

Your presence and active participation strengthen our parish community!`;
    }

    if (lowerTitle.includes('blood') || lowerTitle.includes('medical') || lowerTitle.includes('camp') || lowerTitle.includes('health')) {
      return `St. John de Britto's Church, Kalayarkoil is organizing ${cleanTitle} to serve our parish and local community.

Medical professionals and volunteers will be available to provide free health consultations, blood donation drives, and awareness sessions.

Event Services:
• Free Doctor Consultation & Health Checkups
• Voluntary Blood Donation Drive
• Essential Medicine Distribution & Guidance

"Amen, I say to you, whatever you did for one of these least brothers of mine, you did for me." (Matthew 25:40). Please register and spread the word to those in need!`;
    }

    return `We warmly invite all parishioners to attend ${cleanTitle} organized at St. John de Britto's Church, Kalayarkoil.

This event offers a wonderful opportunity for our parish family to unite in prayer, reflection, and community fellowship. 

Program Details:
• Opening Prayer & Eucharistic Blessing
• Keynote Address & Guided Spiritual Reflection
• Community Discussions & Activities
• Closing Prayer & Light Fellowship.

Come with your family and friends to share in this blessed gathering!`;
  }

  // 3. ANNOUNCEMENTS
  if (type === 'announcements' || type === 'announcement') {
    if (lowerTitle.includes('mass') || lowerTitle.includes('timing') || lowerTitle.includes('schedule')) {
      return `Special Announcement regarding ${cleanTitle}:

Please take note of the updated Mass schedules and liturgy timings for St. John de Britto's Church, Kalayarkoil. All parishioners are requested to arrive 15 minutes prior to Mass for personal prayer and preparation.

For Mass intentions, special blessings, or confession timings, please contact the Parish Office during working hours.`;
    }

    if (lowerTitle.includes('emergency') || lowerTitle.includes('alert') || lowerTitle.includes('urgent') || lowerTitle.includes('notice')) {
      return `URGENT PARISH NOTICE: ${cleanTitle}

Dear Parishioners, please be informed about ${cleanTitle}. The Parish Administration requests everyone to follow the guidelines provided and stay tuned for further updates.

For urgent inquiries or emergency pastoral assistance, please contact the Parish Priest or Parish Office immediately.`;
    }

    return `Parish Announcement: ${cleanTitle}

The Parish Office of St. John de Britto's Church, Kalayarkoil wishes to inform all parishioners about ${cleanTitle}. 

We kindly request all families to take note of this information and share it within your Anbiyam (Basic Christian Communities). For further details or clarifications, please visit the Parish Office after Sunday Mass.

"May the grace of our Lord Jesus Christ, and the love of God, and the fellowship of the Holy Spirit be with you all." (2 Corinthians 13:14)`;
  }

  // 4. PRIESTS
  if (type === 'priests' || type === 'priest') {
    return `Rev. Fr. ${cleanTitle} serves as a dedicated shepherd at St. John de Britto's Church, Kalayarkoil. With a deep commitment to spiritual guidance, Eucharistic celebrations, pastoral counseling, and youth ministry, Fr. ${cleanTitle} works tirelessly to strengthen the faith and unity of our parish family.`;
  }

  // 5. TEAM MEMBERS
  if (type === 'team') {
    return `${cleanTitle} actively serves our parish family at St. John de Britto's Church, Kalayarkoil. Dedicated to organizing parish ministries, Anbiyam outreach, and church events, working in unity to support our priests and parishioners.`;
  }

  // 6. DOCUMENTS
  if (type === 'documents' || type === 'document') {
    return `Official parish guidelines for requesting "${cleanTitle}" certificate from St. John de Britto's Church, Kalayarkoil. Please submit your application form along with necessary details. Certificates are verified and issued by the Parish Priest after verification.`;
  }

  // 7. DONATIONS
  if (type === 'donations' || type === 'donation') {
    return `Support our parish campaign: "${cleanTitle}". Your generous contributions to St. John de Britto's Church help maintain our sanctuary, support parish welfare initiatives, and serve those in need. "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." (2 Corinthians 9:7)`;
  }

  // DEFAULT FALLBACK
  return `${cleanTitle} — St. John de Britto's Church, Kalayarkoil. Serving our parish community with faith, hope, and Christian love.`;
}

// POST /api/ai/generate-content
exports.generateAIContent = async (req, res) => {
  try {
    const { title, type = 'events', field = 'description', category = '', album = '', venue = '', role = '' } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required for AI content generation.' });
    }

    const cleanTitle = title.trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        let typeDescription = 'Parish Content';
        if (type === 'gallery') typeDescription = 'Church Gallery Photo Caption/Description';
        else if (type === 'events') typeDescription = 'Parish Event Description';
        else if (type === 'announcements') typeDescription = 'Official Parish Announcement Content';
        else if (type === 'priests') typeDescription = 'Priest Ministry Biography';
        else if (type === 'team') typeDescription = 'Parish Team Member Profile';
        else if (type === 'documents') typeDescription = 'Certificate Application Guidelines';
        else if (type === 'donations') typeDescription = 'Charitable Donation Campaign Appeal';

        const prompt = `You are a helpful Catholic Parish AI Assistant for St. John de Britto's Church, Kalayarkoil.
Generate a high quality, realistic, warm, and inspiring ${typeDescription} for a ${type} item titled "${cleanTitle}".
Context details:
- Category: ${category || 'General'}
${album ? `- Album: ${album}` : ''}
${venue ? `- Venue: ${venue}` : ''}
${role ? `- Role: ${role}` : ''}

Requirements:
- Written in a welcoming, pastoral, and realistic tone suitable for a Catholic church.
- Tailored specifically to the title "${cleanTitle}" and the item type "${type}".
- If type is 'gallery', write 2-3 inspiring sentences suitable for a photo description.
- If type is 'events' or 'announcements', include key highlights or bullet points and a biblical verse at the end.
- Maximum 150-200 words. Output clean plain text without markdown header symbols like # or **.`;

        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }]
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );

        const generatedText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedText) {
          return res.json({ success: true, text: generatedText.trim() });
        }
      } catch (geminiError) {
        console.warn(' Gemini API call failed, falling back to local parish AI model:', geminiError.message);
      }
    }

    // Fallback to local intelligent parish AI generator
    const generatedText = generateParishAIContent(type, cleanTitle, category, { album, venue, role });
    res.json({ success: true, text: generatedText });
  } catch (err) {
    console.error(' AI generation error:', err);
    res.status(500).json({ message: err.message || 'AI Generation failed' });
  }
};
