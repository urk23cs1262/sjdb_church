/**
 * SJDB Connect — Two-Tier Church Knowledge Base
 * 
 * Tier 1: Official SJDB Parish Information (Kalayarkoil)
 * Tier 2: Catholic Faith, Liturgy, Prayers & Scripture
 */

const SJDB_OFFICIAL_KNOWLEDGE = {
  parishName: "St. John de Britto's Church (புனித அருளானந்தர் திருத்தலம்)",
  location: "Kalayarkoil, Sivagangai District, Tamil Nadu - 630551",
  diocese: "Diocese of Sivagangai",
  patronSaint: "St. John de Britto (புனித அருளானந்தர்)",
  feastDay: "February 4 (புனித அருளானந்தர் பெருவிழா)",

  history: `St. John de Britto's Church in Kalayarkoil stands as a historic sanctuary of faith in the Sivagangai Diocese. It honors St. John de Britto (known lovingly as Arulanandar), a Portuguese Jesuit missionary who adopted local Indian attire and customs to proclaim the Gospel across the Marava country before his martyrdom at Oriyur on February 4, 1693. The parish has nurtured generations of devoted Catholic families, vocations, and vibrant Anbiyam communities.`,

  historyTa: `காளையார்கோவிலில் அமைந்துள்ள புனித அருளானந்தர் திருத்தலம் சிவகங்கை மறைமாவட்டத்தின் புகழ்மிக்க ஆலயமாகும். போர்ச்சுகல் நாட்டைச் சேர்ந்த இயேசு சபை துறவியான புனித அருளானந்தர் (ஜான் டி பிரிட்டோ), இந்திய துறவி போல காவி உடை தரித்து மறவ நாட்டில் நற்செய்தி அறிவித்து, 1693 பிப்ரவரி 4 அன்று ஓரியூரில் மறைசாட்சியாக உயிர் நீத்தார். அவரது நினைவாகவும் இறை ஆசீருடனும் விளங்கும் இத்திருத்தலம் பல தலைமுறைகளாக மக்களின் ஆன்மீகக் கோட்டையாகத் திகழ்கிறது.`,

  massTimings: {
    weekdays: "Daily Morning Mass at 6:00 AM (திங்கள் முதல் சனி வரை காலை 6:00 மணி)",
    sunday: "Sunday Masses at 6:00 AM and 8:00 AM (ஞாயிறு திருப்பலிகள்: காலை 6:00 மணி & காலை 8:00 மணி)",
    tuesdayNovena: "Tuesday Novena to St. Antony & Mass at 6:00 PM (செவ்வாய் மாலை 6:00 மணிக்கு புனித அந்தோனியார் நவநாள் திருப்பலி)",
    firstFriday: "First Friday Eucharistic Adoration & Special Mass at 6:00 PM (மாதத்தின் முதல் வெள்ளிக்கிழமை மாலை 6:00 மணிக்கு நற்கருணை ஆராதனை மற்றும் சிறப்பு திருப்பலி)"
  },

  confessionTimings: `Confessions are heard on Saturdays from 5:30 PM to 6:30 PM, before daily morning Mass, and upon personal request to the Parish Priests. (ஒப்புரவு அருட்சாதனம்: ஒவ்வொரு சனிக்கிழமை மாலை 5:30 மணி முதல் 6:30 மணி வரை, காலை திருப்பலிக்கு முன் மற்றும் பங்குத்தந்தையிடம் கேட்டறிந்து பெற்றுக்கொள்ளலாம்).`,

  sacraments: {
    baptism: "Baptism ceremonies are held with prior registration with the parish office. (ஞானஸ்நானம்: பங்கு அலுவலகத்தில் முன்பதிவு செய்து பெற்றுக்கொள்ளலாம்).",
    firstCommunion: "Prepared through parish catechism classes and celebrated annually. (முதல் நற்கருணை: மறைக்கல்வி வழியாக தயாரிப்பு பெற்று கொண்டாடப்படுகிறது).",
    confirmation: "Administered by the Bishop of Sivagangai during parish pastoral visits. (திடப்படுத்துதல்: ஆயரின் மேய்ப்புப்பணி வருகையின் போது வழங்கப்படுகிறது).",
    marriage: "Pre-Cana preparation and publication of banns at least 1 month prior are required. (திருமணம்: திருமணத் தயாரிப்பு மற்றும் 1 மாதத்திற்கு முன் அறிவிப்பு அவசியம்).",
    anointing: "Available anytime for the sick and elderly upon contacting the parish priest. (நோயாளரின் பூசுதல்: எந்த நேரத்திலும் பங்குத்தந்தையைத் தொடர்புகொள்ளலாம்)."
  },

  contact: {
    address: "St. John de Britto's Church, Church Road, Kalayarkoil - 630551, Sivagangai District, Tamil Nadu, India",
    addressTa: "புனித அருளானந்தர் திருத்தலம், தேவாலய சாலை, காளையார்கோவில் - 630551, சிவகங்கை மாவட்டம், தமிழ்நாடு, இந்தியா",
    phone: "+91 96556 39144",
    email: "arndas777@gmail.com",
    mapUrl: "https://maps.google.com/?q=St.+John+de+Britto+Church+Kalayarkoil+Tamil+Nadu+630551",
    services: "Daily Mass, Family blessings, Anbiyam meetings, Catechism, Youth movement, Vincent de Paul Society",
    website: process.env.CLIENT_URL || "https://stjb-church.vercel.app"
  },

  botUsage: `SJDB Connect WhatsApp Bot Commands:
• HI / START: Start onboarding & configure preferences
• READINGS: Receive today's Mass readings & Saint of the Day portrait
• PREFERENCES: Customize your daily subscriptions (Verse, Saint, Mass, Events, Announcements, Birthday)
• LANGUAGE: Switch devotions language (Tamil / English / Both)
• VERIFY: Link/update your registered parish phone number
• MENU: View parish overview and links
• STOP: Unsubscribe from daily broadcasts`
};

const CATHOLIC_FAITH_KNOWLEDGE = {
  tenCommandments: [
    "1. I am the Lord your God: you shall not have strange Gods before me. (நானே உன் கடவுளாகிய ஆண்டவர், என்னைத் தவிர வேறு தெய்வங்கள் உனக்கு வேண்டாம்.)",
    "2. You shall not take the name of the Lord your God in vain. (இறைவனின் திருப்பெயரை வீணாகப் பயன்படுத்தாதே.)",
    "3. Remember to keep holy the Lord's Day. (ஆண்டவரின் ஓய்வுநாளைப் புனிதமாகக் கடைப்பிடி.)",
    "4. Honor your father and your mother. (தாய் தந்தையரை மதித்து நட.)",
    "5. You shall not kill. (கொலை செய்யாதே.)",
    "6. You shall not commit adultery. (விபச்சாரம் செய்யாதே.)",
    "7. You shall not steal. (திருடாதே.)",
    "8. You shall not bear false witness against your neighbor. (பொய்ச்சான்று சொல்லாதே.)",
    "9. You shall not covet your neighbor's wife. (பிறர் மனைவியை விரும்பாதே.)",
    "10. You shall not covet your neighbor's goods. (பிறர் உடைமைகளை விரும்பாதே.)"
  ],

  prayers: {
    ourFather: {
      en: `Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.`,
      ta: `பரலோகத்தில் இருக்கிற எங்கள் பிதாவே, உம்முடைய நாமம் அர்ச்சிக்கப்படுவதாக. உம்முடைய நாடு வருக. உம்முடைய சித்தம் பரலோகத்தில் செய்யப்படுவது போல, பூலோகத்திலும் செய்யப்படுவதாக. எங்கள் அன்றாட உணவை எங்களுக்கு இன்று அளித்தருளும். எங்களுக்குத் தீமை செய்வோரை நாங்கள் மன்னிப்பது போல, எங்கள் பாவங்களை மன்னித்தருளும். எங்களை சோதனையில் விழவிடாதேயும், தீமையிலிருந்து எங்களை இரட்சித்தருளும். ஆமென்.`
    },
    hailMary: {
      en: `Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.`,
      ta: `அருள் நிறைந்த மரியே வாழ்க! கர்த்தர் உம்முடனே. பெண்களுக்குள் ஆசீர்வதிக்கப்பட்டவர் நீரே, உம்முடைய திருவயிற்றின் கனியாகிய இயேசுவும் ஆசீர்வதிக்கப்பட்டவரே. தூய மரியே, இறைவனின் தாயே, பாவிகளாய் இருக்கிற எங்களுக்காக இப்பொழுதும் எங்கள் இறப்பின் வேளையிலும் வேண்டிக்கொள்ளும். ஆமென்.`
    },
    gloryBe: {
      en: `Glory be to the Father, and to the Son, and to the Holy Spirit, as it was in the beginning, is now, and ever shall be, world without end. Amen.`,
      ta: `பிதாவுக்கும் சுதனுக்கும் தூய ஆவிக்கும் மகிமை உண்டாவதாக. ஆதியிலே இருந்ததுபோல இப்பொழுதும் எப்பொழுதும் என்றென்றும் இருப்பதாக. ஆமென்.`
    },
    creed: {
      en: `I believe in God, the Father Almighty, Creator of heaven and earth, and in Jesus Christ, His only Son, our Lord...`,
      ta: `பரலோகத்தையும் பூலோகத்தையும் படைத்த எல்லாம் வல்ல பிதாவாகிய கடவுளை விசுவாசிக்கிறேன். அவருடைய ஒரே மகனாகிய நம்முடைய நாதர் இயேசுகிறிஸ்துவையும் விசுவாசிக்கிறேன்...`
    }
  },

  rosaryMysteries: {
    joyful: "Joyful Mysteries (மகிழ்ச்சி மறைபொருள்கள்): Annunciation, Visitation, Nativity, Presentation, Finding in the Temple (Mondays & Saturdays).",
    luminous: "Luminous Mysteries (ஒளி மறைபொருள்கள்): Baptism of Jesus, Wedding at Cana, Proclamation of the Kingdom, Transfiguration, Institution of the Eucharist (Thursdays).",
    sorrowful: "Sorrowful Mysteries (துயர மறைபொருள்கள்): Agony in the Garden, Scourging at the Pillar, Crowning with Thorns, Carrying of the Cross, Crucifixion (Tuesdays & Fridays).",
    glorious: "Glorious Mysteries (மகிமை மறைபொருள்கள்): Resurrection, Ascension, Descent of the Holy Spirit, Assumption of Mary, Coronation of Mary (Wednesdays & Sundays)."
  },

  liturgicalSeasons: {
    advent: "Advent (திருவருகைக் காலம்): 4 weeks of preparation for the Nativity of our Lord Jesus Christ. Color: Violet.",
    christmas: "Christmas Season (கிறிஸ்து பிறப்பு காலம்): Celebrating the Incarnation and Epiphany. Color: White / Gold.",
    lent: "Lent (தவக்காலம்): 40 days of prayer, fasting, and almsgiving starting on Ash Wednesday. Color: Violet.",
    holyWeek: "Holy Week (புனித வாரம்): Palm Sunday, Maundy Thursday (Last Supper), Good Friday (Passion & Death), Holy Saturday.",
    easter: "Easter Season (பாஸ்கா காலம்): 50 days of joy celebrating the Resurrection of Christ until Pentecost. Color: White / Gold.",
    ordinaryTime: "Ordinary Time (பொதுக்காலம்): Weeks celebrating the teachings, miracles, and life of Christ. Color: Green."
  },

  sacramentsList: [
    "1. Baptism (ஞானஸ்நானம் / திருமுழுக்கு) — Entry into Christian life",
    "2. Confirmation (திடப்படுத்துதல் / உறுதிப்பூசுதல்) — Gift of the Holy Spirit",
    "3. Eucharist (நற்கருணை / திருவிருந்து) — The Body and Blood of Christ",
    "4. Penance / Reconciliation (ஒப்புரவு / பாவமன்னிப்பு) — Forgiveness of sins",
    "5. Anointing of the Sick (நோயாளரின் பூசுதல்) — Healing and grace",
    "6. Holy Orders (குருத்துவம் / திருப்பட்டம்) — Priesthood ministry",
    "7. Matrimony (திருமணம் / திருமண அருட்சாதனம்) — Holy union in Christ"
  ]
};

module.exports = {
  SJDB_OFFICIAL_KNOWLEDGE,
  CATHOLIC_FAITH_KNOWLEDGE
};
