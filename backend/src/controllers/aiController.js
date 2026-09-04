const axios = require('axios');

/**
 * Format a Date object or string into standard Catholic parish date format:
 * e.g. "Sunday, 30 August 2026" or "30 August 2026"
 */
function formatParishDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Fallback AI content generator for Catholic Parish Resources
function generateParishAIContent(type, title, category, extra = {}) {
  const cleanTitle = (title || '').trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const catStr = (category || extra.category || '').toLowerCase();
  const venueStr = extra.venue || "St. John de britto Church Parish Hall, Kalayarkoil";
  const organizerStr = extra.organizer || "St. John de britto Church Parish Office";
  const dateStr = extra.date ? formatParishDate(extra.date) : '';
  const timeStr = extra.time || '';
  const isRegRequired = extra.registrationRequired === true || extra.registrationRequired === 'true';

  // 1. GALLERY
  if (type === 'gallery') {
    if (catStr === 'feast' || lowerTitle.includes('feast') || lowerTitle.includes('novena')) {
      return `A solemn moment capturing "${cleanTitle}" during St. John de britto Annual Feast celebration. Parishioners and devotees gather in heartfelt prayer, Holy Mass, and sacred procession to honor our patron saint.`;
    }
    if (catStr === 'events' || lowerTitle.includes('event') || lowerTitle.includes('youth') || lowerTitle.includes('choir')) {
      return `Vibrant highlights from "${cleanTitle}" at St. John de britto Church, Kalayarkoil. Capturing the joy, fellowship, and active participation of our parish community.`;
    }
    if (catStr === 'priests' || lowerTitle.includes('fr') || lowerTitle.includes('father') || lowerTitle.includes('priest')) {
      return `Blessed moments with clergy during "${cleanTitle}" at St. John de britto Church, Kalayarkoil, offering pastoral guidance, holy sacraments, and spiritual leadership to our parish family.`;
    }
    if (catStr === 'church' || lowerTitle.includes('altar') || lowerTitle.includes('shrine') || lowerTitle.includes('statue')) {
      return `A sacred view of "${cleanTitle}" at St. John de britto Church, Kalayarkoil. A peaceful place of prayer, divine grace, and spiritual reflection for all believers.`;
    }
    return `A cherished photograph capturing "${cleanTitle}" at St. John de britto Church, Kalayarkoil. Preserving moments of faith, fellowship, and sacred traditions of our parish family.`;
  }

  // 2. EVENTS
  if (type === 'events' || type === 'event') {
    const dateTimeClause = (dateStr || timeStr)
      ? `on ${dateStr || 'the scheduled date'}${timeStr ? ` at ${timeStr}` : ''} at ${venueStr}`
      : `at ${venueStr}`;

    // Feast / Novena
    if (catStr === 'feast' || lowerTitle.includes('feast') || lowerTitle.includes('novena') || lowerTitle.includes('britto')) {
      return `St. John de britto Church, Kalayarkoil, warmly invites all parishioners, families, and devotees to join in the solemn celebration of ${cleanTitle} ${dateTimeClause}.

The celebration is being organized by ${organizerStr} as an occasion for our entire parish community to unite in heartfelt prayer, Holy Mass, and fellowship to receive divine blessings through the intercession of our patron saint.

The program will include the solemn Eucharistic celebration, novena prayers, flag hoisting, blessing of the faithful, and community fellowship.

All parishioners and families are encouraged to participate and make the celebration a joyful and spiritually enriching occasion for our parish community.

Please arrive at the venue on time and cooperate with the organizers throughout the program.

For further information, please contact the Parish Office.`;
    }

    // Youth / Choir / Meeting / Catechism
    if (catStr === 'youth' || catStr === 'choir' || catStr === 'catechism' || catStr === 'meeting' || lowerTitle.includes('youth') || lowerTitle.includes('choir') || lowerTitle.includes('meeting') || lowerTitle.includes('seminar')) {
      return `St. John de britto Church, Kalayarkoil, warmly invites all concerned members and families to participate in ${cleanTitle} ${dateTimeClause}.

The program is being organized by ${organizerStr} to promote spiritual growth, leadership development, and active engagement within our parish community and ministries.

The gathering will include opening prayers, guided reflection, group discussions, and activity planning for the upcoming parish calendar.

All concerned members are kindly requested to attend on time and contribute constructively to our parish life.

For further details and registration assistance, please contact the Parish Office.`;
    }

    // Medical / Blood donation / Charity
    if (lowerTitle.includes('blood') || lowerTitle.includes('medical') || lowerTitle.includes('camp') || lowerTitle.includes('health') || lowerTitle.includes('charity')) {
      return `St. John de britto Church, Kalayarkoil, in collaboration with ${organizerStr}, is organizing ${cleanTitle} ${dateTimeClause} to serve our parish families and the wider local community.

Qualified medical professionals and parish volunteers will be present to offer free medical consultations, essential health screenings, and voluntary blood donation facilities.

All parishioners, neighbors, and people in need are warmly encouraged to utilize these services and participate in this mission of Christian charity.

"Amen, I say to you, whatever you did for one of these least brothers of mine, you did for me." (Matthew 25:40).

For appointments and further information, please contact the Parish Office.`;
    }

    // Default Complete Parish Event (e.g. Parish Family Gathering, Community Day)
    return `St. John de britto Church, Kalayarkoil, warmly invites all parishioners and their families to the ${cleanTitle}.

The gathering is being organized as an opportunity for parish families to come together in fellowship, strengthen community relationships, and participate in activities prepared by the parish.

The program will include prayer, fellowship, family activities, and community interaction.

All parishioners and families are encouraged to participate and make the gathering a joyful and meaningful occasion for our parish community.

Please arrive at the venue on time and cooperate with the organizers throughout the program.

For further information, please contact the Parish Office.`;
  }

  // 3. ANNOUNCEMENTS
  if (type === 'announcements' || type === 'announcement') {
    // Council / Committee / Meeting
    if (lowerTitle.includes('council') || lowerTitle.includes('committee') || lowerTitle.includes('meeting') || catStr === 'meeting') {
      const scheduleInfo = (dateStr || timeStr)
        ? `on ${dateStr || 'the scheduled date'}${timeStr ? ` at ${timeStr}` : ' at 5:00 PM'} at ${venueStr || 'the Parish Hall'}`
        : 'on Sunday, 30 August 2026, at 5:00 PM at the Parish Hall';

      return `The Parish Office of St. John de britto Church, Kalayarkoil, wishes to inform all parishioners that a ${cleanTitle} will be held ${scheduleInfo}.

All Parish Council members and concerned representatives are kindly requested to attend the meeting on time. Important matters concerning the parish community, upcoming pastoral activities, and parish programs will be discussed during the meeting.

We request all concerned members to take note of the schedule and participate responsibly.

For further details, please contact the Parish Office.`;
    }

    // Mass / Liturgy Timings
    if (lowerTitle.includes('mass') || lowerTitle.includes('timing') || lowerTitle.includes('schedule') || lowerTitle.includes('liturgy')) {
      return `The Parish Office of St. John de britto Church, Kalayarkoil, wishes to inform all parishioners regarding the upcoming schedule for ${cleanTitle}.

Please take note of the updated Mass timings and liturgical services. All parishioners are kindly requested to arrive at the church 15 minutes prior to Holy Mass for personal prayer and spiritual preparation.

Parishioners wishing to book Mass intentions or special blessings are requested to visit the Parish Office during office hours.

We encourage all families to participate actively in the Holy Eucharist and parish liturgies.

For further inquiries, please contact the Parish Office.`;
    }

    // Feast / Novena Announcement
    if (lowerTitle.includes('feast') || lowerTitle.includes('novena') || lowerTitle.includes('procession') || catStr === 'feast') {
      return `The Parish Office of St. John de britto Church, Kalayarkoil, joyfully announces to all parishioners the upcoming celebration of ${cleanTitle}.

All parishioners, devotees, and parish families are warmly invited to participate in the Holy Eucharistic celebrations, novena devotions, and parish programs organized in honor of our patron saint.

Detailed liturgical schedules, Anbiyam animators' roles, and choir arrangements will be announced during Sunday Masses.

Let us come together in prayer, unity, and thanksgiving for the abundant graces showered upon our parish family.

For further information, please contact the Parish Office.`;
    }

    // Urgent / Emergency Notice
    if (lowerTitle.includes('emergency') || lowerTitle.includes('alert') || lowerTitle.includes('urgent') || catStr === 'emergency' || extra.priority === 'urgent') {
      return `URGENT PARISH NOTICE: ${cleanTitle}

The Parish Office of St. John de britto Church, Kalayarkoil, wishes to urgently inform all parishioners about ${cleanTitle}.

All parishioners, Anbiyam leaders, and parish units are requested to take immediate note of this notice and follow the guidelines issued by the Parish Administration.

We kindly request all members to assist elderly and vulnerable neighbors in our parish community during this time.

For emergency pastoral assistance or clarifications, please contact the Parish Office immediately.`;
    }

    // Marriage / Banns
    if (lowerTitle.includes('marriage') || lowerTitle.includes('bann') || catStr === 'marriage') {
      return `The Parish Office of St. John de britto Church, Kalayarkoil, publishes the announcement regarding ${cleanTitle}.

The parish community is requested to pray for the couples preparing to receive the Holy Sacrament of Matrimony, that their married life may be filled with God's peace, love, and grace.

If anyone knows of any canonical impediment to these marriages, they are obliged in conscience to bring it to the attention of the Parish Priest.

For further information, please contact the Parish Office.`;
    }

    // General Parish Announcement Default
    return `The Parish Office of St. John de britto Church, Kalayarkoil, wishes to inform all parishioners regarding ${cleanTitle}.

All parishioners and Basic Christian Communities (Anbiyams) are kindly requested to take note of this information and participate actively in the related parish initiatives.

We request all families to share this message with fellow members of our parish community.

For further details or clarifications, please contact the Parish Office.`;
  }

  // 4. PRIESTS
  if (type === 'priests' || type === 'priest') {
    return `Rev. Fr. ${cleanTitle} serves as a dedicated shepherd at St. John de britto Church, Kalayarkoil. With a deep commitment to spiritual guidance, Eucharistic celebrations, pastoral counseling, and youth ministry, Fr. ${cleanTitle} works tirelessly to strengthen the faith and unity of our parish family.`;
  }

  // 5. TEAM MEMBERS
  if (type === 'team') {
    return `${cleanTitle} actively serves our parish family at St. John de britto Church, Kalayarkoil. Dedicated to organizing parish ministries, Anbiyam outreach, and church events, working in unity to support our priests and parishioners.`;
  }

  // 6. DOCUMENTS
  if (type === 'documents' || type === 'document') {
    return `Official parish guidelines for requesting "${cleanTitle}" certificate from St. John de britto Church, Kalayarkoil. Please submit your application form along with necessary details. Certificates are verified and issued by the Parish Priest after verification.`;
  }

  // 7. DONATIONS
  if (type === 'donations' || type === 'donation') {
    return `Support our parish campaign: "${cleanTitle}". Your generous contributions to St. John de britto Church help maintain our sanctuary, support parish welfare initiatives, and serve those in need. "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." (2 Corinthians 9:7)`;
  }

  // DEFAULT FALLBACK
  return `The Parish Office of St. John de britto Church, Kalayarkoil, publishes this official information regarding "${cleanTitle}". Serving our parish community with faith, hope, and Christian charity.`;
}

// POST /api/ai/generate-content
exports.generateAIContent = async (req, res) => {
  try {
    const {
      title,
      type = 'events',
      field = 'description',
      category = '',
      album = '',
      venue = '',
      role = '',
      date = '',
      time = '',
      organizer = '',
      priority = '',
      expiresAt = '',
      registrationRequired = false
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required for AI content generation.' });
    }

    const cleanTitle = title.trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        let typeDescription = 'Parish Content';
        if (type === 'gallery') typeDescription = 'Church Gallery Photo Caption/Description';
        else if (type === 'events' || type === 'event') typeDescription = 'Official Parish Event Description';
        else if (type === 'announcements' || type === 'announcement') typeDescription = 'Complete Parish Announcement Content';
        else if (type === 'priests' || type === 'priest') typeDescription = 'Priest Ministry Biography';
        else if (type === 'team') typeDescription = 'Parish Team Member Profile';
        else if (type === 'documents' || type === 'document') typeDescription = 'Certificate Application Guidelines';
        else if (type === 'donations' || type === 'donation') typeDescription = 'Charitable Donation Campaign Appeal';

        const prompt = `You are the official Catholic Parish Communication Assistant for St. John de britto Church, Kalayarkoil.
Write a comprehensive, dignified, realistic, and complete ${typeDescription} for the item titled "${cleanTitle}".

Context Information:
- Item Type: ${type}
- Title: ${cleanTitle}
- Category: ${category || 'General'}
${date ? `- Date: ${date}` : ''}
${time ? `- Time: ${time}` : ''}
${venue ? `- Venue: ${venue}` : "- Venue: St. John de britto Church Parish Hall, Kalayarkoil"}
${organizer ? `- Organizer: ${organizer}` : "- Organizer: St. John de britto Church Parish Office"}
${registrationRequired ? '- Requires Registration: Yes' : '- Requires Registration: No'}
${priority ? `- Priority: ${priority}` : ''}
${album ? `- Album: ${album}` : ''}
${role ? `- Role: ${role}` : ''}

Strict Formatting Rules:
1. Write in a warm, welcoming, and pastoral Catholic tone representing St. John de britto Church, Kalayarkoil.
2. The content must be a COMPLETE, full-length parish text (between 80 and 160 words across 3-4 structured paragraphs).
3. For Announcements: Start with "The Parish Office of St. John de britto Church, Kalayarkoil, wishes to inform all parishioners that...", provide the purpose, date/time/venue details if applicable, request attendance/action, and conclude with "For further details, please contact the Parish Office."
4. For Events: Start with "St. John de britto Church, Kalayarkoil, warmly invites all parishioners and their families to...", detail the purpose and program highlights, advise arriving on time, and conclude with contact instructions.
5. NEVER output short broken words, placeholders (like "Niki" or "ee"), or bullet symbols.
6. Output clean, readable plain text paragraphs only without markdown headings (# or ##).`;

        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }]
          },
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );

        const generatedText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        // Guard against any truncated or nonsense output (< 40 words)
        if (generatedText && generatedText.split(/\s+/).length >= 35) {
          return res.json({ success: true, text: generatedText });
        }
      } catch (geminiError) {
        console.warn(' Gemini API call failed, falling back to local parish AI model:', geminiError.message);
      }
    }

    // Fallback to local intelligent parish AI generator
    const generatedText = generateParishAIContent(type, cleanTitle, category, {
      album,
      venue,
      role,
      date,
      time,
      organizer,
      priority,
      expiresAt,
      registrationRequired
    });
    res.json({ success: true, text: generatedText });
  } catch (err) {
    console.error(' AI generation error:', err);
    res.status(500).json({ message: err.message || 'AI Generation failed' });
  }
};

exports.generateParishAIContent = generateParishAIContent;


