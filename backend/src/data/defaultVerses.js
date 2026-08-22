const DEFAULT_VERSES = [
  {
    "id": 1,
    "ref": "John 3:16",
    "category": "Love",
    "verseTextEn": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    "verseTextTa": "தேவன் உலகத்தையே இவ்வளவாக நேசித்தார், அதினால் தம்முடைய ஒரேபேறான குமாரனை அனுப்பினார்; அவரை விசுவாசிக்கிறவன் எவனோ அவன் கெட்டுப்போகாமல் நித்தியஜீவனை அடையும்படிக்கே அவரை அனுப்பினார்."
  },
  {
    "id": 2,
    "ref": "Psalm 23:1",
    "category": "Trust",
    "verseTextEn": "The Lord is my shepherd; I shall not want.",
    "verseTextTa": "கர்த்தர் என் மேய்ப்பர்; எனக்கு குறைவில்லை."
  },
  {
    "id": 3,
    "ref": "Philippians 4:13",
    "category": "Strength",
    "verseTextEn": "I can do all things through Christ who strengthens me.",
    "verseTextTa": "என்னை பலப்படுத்துகிற கிறிஸ்துவினாலே எல்லாவற்றையும் செய்யக்கூடும்."
  },
  {
    "id": 4,
    "ref": "Matthew 11:28",
    "category": "Comfort & Healing",
    "verseTextEn": "Come to me, all you who are weary and burdened, and I will give you rest.",
    "verseTextTa": "பல்லாயிரவர் வருத்தப்பட்டு சுமையடிக்கப்பட்டவர்களே! நீங்கள் எல்லாரும் என்னிடத்தில் வாருங்கள், நான் உங்களுக்கு இளைப்பாறுதல் தருவேன்."
  },
  {
    "id": 5,
    "ref": "Proverbs 3:5-6",
    "category": "Trust",
    "verseTextEn": "Trust in the Lord with all your heart and lean not on your own understanding.",
    "verseTextTa": "உன் முழு இருதயத்தோடும் கர்த்தரை நம்பு; உன் சுயபுத்தியை நம்பாதே."
  },
  {
    "id": 6,
    "ref": "Romans 8:28",
    "category": "Love",
    "verseTextEn": "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
    "verseTextTa": "தேவனிடத்தில் அன்புகூருகிறவர்களுக்கும், அவருடைய தீர்மானத்தின்படி அழைக்கப்பட்டவர்களுக்கும், சகல காரியங்களும் நன்மையை உண்டாக்க ஒருமிக்க உதவுகிறது என்று அறிந்திருக்கிறோம்."
  },
  {
    "id": 7,
    "ref": "Isaiah 40:31",
    "category": "Strength",
    "verseTextEn": "But those who hope in the Lord will renew their strength. They will soar on wings like eagles.",
    "verseTextTa": "கர்த்தருக்குக் காத்திருக்கிறவர்களோ புது பெலனடைவார்கள்; கழுகுகளைப்போல் சிறகுகளைக் கட்டிக்கொண்டு பறப்பார்கள்."
  },
  {
    "id": 8,
    "ref": "Matthew 6:33",
    "category": "Prayer",
    "verseTextEn": "But seek first his kingdom and his righteousness, and all these things will be given to you as well.",
    "verseTextTa": "முதலாவது அவருடைய ராஜ்யத்தையும் அவருடைய நீதியையும் தேடுங்கள்; இவைகளெல்லாம் உங்களுக்கு அதிகமாகக் கொடுக்கப்படும்."
  },
  {
    "id": 9,
    "ref": "Romans 8:38-39",
    "category": "Love",
    "verseTextEn": "For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers, neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.",
    "verseTextTa": "மரணமாவது, ஜீவனாவது, தூதர்களாவது, அதிகாரங்களாவது, இனிச் சம்பவிக்கும் காரியங்களாவது, வல்லமைகளாவது, உயரமாவது, ஆழமாவது, சிருஷ்டிக்கப்பட்ட வேறெந்த சிருஷ்டியாவது, நம்முடைய கர்த்தராகிய கிறிஸ்து இயேசுவில் இருக்கிற தேவனுடைய அன்பிலிருந்து நம்மைப் பிரிக்கலாம் என்று நிச்சயமாய் அறிந்திருக்கிறேன்."
  },
  {
    "id": 10,
    "ref": "Jeremiah 29:11",
    "category": "Hope",
    "verseTextEn": "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
    "verseTextTa": "உங்களைக் குறித்து நான் வைத்திருக்கிற எண்ணங்கள் நான் அறிவேன்; அவை உங்களுக்குச் சமாதானத்தைக் கொடுத்து, உங்களைத் தீமையிலிருந்து காத்து, உங்களுக்கு நம்பிக்கையையும் எதிர்காலத்தையும் தரும் எண்ணங்களே."
  },
  {
    "id": 11,
    "ref": "Psalm 119:105",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Your word is a lamp for my feet, a light on my path.",
    "verseTextTa": "உமது வார்த்தை என் கால்களுக்கு தீபமும், என் வழிகளுக்கு வெளிச்சுமுமாயிருக்கிறது."
  },
  {
    "id": 12,
    "ref": "Joshua 1:9",
    "category": "Courage",
    "verseTextEn": "Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
    "verseTextTa": "நான் உனக்குக் கட்டளையிடவில்லையா? திடன்கொண்டு தைரியமாயிரு; பயப்படாதே, கிலேசப்படாதே; உன் தேவனாகிய கர்த்தர் நீ போகும் எங்கும் உன்னுடனே இருக்கிறார்."
  },
  {
    "id": 13,
    "ref": "Matthew 5:16",
    "category": "Light & Witness",
    "verseTextEn": "In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven.",
    "verseTextTa": "அப்படியே உங்கள் வெளிச்சம் மனுஷருக்கு முன்பாகப் பிரகாசிக்கட்டும்; அப்பொழுது உங்கள் நற்கிரியைகளைக் கண்டு, பரலோகத்திலிருக்கிற உங்கள் பிதாவை மகிமைப்படுத்துவார்கள்."
  },
  {
    "id": 14,
    "ref": "Psalm 34:8",
    "category": "Blessing",
    "verseTextEn": "Taste and see that the Lord is good; blessed is the one who takes refuge in him.",
    "verseTextTa": "கர்த்தர் நல்லவர் என்று ருசித்துப் பாருங்கள்; அவரிடத்தில் அடைக்கலம் புகுகிற மனுஷன் பாக்கியவான்."
  },
  {
    "id": 15,
    "ref": "1 Peter 5:7",
    "category": "General",
    "verseTextEn": "Cast all your anxiety on him because he cares for you.",
    "verseTextTa": "அவர் உங்களைக் கவனிக்கிறார், ஆதலால் உங்கள் கவலைகளையெல்லாம் அவர்மேல் வைத்துவிடுங்கள்."
  },
  {
    "id": 16,
    "ref": "Psalm 27:1",
    "category": "Courage",
    "verseTextEn": "The Lord is my light and my salvation—whom shall I fear? The Lord is the stronghold of my life—of whom shall I be afraid?",
    "verseTextTa": "கர்த்தர் என் வெளிச்சமும், என் இரட்சிப்பும்; நான் யாருக்குப் பயப்படுவேன்? கர்த்தர் என் ஜீவனின் அடைக்கலம்; நான் யாருக்கு நடுங்குவேன்?"
  },
  {
    "id": 17,
    "ref": "John 14:27",
    "category": "Peace",
    "verseTextEn": "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.",
    "verseTextTa": "சமாதானத்தை உங்களுக்கு விட்டுப்போகிறேன்; உங்கள் இருதயம் கலங்காமலும் பயப்படாமலும் இருப்பதாக."
  },
  {
    "id": 18,
    "ref": "Romans 15:13",
    "category": "Peace",
    "verseTextEn": "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.",
    "verseTextTa": "நீங்கள் விசுவாசிக்கிறதினால், நம்பிக்கையுள்ள தேவன் சகல சந்தோஷத்தினாலும் சமாதானத்தினாலும் உங்களை நிரப்புவாராக; பரிசுத்த ஆவியின் வல்லமையினால் நீங்கள் நம்பிக்கையில் பெருகக்கடவீர்கள்."
  },
  {
    "id": 19,
    "ref": "Psalm 46:10",
    "category": "Peace",
    "verseTextEn": "Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth.",
    "verseTextTa": "அமர்ந்திருந்து, நானே தேவன் என்று அறிந்துகொள்ளுங்கள்; நான் பூமியிலும் உயர்த்தப்படுவேன்."
  },
  {
    "id": 20,
    "ref": "Matthew 28:20",
    "category": "Trust",
    "verseTextEn": "And surely I am with you always, to the very end of the age.",
    "verseTextTa": "இதோ, நான் உலகத்தின் முடிவுபரியந்தம் எந்நாளும் உங்களோடே இருக்கிறேன்."
  },
  {
    "id": 21,
    "ref": "Psalm 121:1-2",
    "category": "Creation",
    "verseTextEn": "I lift up my eyes to the mountains—where does my help come from? My help comes from the Lord, the Maker of heaven and earth.",
    "verseTextTa": "நான் என் கண்களை மலைகளுக்கு ஏறெடுக்கிறேன்; என் சகாயம் எங்கேயிருந்து வரும்? பரலோகத்தையும் பூமியையும் உண்டாக்கின கர்த்தரிடத்திலிருந்து என் சகாயம் வரும்."
  },
  {
    "id": 22,
    "ref": "John 16:33",
    "category": "Peace",
    "verseTextEn": "I have told you these things, so that in me you may have peace. In this world you will have trouble. But take heart! I have overcome the world.",
    "verseTextTa": "இவைகளை உங்களுக்குச் சொன்னேன்; நீங்கள் என்னிடத்தில் சமாதானமாயிருக்கும்படிக்குத் தான். உலகத்திலே உங்களுக்கு உபத்திரவம் உண்டு, திடன்கொள்ளுங்கள், நான் உலகத்தை ஜெயித்தேன்."
  },
  {
    "id": 23,
    "ref": "Psalm 91:1-2",
    "category": "Trust",
    "verseTextEn": "Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty. I will say of the Lord, 'He is my refuge and my fortress, my God, in whom I trust.'",
    "verseTextTa": "உன்னதத்திலே வாசமாயிருக்கிறவனே, சர்வவல்லவனுடைய நிழலிலே தங்கியிருப்பான். நான் என் தேவனாகிய கர்த்தரை நோக்கி: அவர் என் அடைக்கலமும் என் கோட்டையும்; அவரை நான் நம்பியிருக்கிறேன் என்று சொல்லுவேன்."
  },
  {
    "id": 24,
    "ref": "Isaiah 43:2",
    "category": "Hope & Promise",
    "verseTextEn": "When you pass through the waters, I will be with you; and when you pass through the rivers, they will not sweep over you.",
    "verseTextTa": "நீ தண்ணீர்களின் நடுவே கடந்துபோகும்போது, நான் உன்னுடனே இருப்பேன்; நதிகளின் நடுவே கடந்துபோகும்போது, அவைகள் உன்னை மூழ்கடிக்கமாட்டா."
  },
  {
    "id": 25,
    "ref": "Philippians 4:6-7",
    "category": "Peace",
    "verseTextEn": "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.",
    "verseTextTa": "ஒன்றைக்குறித்தும் கவலைப்படாதிருங்கள்; சகலத்திலும் உங்கள் விண்ணப்பங்களை விஞ்ஞானத்தை மீறுகிற தேவசமாதானம் கிறிஸ்து இயேசுவினால் உங்கள் இருதயங்களையும் உங்கள் சிந்தனைகளையும் காத்துக்கொள்ளும்."
  },
  {
    "id": 26,
    "ref": "Psalm 37:4",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Take delight in the Lord, and he will give you the desires of your heart.",
    "verseTextTa": "கர்த்தரில் மகிழும்; அப்பொழுது அவர் உன் இருதயத்தின் ஆசைகளை உனக்கு அருளுவார்."
  },
  {
    "id": 27,
    "ref": "Romans 12:12",
    "category": "Hope",
    "verseTextEn": "Be joyful in hope, patient in affliction, faithful in prayer.",
    "verseTextTa": "நம்பிக்கையிலே மகிழுங்கள்; உபத்திரவத்திலே பொறுமையாயிருங்கள்; ஜெபத்திலே திடனாயிருங்கள்."
  },
  {
    "id": 28,
    "ref": "Psalm 20:7",
    "category": "Trust",
    "verseTextEn": "Some trust in chariots and some in horses, but we trust in the name of the Lord our God.",
    "verseTextTa": "இவர்கள் இரதங்களிலும், இவர்கள் குதிரைகளிலும் நம்பிக்கையாயிருக்கிறார்கள்; நாமோ நம்முடைய தேவனாகிய கர்த்தருடைய நாமத்திலே நினைக்கிறோம்."
  },
  {
    "id": 29,
    "ref": "1 Corinthians 13:13",
    "category": "Love",
    "verseTextEn": "And now these three remain: faith, hope and love. But the greatest of these is love.",
    "verseTextTa": "இப்பொழுது விசுவாசம், நம்பிக்கை, அன்பு இம்மூன்றும் நிலைத்திருக்கிறது; இவைகளில் பெரியது அன்பு."
  },
  {
    "id": 30,
    "ref": "Psalm 30:5",
    "category": "Comfort & Refuge",
    "verseTextEn": "For his anger lasts only a moment, but his favor lasts a lifetime; weeping may stay for the night, but rejoicing comes in the morning.",
    "verseTextTa": "அவருடைய கோபம் நிமிஷமாத்திரம்; அவருடைய பிரியமோ ஜீவகாலமெல்லாம்; சாயங்காலத்தில் அழுகை தங்கியிருக்கும்; காலையில் கெம்பீரம் உண்டாகும்."
  },
  {
    "id": 31,
    "ref": "Deuteronomy 31:8",
    "category": "Courage",
    "verseTextEn": "The Lord himself goes before you and will be with you; he will never leave you nor forsake you. Do not be afraid; do not be discouraged.",
    "verseTextTa": "கர்த்தர் உமக்கு முன்னே போகிறார்; அவர் உம்மோடே இருப்பார்; உம்மைவிட்டு விலகவுமாட்டார், உம்மைக் கைவிடவுமாட்டார்; நீர் பயப்படாமலும் கலங்காமலும் இருப்பீராக."
  },
  {
    "id": 32,
    "ref": "Psalm 118:24",
    "category": "Joy",
    "verseTextEn": "The Lord has done it this very day; let us rejoice today and be glad.",
    "verseTextTa": "கர்த்தர் உண்டாக்கின நாள் இதுவே; நாம் இதில் களிகூர்ந்து சந்தோஷிப்போம்."
  },
  {
    "id": 33,
    "ref": "2 Corinthians 5:17",
    "category": "Creation",
    "verseTextEn": "Therefore, if anyone is in Christ, the new creation has come: The old has gone, the new is here!",
    "verseTextTa": "ஆகையால், ஒருவன் கிறிஸ்துவுக்குள் இருந்தால் அவன் புதுச்சிருஷ்டியாயிருக்கிறான்; பழையவை கடந்துபோயின, இதோ, எல்லாம் புதிதாயின."
  },
  {
    "id": 34,
    "ref": "Psalm 34:4",
    "category": "Comfort & Refuge",
    "verseTextEn": "I sought the Lord, and he answered me; he delivered me from all my fears.",
    "verseTextTa": "நான் கர்த்தரைத் தேடினேன்; அவர் எனக்குச் செவிகொடுத்து, என் பயங்களையெல்லாம் நீக்கி, என்னைத் தப்புவித்தார்."
  },
  {
    "id": 35,
    "ref": "Romans 8:1",
    "category": "Faith & Life",
    "verseTextEn": "Therefore, there is now no condemnation for those who are in Christ Jesus.",
    "verseTextTa": "ஆதலால் கிறிஸ்து இயேசுவுக்குள் இருக்கிறவர்களுக்கு இப்பொழுது ஆக்கினையே இல்லை."
  },
  {
    "id": 36,
    "ref": "Psalm 55:22",
    "category": "Comfort & Refuge",
    "verseTextEn": "Cast your cares on the Lord and he will sustain you; he will never let the righteous be shaken.",
    "verseTextTa": "உன் சுமையைக் கர்த்தர்மேல் வைத்துவிடு; அவர் உன்னைத் தாங்கிக்கொள்வார்; நீதிமானைத் தள்ளாடவிடமாட்டார்."
  },
  {
    "id": 37,
    "ref": "Matthew 22:37-39",
    "category": "Love",
    "verseTextEn": "Love the Lord your God with all your heart and with all your soul and with all your mind. This is the first and greatest commandment. And the second is like it: Love your neighbor as yourself.",
    "verseTextTa": "உன் தேவனாகிய கர்த்தரிடத்தில் உன் முழு இருதயத்தோடும், உன் முழு ஆத்துமாவோடும், உன் முழு மனதோடும் அன்புகூருவாயாக. இதுவே பெரியதும் முதலாவதுமான கற்பனை. இரண்டாவதும் இதற்கு ஒப்பானது: உன்னிடத்தில் நீ அன்புகூருவதுபோல் உன் பக்கத்தானிடத்திலும் அன்புகூருவாயாக."
  },
  {
    "id": 38,
    "ref": "Psalm 56:3-4",
    "category": "Trust",
    "verseTextEn": "When I am afraid, I put my trust in you. In God, whose word I praise—in God I trust and am not afraid. What can mere mortals do to me?",
    "verseTextTa": "நான் பயப்படும்போது, உம்மை நம்புகிறேன். தேவனுடைய வார்த்தையை நான் புகழுகிறேன்; தேவனை நம்பினேன், பயப்படேன்; மனுஷர் எனக்கு என்ன செய்யலாம்?"
  },
  {
    "id": 39,
    "ref": "Ephesians 2:8-9",
    "category": "Faith",
    "verseTextEn": "For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God—not by works, so that no one can boast.",
    "verseTextTa": "கிருபையினாலே விசுவாசத்தைக்கொண்டு இரட்சிக்கப்பட்டீர்கள்; அது உங்களாலே உண்டானதல்ல, தேவனுடைய வரமே; ஒருவனும் மேற்படாதபடி கிரியைகளினாலே உண்டானதல்ல."
  },
  {
    "id": 40,
    "ref": "Psalm 136:1",
    "category": "Love",
    "verseTextEn": "Give thanks to the Lord, for he is good. His love endures forever.",
    "verseTextTa": "கர்த்தருக்கு ஸ்தோத்திரம் செய்யுங்கள்; அவர் நல்லவர், அவருடைய கிருபை என்றென்றைக்கும் உண்டு."
  },
  {
    "id": 41,
    "ref": "Proverbs 16:3",
    "category": "Wisdom",
    "verseTextEn": "Commit to the Lord whatever you do, and he will establish your plans.",
    "verseTextTa": "நீ செய்கிற காரியங்களைக் கர்த்தருக்கு ஒப்புக்கொடு; அப்பொழுது உன் யோசனைகள் ஸ்திரப்படும்."
  },
  {
    "id": 42,
    "ref": "Colossians 3:23",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.",
    "verseTextTa": "நீங்கள் எதைச் செய்தாலும், அதை மனிதர்களுக்காக அல்ல, கர்த்தருக்காகச் செய்கிறதுபோல், முழு இருதயத்தோடும் செய்யுங்கள்."
  },
  {
    "id": 43,
    "ref": "Psalm 62:1-2",
    "category": "Strength",
    "verseTextEn": "Truly my soul finds rest in God; my salvation comes from him. Truly he is my rock and my salvation; he is my fortress, I will never be shaken.",
    "verseTextTa": "என் ஆத்துமா தேவனிடத்தில் மௌனமாய் காத்திருக்கிறது; அவரிடத்திலிருந்து என் இரட்சிப்பு வருகிறது. அவரே என் கன்மலையும் என் இரட்சிப்புமாயிருக்கிறார்; அவர் என் அடைக்கலம்; நான் அசையமாட்டேன்."
  },
  {
    "id": 44,
    "ref": "Romans 12:2",
    "category": "Light & Witness",
    "verseTextEn": "Do not conform to the pattern of this world, but be transformed by the renewing of your mind.",
    "verseTextTa": "இவ்வுலகத்திற்கு ஒப்பாகாதிருங்கள்; மனதைப் புதுப்பிக்கிறதினால் மறுரூபமடையுங்கள்."
  },
  {
    "id": 45,
    "ref": "Psalm 103:1-3",
    "category": "Praise & Worship",
    "verseTextEn": "Praise the Lord, my soul; all my inmost being, praise his holy name. Praise the Lord, my soul, and forget not all his benefits.",
    "verseTextTa": "என் ஆத்துமாவே, கர்த்தரை ஸ்தோத்திரி; என் உள்ளத்திலுள்ள யாவுமே, அவருடைய பரிசுத்த நாமத்தை ஸ்தோத்திரி. என் ஆத்துமாவே, கர்த்தரை ஸ்தோத்திரி; அவருடைய உபகாரங்களையெல்லாம் மறவாதே."
  },
  {
    "id": 46,
    "ref": "Matthew 7:7-8",
    "category": "Prayer",
    "verseTextEn": "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.",
    "verseTextTa": "கேளுங்கள், அப்பொழுது உங்களுக்குக் கொடுக்கப்படும்; தேடுங்கள், அப்பொழுது கண்டடைவீர்கள்; தட்டுங்கள், அப்பொழுது உங்களுக்குத் திறக்கப்படும்."
  },
  {
    "id": 47,
    "ref": "Psalm 145:18",
    "category": "Comfort & Refuge",
    "verseTextEn": "The Lord is near to all who call on him, to all who call on him in truth.",
    "verseTextTa": "கர்த்தர் தம்மை நோக்கிக் கூப்பிடுகிறவர்களெல்லாருக்கும், உண்மையாய்த் தம்மை நோக்கிக் கூப்பிடுகிறவர்களெல்லாருக்கும் சமீபமாயிருக்கிறார்."
  },
  {
    "id": 48,
    "ref": "2 Timothy 1:7",
    "category": "Love",
    "verseTextEn": "For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.",
    "verseTextTa": "தேவன் நமக்குப் பயத்தினுடைய ஆவியை அல்ல, வல்லமையினுடைய ஆவியையும், அன்பினுடைய ஆவியையும், தெளிந்த புத்தியினுடைய ஆவியையும் கொடுத்திருக்கிறார்."
  },
  {
    "id": 49,
    "ref": "Psalm 18:2",
    "category": "Strength",
    "verseTextEn": "The Lord is my rock, my fortress and my deliverer; my God is my rock, in whom I take refuge.",
    "verseTextTa": "கர்த்தர் என் கன்மலையும், என் கோட்டையும், என்னை விடுவிக்கிறவருமாயிருக்கிறார்; என் தேவன் என் கன்மலை, நான் அவரை நம்பியிருக்கிறேன்."
  },
  {
    "id": 50,
    "ref": "1 John 4:8",
    "category": "Love",
    "verseTextEn": "Whoever does not love does not know God, because God is love.",
    "verseTextTa": "அன்பு இல்லாதவன் தேவனை அறியான்; தேவன் அன்பாயிருக்கிறார்."
  },
  {
    "id": 51,
    "ref": "Psalm 46:1",
    "category": "Strength",
    "verseTextEn": "God is our refuge and strength, an ever-present help in trouble.",
    "verseTextTa": "தேவன் நமக்கு அடைக்கலமும் பலமும்; ஆபத்தில் மிகுந்த சகாயமுமாயிருக்கிறார்."
  },
  {
    "id": 52,
    "ref": "James 1:5",
    "category": "Prayer",
    "verseTextEn": "If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.",
    "verseTextTa": "உங்களில் ஒருவனுக்கு ஞானமில்லாதிருந்தால், அவன் தேவனிடத்தில் கேட்கக்கடவன்; அவர் எல்லாருக்கும் வெட்டியாய்க் கொடுக்கிறவரும், கடிந்துகொள்ளாதவருமாயிருக்கிறார்; அப்பொழுது அது அவனுக்குக் கொடுக்கப்படும்."
  },
  {
    "id": 53,
    "ref": "Psalm 100:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Shout for joy to the Lord, all the earth. Worship the Lord with gladness; come into his presence with singing.",
    "verseTextTa": "பூமியிலுள்ள யாவரே, கர்த்தருக்கு ஆர்ப்பரியுங்கள். சந்தோஷத்தோடே கர்த்தரைச் சேவியுங்கள்; கீதத்தோடே அவருடைய சந்நிதியில் பிரவேசியுங்கள்."
  },
  {
    "id": 54,
    "ref": "Ephesians 3:20",
    "category": "Prayer",
    "verseTextEn": "Now to him who is able to do immeasurably more than all we ask or imagine, according to his power that is at work within us.",
    "verseTextTa": "நமக்குள்ளே கிரியை செய்கிற வல்லமையின்படியே, நாம் கேட்கிறதையும் நினைக்கிறதையும் அதிகமாய்ச் செய்ய வல்லவருக்கும்."
  },
  {
    "id": 55,
    "ref": "Psalm 27:4",
    "category": "Prayer",
    "verseTextEn": "One thing I ask from the Lord, this only do I seek: that I may dwell in the house of the Lord all the days of my life.",
    "verseTextTa": "கர்த்தரிடத்தில் ஒன்றைக் கேட்டேன்; அதையே தேடுவேன்; நான் என் ஜீவகாலமெல்லாம் கர்த்தருடைய ஆலயத்தில் வாசமாய், கர்த்தரின் இனிமையைக் கண்டு, அவருடைய ஆலயத்தில் தியானித்துக்கொண்டிருக்கவேண்டுமென்று."
  },
  {
    "id": 56,
    "ref": "Proverbs 30:5",
    "category": "Protection & Refuge",
    "verseTextEn": "Every word of God is flawless; he is a shield to those who take refuge in him.",
    "verseTextTa": "தேவனுடைய வசனம் எல்லாம் புடமிடப்பட்டிருக்கிறது; அவர் தம்மை நம்பியிருக்கிறவர்களுக்குக் கேடகமாயிருக்கிறார்."
  },
  {
    "id": 57,
    "ref": "Psalm 121:3-4",
    "category": "Comfort & Refuge",
    "verseTextEn": "He will not let your foot slip—he who watches over you will not slumber; indeed, he who watches over Israel will neither slumber nor sleep.",
    "verseTextTa": "உன் காலைத் தள்ளாடவிடார்; உன்னைக் காக்கிறவர் உறங்கமாட்டார். இஸ்ரவேலைக் காக்கிறவர் உறங்குவதுமில்லை, தூங்குவதுமில்லை."
  },
  {
    "id": 58,
    "ref": "2 Chronicles 7:14",
    "category": "Comfort & Healing",
    "verseTextEn": "If my people, who are called by my name, will humble themselves and pray and seek my face and turn from their wicked ways, then I will hear from heaven, and I will forgive their sin and will heal their land.",
    "verseTextTa": "என்னுடைய நாமத்தினால் அழைக்கப்படுகிற என் ஜனங்கள், தங்களைத் தாழ்த்தி, ஜெபம்பண்ணி, என் முகத்தைத் தேடி, தங்கள் பொல்லாத வழிகளைவிட்டுத் திரும்பினால், நான் பரலோகத்திலிருந்து கேட்டு, அவர்களுடைய பாவத்தை மன்னித்து, அவர்கள் தேசத்தைக் குணமாக்குவேன்."
  },
  {
    "id": 59,
    "ref": "Psalm 95:6-7",
    "category": "Praise & Worship",
    "verseTextEn": "Come, let us bow down in worship, let us kneel before the Lord our Maker; for he is our God and we are the people of his pasture, the flock under his care.",
    "verseTextTa": "வாருங்கள், நாம் பணிந்து வணங்கி, நம்மை உண்டாக்கின கர்த்தருக்கு முன்பாக முழங்கால்படியுவோம். அவரே நம்முடைய தேவன்; நாம் அவரின் மேய்ச்சலின் ஜனங்களும், அவர் கைக்கு ஆடுகளுமாயிருக்கிறோம்."
  },
  {
    "id": 60,
    "ref": "1 John 1:9",
    "category": "Faith",
    "verseTextEn": "If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.",
    "verseTextTa": "நாம் நம்முடைய பாவங்களை அறிக்கையிட்டால், அவர் நம்முடைய பாவங்களை மன்னித்து, நம்மைச் சகல அநீதியினின்றும் சுத்திகரிப்பதற்கு உண்மையும் நீதியுமுள்ளவராயிருக்கிறார்."
  },
  {
    "id": 61,
    "ref": "Psalm 23:6",
    "category": "Love",
    "verseTextEn": "Surely your goodness and love will follow me all the days of my life, and I will dwell in the house of the Lord forever.",
    "verseTextTa": "நிச்சயமாக நன்மையும் கிருபையும் என் ஜீவகாலமெல்லாம் என்னைப் பின்தொடரும்; நான் கர்த்தருடைய ஆலயத்தில் என்றென்றைக்கும் வாசமாயிருப்பேன்."
  },
  {
    "id": 62,
    "ref": "Romans 12:12",
    "category": "Hope",
    "verseTextEn": "Rejoice in hope, be patient in tribulation, be constant in prayer.",
    "verseTextTa": "நம்பிக்கையிலே மகிழுங்கள்; உபத்திரவத்திலே பொறுமையாயிருங்கள்; ஜெபத்திலே திடனாயிருங்கள்."
  },
  {
    "id": 63,
    "ref": "Psalm 116:1-2",
    "category": "Love",
    "verseTextEn": "I love the Lord, for he heard my voice; he heard my cry for mercy. Because he turned his ear to me, I will call on him as long as I live.",
    "verseTextTa": "கர்த்தர் என் குரலையும், என் மன்றாட்டின் சத்தத்தையும் கேட்டபடியால், நான் அவரில் பிரியமாயிருக்கிறேன். அவர் தமது காதை எனக்குச் சாய்த்தபடியால், என் ஜீவகாலமெல்லாம் நான் அவரை நோக்கிக் கூப்பிடுவேன்."
  },
  {
    "id": 64,
    "ref": "Philippians 4:8",
    "category": "Love",
    "verseTextEn": "Finally, brothers and sisters, whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things.",
    "verseTextTa": "மேலும், சகோதரரே, எவைகள் சத்தியமும், எவைகள் கனவானும், எவைகள் நீதியும், எவைகள் பரிசுத்தமும், எவைகள் பிரியமும், எவைகள் நற்புகழுமாயிருக்கிறதோ, அந்தக் காரியங்களையே சிந்தித்துப் பாருங்கள்."
  },
  {
    "id": 65,
    "ref": "Psalm 9:9-10",
    "category": "Trust",
    "verseTextEn": "The Lord is a refuge for the oppressed, a stronghold in times of trouble. Those who know your name trust in you, for you, Lord, have never forsaken those who seek you.",
    "verseTextTa": "ஒடுக்கப்பட்டவனுக்குக் கர்த்தர் அடைக்கலமும், ஆபத்துக்காலத்தில் கோட்டையுமாயிருக்கிறார். உமது நாமத்தை அறிந்தவர்கள் உம்மை நம்புவார்கள்; கர்த்தாவே, உம்மைத் தேடுகிறவர்களை நீர் கைவிடுவதில்லை."
  },
  {
    "id": 66,
    "ref": "Ephesians 6:10-11",
    "category": "Strength",
    "verseTextEn": "Finally, be strong in the Lord and in his mighty power. Put on the full armor of God, so that you can take your stand against the devil's schemes.",
    "verseTextTa": "மேலும், நீங்கள் கர்த்தரிலும், அவருடைய வல்லமையின் பெலத்திலும் பலப்படுங்கள். பிசாசின் சூழ்ச்சிகளை எதிர்த்து நிற்கும்படி தேவனுடைய ஆயுதங்கள் அனைத்தையும் தரித்துக்கொள்ளுங்கள்."
  },
  {
    "id": 67,
    "ref": "Psalm 32:7",
    "category": "Comfort & Refuge",
    "verseTextEn": "You are my hiding place; you will protect me from trouble and surround me with songs of deliverance.",
    "verseTextTa": "நீர் என் மறைவிடம்; நீர் என்னை இக்கட்டிலிருந்து காத்துக்கொள்வீர்; விடுதலையின் பாடல்களால் என்னைச் சூழ்ந்துகொள்வீர்."
  },
  {
    "id": 68,
    "ref": "Hebrews 11:1",
    "category": "Trust",
    "verseTextEn": "Now faith is confidence in what we hope for and assurance about what we do not see.",
    "verseTextTa": "விசுவாசமோ நம்பப்படுகிறவைகளின் ஸ்திரமும், காணப்படாதவைகளின் நிச்சயமுமாம்."
  },
  {
    "id": 69,
    "ref": "Psalm 138:3",
    "category": "Courage",
    "verseTextEn": "When I called, you answered me; you greatly emboldened me.",
    "verseTextTa": "நான் கூப்பிட்ட நாளிலே நீர் எனக்குச் செவிகொடுத்து, என் ஆத்துமாவில் பெலனைப் பெருகப்பண்ணினீர்."
  },
  {
    "id": 70,
    "ref": "Galatians 5:22-23",
    "category": "Love",
    "verseTextEn": "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.",
    "verseTextTa": "ஆவியின் கனியோ அன்பு, சந்தோஷம், சமாதானம், நீடிய பொறுமை, தயவு, நற்குணம், விசுவாசம், சாந்தம், இந்திரிய அடக்கம்."
  },
  {
    "id": 71,
    "ref": "Psalm 37:7",
    "category": "Peace",
    "verseTextEn": "Be still before the Lord and wait patiently for him; do not fret when people succeed in their ways, when they carry out their wicked schemes.",
    "verseTextTa": "கர்த்தருக்கு முன்பாக அமர்ந்திருந்து, அவருக்காகப் பொறுமையாய்க் காத்திரு; வழியில் வெற்றியடைந்தவர்களையும், துராலோசனைகளை நிறைவேற்றுகிறவர்களையும் குறித்து எரிச்சல்படாதே."
  },
  {
    "id": 72,
    "ref": "1 Corinthians 16:13-14",
    "category": "Love",
    "verseTextEn": "Be on your guard; stand firm in the faith; be courageous; be strong. Do everything in love.",
    "verseTextTa": "விழித்திருங்கள்; விசுவாசத்தில் நிலைத்திருங்கள்; வீரர்களைப்போல் நடந்துகொள்ளுங்கள்; பலப்படுங்கள். உங்களுடைய எல்லாக் காரியங்களும் அன்போடே செய்யப்படக்கடவது."
  },
  {
    "id": 73,
    "ref": "Psalm 34:17",
    "category": "Comfort & Refuge",
    "verseTextEn": "The righteous cry out, and the Lord hears them; he delivers them from all their troubles.",
    "verseTextTa": "நீதிமான்கள் கூப்பிடுகிறார்கள், கர்த்தர் கேட்டு, அவர்களுடைய சகல உபத்திரவங்களிலிருந்தும் அவர்களை விடுவிக்கிறார்."
  },
  {
    "id": 74,
    "ref": "Colossians 3:2",
    "category": "Faith & Life",
    "verseTextEn": "Set your minds on things above, not on earthly things.",
    "verseTextTa": "பூமியிலுள்ளவைகளிலே அல்ல, பரலோகத்திலுள்ளவைகளிலே மனதை வையுங்கள்."
  },
  {
    "id": 75,
    "ref": "Psalm 19:14",
    "category": "Praise & Worship",
    "verseTextEn": "May these words of my mouth and this meditation of my heart be pleasing in your sight, Lord, my Rock and my Redeemer.",
    "verseTextTa": "என் வாயின் வார்த்தைகளும், என் இருதயத்தின் தியானமும், உமது சந்நிதியில் பிரியமாயிருப்பதாக; கர்த்தாவே, நீர் என் கன்மலையும், என் மீட்பருமாயிருக்கிறீர்."
  },
  {
    "id": 76,
    "ref": "Psalm 37:5",
    "category": "Trust",
    "verseTextEn": "Commit your way to the Lord; trust in him and he will do this.",
    "verseTextTa": "உன் வழியைக் கர்த்தருக்கு ஒப்புக்கொடு; அவர் மேல் நம்பிக்கையாயிரு; அவர் அதை நிறைவேற்றுவார்."
  },
  {
    "id": 77,
    "ref": "Romans 8:15",
    "category": "Faith & Life",
    "verseTextEn": "The Spirit you received does not make you slaves, so that you live in fear again; rather, the Spirit you received brought about your adoption to sonship.",
    "verseTextTa": "நீங்கள் பயத்தினுடைய ஆவியை அல்ல, புத்திரத்துவத்தின் ஆவியைப் பெற்றீர்கள்; அந்த ஆவியினாலே நாம் 'அப்பா, பிதாவே' என்று கூப்பிடுகிறோம்."
  },
  {
    "id": 78,
    "ref": "Psalm 107:1",
    "category": "Love",
    "verseTextEn": "Give thanks to the Lord, for he is good; his love endures forever.",
    "verseTextTa": "கர்த்தருக்கு ஸ்தோத்திரம் செய்யுங்கள்; அவர் நல்லவர்; அவருடைய கிருபை என்றென்றைக்கும் உண்டு."
  },
  {
    "id": 79,
    "ref": "Matthew 6:34",
    "category": "Gospel & Grace",
    "verseTextEn": "Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.",
    "verseTextTa": "ஆகையால், நாளைக்காகக் கவலைப்படாதீர்கள்; நாளையதை நாளைக்கு அது கவலைப்படும்; அன்றையதற்கு அதினுடைய தீங்கு போதும்."
  },
  {
    "id": 80,
    "ref": "Psalm 71:5",
    "category": "Trust",
    "verseTextEn": "For you have been my hope, Sovereign Lord, my confidence since my youth.",
    "verseTextTa": "கர்த்தராகிய ஆண்டவரே, நீரே என் நம்பிக்கை; என் வாலிப முதல் நீரே என் நிச்சயம்."
  },
  {
    "id": 81,
    "ref": "2 Corinthians 9:8",
    "category": "Blessing",
    "verseTextEn": "And God is able to bless you abundantly, so that in all things at all times you may abound in every good work.",
    "verseTextTa": "தேவனோ நீங்கள் எப்பொழுதும் சகலத்திலும் மிகுதியாகத் திருப்தியடைந்து, எல்லா நற்கிரியைகளிலும் பெருகும்படிக்கு, உங்களுக்கு எல்லாக் கிருபையையும் பெருகப்பண்ண வல்லவராயிருக்கிறார்."
  },
  {
    "id": 82,
    "ref": "Psalm 112:1",
    "category": "Blessing",
    "verseTextEn": "Blessed are those who fear the Lord, who find great delight in his commands.",
    "verseTextTa": "கர்த்தருக்குப் பயந்து, அவர் கற்பனைகளில் மிகவும் பிரியப்படுகிற மனுஷன் பாக்கியவான்."
  },
  {
    "id": 83,
    "ref": "John 10:10",
    "category": "Gospel & Grace",
    "verseTextEn": "The thief comes only to steal and kill and destroy; I have come that they may have life, and have it to the full.",
    "verseTextTa": "கள்ளனோ திருடவும், கொலைசெய்யவும், அழிக்கவும் வருகிறான்; நானோ அவர்கள் ஜீவனை அடைந்து, மிகுதியாய் அடையும்படி வந்தேன்."
  },
  {
    "id": 84,
    "ref": "Psalm 118:6",
    "category": "Courage",
    "verseTextEn": "The Lord is with me; I will not be afraid. What can mere mortals do to me?",
    "verseTextTa": "கர்த்தர் எனக்குத் துணையாயிருக்கிறார்; நான் பயப்படேன்; மனுஷர் எனக்கு என்ன செய்யலாம்?"
  },
  {
    "id": 85,
    "ref": "Galatians 6:9",
    "category": "Comfort & Healing",
    "verseTextEn": "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.",
    "verseTextTa": "நாம் நன்மை செய்வதில் சோர்ந்துபோகாமல் இருப்போமாக; நாம் இளைக்காமல் இருந்தால், ஏற்ற காலத்தில் அறுப்போம்."
  },
  {
    "id": 86,
    "ref": "Psalm 25:4-5",
    "category": "Comfort & Refuge",
    "verseTextEn": "Show me your ways, Lord, teach me your paths. Guide me in your truth and teach me, for you are God my Savior.",
    "verseTextTa": "கர்த்தாவே, உம்முடைய வழிகளை எனக்கு அறிவித்து, உம்முடைய பாதைகளை எனக்குப் போதியும். உம்முடைய சத்தியத்தில் என்னை நடத்தி எனக்குப் போதியும்; நீர் என் இரட்சிப்பின் தேவனாயிருக்கிறீர்."
  },
  {
    "id": 87,
    "ref": "1 John 4:4",
    "category": "Light & Witness",
    "verseTextEn": "You, dear children, are from God and have overcome them, because the one who is in you is greater than the one who is in the world.",
    "verseTextTa": "பிள்ளைகளே, நீங்கள் தேவனால் உண்டானவர்கள்; உங்களுக்குள் இருக்கிறவர், உலகத்திலிருக்கிறவரிலும் பெரியவராயிருக்கிறபடியால், நீங்கள் அவர்களை ஜெயித்திருக்கிறீர்கள்."
  },
  {
    "id": 88,
    "ref": "Psalm 34:19",
    "category": "Comfort & Refuge",
    "verseTextEn": "The righteous person may have many troubles, but the Lord delivers him from them all.",
    "verseTextTa": "நீதிமானுக்கு அநேக உபத்திரவங்கள் உண்டு; கர்த்தர் அவைகளெல்லாவற்றிலும் அவனை விடுவிக்கிறார்."
  },
  {
    "id": 89,
    "ref": "Ephesians 2:10",
    "category": "Faith & Life",
    "verseTextEn": "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.",
    "verseTextTa": "நாம் அவர் கைவேலையாயிருக்கிறோம்; தேவன் முன்னதாக நாம் நடக்கும்படி ஆயத்தம் பண்ணின நற்கிரியைகளில் நாம் நடக்கும்படி, கிறிஸ்து இயேசுவில் சிருஷ்டிக்கப்பட்டிருக்கிறோம்."
  },
  {
    "id": 90,
    "ref": "Psalm 147:3",
    "category": "Comfort & Healing",
    "verseTextEn": "He heals the brokenhearted and binds up their wounds.",
    "verseTextTa": "அவர் உட்படுகிறவர்களின் உள்ளத்தைக் குணமாக்கி, அவர்களுடைய துக்கங்களைக் கட்டி ஆற்றுகிறார்."
  },
  {
    "id": 91,
    "ref": "Romans 8:39",
    "category": "Love",
    "verseTextEn": "Neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.",
    "verseTextTa": "உயரமாவது, ஆழமாவது, சிருஷ்டிக்கப்பட்ட வேறெந்த சிருஷ்டியாவது, நம்முடைய கர்த்தராகிய கிறிஸ்து இயேசுவில் இருக்கிற தேவனுடைய அன்பிலிருந்து நம்மைப் பிரிக்கலாம் என்று நிச்சயமாய் அறிந்திருக்கிறேன்."
  },
  {
    "id": 92,
    "ref": "Psalm 86:11",
    "category": "Trust",
    "verseTextEn": "Teach me your way, Lord, that I may rely on your faithfulness; give me an undivided heart, that I may fear your name.",
    "verseTextTa": "கர்த்தாவே, நான் உமது சத்தியத்தில் நடக்கும்படி உம்முடைய வழியை எனக்குப் போதியும்; உமது நாமத்திற்குப் பயப்படும்படி என் இருதயத்தை ஒருமிக்கச் செய்யும்."
  },
  {
    "id": 93,
    "ref": "Joshua 1:8",
    "category": "General",
    "verseTextEn": "Keep this Book of the Law always on your lips; meditate on it day and night, so that you may be careful to do everything written in it.",
    "verseTextTa": "இந்த நியாயப்பிரமாண புஸ்தகம் உன் வாயைவிட்டு நீங்காதிருப்பதாக; அதில் எழுதப்பட்ட யாவையும் காத்து நடக்கும்படிக்கு, நீ அதைப் பகலும் இரவும் தியானித்துக்கொண்டிரு."
  },
  {
    "id": 94,
    "ref": "Psalm 143:8",
    "category": "Love",
    "verseTextEn": "Let the morning bring me word of your unfailing love, for I have put my trust in you. Show me the way I should go, for to you I entrust my life.",
    "verseTextTa": "உமது கிருபையைக் காலையில் எனக்குத் தெரியப்படுத்தும்; நான் உம்மை நம்பியிருக்கிறேன். நான் நடக்கவேண்டிய வழியை எனக்குத் தெரியப்படுத்தும்; என் ஆத்துமாவை உம்மிடத்தில் உயர்த்துகிறேன்."
  },
  {
    "id": 95,
    "ref": "Proverbs 18:10",
    "category": "Wisdom",
    "verseTextEn": "The name of the Lord is a fortified tower; the righteous run to it and are safe.",
    "verseTextTa": "கர்த்தருடைய நாமம் பலத்த கோட்டை; நீதிமான் அதற்கு ஓடி, உயர்ந்த இடம் அடைகிறான்."
  },
  {
    "id": 96,
    "ref": "1 Peter 5:10",
    "category": "Praise & Worship",
    "verseTextEn": "And the God of all grace, who called you to his eternal glory in Christ, after you have suffered a little while, will himself restore you and make you strong, firm and steadfast.",
    "verseTextTa": "சகல கிருபைக்கும் உரிய தேவனோ, உங்களைத் தமது நித்திய மகிமைக்கு கிறிஸ்து இயேசுவில் அழைத்திருக்கிறார்; கொஞ்சக்காலம் பாடுபட்டபின்பு, அவரே உங்களைப் பூரணப்படுத்தி, உறுதிப்படுத்தி, பலப்படுத்தி, நிலைப்படுத்துவார்."
  },
  {
    "id": 97,
    "ref": "Psalm 28:7",
    "category": "Trust",
    "verseTextEn": "The Lord is my strength and my shield; my heart trusts in him, and he helps me.",
    "verseTextTa": "கர்த்தர் என் பெலனும், என் கேடகமுமாயிருக்கிறார்; என் இருதயம் அவரை நம்புகிறது; அவர் எனக்குச் சகாயமாகிறார்."
  },
  {
    "id": 98,
    "ref": "Romans 15:5",
    "category": "Courage",
    "verseTextEn": "May the God who gives endurance and encouragement give you the same attitude of mind toward each other that Christ Jesus had.",
    "verseTextTa": "பொறுமையும் தேற்றுதலையும் தருகிற தேவனோ, நீங்கள் கிறிஸ்து இயேசுவுக்குள்ளாக மனதொருமித்து, ஒருமனப்பட்டு, தேவனை மகிமைப்படுத்தும்படி செய்வாராக."
  },
  {
    "id": 99,
    "ref": "Psalm 16:8",
    "category": "Comfort & Refuge",
    "verseTextEn": "I keep my eyes always on the Lord. With him at my right hand, I will not be shaken.",
    "verseTextTa": "கர்த்தரை என்றும் என் கண்களுக்கு முன்பாக வைத்தேன்; அவர் என் வலதுபக்கத்தில் இருக்கிறபடியால் நான் அசையேன்."
  },
  {
    "id": 100,
    "ref": "John 13:34",
    "category": "Love",
    "verseTextEn": "A new command I give you: Love one another. As I have loved you, so you must love one another.",
    "verseTextTa": "ஒரு புது கற்பனையை உங்களுக்குக் கொடுக்கிறேன்; நான் உங்களிடத்தில் அன்புகூர்ந்ததுபோல, நீங்களும் ஒருவரிலொருவர் அன்புகூரவேண்டும்."
  },
  {
    "id": 101,
    "ref": "Psalm 31:24",
    "category": "Hope",
    "verseTextEn": "Be strong and take heart, all you who hope in the Lord.",
    "verseTextTa": "கர்த்தருக்குக் காத்திருக்கிறவர்களே, நீங்கள் எல்லாரும் திடன்கொண்டு, உங்கள் இருதயத்தைத் திடப்படுத்துங்கள்."
  },
  {
    "id": 102,
    "ref": "Matthew 5:9",
    "category": "Peace",
    "verseTextEn": "Blessed are the peacemakers, for they will be called children of God.",
    "verseTextTa": "சமாதானம் செய்கிறவர்கள் பாக்கியவான்கள்; அவர்கள் தேவனுடைய பிள்ளைகள் என்னப்படுவார்கள்."
  },
  {
    "id": 103,
    "ref": "Psalm 42:1",
    "category": "Comfort & Refuge",
    "verseTextEn": "As the deer pants for streams of water, so my soul pants for you, my God.",
    "verseTextTa": "மான் நீரோடைகளைத் தாகமாய் விரும்புகிறதுபோல, என் ஆத்துமா உம்மையே, தேவனையே, தாகமாய் விரும்புகிறது."
  },
  {
    "id": 104,
    "ref": "Romans 12:10",
    "category": "Love",
    "verseTextEn": "Be devoted to one another in love. Honor one another above yourselves.",
    "verseTextTa": "அன்பிலே ஒருவரிலொருவர் பட்சமாயிருங்கள்; ஒருவரையொருவர் கனம்பண்ணுவதில் முந்திக்கொள்ளுங்கள்."
  },
  {
    "id": 105,
    "ref": "Psalm 62:8",
    "category": "Trust",
    "verseTextEn": "Trust in him at all times, you people; pour out your hearts to him, for God is our refuge.",
    "verseTextTa": "ஜனங்களே, எக்காலத்திலும் அவரை நம்புங்கள்; உங்கள் இருதயங்களை அவர் முன்பாக ஊற்றுங்கள்; தேவன் நமக்கு அடைக்கலமாயிருக்கிறார்."
  },
  {
    "id": 106,
    "ref": "Ephesians 4:32",
    "category": "Faith & Life",
    "verseTextEn": "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.",
    "verseTextTa": "நீங்கள் ஒருவரிலொருவர் தயவாயும், மனவுருக்கமுள்ளவர்களாயும், தேவன் கிறிஸ்துவுக்குள் உங்களை மன்னித்ததுபோல, ஒருவருக்கொருவர் மன்னித்துக்கொண்டிருங்கள்."
  },
  {
    "id": 107,
    "ref": "Psalm 138:8",
    "category": "Love",
    "verseTextEn": "The Lord will vindicate me; your love, Lord, endures forever—do not abandon the works of your hands.",
    "verseTextTa": "கர்த்தர் எனக்காக அதை நிறைவேற்றுவார்; கர்த்தாவே, உமது கிருபை என்றென்றைக்கும் உண்டு; உமது கைகளின் கிரியைகளைக் கைவிடாதேயும்."
  },
  {
    "id": 108,
    "ref": "1 Thessalonians 5:18",
    "category": "Generosity",
    "verseTextEn": "Give thanks in all circumstances; for this is God's will for you in Christ Jesus.",
    "verseTextTa": "சகலத்திலும் நன்றியுள்ளவர்களாயிருங்கள்; இதுவே கிறிஸ்து இயேசுவுக்குள் உங்களைக்குறித்த தேவனுடைய சித்தம்."
  },
  {
    "id": 109,
    "ref": "Psalm 3:3-4",
    "category": "Praise & Worship",
    "verseTextEn": "But you, Lord, are a shield around me, my glory, the One who lifts my head high. I call out to the Lord, and he answers me from his holy mountain.",
    "verseTextTa": "கர்த்தாவே, நீர் என்னைச் சுற்றிலும் கேடகமும், என் மகிமையும், என் தலையை உயர்த்துகிறவருமாயிருக்கிறீர். நான் சத்தமிட்டுக் கர்த்தரை நோக்கிக் கூப்பிட்டேன்; அவர் தம்முடைய பரிசுத்த பர்வதத்திலிருந்து எனக்கு உத்தரவு அருளினார்."
  },
  {
    "id": 110,
    "ref": "Colossians 3:16",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Let the message of Christ dwell among you richly as you teach and admonish one another with all wisdom.",
    "verseTextTa": "கிறிஸ்துவின் வசனம் உங்களில் சம்பூரணமாய் வாசமாயிருப்பதாக; எல்லா ஞானத்தோடும் ஒருவருக்கொருவர் போதித்தும், புத்திசொல்லியும், கிருபையான பாடல்களினால் கர்த்தரை உங்கள் இருதயங்களில் பாடுங்கள்."
  },
  {
    "id": 111,
    "ref": "Psalm 40:1-2",
    "category": "Protection & Refuge",
    "verseTextEn": "I waited patiently for the Lord; he turned to me and heard my cry. He lifted me out of the slimy pit, out of the mud and mire; he set my feet on a rock and gave me a firm place to stand.",
    "verseTextTa": "நான் கர்த்தருக்குக் காத்திருக்கக் காத்திருந்தேன்; அவர் எனக்குச் செவிசாய்த்து, என் மன்றாட்டைக் கேட்டருளினார். அவர் என்னைக் கேடான குழியிலும், சகதியுள்ள எருமண்ணிலுமிருந்து எடுத்து, என் கால்களைக் கன்மலையின்மேல் நிறுத்தி, என் நடைகளை உறுதிப்படுத்தினார்."
  },
  {
    "id": 112,
    "ref": "Ephesians 5:20",
    "category": "Faith & Life",
    "verseTextEn": "Always giving thanks to God the Father for everything, in the name of our Lord Jesus Christ.",
    "verseTextTa": "எப்பொழுதும் எல்லாவற்றிற்காகவும் நம்முடைய கர்த்தராகிய இயேசு கிறிஸ்துவின் நாமத்தினாலே பிதாவாகிய தேவனுக்கு ஸ்தோத்திரம் செலுத்துங்கள்."
  },
  {
    "id": 113,
    "ref": "Psalm 50:15",
    "category": "Comfort & Refuge",
    "verseTextEn": "Call me in the day of trouble; I will deliver you, and you will honor me.",
    "verseTextTa": "உபத்திரவ நாளிலே என்னை நோக்கிக் கூப்பிடு; அப்பொழுது நான் உன்னைத் தப்புவிப்பேன்; நீ என்னை மகிமைப்படுத்துவாய்."
  },
  {
    "id": 114,
    "ref": "Hebrews 13:5",
    "category": "Love",
    "verseTextEn": "Keep your lives free from the love of money and be content with what you have, because God has said, 'Never will I leave you; never will I forsake you.'",
    "verseTextTa": "உங்கள் நடக்கையில் வெறுமையான ஆசையில்லாமலும், உங்களுக்கு உள்ளவைகளில் திருப்தியுள்ளவர்களாயும் இருங்கள்; 'உன்னை விட்டுவிடேன், உன்னைக் கைவிடேன்' என்று அவர் சொல்லியிருக்கிறார்."
  },
  {
    "id": 115,
    "ref": "Psalm 84:11-12",
    "category": "Protection & Refuge",
    "verseTextEn": "For the Lord God is a sun and shield; the Lord bestows favor and honor; no good thing does he withhold from those whose walk is blameless.",
    "verseTextTa": "கர்த்தராகிய தேவன் சூரியனும் கேடகமுமாயிருக்கிறார்; கர்த்தர் கிருபையையும் மகிமையையும் தருகிறார்; உத்தமமாய் நடக்கிறவர்களுக்கு நன்மையைக் குறைவுபடுத்தமாட்டார்."
  },
  {
    "id": 116,
    "ref": "Romans 10:9",
    "category": "Faith",
    "verseTextEn": "If you declare with your mouth, 'Jesus is Lord,' and believe in your heart that God raised him from the dead, you will be saved.",
    "verseTextTa": "நீ உன் வாயினாலே இயேசு கர்த்தர் என்று அறிக்கையிட்டு, தேவன் அவரை மரித்தோரிலிருந்து எழுப்பினார் என்று உன் இருதயத்தில் விசுவாசித்தால், இரட்சிக்கப்படுவாய்."
  },
  {
    "id": 117,
    "ref": "Psalm 121:7-8",
    "category": "Comfort & Refuge",
    "verseTextEn": "The Lord will keep you from all harm—he will watch over your life; the Lord will watch over your coming and going both now and forevermore.",
    "verseTextTa": "கர்த்தர் உன்னை எல்லாத் தீங்கினின்றும் காப்பார்; அவர் உன் ஆத்துமாவைக் காப்பார். நீ புறப்படுகிறதிலும் உள்ளே போகிறதிலும் இப்பொழுதும் என்றென்றைக்கும் கர்த்தர் உன்னைக் காப்பார்."
  },
  {
    "id": 118,
    "ref": "Psalm 37:11",
    "category": "Peace",
    "verseTextEn": "But the meek will inherit the land and enjoy peace and prosperity.",
    "verseTextTa": "சாந்தகுணமுள்ளவர்கள் பூமியைச் சுதந்தரித்து, மிகுந்த சமாதானத்தில் மகிழுவார்கள்."
  },
  {
    "id": 119,
    "ref": "John 8:12",
    "category": "Light & Witness",
    "verseTextEn": "When Jesus spoke again to the people, he said, 'I am the light of the world. Whoever follows me will never walk in darkness, but will have the light of life.'",
    "verseTextTa": "இயேசு மறுபடியும் அவர்களை நோக்கி: நான் உலகத்தின் வெளிச்சமாயிருக்கிறேன்; என்னைப் பின்பற்றுகிறவன் இருளில் நடவாமல் ஜீவனின் வெளிச்சத்தை அடைவான் என்றார்."
  },
  {
    "id": 120,
    "ref": "Psalm 34:14",
    "category": "Peace",
    "verseTextEn": "Turn from evil and do good; seek peace and pursue it.",
    "verseTextTa": "தீமையைவிட்டு விலகி நன்மை செய்; சமாதானத்தைத் தேடி, அதைப் பின்தொடர்."
  },
  {
    "id": 121,
    "ref": "2 Corinthians 4:16",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Therefore we do not lose heart. Though outwardly we are wasting away, yet inwardly we are being renewed day by day.",
    "verseTextTa": "ஆதலால் நாம் சோர்ந்துபோகிறதில்லை; எங்கள் புறம்பான மனுஷன் அழிந்தாலும், உள்ளான மனுஷன் நாளுக்குநாள் புதிதாகிறான்."
  },
  {
    "id": 122,
    "ref": "Psalm 20:4",
    "category": "Wisdom & Guidance",
    "verseTextEn": "May he give you the desire of your heart and make all your plans succeed.",
    "verseTextTa": "உன் இருதயத்தின் ஆசையை அவர் உனக்கு அருளி, உன் எல்லா யோசனைகளையும் நிறைவேற்றுவாராக."
  },
  {
    "id": 123,
    "ref": "Colossians 3:14",
    "category": "Love",
    "verseTextEn": "And over all these virtues put on love, which binds them all together in perfect unity.",
    "verseTextTa": "இவைகளுக்கெல்லாம் மேலாகச் சர்வ சங்கிலியுமான அன்பைத் தரித்துக்கொள்ளுங்கள்."
  },
  {
    "id": 124,
    "ref": "Psalm 94:18-19",
    "category": "Love",
    "verseTextEn": "When I said, 'My foot is slipping,' your unfailing love, Lord, supported me. When anxiety was great within me, your consolation brought me joy.",
    "verseTextTa": "நான் தள்ளாடுகிறேன் என்று சொல்லும்போது, கர்த்தாவே, உமது கிருபை என்னைத் தாங்கினது. என் உள்ளத்தில் கவலைகள் பெருகும்போது, உமது ஆறுதல்கள் என் ஆத்துமாவை மகிழ்விக்கிறது."
  },
  {
    "id": 125,
    "ref": "Romans 12:1",
    "category": "Praise & Worship",
    "verseTextEn": "Therefore, I urge you, brothers and sisters, in view of God's mercy, to offer your bodies as a living sacrifice, holy and pleasing to God—this is your true and proper worship.",
    "verseTextTa": "ஆகையால், சகோதரரே, தேவனுடைய இரக்கங்களினிமித்தம் நான் உங்களை வேண்டிக்கொள்ளுகிறது என்னவென்றால், நீங்கள் உங்கள் சரீரங்களை ஜீவகற்பலியாகவும், பரிசுத்தமானதும், தேவனுக்குப் பிரியமானதுமான பலியாகவும் ஒப்புக்கொடுங்கள்; அதுவே உங்களுக்கு ஏற்ற ஆராதனை."
  },
  {
    "id": 126,
    "ref": "Psalm 119:11",
    "category": "Wisdom & Guidance",
    "verseTextEn": "I have hidden your word in my heart that I might not sin against you.",
    "verseTextTa": "உமக்கு விரோதமாகப் பாவம் செய்யாதபடிக்கு, உமது வசனத்தை என் இருதயத்தில் பாதுகாத்துவைத்தேன்."
  },
  {
    "id": 127,
    "ref": "Matthew 5:14",
    "category": "Light & Witness",
    "verseTextEn": "You are the light of the world. A town built on a hill cannot be hidden.",
    "verseTextTa": "நீங்கள் உலகத்தின் வெளிச்சமாயிருக்கிறீர்கள்; மலையின்மேல் இருக்கிற பட்டணம் மறைந்திருக்கக்கூடாது."
  },
  {
    "id": 128,
    "ref": "Psalm 36:5",
    "category": "Love",
    "verseTextEn": "Your love, Lord, reaches to the heavens, your faithfulness to the skies.",
    "verseTextTa": "கர்த்தாவே, உமது கிருபை வானபரியந்தமும், உமது சத்தியம் ஆகாயமட்டும் இருக்கிறது."
  },
  {
    "id": 129,
    "ref": "Philippians 4:19",
    "category": "Praise & Worship",
    "verseTextEn": "And my God will meet all your needs according to the riches of his glory in Christ Jesus.",
    "verseTextTa": "என் தேவனோ கிறிஸ்து இயேசுவுக்குள் தமது மகிமையின் ஐசுவரியத்தின்படி உங்கள் எல்லாக் குறைவுகளையும் நிறைவு செய்வார்."
  },
  {
    "id": 130,
    "ref": "Psalm 66:20",
    "category": "Love",
    "verseTextEn": "Praise be to God, who has not rejected my prayer or withheld his love from me!",
    "verseTextTa": "தேவனுக்கு ஸ்தோத்திரம்; அவர் என் ஜெபத்தைத் தள்ளாமலும், தமது கிருபையை என்னைவிட்டு விலக்காமலும் இருந்தார்."
  },
  {
    "id": 131,
    "ref": "Hebrews 12:1-2",
    "category": "Light & Witness",
    "verseTextEn": "Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles. And let us run with perseverance the race marked out for us.",
    "verseTextTa": "ஆகையால், இவ்வளவு பெரிய சாட்சிகளின் மேகத்தினால் நாம் சூழப்பட்டிருக்கையில், நாம் போட்டிக்கு விடப்பட்ட வீரப்பந்தயத்தில் பொறுமையோடே ஓடி, நமக்குப் பாரமாயிருக்கிற யாவையும், நம்மைப் பற்றிக்கொள்ளும் பாவத்தையும் விட்டுவைப்போமாக."
  },
  {
    "id": 132,
    "ref": "Psalm 81:10",
    "category": "Comfort & Refuge",
    "verseTextEn": "I am the Lord your God, who brought you up out of Egypt. Open wide your mouth and I will fill it.",
    "verseTextTa": "உன்னை எகிப்து தேசத்திலிருந்து வெளியே கொண்டுவந்த உன் தேவனாகிய கர்த்தர் நானே; உன் வாயைத் திற; நான் அதை நிரப்புவேன்."
  },
  {
    "id": 133,
    "ref": "1 Peter 4:10",
    "category": "Faith",
    "verseTextEn": "Each of you should use whatever gift you have received to serve others, as faithful stewards of God's grace in its various forms.",
    "verseTextTa": "நீங்கள் அவரவர் வரமடைந்தபடியே, தேவனுடைய பலவிதமான கிருபையின் நல்ல விசுவாசமுள்ள கிரியைக்காரராக, அதைக் கொண்டு ஒருவருக்கொருவர் ஊழியம் செய்யுங்கள்."
  },
  {
    "id": 134,
    "ref": "Psalm 90:14",
    "category": "Love",
    "verseTextEn": "Satisfy us in the morning with your unfailing love, that we may sing for joy and be glad all our days.",
    "verseTextTa": "காலையிலே உமது கிருபையினால் எங்களைத் திருப்தியாக்கும்; அப்பொழுது எங்கள் ஜீவகாலமெல்லாம் நாங்கள் மகிழ்ந்து களிகூருவோம்."
  },
  {
    "id": 135,
    "ref": "Romans 6:23",
    "category": "Grace & Forgiveness",
    "verseTextEn": "For the wages of sin is death, but the gift of God is eternal life in Christ Jesus our Lord.",
    "verseTextTa": "பாவத்தின் சம்பளம் மரணம்; தேவனுடைய வரமோ நம்முடைய கர்த்தராகிய கிறிஸ்து இயேசுவுக்குள் நித்திய ஜீவன்."
  },
  {
    "id": 136,
    "ref": "Psalm 47:1",
    "category": "Joy",
    "verseTextEn": "Clap your hands, all you nations; shout to God with cries of joy.",
    "verseTextTa": "ஜாதிகளே, நீங்களெல்லாரும் கைதட்டுங்கள்; கெம்பீர சத்தத்தோடே தேவனை நோக்கி ஆர்ப்பரியுங்கள்."
  },
  {
    "id": 137,
    "ref": "James 1:19-20",
    "category": "General",
    "verseTextEn": "My dear brothers and sisters, take note of this: Everyone should be quick to listen, slow to speak and slow to become angry, because human anger does not produce the righteousness that God desires.",
    "verseTextTa": "ஆகையால், எனக்குப் பிரியமான சகோதரரே, நீங்கள் கேட்கிறதற்குத் தீவிரமும், பேசுகிறதற்குப் பொறுமையும், கோபிக்கிறதற்குப் பொறுமையுமுள்ளவர்களாயிருங்கள்; மனுஷனுடைய கோபம் தேவனுடைய நீதியை உண்டாக்குவதில்லையே."
  },
  {
    "id": 138,
    "ref": "Psalm 95:1",
    "category": "Praise & Worship",
    "verseTextEn": "Come, let us sing for joy to the Lord; let us shout aloud to the Rock of our salvation.",
    "verseTextTa": "வாருங்கள், நாம் கர்த்தருக்குக் கெம்பீரித்துப் பாடி, நம்முடைய இரட்சிப்பின் கன்மலையை நோக்கி ஆர்ப்பரிப்போம்."
  },
  {
    "id": 139,
    "ref": "Ephesians 5:25",
    "category": "Love",
    "verseTextEn": "Husbands, love your wives, just as Christ loved the church and gave himself up for her.",
    "verseTextTa": "புருஷர்களே, கிறிஸ்து சபையில் அன்புகூர்ந்து, தம்மையே அதற்காக ஒப்புக்கொடுத்ததுபோல, நீங்களும் உங்கள் மனைவிகளிடத்தில் அன்புகூரவேண்டும்."
  },
  {
    "id": 140,
    "ref": "Psalm 30:11-12",
    "category": "Praise & Worship",
    "verseTextEn": "You turned my wailing into dancing; you removed my sackcloth and clothed me with joy, that my heart may sing your praises and not be silent.",
    "verseTextTa": "நீர் என் புலம்பலை நாட்டியமாக மாற்றி, என் இரட்டைக் களைந்து, எனக்குச் சந்தோஷத்தை உடுத்தினீர்; என்னுடைய மகிமை உம்மைப் புகழ்ந்து பாடும், அது மௌனமாயிராது."
  },
  {
    "id": 141,
    "ref": "Colossians 3:17",
    "category": "Faith & Life",
    "verseTextEn": "And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.",
    "verseTextTa": "நீங்கள் வார்த்தையிலாவது, கிரியையிலாவது, எதைச் செய்தாலும், கர்த்தராகிய இயேசுவின் நாமத்தில் எல்லாவற்றையும் செய்து, அவர்மூலமாய்ப் பிதாவாகிய தேவனுக்கு ஸ்தோத்திரம் செலுத்துங்கள்."
  },
  {
    "id": 142,
    "ref": "Psalm 92:1-2",
    "category": "Love",
    "verseTextEn": "It is good to praise the Lord and make music to your name, O Most High, proclaiming your love in the morning and your faithfulness at night.",
    "verseTextTa": "கர்த்தருக்கு ஸ்தோத்திரம் செய்வதும், உன்னதமே, உமது நாமத்தைக் கீர்த்தனம்பண்ணுவதும், காலையில் உமது கிருபையையும், இரவிலே உமது சத்தியத்தையும் அறிவிப்பதும் நல்லது."
  },
  {
    "id": 143,
    "ref": "1 Corinthians 15:58",
    "category": "Perseverance",
    "verseTextEn": "Therefore, my dear brothers and sisters, stand firm. Let nothing move you. Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain.",
    "verseTextTa": "ஆகையால், எனக்குப் பிரியமான சகோதரரே, நீங்கள் உறுதியாயும், அசைவற்றவர்களாயும், கர்த்தருடைய கிரியையில் எப்பொழுதும் பெருகுகிறவர்களாயும் இருங்கள்; கர்த்தருக்குள் உங்கள் பிரயாசம் வீணானதல்ல என்று அறிந்திருக்கிறீர்கள்."
  },
  {
    "id": 144,
    "ref": "Psalm 73:26",
    "category": "Strength",
    "verseTextEn": "My flesh and my heart may fail, but God is the strength of my heart and my portion forever.",
    "verseTextTa": "என் மாம்சமும் என் இருதயமும் மயங்கிப்போனாலும், தேவன் என் இருதயத்தின் பெலனும், என்றென்றைக்கும் என் பங்குமாயிருக்கிறார்."
  },
  {
    "id": 145,
    "ref": "Ephesians 3:16-17",
    "category": "Strength",
    "verseTextEn": "I pray that out of his glorious riches he may strengthen you with power through his Spirit in your inner being, so that Christ may dwell in your hearts through faith.",
    "verseTextTa": "அவருடைய மகிமையின் ஐசுவரியத்தின்படி, அவருடைய ஆவியினாலே உங்கள் உள்ளான மனுஷனில் வல்லமையாய்ப் பலப்படவும், உங்கள் இருதயங்களிலே விசுவாசத்தினால் கிறிஸ்து வாசம்பண்ணவும் வேண்டிக்கொள்ளுகிறேன்."
  },
  {
    "id": 146,
    "ref": "Psalm 17:8",
    "category": "Protection & Refuge",
    "verseTextEn": "Keep me as the apple of your eye; hide me in the shadow of your wings.",
    "verseTextTa": "கண்மணியைப்போல என்னைக் காத்து, உம்முடைய சிறகுகளின் நிழலில் என்னை மறைத்தருளும்."
  },
  {
    "id": 147,
    "ref": "Philippians 2:3-4",
    "category": "Faith & Life",
    "verseTextEn": "Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves, not looking to your own interests but each of you to the interests of the others.",
    "verseTextTa": "நீங்கள் சுய லாபத்தையோ, வீண் மேன்மையையோ நாடாமல், பணிவுள்ளவர்களாய், ஒருவனையொருவன் தங்களிலும் உத்தமனாக எண்ணிக்கொள்ளுங்கள்; உங்களுடைய சுய நன்மையை மாத்திரம் பாராது, அந்நியரின் நன்மையையும் பாருங்கள்."
  },
  {
    "id": 148,
    "ref": "Psalm 141:3",
    "category": "Comfort & Refuge",
    "verseTextEn": "Set a guard over my mouth, Lord; keep watch over the door of my lips.",
    "verseTextTa": "கர்த்தாவே, என் வாய்க்குக் காவல் வைத்து, என் உதடுகளின் வாசலைக் காத்தருளும்."
  },
  {
    "id": 149,
    "ref": "1 John 4:9",
    "category": "Love",
    "verseTextEn": "This is how God showed his love among us: He sent his one and only Son into the world that we might live through him.",
    "verseTextTa": "தேவன் தம்முடைய ஒரேபேறான குமாரனை உலகத்தில் அனுப்பினார்; நாம் அவர்மூலமாய் ஜீவனடையும்படி, அதனாலே தேவனுடைய அன்பு நம்மிடத்தில் வெளிப்பட்டது."
  },
  {
    "id": 150,
    "ref": "Psalm 126:3",
    "category": "Joy",
    "verseTextEn": "The Lord has done great things for us, and we are filled with joy.",
    "verseTextTa": "கர்த்தர் நமக்குப் பெரிய காரியங்களைச் செய்தார்; நாம் சந்தோஷப்பட்டோம்."
  },
  {
    "id": 151,
    "ref": "Romans 16:19",
    "category": "Joy",
    "verseTextEn": "Everyone has heard about your obedience, so I rejoice because of you; but I want you to be wise about what is good, and innocent about what is evil.",
    "verseTextTa": "நீங்கள் கீழ்ப்படிகிற செய்தி எல்லாருக்கும் போயிற்று; ஆதலால் நான் உங்களைக்குறித்துச் சந்தோஷப்படுகிறேன்; நீங்கள் நன்மையை அறிந்து, தீமையை அறியாதவர்களாயிருக்கவேண்டுமென்று விரும்புகிறேன்."
  },
  {
    "id": 152,
    "ref": "Psalm 5:11-12",
    "category": "Love",
    "verseTextEn": "But let all who take refuge in you be glad; let them ever sing for joy. Spread your protection over them, that those who love your name may rejoice in you.",
    "verseTextTa": "உம்மிடத்தில் அடைக்கலம் புகுகிற யாவரும் மகிழ்வார்களாக; உமது நாமத்தில் அன்புகூருகிறவர்கள் உம்மில் களிகூரும்படிக்கு, நீர் அவர்களுக்கு நித்திய கெம்பீரத்தை அருளி, அவர்களை உம்முடைய தயவினால் கவசம்பண்ணுவீர்."
  },
  {
    "id": 153,
    "ref": "1 Timothy 6:12",
    "category": "Faith",
    "verseTextEn": "Fight the good fight of the faith. Take hold of the eternal life to which you were called when you made your good confession in the presence of many witnesses.",
    "verseTextTa": "விசுவாசத்தின் நல்ல போராட்டத்தில் போராடு; நித்திய ஜீவனைப் பிடித்துக்கொள்; அதற்காக நீ அழைக்கப்பட்டாய்; அநேக சாட்சிகளுக்கு முன்பாக நல்ல அறிக்கையை அறிக்கையிட்டாய்."
  },
  {
    "id": 154,
    "ref": "Psalm 119:114",
    "category": "Hope",
    "verseTextEn": "You are my refuge and my shield; I have put my hope in your word.",
    "verseTextTa": "நீர் என் மறைவும் என் கேடகமுமாயிருக்கிறீர்; உமது வசனத்தில் நான் நம்பிக்கையாயிருக்கிறேன்."
  },
  {
    "id": 155,
    "ref": "2 Corinthians 5:7",
    "category": "Faith",
    "verseTextEn": "For we live by faith, not by sight.",
    "verseTextTa": "நாம் காண்கிறதினாலே அல்ல, விசுவாசத்தினாலே நடக்கிறோம்."
  },
  {
    "id": 156,
    "ref": "Psalm 108:4",
    "category": "Love",
    "verseTextEn": "For great is your love, higher than the heavens; your faithfulness reaches to the skies.",
    "verseTextTa": "உமது கிருபை வானங்களுக்கு மேலும், உமது சத்தியம் ஆகாயத்துவரைக்கும் பெரிதாயிருக்கிறது."
  },
  {
    "id": 157,
    "ref": "Titus 3:5",
    "category": "Grace & Forgiveness",
    "verseTextEn": "He saved us, not because of righteous things we had done, but because of his mercy.",
    "verseTextTa": "நாம் செய்த நீதியுள்ள கிரியைகளினிமித்தம் அல்ல, தமது இரக்கத்தினிமித்தமே நம்மை இரட்சித்தார்."
  },
  {
    "id": 158,
    "ref": "Psalm 23:4",
    "category": "Comfort & Healing",
    "verseTextEn": "Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
    "verseTextTa": "மரண இருளின் பள்ளத்தாக்கிலே நான் நடந்தாலும், நீர் என்னோடே இருக்கிறபடியால் நான் தீமைக்குப் பயப்படேன்; உமது கோலும் உமது தடியும் எனக்குத் தேற்றரவாகும்."
  },
  {
    "id": 159,
    "ref": "Ephesians 4:2-3",
    "category": "Love",
    "verseTextEn": "Be completely humble and gentle; be patient, bearing with one another in love. Make every effort to keep the unity of the Spirit through the bond of peace.",
    "verseTextTa": "முழுப் பணிவோடும் சாந்தத்தோடும் பொறுமையோடும் ஒருவரிலொருவர் அன்பாய் பொறுத்துக்கொண்டு, சமாதானக் கட்டினாலே ஆவியின் ஐக்கியத்தைக் காத்துக்கொள்ள வகைதேடுங்கள்."
  },
  {
    "id": 160,
    "ref": "Psalm 145:14",
    "category": "Comfort & Refuge",
    "verseTextEn": "The Lord upholds all who fall and lifts up all who are bowed down.",
    "verseTextTa": "கர்த்தர் விழுகிற அனைவரையும் தாங்கி, வளைந்துகிடக்கிற எல்லாரையும் நிமிர்த்துகிறார்."
  },
  {
    "id": 161,
    "ref": "James 2:17",
    "category": "Faith",
    "verseTextEn": "In the same way, faith by itself, if it is not accompanied by action, is dead.",
    "verseTextTa": "அப்படியே விசுவாசமும் கிரியைகள் இல்லாதது தன்னில்தானே செத்ததாயிருக்கிறது."
  },
  {
    "id": 162,
    "ref": "Psalm 119:165",
    "category": "Love",
    "verseTextEn": "Great peace have those who love your law, and nothing can make them stumble.",
    "verseTextTa": "உமது நியாயப்பிரமாணத்தில் பிரியப்படுகிறவர்களுக்கு மிகுந்த சமாதானமுண்டு; அவர்கள் தள்ளாடுவதில்லை."
  },
  {
    "id": 163,
    "ref": "Matthew 6:21",
    "category": "Wisdom & Guidance",
    "verseTextEn": "For where your treasure is, there your heart will be also.",
    "verseTextTa": "உங்கள் பொக்கிஷம் எங்கேயிருக்கிறதோ, உங்கள் இருதயமும் அங்கே இருக்கும்."
  },
  {
    "id": 164,
    "ref": "Psalm 100:3",
    "category": "Comfort & Refuge",
    "verseTextEn": "Know that the Lord is God. It is he who made us, and we are his; we are his people, the sheep of his pasture.",
    "verseTextTa": "கர்த்தரே தேவன் என்று அறிந்துகொள்ளுங்கள்; அவரே நம்மை உண்டாக்கினார், நாம் அவருக்குரியவர்கள்; நாம் அவருடைய ஜனங்களும், அவர் மேய்ச்சலின் ஆடுகளுமாயிருக்கிறோம்."
  },
  {
    "id": 165,
    "ref": "1 Corinthians 10:13",
    "category": "Faith",
    "verseTextEn": "No temptation has overtaken you except what is common to mankind. And God is faithful; he will not let you be tempted beyond what you can bear.",
    "verseTextTa": "மனுஷருக்கு வரும் சாதாரணமான சோதனையேயல்லாமல் வேறே சோதனை உங்களுக்கு வரவில்லை; தேவனோ உண்மையுள்ளவர்; நீங்கள் சகிக்கக்கூடியதற்குமேல் சோதனைப்படவிடாமல், அந்தச் சோதனையை நீங்கள் சகிக்கத்தக்கதாக, அதற்கு ஏற்ற தப்புவித்தலையும் உண்டாக்குவார்."
  },
  {
    "id": 166,
    "ref": "Psalm 31:16",
    "category": "Love",
    "verseTextEn": "Let your face shine on your servant; save me in your unfailing love.",
    "verseTextTa": "உமது முகத்தை உமது அடியேன்மேல் பிரகாசிக்கப்பண்ணும்; உமது கிருபையினாலே என்னை இரட்சியும்."
  },
  {
    "id": 167,
    "ref": "Luke 1:37",
    "category": "Gospel & Grace",
    "verseTextEn": "For no word from God will ever fail.",
    "verseTextTa": "தேவனாலே நடவாத காரியம் ஒன்றுமில்லை."
  },
  {
    "id": 168,
    "ref": "Psalm 33:20-22",
    "category": "Trust",
    "verseTextEn": "We wait in hope for the Lord; he is our help and our shield. In him our hearts rejoice, for we trust in his holy name.",
    "verseTextTa": "நாங்கள் கர்த்தருக்குக் காத்திருக்கிறோம்; அவர் எங்களுக்குச் சகாயமும் கேடகமுமாயிருக்கிறார். நாங்கள் அவரில் களிகூருகிறோம்; அவருடைய பரிசுத்த நாமத்தில் நம்பிக்கையாயிருக்கிறோம்."
  },
  {
    "id": 169,
    "ref": "Romans 16:17",
    "category": "Faith & Life",
    "verseTextEn": "I urge you, brothers and sisters, to watch out for those who cause divisions and put obstacles in your way that are contrary to the teaching you have learned.",
    "verseTextTa": "சகோதரரே, நீங்கள் கற்றுக்கொண்ட உபதேசத்திற்கு விரோதமாகப் பிளவுகளையும் இடறல்களையும் உண்டாக்குகிறவர்களைக் கவனித்து, அவர்களிடத்தில் விலகுங்கள்."
  },
  {
    "id": 170,
    "ref": "Psalm 51:10",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Create in me a pure heart, O God, and renew a steadfast spirit within me.",
    "verseTextTa": "தேவனே, எனக்குச் சுத்தமான இருதயத்தை உண்டாக்கி, எனக்குள்ளே ஸ்திரமான ஆவியைப் புதிதாக்கும்."
  },
  {
    "id": 171,
    "ref": "1 Peter 3:15",
    "category": "Hope",
    "verseTextEn": "But in your hearts revere Christ as Lord. Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have.",
    "verseTextTa": "நீங்கள் உங்கள் இருதயங்களில் கர்த்தராகிய கிறிஸ்துவைப் பரிசுத்தப்படுத்தி, உங்களில் இருக்கும் நம்பிக்கையைக்குறித்துக் காரணம் கேட்கிற எவருக்கும், சாந்தத்தோடும் வணக்கத்தோடும் உத்தரவு கொடுக்க எப்பொழுதும் ஆயத்தமாயிருங்கள்."
  },
  {
    "id": 172,
    "ref": "Psalm 23:5",
    "category": "Comfort & Refuge",
    "verseTextEn": "You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.",
    "verseTextTa": "எனக்கு விரோதமானவர்களின் முன்னிலையில் நீர் எனக்கு ஒரு பந்தியை ஆயத்தப்படுத்துகிறீர்; என் தலையை எண்ணெயால் அபிஷேகம்பண்ணுகிறீர்; என் பாத்திரம் நிறைந்து பொங்குகிறது."
  },
  {
    "id": 173,
    "ref": "Acts 16:31",
    "category": "Faith",
    "verseTextEn": "They replied, 'Believe in the Lord Jesus, and you will be saved—you and your household.'",
    "verseTextTa": "அதற்கு அவர்கள்: கர்த்தராகிய இயேசு கிறிஸ்துவை விசுவாசி, அப்பொழுது நீயும் உன் குடும்பத்தாரும் இரட்சிக்கப்படுவீர்கள் என்று சொன்னார்கள்."
  },
  {
    "id": 174,
    "ref": "Psalm 119:50",
    "category": "Comfort & Healing",
    "verseTextEn": "My comfort in my suffering is this: Your promise preserves my life.",
    "verseTextTa": "என் உபத்திரவத்தில் எனக்கு ஆறுதலானது: உமது வார்த்தை என்னை உயிர்ப்பிக்கிறது."
  },
  {
    "id": 175,
    "ref": "Philippians 3:14",
    "category": "Faith & Life",
    "verseTextEn": "I press on toward the goal to win the prize for which God has called me heavenward in Christ Jesus.",
    "verseTextTa": "தேவன் கிறிஸ்து இயேசுவுக்குள் பரலோகத்திலிருந்து நம்மை அழைத்திருக்கிற பதவியின் பரிசைப் பெற இலக்கை நோக்கி ஓடுகிறேன்."
  },
  {
    "id": 176,
    "ref": "Psalm 24:1",
    "category": "Light & Witness",
    "verseTextEn": "The earth is the Lord's, and everything in it, the world, and all who live in it.",
    "verseTextTa": "பூமியும் அதிலுள்ள சகலமும், பிரபஞ்சமும் அதில் வாசமாயிருக்கிறவர்களும் கர்த்தருடையவைகள்."
  },
  {
    "id": 177,
    "ref": "John 14:6",
    "category": "Gospel & Grace",
    "verseTextEn": "Jesus answered, 'I am the way and the truth and the life. No one comes to the Father except through me.'",
    "verseTextTa": "இயேசு அவரை நோக்கி: நானே வழியும் சத்தியமும் ஜீவனுமாயிருக்கிறேன்; என்னாலேயல்லாமல் ஒருவனும் பிதாவினிடத்தில் வரான் என்றார்."
  },
  {
    "id": 178,
    "ref": "Psalm 63:1",
    "category": "Prayer",
    "verseTextEn": "You, God, are my God, earnestly I seek you; I thirst for you, my whole being longs for you.",
    "verseTextTa": "தேவனே, நீரே என் தேவன்; அதிகாலையிலே உம்மைத் தேடுகிறேன்; உமக்காக என் ஆத்துமா தாகமாயிருக்கிறது; உமக்காக என் மாம்சம் இச்சிக்கிறது."
  },
  {
    "id": 179,
    "ref": "Romans 12:9",
    "category": "Love",
    "verseTextEn": "Love must be sincere. Hate what is evil; cling to what is good.",
    "verseTextTa": "அன்பு மாயமில்லாததாயிருப்பதாக; பொல்லாததை வெறுத்து, நல்லதைப் பற்றிக்கொள்ளுங்கள்."
  },
  {
    "id": 180,
    "ref": "Psalm 34:18",
    "category": "Comfort & Healing",
    "verseTextEn": "The Lord is near to the brokenhearted and saves those who are crushed in spirit.",
    "verseTextTa": "கர்த்தர் நொறுங்குண்ட இருதயமுள்ளவர்களுக்கு சமீபமாயிருக்கிறார்; நசுங்குண்ட ஆவியுள்ளவர்களை இரட்சிக்கிறார்."
  },
  {
    "id": 181,
    "ref": "Hebrews 13:8",
    "category": "General",
    "verseTextEn": "Jesus Christ is the same yesterday and today and forever.",
    "verseTextTa": "இயேசு கிறிஸ்து நேற்றும் இன்றும் என்றென்றைக்கும் ஒரேவிதமானவர்."
  },
  {
    "id": 182,
    "ref": "Psalm 92:12-13",
    "category": "Comfort & Refuge",
    "verseTextEn": "The righteous will flourish like a palm tree, they will grow like a cedar of Lebanon; planted in the house of the Lord, they will flourish in the courts of our God.",
    "verseTextTa": "நீதிமான் பனைமரத்தைப்போல் செழித்து, லீபனோனின் கேதுருவைப்போல் வளருவான். அவர்கள் கர்த்தருடைய ஆலயத்தில் நாட்டப்பட்டு, நம்முடைய தேவனுடைய பிராகாரங்களில் செழித்து வளருவார்கள்."
  },
  {
    "id": 183,
    "ref": "Proverbs 16:24",
    "category": "Comfort & Healing",
    "verseTextEn": "Gracious words are a honeycomb, sweet to the soul and healing to the bones.",
    "verseTextTa": "கிருபையுள்ள வார்த்தைகள் தேன்கூடு; ஆத்துமாவுக்கு மதுரமும், எலும்புகளுக்கு ஆரோக்கியமுமானவைகள்."
  },
  {
    "id": 184,
    "ref": "Psalm 89:1",
    "category": "Love",
    "verseTextEn": "I will sing of the Lord's great love forever; with my mouth I will make your faithfulness known through all generations.",
    "verseTextTa": "கர்த்தருடைய கிருபைகளை என்றென்றைக்கும் பாடுவேன்; உமது சத்தியத்தை எல்லாச் சந்ததிகளிலும் என் வாயினால் அறிவிப்பேன்."
  },
  {
    "id": 185,
    "ref": "1 Corinthians 13:4-5",
    "category": "Love",
    "verseTextEn": "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It does not dishonor others, it is not self-seeking, it is not easily angered, it keeps no record of wrongs.",
    "verseTextTa": "அன்பு நீடிய பொறுமையுள்ளது, தயவுள்ளது; அன்பு விரோதப்படுத்துவதில்லை, மேன்மைபாராட்டுவதில்லை, இறுமாப்பாயிராது, மரியாதைக்கேடு செய்வதில்லை, சுயநலத்தை நாடுவதில்லை, எரிச்சலடையாது, தீங்கை எண்ணாது."
  },
  {
    "id": 186,
    "ref": "Psalm 91:4",
    "category": "Faith",
    "verseTextEn": "He will cover you with his feathers, and under his wings you will find refuge; his faithfulness will be your shield and rampart.",
    "verseTextTa": "அவர் தமது இறகுகளால் உன்னை மூடுவார்; அவருடைய சிறகுகளின் கீழே நீ அடைக்கலம் புகுவாய்; அவருடைய சத்தியம் கேடகமும் பலிசையுமாயிருக்கும்."
  },
  {
    "id": 187,
    "ref": "Micah 6:8",
    "category": "Love",
    "verseTextEn": "He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God.",
    "verseTextTa": "மனுஷனே, நல்லது என்ன என்று அவர் உனக்கு அறிவித்திருக்கிறார்; நியாயத்தைச் செய்வதும், இரக்கத்தை நேசிப்பதும், உன் தேவனுக்கு முன்பாக சாந்தமாய் நடப்பதுமே கர்த்தர் உன்னிடத்தில் கேட்கிறது."
  },
  {
    "id": 188,
    "ref": "Psalm 37:3",
    "category": "Trust",
    "verseTextEn": "Trust in the Lord and do good; dwell in the land and enjoy safe pasture.",
    "verseTextTa": "கர்த்தரை நம்பி, நன்மை செய்; தேசத்தில் வாசம்பண்ணி, உண்மையைப் பின்பற்று."
  },
  {
    "id": 189,
    "ref": "John 1:5",
    "category": "Light & Witness",
    "verseTextEn": "The light shines in the darkness, and the darkness has not overcome it.",
    "verseTextTa": "அந்த வெளிச்சம் இருளில் பிரகாசிக்கிறது; இருளானது அதை மேற்கொள்ளவில்லை."
  },
  {
    "id": 190,
    "ref": "Psalm 22:27",
    "category": "Comfort & Refuge",
    "verseTextEn": "All the ends of the earth will remember and turn to the Lord, and all the families of the nations will bow down before him.",
    "verseTextTa": "பூமியின் கடையாந்தரங்களிலுள்ள யாவரும் நினைத்து, கர்த்தரிடத்தில் திரும்புவார்கள்; சகல ஜாதிகளின் வம்சத்தாரும் உமக்கு முன்பாகப் பணிவார்கள்."
  },
  {
    "id": 191,
    "ref": "Ephesians 5:19",
    "category": "Praise & Worship",
    "verseTextEn": "Speak to one another with psalms, hymns, and songs from the Spirit. Sing and make music from your heart to the Lord.",
    "verseTextTa": "உங்களுக்குள்ளே சங்கீதங்களாலும், கீர்த்தனைகளாலும், ஆவிக்குரிய பாடல்களாலும் பேசி, உங்கள் இருதயத்திலே கர்த்தருக்குப் பாடியும் கீதம்பண்ணியும் கொண்டிருங்கள்."
  },
  {
    "id": 192,
    "ref": "Psalm 145:21",
    "category": "Praise & Worship",
    "verseTextEn": "My mouth will speak in praise of the Lord. Let every creature praise his holy name for ever and ever.",
    "verseTextTa": "என் வாய் கர்த்தருடைய துதியை உரைக்கும்; மாம்சமான யாவும் அவருடைய பரிசுத்த நாமத்தை என்றென்றைக்கும் ஸ்தோத்திரிப்பதாக."
  },
  {
    "id": 193,
    "ref": "James 4:7",
    "category": "General",
    "verseTextEn": "Submit yourselves, then, to God. Resist the devil, and he will flee from you.",
    "verseTextTa": "ஆகையால், நீங்கள் தேவனுக்குக் கீழ்ப்படிந்திருங்கள்; பிசாசை எதிர்த்து நில்லுங்கள், அப்பொழுது அவன் உங்களை விட்டு ஓடிப்போவான்."
  },
  {
    "id": 194,
    "ref": "Psalm 104:33",
    "category": "Praise & Worship",
    "verseTextEn": "I will sing to the Lord all my life; I will sing praise to my God as long as I live.",
    "verseTextTa": "நான் உயிரோடிருக்கும் வரைக்கும் கர்த்தரைப் பாடுவேன்; நான் உள்ளளவும் என் தேவனைக் கீர்த்தனம்பண்ணுவேன்."
  },
  {
    "id": 195,
    "ref": "Romans 14:8",
    "category": "Faith & Life",
    "verseTextEn": "If we live, we live for the Lord; and if we die, we die for the Lord. So, whether we live or die, we belong to the Lord.",
    "verseTextTa": "நாம் உயிரோடிருந்தால் கர்த்தருக்கே உயிரோடிருக்கிறோம்; மரித்தால் கர்த்தருக்கே மரிக்கிறோம்; ஆதலால் நாம் உயிரோடிருந்தாலும் மரித்தாலும் கர்த்தருடையவர்களே."
  },
  {
    "id": 196,
    "ref": "Psalm 106:1",
    "category": "Love",
    "verseTextEn": "Praise the Lord. Give thanks to the Lord, for he is good; his love endures forever.",
    "verseTextTa": "அல்லேலூயா! கர்த்தருக்கு ஸ்தோத்திரம்; அவர் நல்லவர்; அவருடைய கிருபை என்றென்றைக்கும் உண்டு."
  },
  {
    "id": 197,
    "ref": "1 Peter 2:9",
    "category": "Praise & Worship",
    "verseTextEn": "But you are a chosen people, a royal priesthood, a holy nation, God's special possession, that you may declare the praises of him who called you out of darkness into his wonderful light.",
    "verseTextTa": "நீங்களோ தெரிந்துகொள்ளப்பட்ட சந்ததியும், ராஜரீகமான ஆசாரியக்கூட்டமும், பரிசுத்த ஜாதியும், தேவனுடைய சொந்த ஜனங்களுமாயிருக்கிறீர்கள்; இருளிலிருந்து தம்முடைய அதிசயமான வெளிச்சத்திற்கு உங்களை அழைத்தவரின் கிருபைகளைப் பிரசித்தம்பண்ணும்படிக்கே இப்படியானீர்கள்."
  },
  {
    "id": 198,
    "ref": "Psalm 16:11",
    "category": "Joy",
    "verseTextEn": "You make known to me the path of life; you will fill me with joy in your presence, with eternal pleasures at your right hand.",
    "verseTextTa": "ஜீவனின் வழியை எனக்குத் தெரியப்படுத்துவீர்; உமது சந்நிதியில் பூரண சந்தோஷமும், உமது வலதுபக்கத்தில் நித்திய மகிழ்ச்சியுமுண்டு."
  },
  {
    "id": 199,
    "ref": "2 Timothy 2:15",
    "category": "General",
    "verseTextEn": "Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth.",
    "verseTextTa": "வேலையில்லாமல் வெட்கமடையாதிருக்கிறவனும், சத்திய வசனத்தைச் செவ்வையாய் வகுக்கிறவனுமாகிய உத்தம வேலைக்காரனாக, உன்னைத் தேவனுக்குப் பிரியமாய்ச் சமர்ப்பிக்கும்படி ஜாக்கிரதையாயிரு."
  },
  {
    "id": 200,
    "ref": "Psalm 4:7-8",
    "category": "Peace",
    "verseTextEn": "You have filled my heart with greater joy than when their grain and new wine abound. In peace I will lie down and sleep, for you alone, Lord, make me dwell in safety.",
    "verseTextTa": "அவர்கள் தானியத்தையும் திராட்சரசத்தையும் பெருகப்பண்ணுகிற சமயத்திலும் அதிகமான சந்தோஷத்தை என் இருதயத்தில் வைத்தீர். நான் சமாதானத்தோடே படுத்துத் தூங்குவேன்; கர்த்தாவே, நீர் ஒருவர் மாத்திரம் என்னை நிர்ப்பயமாய் வாசம்பண்ணப்பண்ணுகிறீர்."
  },
  {
    "id": 201,
    "ref": "Psalm 8:3-4",
    "category": "Comfort & Refuge",
    "verseTextEn": "When I consider your heavens, the work of your fingers, the moon and the stars, which you have set in place, what is mankind that you are mindful of them, human beings that you care for them?",
    "verseTextTa": "உமது விரல்களின் கிரியையாகிய வானங்களையும், நீர் அமைத்த சந்திரனையும் நட்சத்திரங்களையும் நான் நோக்கும்போது, நீர் அவனை நினைக்கத்தக்கதாக மனுஷன் என்ன? அவனை விசாரிக்கத்தக்கதாக மனுபுத்திரன் என்ன?"
  },
  {
    "id": 202,
    "ref": "John 15:5",
    "category": "Gospel & Grace",
    "verseTextEn": "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.",
    "verseTextTa": "நானே திராட்சச்செடி, நீங்கள் கிளைகள்; ஒருவன் என்னிலும் நான் அவனிலும் நிலைத்திருந்தால், அவன் மிகுந்த கனிகொடுப்பான்; என்னையொழிய நீங்கள் ஒன்றும் செய்யக்கூடாது."
  },
  {
    "id": 203,
    "ref": "Psalm 96:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Sing to the Lord a new song; sing to the Lord, all the earth. Sing to the Lord, praise his name; proclaim his salvation day after day.",
    "verseTextTa": "புதிய பாட்டைக் கர்த்தருக்குப் பாடுங்கள்; பூமியிலுள்ள யாவரே, கர்த்தருக்குப் பாடுங்கள். கர்த்தருக்குப் பாடி, அவருடைய நாமத்தை ஸ்தோத்தரியுங்கள்; தினந்தோறும் அவருடைய இரட்சிப்பை அறிவியுங்கள்."
  },
  {
    "id": 204,
    "ref": "1 John 4:19",
    "category": "Love",
    "verseTextEn": "We love because he first loved us.",
    "verseTextTa": "நாம் அவரிடத்தில் அன்புகூருகிறோம்; அவர் முதலில் நம்மிடத்தில் அன்புகூர்ந்தார்."
  },
  {
    "id": 205,
    "ref": "Psalm 116:7",
    "category": "Comfort & Refuge",
    "verseTextEn": "Return to your rest, my soul, for the Lord has been good to you.",
    "verseTextTa": "என் ஆத்துமாவே, நீ உன் இளைப்பாறுதலுக்குத் திரும்பு; கர்த்தர் உனக்கு நன்மை செய்திருக்கிறார்."
  },
  {
    "id": 206,
    "ref": "Matthew 19:26",
    "category": "Gospel & Grace",
    "verseTextEn": "Jesus looked at them and said, 'With man this is impossible, but with God all things are possible.'",
    "verseTextTa": "இயேசு அவர்களைப் பார்த்து: மனுஷரால் இது கூடாது, தேவனாலே சகலமும் கூடும் என்றார்."
  },
  {
    "id": 207,
    "ref": "Psalm 105:4-5",
    "category": "Strength",
    "verseTextEn": "Look to the Lord and his strength; seek his face always. Remember the wonders he has done, his miracles, and the judgments he pronounced.",
    "verseTextTa": "கர்த்தரையும் அவருடைய வல்லமையையும் தேடுங்கள்; அவருடைய முகத்தை எப்பொழுதும் தேடுங்கள். அவர் செய்த அதிசயங்களையும், அவருடைய அற்புதங்களையும், அவர் வாயின் நியாயங்களையும் நினைவுகூருங்கள்."
  },
  {
    "id": 208,
    "ref": "Colossians 2:6-7",
    "category": "Strength",
    "verseTextEn": "So then, just as you received Christ Jesus as Lord, continue to live your lives in him, rooted and built up in him, strengthened in the faith as you were taught, and overflowing with thankfulness.",
    "verseTextTa": "நீங்கள் கர்த்தராகிய கிறிஸ்து இயேசுவை ஏற்றுக்கொண்டபடியே, நீங்கள் போதிக்கப்பட்ட விசுவாசத்திலே வேரூன்றி, அவரில் கட்டப்பட்டு, உறுதிப்படுத்தப்பட்டு, நன்றியுள்ளவர்களாய், அவரில் நடந்துகொள்ளுங்கள்."
  },
  {
    "id": 209,
    "ref": "Psalm 33:1",
    "category": "Praise & Worship",
    "verseTextEn": "Sing joyfully to the Lord, you righteous; it is fitting for the upright to praise him.",
    "verseTextTa": "நீதிமான்களே, கர்த்தருக்குள் கெம்பீரியுங்கள்; உத்தமருக்குப் புகழ்ச்சி அழகு."
  },
  {
    "id": 210,
    "ref": "Romans 3:23-24",
    "category": "Praise & Worship",
    "verseTextEn": "For all have sinned and fall short of the glory of God, and all are justified freely by his grace through the redemption that came by Christ Jesus.",
    "verseTextTa": "எல்லாரும் பாவஞ்செய்து, தேவனுடைய மகிமையை இழந்திருக்கிறார்கள். கிறிஸ்து இயேசுவுக்குள் இருக்கும் மீட்பினாலே அவருடைய கிருபையினால் இலவசமாய் நீதிமான்களாக்கப்படுகிறார்கள்."
  },
  {
    "id": 211,
    "ref": "Psalm 119:10-11",
    "category": "Prayer",
    "verseTextEn": "I seek you with all my heart; do not let me stray from your commands. I have hidden your word in my heart that I might not sin against you.",
    "verseTextTa": "என் முழு இருதயத்தோடும் உம்மைத் தேடினேன்; உமது கற்பனைகளை விட்டு நான் தப்பிப்போகாதபடி செய்யும். உமக்கு விரோதமாகப் பாவம் செய்யாதபடிக்கு, உமது வசனத்தை என் இருதயத்தில் பாதுகாத்துவைத்தேன்."
  },
  {
    "id": 212,
    "ref": "Isaiah 41:10",
    "category": "Strength",
    "verseTextEn": "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.",
    "verseTextTa": "பயப்படாதே, நான் உன்னோடே இருக்கிறேன்; கலங்காதே, நான் உன் தேவன்; நான் உன்னைப் பலப்படுத்தி, உனக்குச் சகாயம் செய்து, என் நீதியின் வலதுகரத்தினால் உன்னைத் தாங்குவேன்."
  },
  {
    "id": 213,
    "ref": "Psalm 119:103",
    "category": "Comfort & Refuge",
    "verseTextEn": "How sweet are your words to my taste, sweeter than honey to my mouth!",
    "verseTextTa": "உமது வார்த்தைகள் என் ருசிக்கு எத்தனை மதுரமானவைகள்! என் வாய்க்குத் தேனிலும் மதுரமானவை."
  },
  {
    "id": 214,
    "ref": "John 14:1",
    "category": "Faith",
    "verseTextEn": "Do not let your hearts be troubled. You believe in God; believe also in me.",
    "verseTextTa": "உங்கள் இருதயம் கலங்காதிருப்பதாக; தேவனிடத்தில் விசுவாசமாயிருங்கள், என்னிடத்திலும் விசுவாசமாயிருங்கள்."
  },
  {
    "id": 215,
    "ref": "Psalm 107:8-9",
    "category": "Love",
    "verseTextEn": "Let them give thanks to the Lord for his unfailing love and his wonderful deeds for mankind, for he satisfies the thirsty and fills the hungry with good things.",
    "verseTextTa": "அவர்கள் கர்த்தருடைய கிருபையையும், மனுபுத்திரருக்கு அவர் செய்த அதிசயங்களையும் மகிமைப்படுத்துவார்களாக. அவர் தாகமான ஆத்துமாவைத் திருப்தியாக்கி, பசியான ஆத்துமாவை நன்மையினால் நிரப்புகிறார்."
  },
  {
    "id": 216,
    "ref": "Ephesians 1:7",
    "category": "Grace & Forgiveness",
    "verseTextEn": "In him we have redemption through his blood, the forgiveness of sins, in accordance with the riches of God's grace.",
    "verseTextTa": "அவருடைய இரத்தத்தினாலே அவரில் நமக்கு மீட்புண்டாகியிருக்கிறது, அதாவது பாவ மன்னிப்பு; அது அவருடைய கிருபையின் ஐசுவரியத்தின்படியே இருக்கிறது."
  },
  {
    "id": 217,
    "ref": "Psalm 111:10",
    "category": "Wisdom & Guidance",
    "verseTextEn": "The fear of the Lord is the beginning of wisdom; all who follow his precepts have good understanding.",
    "verseTextTa": "கர்த்தருக்குப் பயப்படுதலே ஞானத்தின் ஆரம்பம்; அவருடைய கற்பனைகளைச் செய்கிறவர்களுக்கு நல்ல புத்தி உண்டு."
  },
  {
    "id": 218,
    "ref": "Proverbs 17:17",
    "category": "Love",
    "verseTextEn": "A friend loves at all times, and a brother is born for a time of adversity.",
    "verseTextTa": "சிநேகிதன் எக்காலத்திலும் சிநேகமாயிருக்கிறான்; சகோதரனோ ஆபத்துக்கு ஏற்றவனாய்ப் பிறந்திருக்கிறான்."
  },
  {
    "id": 219,
    "ref": "Psalm 13:5-6",
    "category": "Love",
    "verseTextEn": "But I trust in your unfailing love; my heart rejoices in your salvation. I will sing the Lord's praise, for he has been good to me.",
    "verseTextTa": "நானோ உமது கிருபையில் நம்பிக்கையாயிருக்கிறேன்; உமது இரட்சிப்பில் என் இருதயம் களிகூரும். கர்த்தர் எனக்கு நன்மை செய்திருக்கிறபடியால் நான் கர்த்தரைப் பாடுவேன்."
  },
  {
    "id": 220,
    "ref": "1 Corinthians 15:33",
    "category": "General",
    "verseTextEn": "Do not be misled: Bad company corrupts good character.",
    "verseTextTa": "வஞ்சிக்கப்படாதிருங்கள்; துர்க்கூட்டம் நற்குணங்களைக் கெடுக்கும்."
  },
  {
    "id": 221,
    "ref": "Psalm 57:9-10",
    "category": "Love",
    "verseTextEn": "I will praise you, Lord, among the nations; I will sing of you among the peoples. For great is your love, reaching to the heavens; your faithfulness reaches to the skies.",
    "verseTextTa": "கர்த்தாவே, ஜனங்களுக்குள்ளே உம்மைத் துதிப்பேன்; ஜாதிகளுக்குள்ளே உம்மைக் கீர்த்தனம் பண்ணுவேன். உமது கிருபை வானபரியந்தமும், உமது சத்தியம் ஆகாயமட்டும் பெரிதாயிருக்கிறது."
  },
  {
    "id": 222,
    "ref": "Romans 11:33",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Oh, the depth of the riches of the wisdom and knowledge of God! How unsearchable his judgments, and his paths beyond tracing out!",
    "verseTextTa": "தேவனுடைய ஞானத்தின் ஐசுவரியத்தின் ஆழமும் அறிவின் ஆழமும் எவ்வளவு மிகுதியாயிருக்கிறது! அவருடைய நியாயத்தீர்ப்புகள் எவ்வளவு ஆராயக்கூடாதவைகள், அவருடைய வழிகள் எவ்வளவு கண்டுபிடிக்கக்கூடாதவைகள்!"
  },
  {
    "id": 223,
    "ref": "Psalm 19:1",
    "category": "Praise & Worship",
    "verseTextEn": "The heavens declare the glory of God; the skies proclaim the work of his hands.",
    "verseTextTa": "வானங்கள் தேவனுடைய மகிமையை வெளிப்படுத்துகின்றன; ஆகாயமிருக்கிறது அவருடைய கரங்களின் கிரியையை அறிவிக்கிறது."
  },
  {
    "id": 224,
    "ref": "Psalm 16:8",
    "category": "Comfort & Refuge",
    "verseTextEn": "I keep my eyes always on the Lord. With him at my right hand, I will not be shaken.",
    "verseTextTa": "கர்த்தரை என்றும் என் கண்களுக்கு முன்பாக வைத்தேன்; அவர் என் வலதுபக்கத்தில் இருக்கிறபடியால் நான் அசையேன்."
  },
  {
    "id": 225,
    "ref": "2 Corinthians 5:15",
    "category": "General",
    "verseTextEn": "And he died for all, that those who live should no longer live for themselves but for him who died for them and was raised again.",
    "verseTextTa": "அவர் எல்லாருக்காகவும் மரித்தார்; அப்படியிருக்க, உயிரோடிருக்கிறவர்கள் இனி தங்களுக்காக அல்ல, தங்களுக்காக மரித்து உயிர்த்தெழுந்த அவருக்காகவே உயிரோடிருக்கவேண்டும்."
  },
  {
    "id": 226,
    "ref": "Psalm 59:16",
    "category": "Love",
    "verseTextEn": "But I will sing of your strength, in the morning I will sing of your love; for you are my fortress, my refuge in times of trouble.",
    "verseTextTa": "நானோ உமது பெலனைப் பாடுவேன்; காலையில் உமது கிருபையைக் கெம்பீரித்துக் கீர்த்தனம் பண்ணுவேன்; நீர் என் கோட்டையும், உபத்திரவ நாளில் என் அடைக்கலமுமாயிருக்கிறீர்."
  },
  {
    "id": 227,
    "ref": "Matthew 16:26",
    "category": "Light & Witness",
    "verseTextEn": "What good will it be for someone to gain the whole world, yet forfeit their soul? Or what can anyone give in exchange for their soul?",
    "verseTextTa": "ஒரு மனுஷன் உலகம் முழுவதையும் அடைந்து, தன் ஆத்துமாவுக்கு நஷ்டம் வந்தால் அவனுக்குப் பிரயோஜனம் என்ன? அல்லது ஒரு மனுஷன் தன் ஆத்துமாவிற்கு ஈடாக என்ன கொடுப்பான்?"
  },
  {
    "id": 228,
    "ref": "Psalm 138:2",
    "category": "Love",
    "verseTextEn": "I will bow down toward your holy temple and will praise your name for your unfailing love and your faithfulness.",
    "verseTextTa": "உமது பரிசுத்த ஆலயத்தை நோக்கி வணங்கி, உமது கிருபைக்காகவும் உமது சத்தியத்திற்காகவும் உமது நாமத்தைத் துதிப்பேன்."
  },
  {
    "id": 229,
    "ref": "Proverbs 3:7-8",
    "category": "Comfort & Healing",
    "verseTextEn": "Do not be wise in your own eyes; fear the Lord and shun evil. This will bring health to your body and nourishment to your bones.",
    "verseTextTa": "உன்னை நீயே ஞானியென்று எண்ணாதே; கர்த்தருக்குப் பயந்து, பொல்லாப்பை விட்டு விலகு; அது உன் தொப்புளுக்கு ஆரோக்கியமும், உன் எலும்புகளுக்கு ஊக்கமுமாயிருக்கும்."
  },
  {
    "id": 230,
    "ref": "Psalm 147:5",
    "category": "Strength",
    "verseTextEn": "Great is our Lord and mighty in power; his understanding has no limit.",
    "verseTextTa": "நம்முடைய கர்த்தர் பெரியவரும், மிகுந்த வல்லமையுள்ளவருமாயிருக்கிறார்; அவருடைய புத்தி அளவிலாதது."
  },
  {
    "id": 231,
    "ref": "Ephesians 6:18",
    "category": "Prayer",
    "verseTextEn": "And pray in the Spirit on all occasions with all kinds of prayers and requests. With this in mind, be alert and always keep on praying for all the Lord's people.",
    "verseTextTa": "எப்பொழுதும் ஆவியினாலே எல்லாவிதமான ஜெபத்தினாலும் விண்ணப்பத்தினாலும் ஜெபம்பண்ணி, இதற்காகவே எல்லாப் பரிசுத்தவான்களுக்காகவும் சகல விடாமுயற்சியோடும் விழித்திருந்து ஜெபம்பண்ணுங்கள்."
  },
  {
    "id": 232,
    "ref": "Psalm 124:8",
    "category": "Creation",
    "verseTextEn": "Our help is in the name of the Lord, the Maker of heaven and earth.",
    "verseTextTa": "நமக்குச் சகாயம் பரலோகத்தையும் பூமியையும் உண்டாக்கின கர்த்தருடைய நாமத்திலிருக்கிறது."
  },
  {
    "id": 233,
    "ref": "Luke 6:38",
    "category": "Generosity",
    "verseTextEn": "Give, and it will be given to you. A good measure, pressed down, shaken together and running over, will be poured into your lap. For with the measure you use, it will be measured to you.",
    "verseTextTa": "கொடுங்கள், அப்பொழுது உங்களுக்குக் கொடுக்கப்படும்; உதறி அழுத்தி நிரப்பித் தாளிக்கும் நல்ல படி உங்கள் மடியிலே வார்க்கப்படும்; நீங்கள் எந்த அளவினால் அளக்கிறீர்களோ, அந்த அளவினாலே உங்களுக்கும் அளக்கப்படும்."
  },
  {
    "id": 234,
    "ref": "Psalm 119:18",
    "category": "Comfort & Refuge",
    "verseTextEn": "Open my eyes that I may see wonderful things in your law.",
    "verseTextTa": "நான் உமது நியாயப்பிரமாணத்திலுள்ள அதிசயங்களைக் காணும்படி, என் கண்களைத் திறந்தருளும்."
  },
  {
    "id": 235,
    "ref": "John 15:7",
    "category": "Prayer",
    "verseTextEn": "If you remain in me and my words remain in you, ask whatever you wish, and it will be done for you.",
    "verseTextTa": "நீங்கள் என்னிலும், என் வார்த்தைகள் உங்களிலும் நிலைத்திருந்தால், நீங்கள் விரும்புவதைக் கேளுங்கள், அது உங்களுக்கு உண்டாகும்."
  },
  {
    "id": 236,
    "ref": "Psalm 66:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Shout for joy to God, all the earth! Sing the glory of his name; make his praise glorious.",
    "verseTextTa": "பூமியிலுள்ள யாவரே, தேவனை நோக்கி ஆர்ப்பரியுங்கள். அவருடைய நாமத்தின் மகிமையைக் கீர்த்தனம்பண்ணி, அவருடைய துதியை மகிமையுள்ளதாக்குங்கள்."
  },
  {
    "id": 237,
    "ref": "Romans 14:17",
    "category": "Peace",
    "verseTextEn": "For the kingdom of God is not a matter of eating and drinking, but of righteousness, peace and joy in the Holy Spirit.",
    "verseTextTa": "தேவனுடைய ராஜ்யமோ புசிப்பும் குடிப்பும் அல்ல, நீதியும் சமாதானமும் பரிசுத்த ஆவியினாலே உண்டாகும் சந்தோஷமுமாயிருக்கிறது."
  },
  {
    "id": 238,
    "ref": "Psalm 69:32",
    "category": "Prayer",
    "verseTextEn": "The poor will see and be glad—you who seek God, may your hearts live!",
    "verseTextTa": "சிறுமையுள்ளவர்கள் அதைப் பார்த்து மகிழ்வார்கள்; தேவனைத் தேடுகிறவர்களே, உங்கள் இருதயம் பூரிப்பதாக."
  },
  {
    "id": 239,
    "ref": "Matthew 5:11-12",
    "category": "Blessing",
    "verseTextEn": "Blessed are you when people insult you, persecute you and falsely say all kinds of evil against you because of me. Rejoice and be glad, because great is your reward in heaven.",
    "verseTextTa": "எனக்காக மனுஷர் உங்களை நிந்தித்து, உபத்திரவப்படுத்தி, உங்களுக்கு விரோதமாகப் பொய்யாகச் சகலவிதமான தீயவார்த்தைகளையும் சொன்னால் நீங்கள் பாக்கியவான்கள். சந்தோஷப்பட்டு, மகிழுங்கள்; பரலோகத்தில் உங்கள் பலன் மிகுதியாயிருக்கிறது."
  },
  {
    "id": 240,
    "ref": "Psalm 18:30",
    "category": "Protection & Refuge",
    "verseTextEn": "As for God, his way is perfect: The Lord's word is flawless; he shields all who take refuge in him.",
    "verseTextTa": "தேவனுடைய வழி உத்தமம்; கர்த்தருடைய வசனம் புடமிடப்பட்டிருக்கிறது; அவர் தம்மிடத்தில் அடைக்கலம் புகுகிற யாவருக்கும் கேடகமாயிருக்கிறார்."
  },
  {
    "id": 241,
    "ref": "Hebrews 12:14",
    "category": "Peace",
    "verseTextEn": "Make every effort to live in peace with everyone and to be holy; without holiness no one will see the Lord.",
    "verseTextTa": "சமாதானத்தைப் பின்தொடர்ந்து, சகலரோடும் சமாதானமாயும், பரிசுத்தமாயும் இருங்கள்; பரிசுத்தமில்லாமல் ஒருவனும் கர்த்தரைக் காண்பதில்லை."
  },
  {
    "id": 242,
    "ref": "Psalm 23:2-3",
    "category": "Peace",
    "verseTextEn": "He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul. He guides me along the right paths for his name's sake.",
    "verseTextTa": "அவர் என்னைப் பசும்புல்லில் படுக்கவைத்து, அமைதியான தண்ணீர்களருகே நடத்துகிறார். என் ஆத்துமாவைப் புத்துயிர்ப்பித்து, தம்முடைய நாமத்தினிமித்தம் நீதியின் பாதைகளில் என்னை நடத்துகிறார்."
  },
  {
    "id": 243,
    "ref": "Acts 4:12",
    "category": "Salvation & Life",
    "verseTextEn": "Salvation is found in no one else, for there is no other name under heaven given to mankind by which we must be saved.",
    "verseTextTa": "வேறு ஒருவராலும் இரட்சிப்பு உண்டாகாது; நாம் இரட்சிக்கப்படவேண்டுமானால், மனுஷருக்குள்ளே வானத்தின்கீழ் வேறே கொடுக்கப்பட்ட நாமமுமில்லை."
  },
  {
    "id": 244,
    "ref": "Psalm 126:5-6",
    "category": "Comfort & Healing",
    "verseTextEn": "Those who sow with tears will reap with songs of joy. Those who go out weeping, carrying seed to sow, will return with songs of joy, carrying sheaves with them.",
    "verseTextTa": "கண்ணீரோடே விதைக்கிறவர்கள் கெம்பீரத்தோடே அறுப்பார்கள். விதைக்கிறதற்கு விலைபோய், அழுதுகொண்டே போகிறவன் கதிர்களைச் சுமந்துகொண்டு, கெம்பீரத்தோடே திரும்பிவருவான்."
  },
  {
    "id": 245,
    "ref": "Proverbs 1:7",
    "category": "Wisdom & Guidance",
    "verseTextEn": "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction.",
    "verseTextTa": "கர்த்தருக்குப் பயப்படுதலே ஞானத்தின் ஆரம்பம்; மூடர்கள் ஞானத்தையும் போதகத்தையும் அசட்டைபண்ணுகிறார்கள்."
  },
  {
    "id": 246,
    "ref": "Psalm 33:13-15",
    "category": "Wisdom & Guidance",
    "verseTextEn": "From heaven the Lord looks down and sees all mankind; from his dwelling place he watches all who live on earth— he who forms the hearts of all, who considers everything they do.",
    "verseTextTa": "கர்த்தர் பரலோகத்திலிருந்து பார்த்து, மனுபுத்திரர் அனைவரையும் பார்க்கிறார்; தாம் வாசமாயிருக்கும் ஸ்தலத்திலிருந்து பூமியில் குடியிருக்கிற எல்லாரையும் கவனிக்கிறார்; அவர் அவர்களுடைய இருதயங்களையெல்லாம் உண்டாக்கி, அவர்களுடைய கிரியைகளையெல்லாம் கவனிக்கிறவர்."
  },
  {
    "id": 247,
    "ref": "Colossians 1:13-14",
    "category": "Love",
    "verseTextEn": "For he has rescued us from the dominion of darkness and brought us into the kingdom of the Son he loves, in whom we have redemption, the forgiveness of sins.",
    "verseTextTa": "அவர் நம்மை இருளின் அதிகாரத்திலிருந்து விடுவித்து, தமக்குப் பிரியமான குமாரனுடைய ராஜ்யத்தில் சேர்த்திருக்கிறார்; அவரில் நமக்கு மீட்பும், பாவ மன்னிப்புமுண்டு."
  },
  {
    "id": 248,
    "ref": "Psalm 29:1-2",
    "category": "Strength",
    "verseTextEn": "Ascribe to the Lord, you heavenly beings, ascribe to the Lord glory and strength. Ascribe to the Lord the glory due his name; worship the Lord in the splendor of his holiness.",
    "verseTextTa": "பரலோகத்திலுள்ள வல்லவர்களே, கர்த்தருக்குக் கீர்த்தியையும் வல்லமையையும் ஒப்புக்கொடுங்கள். அவருடைய நாமத்தின் மகிமையைக் கர்த்தருக்கு ஒப்புக்கொடுத்து, பரிசுத்த அலங்காரத்தோடே கர்த்தரை வணங்குங்கள்."
  },
  {
    "id": 249,
    "ref": "John 5:24",
    "category": "Faith",
    "verseTextEn": "Very truly I tell you, whoever hears my word and believes him who sent me has eternal life and will not be judged but has crossed over from death to life.",
    "verseTextTa": "உண்மையாகவே உண்மையாகவே நான் உங்களுக்குச் சொல்லுகிறேன், என் வசனத்தைக் கேட்டு, என்னை அனுப்பினவரை விசுவாசிக்கிறவன் நித்திய ஜீவனை அடைந்திருக்கிறான்; அவன் ஆக்கினைக்கு வராமல், மரணத்தை விட்டு ஜீவனில் பிரவேசித்திருக்கிறான்."
  },
  {
    "id": 250,
    "ref": "Psalm 146:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Praise the Lord. Praise the Lord, my soul. I will praise the Lord all my life; I will sing praise to my God as long as I live.",
    "verseTextTa": "அல்லேலூயா! என் ஆத்துமாவே, கர்த்தரைத் துதி. நான் உயிரோடிருக்கும்வரைக்கும் கர்த்தரைத் துதிப்பேன்; நான் உள்ளளவும் என் தேவனைக் கீர்த்தனம்பண்ணுவேன்."
  },
  {
    "id": 251,
    "ref": "Psalm 23:4",
    "category": "Comfort & Healing",
    "verseTextEn": "Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
    "verseTextTa": "மரண இருளின் பள்ளத்தாக்கிலே நான் நடந்தாலும், நீர் என்னோடே இருக்கிறபடியால் நான் தீமைக்குப் பயப்படேன்; உமது கோலும் உமது தடியும் எனக்குத் தேற்றரவாகும்."
  },
  {
    "id": 252,
    "ref": "Romans 16:19",
    "category": "Joy",
    "verseTextEn": "Everyone has heard about your obedience, so I rejoice because of you; but I want you to be wise about what is good, and innocent about what is evil.",
    "verseTextTa": "நீங்கள் கீழ்ப்படிகிற செய்தி எல்லாருக்கும் போயிற்று; ஆதலால் நான் உங்களைக்குறித்துச் சந்தோஷப்படுகிறேன்; நீங்கள் நன்மையை அறிந்து, தீமையை அறியாதவர்களாயிருக்கவேண்டுமென்று விரும்புகிறேன்."
  },
  {
    "id": 253,
    "ref": "Psalm 5:11-12",
    "category": "Love",
    "verseTextEn": "But let all who take refuge in you be glad; let them ever sing for joy. Spread your protection over them, that those who love your name may rejoice in you.",
    "verseTextTa": "உம்மிடத்தில் அடைக்கலம் புகுகிற யாவரும் மகிழ்வார்களாக; உமது நாமத்தில் அன்புகூருகிறவர்கள் உம்மில் களிகூரும்படிக்கு, நீர் அவர்களுக்கு நித்திய கெம்பீரத்தை அருளி, அவர்களை உம்முடைய தயவினால் கவசம்பண்ணுவீர்."
  },
  {
    "id": 254,
    "ref": "1 Timothy 6:12",
    "category": "Faith",
    "verseTextEn": "Fight the good fight of the faith. Take hold of the eternal life to which you were called when you made your good confession in the presence of many witnesses.",
    "verseTextTa": "விசுவாசத்தின் நல்ல போராட்டத்தில் போராடு; நித்திய ஜீவனைப் பிடித்துக்கொள்; அதற்காக நீ அழைக்கப்பட்டாய்; அநேக சாட்சிகளுக்கு முன்பாக நல்ல அறிக்கையை அறிக்கையிட்டாய்."
  },
  {
    "id": 255,
    "ref": "Psalm 119:114",
    "category": "Hope",
    "verseTextEn": "You are my refuge and my shield; I have put my hope in your word.",
    "verseTextTa": "நீர் என் மறைவும் என் கேடகமுமாயிருக்கிறீர்; உமது வசனத்தில் நான் நம்பிக்கையாயிருக்கிறேன்."
  },
  {
    "id": 256,
    "ref": "2 Corinthians 5:7",
    "category": "Faith",
    "verseTextEn": "For we live by faith, not by sight.",
    "verseTextTa": "நாம் காண்கிறதினாலே அல்ல, விசுவாசத்தினாலே நடக்கிறோம்."
  },
  {
    "id": 257,
    "ref": "Psalm 108:4",
    "category": "Love",
    "verseTextEn": "For great is your love, higher than the heavens; your faithfulness reaches to the skies.",
    "verseTextTa": "உமது கிருபை வானங்களுக்கு மேலும், உமது சத்தியம் ஆகாயத்துவரைக்கும் பெரிதாயிருக்கிறது."
  },
  {
    "id": 258,
    "ref": "Titus 3:5",
    "category": "Grace & Forgiveness",
    "verseTextEn": "He saved us, not because of righteous things we had done, but because of his mercy.",
    "verseTextTa": "நாம் செய்த நீதியுள்ள கிரியைகளினிமித்தம் அல்ல, தமது இரக்கத்தினிமித்தமே நம்மை இரட்சித்தார்."
  },
  {
    "id": 259,
    "ref": "Psalm 119:165",
    "category": "Love",
    "verseTextEn": "Great peace have those who love your law, and nothing can make them stumble.",
    "verseTextTa": "உமது நியாயப்பிரமாணத்தில் பிரியப்படுகிறவர்களுக்கு மிகுந்த சமாதானமுண்டு; அவர்கள் தள்ளாடுவதில்லை."
  },
  {
    "id": 260,
    "ref": "Matthew 6:21",
    "category": "Wisdom & Guidance",
    "verseTextEn": "For where your treasure is, there your heart will be also.",
    "verseTextTa": "உங்கள் பொக்கிஷம் எங்கேயிருக்கிறதோ, உங்கள் இருதயமும் அங்கே இருக்கும்."
  },
  {
    "id": 261,
    "ref": "Psalm 100:3",
    "category": "Comfort & Refuge",
    "verseTextEn": "Know that the Lord is God. It is he who made us, and we are his; we are his people, the sheep of his pasture.",
    "verseTextTa": "கர்த்தரே தேவன் என்று அறிந்துகொள்ளுங்கள்; அவரே நம்மை உண்டாக்கினார், நாம் அவருக்குரியவர்கள்; நாம் அவருடைய ஜனங்களும், அவர் மேய்ச்சலின் ஆடுகளுமாயிருக்கிறோம்."
  },
  {
    "id": 262,
    "ref": "1 Corinthians 10:13",
    "category": "Faith",
    "verseTextEn": "No temptation has overtaken you except what is common to mankind. And God is faithful; he will not let you be tempted beyond what you can bear.",
    "verseTextTa": "மனுஷருக்கு வரும் சாதாரணமான சோதனையேயல்லாமல் வேறே சோதனை உங்களுக்கு வரவில்லை; தேவனோ உண்மையுள்ளவர்; நீங்கள் சகிக்கக்கூடியதற்குமேல் சோதனைப்படவிடாமல், அந்தச் சோதனையை நீங்கள் சகிக்கத்தக்கதாக, அதற்கு ஏற்ற தப்புவித்தலையும் உண்டாக்குவார்."
  },
  {
    "id": 263,
    "ref": "Psalm 31:16",
    "category": "Love",
    "verseTextEn": "Let your face shine on your servant; save me in your unfailing love.",
    "verseTextTa": "உமது முகத்தை உமது அடியேன்மேல் பிரகாசிக்கப்பண்ணும்; உமது கிருபையினாலே என்னை இரட்சியும்."
  },
  {
    "id": 264,
    "ref": "Luke 1:37",
    "category": "Gospel & Grace",
    "verseTextEn": "For no word from God will ever fail.",
    "verseTextTa": "தேவனாலே நடவாத காரியம் ஒன்றுமில்லை."
  },
  {
    "id": 265,
    "ref": "Psalm 33:20-22",
    "category": "Trust",
    "verseTextEn": "We wait in hope for the Lord; he is our help and our shield. In him our hearts rejoice, for we trust in his holy name.",
    "verseTextTa": "நாங்கள் கர்த்தருக்குக் காத்திருக்கிறோம்; அவர் எங்களுக்குச் சகாயமும் கேடகமுமாயிருக்கிறார். நாங்கள் அவரில் களிகூருகிறோம்; அவருடைய பரிசுத்த நாமத்தில் நம்பிக்கையாயிருக்கிறோம்."
  },
  {
    "id": 266,
    "ref": "Romans 16:17",
    "category": "Faith & Life",
    "verseTextEn": "I urge you, brothers and sisters, to watch out for those who cause divisions and put obstacles in your way that are contrary to the teaching you have learned.",
    "verseTextTa": "சகோதரரே, நீங்கள் கற்றுக்கொண்ட உபதேசத்திற்கு விரோதமாகப் பிளவுகளையும் இடறல்களையும் உண்டாக்குகிறவர்களைக் கவனித்து, அவர்களிடத்தில் விலகுங்கள்."
  },
  {
    "id": 267,
    "ref": "Psalm 51:10",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Create in me a pure heart, O God, and renew a steadfast spirit within me.",
    "verseTextTa": "தேவனே, எனக்குச் சுத்தமான இருதயத்தை உண்டாக்கி, எனக்குள்ளே ஸ்திரமான ஆவியைப் புதிதாக்கும்."
  },
  {
    "id": 268,
    "ref": "1 Peter 3:15",
    "category": "Hope",
    "verseTextEn": "But in your hearts revere Christ as Lord. Always be prepared to give an answer to everyone who asks you to give the reason for the hope that you have.",
    "verseTextTa": "நீங்கள் உங்கள் இருதயங்களில் கர்த்தராகிய கிறிஸ்துவைப் பரிசுத்தப்படுத்தி, உங்களில் இருக்கும் நம்பிக்கையைக்குறித்துக் காரணம் கேட்கிற எவருக்கும், சாந்தத்தோடும் வணக்கத்தோடும் உத்தரவு கொடுக்க எப்பொழுதும் ஆயத்தமாயிருங்கள்."
  },
  {
    "id": 269,
    "ref": "Psalm 23:5",
    "category": "Comfort & Refuge",
    "verseTextEn": "You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.",
    "verseTextTa": "எனக்கு விரோதமானவர்களின் முன்னிலையில் நீர் எனக்கு ஒரு பந்தியை ஆயத்தப்படுத்துகிறீர்; என் தலையை எண்ணெயால் அபிஷேகம்பண்ணுகிறீர்; என் பாத்திரம் நிறைந்து பொங்குகிறது."
  },
  {
    "id": 270,
    "ref": "Acts 16:31",
    "category": "Faith",
    "verseTextEn": "They replied, 'Believe in the Lord Jesus, and you will be saved—you and your household.'",
    "verseTextTa": "அதற்கு அவர்கள்: கர்த்தராகிய இயேசு கிறிஸ்துவை விசுவாசி, அப்பொழுது நீயும் உன் குடும்பத்தாரும் இரட்சிக்கப்படுவீர்கள் என்று சொன்னார்கள்."
  },
  {
    "id": 271,
    "ref": "Psalm 119:50",
    "category": "Comfort & Healing",
    "verseTextEn": "My comfort in my suffering is this: Your promise preserves my life.",
    "verseTextTa": "என் உபத்திரவத்தில் எனக்கு ஆறுதலானது: உமது வார்த்தை என்னை உயிர்ப்பிக்கிறது."
  },
  {
    "id": 272,
    "ref": "Philippians 3:14",
    "category": "Faith & Life",
    "verseTextEn": "I press on toward the goal to win the prize for which God has called me heavenward in Christ Jesus.",
    "verseTextTa": "தேவன் கிறிஸ்து இயேசுவுக்குள் பரலோகத்திலிருந்து நம்மை அழைத்திருக்கிற பதவியின் பரிசைப் பெற இலக்கை நோக்கி ஓடுகிறேன்."
  },
  {
    "id": 273,
    "ref": "Psalm 24:1",
    "category": "Light & Witness",
    "verseTextEn": "The earth is the Lord's, and everything in it, the world, and all who live in it.",
    "verseTextTa": "பூமியும் அதிலுள்ள சகலமும், பிரபஞ்சமும் அதில் வாசமாயிருக்கிறவர்களும் கர்த்தருடையவைகள்."
  },
  {
    "id": 274,
    "ref": "John 14:6",
    "category": "Gospel & Grace",
    "verseTextEn": "Jesus answered, 'I am the way and the truth and the life. No one comes to the Father except through me.'",
    "verseTextTa": "இயேசு அவரை நோக்கி: நானே வழியும் சத்தியமும் ஜீவனுமாயிருக்கிறேன்; என்னாலேயல்லாமல் ஒருவனும் பிதாவினிடத்தில் வரான் என்றார்."
  },
  {
    "id": 275,
    "ref": "Psalm 63:1",
    "category": "Prayer",
    "verseTextEn": "You, God, are my God, earnestly I seek you; I thirst for you, my whole being longs for you.",
    "verseTextTa": "தேவனே, நீரே என் தேவன்; அதிகாலையிலே உம்மைத் தேடுகிறேன்; உமக்காக என் ஆத்துமா தாகமாயிருக்கிறது; உமக்காக என் மாம்சம் இச்சிக்கிறது."
  },
  {
    "id": 276,
    "ref": "Romans 12:9",
    "category": "Love",
    "verseTextEn": "Love must be sincere. Hate what is evil; cling to what is good.",
    "verseTextTa": "அன்பு மாயமில்லாததாயிருப்பதாக; பொல்லாததை வெறுத்து, நல்லதைப் பற்றிக்கொள்ளுங்கள்."
  },
  {
    "id": 277,
    "ref": "Psalm 34:18",
    "category": "Comfort & Healing",
    "verseTextEn": "The Lord is near to the brokenhearted and saves those who are crushed in spirit.",
    "verseTextTa": "கர்த்தர் நொறுங்குண்ட இருதயமுள்ளவர்களுக்கு சமீபமாயிருக்கிறார்; நசுங்குண்ட ஆவியுள்ளவர்களை இரட்சிக்கிறார்."
  },
  {
    "id": 278,
    "ref": "Hebrews 13:8",
    "category": "General",
    "verseTextEn": "Jesus Christ is the same yesterday and today and forever.",
    "verseTextTa": "இயேசு கிறிஸ்து நேற்றும் இன்றும் என்றென்றைக்கும் ஒரேவிதமானவர்."
  },
  {
    "id": 279,
    "ref": "Psalm 92:12-13",
    "category": "Comfort & Refuge",
    "verseTextEn": "The righteous will flourish like a palm tree, they will grow like a cedar of Lebanon; planted in the house of the Lord, they will flourish in the courts of our God.",
    "verseTextTa": "நீதிமான் பனைமரத்தைப்போல் செழித்து, லீபனோனின் கேதுருவைப்போல் வளருவான். அவர்கள் கர்த்தருடைய ஆலயத்தில் நாட்டப்பட்டு, நம்முடைய தேவனுடைய பிராகாரங்களில் செழித்து வளருவார்கள்."
  },
  {
    "id": 280,
    "ref": "Proverbs 16:24",
    "category": "Comfort & Healing",
    "verseTextEn": "Gracious words are a honeycomb, sweet to the soul and healing to the bones.",
    "verseTextTa": "கிருபையுள்ள வார்த்தைகள் தேன்கூடு; ஆத்துமாவுக்கு மதுரமும், எலும்புகளுக்கு ஆரோக்கியமுமானவைகள்."
  },
  {
    "id": 281,
    "ref": "Psalm 89:1",
    "category": "Love",
    "verseTextEn": "I will sing of the Lord's great love forever; with my mouth I will make your faithfulness known through all generations.",
    "verseTextTa": "கர்த்தருடைய கிருபைகளை என்றென்றைக்கும் பாடுவேன்; உமது சத்தியத்தை எல்லாச் சந்ததிகளிலும் என் வாயினால் அறிவிப்பேன்."
  },
  {
    "id": 282,
    "ref": "1 Corinthians 13:4-5",
    "category": "Love",
    "verseTextEn": "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. It does not dishonor others, it is not self-seeking, it is not easily angered, it keeps no record of wrongs.",
    "verseTextTa": "அன்பு நீடிய பொறுமையுள்ளது, தயவுள்ளது; அன்பு விரோதப்படுத்துவதில்லை, மேன்மைபாராட்டுவதில்லை, இறுமாப்பாயிராது, மரியாதைக்கேடு செய்வதில்லை, சுயநலத்தை நாடுவதில்லை, எரிச்சலடையாது, தீங்கை எண்ணாது."
  },
  {
    "id": 283,
    "ref": "Psalm 91:4",
    "category": "Faith",
    "verseTextEn": "He will cover you with his feathers, and under his wings you will find refuge; his faithfulness will be your shield and rampart.",
    "verseTextTa": "அவர் தமது இறகுகளால் உன்னை மூடுவார்; அவருடைய சிறகுகளின் கீழே நீ அடைக்கலம் புகுவாய்; அவருடைய சத்தியம் கேடகமும் பலிசையுமாயிருக்கும்."
  },
  {
    "id": 284,
    "ref": "Micah 6:8",
    "category": "Love",
    "verseTextEn": "He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God.",
    "verseTextTa": "மனுஷனே, நல்லது என்ன என்று அவர் உனக்கு அறிவித்திருக்கிறார்; நியாயத்தைச் செய்வதும், இரக்கத்தை நேசிப்பதும், உன் தேவனுக்கு முன்பாக சாந்தமாய் நடப்பதுமே கர்த்தர் உன்னிடத்தில் கேட்கிறது."
  },
  {
    "id": 285,
    "ref": "Psalm 37:3",
    "category": "Trust",
    "verseTextEn": "Trust in the Lord and do good; dwell in the land and enjoy safe pasture.",
    "verseTextTa": "கர்த்தரை நம்பி, நன்மை செய்; தேசத்தில் வாசம்பண்ணி, உண்மையைப் பின்பற்று."
  },
  {
    "id": 286,
    "ref": "John 1:5",
    "category": "Light & Witness",
    "verseTextEn": "The light shines in the darkness, and the darkness has not overcome it.",
    "verseTextTa": "அந்த வெளிச்சம் இருளில் பிரகாசிக்கிறது; இருளானது அதை மேற்கொள்ளவில்லை."
  },
  {
    "id": 287,
    "ref": "Psalm 22:27",
    "category": "Comfort & Refuge",
    "verseTextEn": "All the ends of the earth will remember and turn to the Lord, and all the families of the nations will bow down before him.",
    "verseTextTa": "பூமியின் கடையாந்தரங்களிலுள்ள யாவரும் நினைத்து, கர்த்தரிடத்தில் திரும்புவார்கள்; சகல ஜாதிகளின் வம்சத்தாரும் உமக்கு முன்பாகப் பணிவார்கள்."
  },
  {
    "id": 288,
    "ref": "Ephesians 5:19",
    "category": "Praise & Worship",
    "verseTextEn": "Speak to one another with psalms, hymns, and songs from the Spirit. Sing and make music from your heart to the Lord.",
    "verseTextTa": "உங்களுக்குள்ளே சங்கீதங்களாலும், கீர்த்தனைகளாலும், ஆவிக்குரிய பாடல்களாலும் பேசி, உங்கள் இருதயத்திலே கர்த்தருக்குப் பாடியும் கீதம்பண்ணியும் கொண்டிருங்கள்."
  },
  {
    "id": 289,
    "ref": "Psalm 145:21",
    "category": "Praise & Worship",
    "verseTextEn": "My mouth will speak in praise of the Lord. Let every creature praise his holy name for ever and ever.",
    "verseTextTa": "என் வாய் கர்த்தருடைய துதியை உரைக்கும்; மாம்சமான யாவும் அவருடைய பரிசுத்த நாமத்தை என்றென்றைக்கும் ஸ்தோத்திரிப்பதாக."
  },
  {
    "id": 290,
    "ref": "James 4:7",
    "category": "General",
    "verseTextEn": "Submit yourselves, then, to God. Resist the devil, and he will flee from you.",
    "verseTextTa": "ஆகையால், நீங்கள் தேவனுக்குக் கீழ்ப்படிந்திருங்கள்; பிசாசை எதிர்த்து நில்லுங்கள், அப்பொழுது அவன் உங்களை விட்டு ஓடிப்போவான்."
  },
  {
    "id": 291,
    "ref": "Psalm 104:33",
    "category": "Praise & Worship",
    "verseTextEn": "I will sing to the Lord all my life; I will sing praise to my God as long as I live.",
    "verseTextTa": "நான் உயிரோடிருக்கும் வரைக்கும் கர்த்தரைப் பாடுவேன்; நான் உள்ளளவும் என் தேவனைக் கீர்த்தனம்பண்ணுவேன்."
  },
  {
    "id": 292,
    "ref": "Romans 14:8",
    "category": "Faith & Life",
    "verseTextEn": "If we live, we live for the Lord; and if we die, we die for the Lord. So, whether we live or die, we belong to the Lord.",
    "verseTextTa": "நாம் உயிரோடிருந்தால் கர்த்தருக்கே உயிரோடிருக்கிறோம்; மரித்தால் கர்த்தருக்கே மரிக்கிறோம்; ஆதலால் நாம் உயிரோடிருந்தாலும் மரித்தாலும் கர்த்தருடையவர்களே."
  },
  {
    "id": 293,
    "ref": "Psalm 106:1",
    "category": "Love",
    "verseTextEn": "Praise the Lord. Give thanks to the Lord, for he is good; his love endures forever.",
    "verseTextTa": "அல்லேலூயா! கர்த்தருக்கு ஸ்தோத்திரம்; அவர் நல்லவர்; அவருடைய கிருபை என்றென்றைக்கும் உண்டு."
  },
  {
    "id": 294,
    "ref": "1 Peter 2:9",
    "category": "Praise & Worship",
    "verseTextEn": "But you are a chosen people, a royal priesthood, a holy nation, God's special possession, that you may declare the praises of him who called you out of darkness into his wonderful light.",
    "verseTextTa": "நீங்களோ தெரிந்துகொள்ளப்பட்ட சந்ததியும், ராஜரீகமான ஆசாரியக்கூட்டமும், பரிசுத்த ஜாதியும், தேவனுடைய சொந்த ஜனங்களுமாயிருக்கிறீர்கள்; இருளிலிருந்து தம்முடைய அதிசயமான வெளிச்சத்திற்கு உங்களை அழைத்தவரின் கிருபைகளைப் பிரசித்தம்பண்ணும்படிக்கே இப்படியானீர்கள்."
  },
  {
    "id": 295,
    "ref": "Psalm 16:11",
    "category": "Joy",
    "verseTextEn": "You make known to me the path of life; you will fill me with joy in your presence, with eternal pleasures at your right hand.",
    "verseTextTa": "ஜீவனின் வழியை எனக்குத் தெரியப்படுத்துவீர்; உமது சந்நிதியில் பூரண சந்தோஷமும், உமது வலதுபக்கத்தில் நித்திய மகிழ்ச்சியுமுண்டு."
  },
  {
    "id": 296,
    "ref": "2 Timothy 2:15",
    "category": "General",
    "verseTextEn": "Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth.",
    "verseTextTa": "வேலையில்லாமல் வெட்கமடையாதிருக்கிறவனும், சத்திய வசனத்தைச் செவ்வையாய் வகுக்கிறவனுமாகிய உத்தம வேலைக்காரனாக, உன்னைத் தேவனுக்குப் பிரியமாய்ச் சமர்ப்பிக்கும்படி ஜாக்கிரதையாயிரு."
  },
  {
    "id": 297,
    "ref": "Psalm 4:7-8",
    "category": "Peace",
    "verseTextEn": "You have filled my heart with greater joy than when their grain and new wine abound. In peace I will lie down and sleep, for you alone, Lord, make me dwell in safety.",
    "verseTextTa": "அவர்கள் தானியத்தையும் திராட்சரசத்தையும் பெருகப்பண்ணுகிற சமயத்திலும் அதிகமான சந்தோஷத்தை என் இருதயத்தில் வைத்தீர். நான் சமாதானத்தோடே படுத்துத் தூங்குவேன்; கர்த்தாவே, நீர் ஒருவர் மாத்திரம் என்னை நிர்ப்பயமாய் வாசம்பண்ணப்பண்ணுகிறீர்."
  },
  {
    "id": 298,
    "ref": "Psalm 8:3-4",
    "category": "Comfort & Refuge",
    "verseTextEn": "When I consider your heavens, the work of your fingers, the moon and the stars, which you have set in place, what is mankind that you are mindful of them, human beings that you care for them?",
    "verseTextTa": "உமது விரல்களின் கிரியையாகிய வானங்களையும், நீர் அமைத்த சந்திரனையும் நட்சத்திரங்களையும் நான் நோக்கும்போது, நீர் அவனை நினைக்கத்தக்கதாக மனுஷன் என்ன? அவனை விசாரிக்கத்தக்கதாக மனுபுத்திரன் என்ன?"
  },
  {
    "id": 299,
    "ref": "John 15:5",
    "category": "Gospel & Grace",
    "verseTextEn": "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing.",
    "verseTextTa": "நானே திராட்சச்செடி, நீங்கள் கிளைகள்; ஒருவன் என்னிலும் நான் அவனிலும் நிலைத்திருந்தால், அவன் மிகுந்த கனிகொடுப்பான்; என்னையொழிய நீங்கள் ஒன்றும் செய்யக்கூடாது."
  },
  {
    "id": 300,
    "ref": "Psalm 96:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Sing to the Lord a new song; sing to the Lord, all the earth. Sing to the Lord, praise his name; proclaim his salvation day after day.",
    "verseTextTa": "புதிய பாட்டைக் கர்த்தருக்குப் பாடுங்கள்; பூமியிலுள்ள யாவரே, கர்த்தருக்குப் பாடுங்கள். கர்த்தருக்குப் பாடி, அவருடைய நாமத்தை ஸ்தோத்தரியுங்கள்; தினந்தோறும் அவருடைய இரட்சிப்பை அறிவியுங்கள்."
  },
  {
    "id": 301,
    "ref": "1 John 4:19",
    "category": "Love",
    "verseTextEn": "We love because he first loved us.",
    "verseTextTa": "நாம் அவரிடத்தில் அன்புகூருகிறோம்; அவர் முதலில் நம்மிடத்தில் அன்புகூர்ந்தார்."
  },
  {
    "id": 302,
    "ref": "Psalm 116:7",
    "category": "Comfort & Refuge",
    "verseTextEn": "Return to your rest, my soul, for the Lord has been good to you.",
    "verseTextTa": "என் ஆத்துமாவே, நீ உன் இளைப்பாறுதலுக்குத் திரும்பு; கர்த்தர் உனக்கு நன்மை செய்திருக்கிறார்."
  },
  {
    "id": 303,
    "ref": "Matthew 19:26",
    "category": "Gospel & Grace",
    "verseTextEn": "Jesus looked at them and said, 'With man this is impossible, but with God all things are possible.'",
    "verseTextTa": "இயேசு அவர்களைப் பார்த்து: மனுஷரால் இது கூடாது, தேவனாலே சகலமும் கூடும் என்றார்."
  },
  {
    "id": 304,
    "ref": "Psalm 105:4-5",
    "category": "Strength",
    "verseTextEn": "Look to the Lord and his strength; seek his face always. Remember the wonders he has done, his miracles, and the judgments he pronounced.",
    "verseTextTa": "கர்த்தரையும் அவருடைய வல்லமையையும் தேடுங்கள்; அவருடைய முகத்தை எப்பொழுதும் தேடுங்கள். அவர் செய்த அதிசயங்களையும், அவருடைய அற்புதங்களையும், அவர் வாயின் நியாயங்களையும் நினைவுகூருங்கள்."
  },
  {
    "id": 305,
    "ref": "Colossians 2:6-7",
    "category": "Strength",
    "verseTextEn": "So then, just as you received Christ Jesus as Lord, continue to live your lives in him, rooted and built up in him, strengthened in the faith as you were taught, and overflowing with thankfulness.",
    "verseTextTa": "நீங்கள் கர்த்தராகிய கிறிஸ்து இயேசுவை ஏற்றுக்கொண்டபடியே, நீங்கள் போதிக்கப்பட்ட விசுவாசத்திலே வேரூன்றி, அவரில் கட்டப்பட்டு, உறுதிப்படுத்தப்பட்டு, நன்றியுள்ளவர்களாய், அவரில் நடந்துகொள்ளுங்கள்."
  },
  {
    "id": 306,
    "ref": "Psalm 33:1",
    "category": "Praise & Worship",
    "verseTextEn": "Sing joyfully to the Lord, you righteous; it is fitting for the upright to praise him.",
    "verseTextTa": "நீதிமான்களே, கர்த்தருக்குள் கெம்பீரியுங்கள்; உத்தமருக்குப் புகழ்ச்சி அழகு."
  },
  {
    "id": 307,
    "ref": "Romans 3:23-24",
    "category": "Praise & Worship",
    "verseTextEn": "For all have sinned and fall short of the glory of God, and all are justified freely by his grace through the redemption that came by Christ Jesus.",
    "verseTextTa": "எல்லாரும் பாவஞ்செய்து, தேவனுடைய மகிமையை இழந்திருக்கிறார்கள். கிறிஸ்து இயேசுவுக்குள் இருக்கும் மீட்பினாலே அவருடைய கிருபையினால் இலவசமாய் நீதிமான்களாக்கப்படுகிறார்கள்."
  },
  {
    "id": 308,
    "ref": "Psalm 119:10-11",
    "category": "Prayer",
    "verseTextEn": "I seek you with all my heart; do not let me stray from your commands. I have hidden your word in my heart that I might not sin against you.",
    "verseTextTa": "என் முழு இருதயத்தோடும் உம்மைத் தேடினேன்; உமது கற்பனைகளை விட்டு நான் தப்பிப்போகாதபடி செய்யும். உமக்கு விரோதமாகப் பாவம் செய்யாதபடிக்கு, உமது வசனத்தை என் இருதயத்தில் பாதுகாத்துவைத்தேன்."
  },
  {
    "id": 309,
    "ref": "Isaiah 41:10",
    "category": "Strength",
    "verseTextEn": "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.",
    "verseTextTa": "பயப்படாதே, நான் உன்னோடே இருக்கிறேன்; கலங்காதே, நான் உன் தேவன்; நான் உன்னைப் பலப்படுத்தி, உனக்குச் சகாயம் செய்து, என் நீதியின் வலதுகரத்தினால் உன்னைத் தாங்குவேன்."
  },
  {
    "id": 310,
    "ref": "Psalm 119:103",
    "category": "Comfort & Refuge",
    "verseTextEn": "How sweet are your words to my taste, sweeter than honey to my mouth!",
    "verseTextTa": "உமது வார்த்தைகள் என் ருசிக்கு எத்தனை மதுரமானவைகள்! என் வாய்க்குத் தேனிலும் மதுரமானவை."
  },
  {
    "id": 311,
    "ref": "John 14:1",
    "category": "Faith",
    "verseTextEn": "Do not let your hearts be troubled. You believe in God; believe also in me.",
    "verseTextTa": "உங்கள் இருதயம் கலங்காதிருப்பதாக; தேவனிடத்தில் விசுவாசமாயிருங்கள், என்னிடத்திலும் விசுவாசமாயிருங்கள்."
  },
  {
    "id": 312,
    "ref": "Psalm 107:8-9",
    "category": "Love",
    "verseTextEn": "Let them give thanks to the Lord for his unfailing love and his wonderful deeds for mankind, for he satisfies the thirsty and fills the hungry with good things.",
    "verseTextTa": "அவர்கள் கர்த்தருடைய கிருபையையும், மனுபுத்திரருக்கு அவர் செய்த அதிசயங்களையும் மகிமைப்படுத்துவார்களாக. அவர் தாகமான ஆத்துமாவைத் திருப்தியாக்கி, பசியான ஆத்துமாவை நன்மையினால் நிரப்புகிறார்."
  },
  {
    "id": 313,
    "ref": "Ephesians 1:7",
    "category": "Grace & Forgiveness",
    "verseTextEn": "In him we have redemption through his blood, the forgiveness of sins, in accordance with the riches of God's grace.",
    "verseTextTa": "அவருடைய இரத்தத்தினாலே அவரில் நமக்கு மீட்புண்டாகியிருக்கிறது, அதாவது பாவ மன்னிப்பு; அது அவருடைய கிருபையின் ஐசுவரியத்தின்படியே இருக்கிறது."
  },
  {
    "id": 314,
    "ref": "Psalm 111:10",
    "category": "Wisdom & Guidance",
    "verseTextEn": "The fear of the Lord is the beginning of wisdom; all who follow his precepts have good understanding.",
    "verseTextTa": "கர்த்தருக்குப் பயப்படுதலே ஞானத்தின் ஆரம்பம்; அவருடைய கற்பனைகளைச் செய்கிறவர்களுக்கு நல்ல புத்தி உண்டு."
  },
  {
    "id": 315,
    "ref": "Proverbs 17:17",
    "category": "Love",
    "verseTextEn": "A friend loves at all times, and a brother is born for a time of adversity.",
    "verseTextTa": "சிநேகிதன் எக்காலத்திலும் சிநேகமாயிருக்கிறான்; சகோதரனோ ஆபத்துக்கு ஏற்றவனாய்ப் பிறந்திருக்கிறான்."
  },
  {
    "id": 316,
    "ref": "Psalm 13:5-6",
    "category": "Love",
    "verseTextEn": "But I trust in your unfailing love; my heart rejoices in your salvation. I will sing the Lord's praise, for he has been good to me.",
    "verseTextTa": "நானோ உமது கிருபையில் நம்பிக்கையாயிருக்கிறேன்; உமது இரட்சிப்பில் என் இருதயம் களிகூரும். கர்த்தர் எனக்கு நன்மை செய்திருக்கிறபடியால் நான் கர்த்தரைப் பாடுவேன்."
  },
  {
    "id": 317,
    "ref": "1 Corinthians 15:33",
    "category": "General",
    "verseTextEn": "Do not be misled: Bad company corrupts good character.",
    "verseTextTa": "வஞ்சிக்கப்படாதிருங்கள்; துர்க்கூட்டம் நற்குணங்களைக் கெடுக்கும்."
  },
  {
    "id": 318,
    "ref": "Psalm 57:9-10",
    "category": "Love",
    "verseTextEn": "I will praise you, Lord, among the nations; I will sing of you among the peoples. For great is your love, reaching to the heavens; your faithfulness reaches to the skies.",
    "verseTextTa": "கர்த்தாவே, ஜனங்களுக்குள்ளே உம்மைத் துதிப்பேன்; ஜாதிகளுக்குள்ளே உம்மைக் கீர்த்தனம் பண்ணுவேன். உமது கிருபை வானபரியந்தமும், உமது சத்தியம் ஆகாயமட்டும் பெரிதாயிருக்கிறது."
  },
  {
    "id": 319,
    "ref": "Romans 11:33",
    "category": "Wisdom & Guidance",
    "verseTextEn": "Oh, the depth of the riches of the wisdom and knowledge of God! How unsearchable his judgments, and his paths beyond tracing out!",
    "verseTextTa": "தேவனுடைய ஞானத்தின் ஐசுவரியத்தின் ஆழமும் அறிவின் ஆழமும் எவ்வளவு மிகுதியாயிருக்கிறது! அவருடைய நியாயத்தீர்ப்புகள் எவ்வளவு ஆராயக்கூடாதவைகள், அவருடைய வழிகள் எவ்வளவு கண்டுபிடிக்கக்கூடாதவைகள்!"
  },
  {
    "id": 320,
    "ref": "Psalm 19:1",
    "category": "Praise & Worship",
    "verseTextEn": "The heavens declare the glory of God; the skies proclaim the work of his hands.",
    "verseTextTa": "வானங்கள் தேவனுடைய மகிமையை வெளிப்படுத்துகின்றன; ஆகாயமிருக்கிறது அவருடைய கரங்களின் கிரியையை அறிவிக்கிறது."
  },
  {
    "id": 321,
    "ref": "Psalm 16:8",
    "category": "Comfort & Refuge",
    "verseTextEn": "I keep my eyes always on the Lord. With him at my right hand, I will not be shaken.",
    "verseTextTa": "கர்த்தரை என்றும் என் கண்களுக்கு முன்பாக வைத்தேன்; அவர் என் வலதுபக்கத்தில் இருக்கிறபடியால் நான் அசையேன்."
  },
  {
    "id": 322,
    "ref": "2 Corinthians 5:15",
    "category": "General",
    "verseTextEn": "And he died for all, that those who live should no longer live for themselves but for him who died for them and was raised again.",
    "verseTextTa": "அவர் எல்லாருக்காகவும் மரித்தார்; அப்படியிருக்க, உயிரோடிருக்கிறவர்கள் இனி தங்களுக்காக அல்ல, தங்களுக்காக மரித்து உயிர்த்தெழுந்த அவருக்காகவே உயிரோடிருக்கவேண்டும்."
  },
  {
    "id": 323,
    "ref": "Psalm 59:16",
    "category": "Love",
    "verseTextEn": "But I will sing of your strength, in the morning I will sing of your love; for you are my fortress, my refuge in times of trouble.",
    "verseTextTa": "நானோ உமது பெலனைப் பாடுவேன்; காலையில் உமது கிருபையைக் கெம்பீரித்துக் கீர்த்தனம் பண்ணுவேன்; நீர் என் கோட்டையும், உபத்திரவ நாளில் என் அடைக்கலமுமாயிருக்கிறீர்."
  },
  {
    "id": 324,
    "ref": "Matthew 16:26",
    "category": "Light & Witness",
    "verseTextEn": "What good will it be for someone to gain the whole world, yet forfeit their soul? Or what can anyone give in exchange for their soul?",
    "verseTextTa": "ஒரு மனுஷன் உலகம் முழுவதையும் அடைந்து, தன் ஆத்துமாவுக்கு நஷ்டம் வந்தால் அவனுக்குப் பிரயோஜனம் என்ன? அல்லது ஒரு மனுஷன் தன் ஆத்துமாவிற்கு ஈடாக என்ன கொடுப்பான்?"
  },
  {
    "id": 325,
    "ref": "Psalm 138:2",
    "category": "Love",
    "verseTextEn": "I will bow down toward your holy temple and will praise your name for your unfailing love and your faithfulness.",
    "verseTextTa": "உமது பரிசுத்த ஆலயத்தை நோக்கி வணங்கி, உமது கிருபைக்காகவும் உமது சத்தியத்திற்காகவும் உமது நாமத்தைத் துதிப்பேன்."
  },
  {
    "id": 326,
    "ref": "Proverbs 3:7-8",
    "category": "Comfort & Healing",
    "verseTextEn": "Do not be wise in your own eyes; fear the Lord and shun evil. This will bring health to your body and nourishment to your bones.",
    "verseTextTa": "உன்னை நீயே ஞானியென்று எண்ணாதே; கர்த்தருக்குப் பயந்து, பொல்லாப்பை விட்டு விலகு; அது உன் தொப்புளுக்கு ஆரோக்கியமும், உன் எலும்புகளுக்கு ஊக்கமுமாயிருக்கும்."
  },
  {
    "id": 327,
    "ref": "Psalm 147:5",
    "category": "Strength",
    "verseTextEn": "Great is our Lord and mighty in power; his understanding has no limit.",
    "verseTextTa": "நம்முடைய கர்த்தர் பெரியவரும், மிகுந்த வல்லமையுள்ளவருமாயிருக்கிறார்; அவருடைய புத்தி அளவிலாதது."
  },
  {
    "id": 328,
    "ref": "Ephesians 6:18",
    "category": "Prayer",
    "verseTextEn": "And pray in the Spirit on all occasions with all kinds of prayers and requests. With this in mind, be alert and always keep on praying for all the Lord's people.",
    "verseTextTa": "எப்பொழுதும் ஆவியினாலே எல்லாவிதமான ஜெபத்தினாலும் விண்ணப்பத்தினாலும் ஜெபம்பண்ணி, இதற்காகவே எல்லாப் பரிசுத்தவான்களுக்காகவும் சகல விடாமுயற்சியோடும் விழித்திருந்து ஜெபம்பண்ணுங்கள்."
  },
  {
    "id": 329,
    "ref": "Psalm 124:8",
    "category": "Creation",
    "verseTextEn": "Our help is in the name of the Lord, the Maker of heaven and earth.",
    "verseTextTa": "நமக்குச் சகாயம் பரலோகத்தையும் பூமியையும் உண்டாக்கின கர்த்தருடைய நாமத்திலிருக்கிறது."
  },
  {
    "id": 330,
    "ref": "Luke 6:38",
    "category": "Generosity",
    "verseTextEn": "Give, and it will be given to you. A good measure, pressed down, shaken together and running over, will be poured into your lap. For with the measure you use, it will be measured to you.",
    "verseTextTa": "கொடுங்கள், அப்பொழுது உங்களுக்குக் கொடுக்கப்படும்; உதறி அழுத்தி நிரப்பித் தாளிக்கும் நல்ல படி உங்கள் மடியிலே வார்க்கப்படும்; நீங்கள் எந்த அளவினால் அளக்கிறீர்களோ, அந்த அளவினாலே உங்களுக்கும் அளக்கப்படும்."
  },
  {
    "id": 331,
    "ref": "Psalm 119:18",
    "category": "Comfort & Refuge",
    "verseTextEn": "Open my eyes that I may see wonderful things in your law.",
    "verseTextTa": "நான் உமது நியாயப்பிரமாணத்திலுள்ள அதிசயங்களைக் காணும்படி, என் கண்களைத் திறந்தருளும்."
  },
  {
    "id": 332,
    "ref": "John 15:7",
    "category": "Prayer",
    "verseTextEn": "If you remain in me and my words remain in you, ask whatever you wish, and it will be done for you.",
    "verseTextTa": "நீங்கள் என்னிலும், என் வார்த்தைகள் உங்களிலும் நிலைத்திருந்தால், நீங்கள் விரும்புவதைக் கேளுங்கள், அது உங்களுக்கு உண்டாகும்."
  },
  {
    "id": 333,
    "ref": "Psalm 66:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Shout for joy to God, all the earth! Sing the glory of his name; make his praise glorious.",
    "verseTextTa": "பூமியிலுள்ள யாவரே, தேவனை நோக்கி ஆர்ப்பரியுங்கள். அவருடைய நாமத்தின் மகிமையைக் கீர்த்தனம்பண்ணி, அவருடைய துதியை மகிமையுள்ளதாக்குங்கள்."
  },
  {
    "id": 334,
    "ref": "Romans 14:17",
    "category": "Peace",
    "verseTextEn": "For the kingdom of God is not a matter of eating and drinking, but of righteousness, peace and joy in the Holy Spirit.",
    "verseTextTa": "தேவனுடைய ராஜ்யமோ புசிப்பும் குடிப்பும் அல்ல, நீதியும் சமாதானமும் பரிசுத்த ஆவியினாலே உண்டாகும் சந்தோஷமுமாயிருக்கிறது."
  },
  {
    "id": 335,
    "ref": "Psalm 69:32",
    "category": "Prayer",
    "verseTextEn": "The poor will see and be glad—you who seek God, may your hearts live!",
    "verseTextTa": "சிறுமையுள்ளவர்கள் அதைப் பார்த்து மகிழ்வார்கள்; தேவனைத் தேடுகிறவர்களே, உங்கள் இருதயம் பூரிப்பதாக."
  },
  {
    "id": 336,
    "ref": "Matthew 5:11-12",
    "category": "Blessing",
    "verseTextEn": "Blessed are you when people insult you, persecute you and falsely say all kinds of evil against you because of me. Rejoice and be glad, because great is your reward in heaven.",
    "verseTextTa": "எனக்காக மனுஷர் உங்களை நிந்தித்து, உபத்திரவப்படுத்தி, உங்களுக்கு விரோதமாகப் பொய்யாகச் சகலவிதமான தீயவார்த்தைகளையும் சொன்னால் நீங்கள் பாக்கியவான்கள். சந்தோஷப்பட்டு, மகிழுங்கள்; பரலோகத்தில் உங்கள் பலன் மிகுதியாயிருக்கிறது."
  },
  {
    "id": 337,
    "ref": "Psalm 18:30",
    "category": "Protection & Refuge",
    "verseTextEn": "As for God, his way is perfect: The Lord's word is flawless; he shields all who take refuge in him.",
    "verseTextTa": "தேவனுடைய வழி உத்தமம்; கர்த்தருடைய வசனம் புடமிடப்பட்டிருக்கிறது; அவர் தம்மிடத்தில் அடைக்கலம் புகுகிற யாவருக்கும் கேடகமாயிருக்கிறார்."
  },
  {
    "id": 338,
    "ref": "Hebrews 12:14",
    "category": "Peace",
    "verseTextEn": "Make every effort to live in peace with everyone and to be holy; without holiness no one will see the Lord.",
    "verseTextTa": "சமாதானத்தைப் பின்தொடர்ந்து, சகலரோடும் சமாதானமாயும், பரிசுத்தமாயும் இருங்கள்; பரிசுத்தமில்லாமல் ஒருவனும் கர்த்தரைக் காண்பதில்லை."
  },
  {
    "id": 339,
    "ref": "Psalm 23:2-3",
    "category": "Peace",
    "verseTextEn": "He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul. He guides me along the right paths for his name's sake.",
    "verseTextTa": "அவர் என்னைப் பசும்புல்லில் படுக்கவைத்து, அமைதியான தண்ணீர்களருகே நடத்துகிறார். என் ஆத்துமாவைப் புத்துயிர்ப்பித்து, தம்முடைய நாமத்தினிமித்தம் நீதியின் பாதைகளில் என்னை நடத்துகிறார்."
  },
  {
    "id": 340,
    "ref": "Acts 4:12",
    "category": "Salvation & Life",
    "verseTextEn": "Salvation is found in no one else, for there is no other name under heaven given to mankind by which we must be saved.",
    "verseTextTa": "வேறு ஒருவராலும் இரட்சிப்பு உண்டாகாது; நாம் இரட்சிக்கப்படவேண்டுமானால், மனுஷருக்குள்ளே வானத்தின்கீழ் வேறே கொடுக்கப்பட்ட நாமமுமில்லை."
  },
  {
    "id": 341,
    "ref": "Psalm 126:5-6",
    "category": "Comfort & Healing",
    "verseTextEn": "Those who sow with tears will reap with songs of joy. Those who go out weeping, carrying seed to sow, will return with songs of joy, carrying sheaves with them.",
    "verseTextTa": "கண்ணீரோடே விதைக்கிறவர்கள் கெம்பீரத்தோடே அறுப்பார்கள். விதைக்கிறதற்கு விலைபோய், அழுதுகொண்டே போகிறவன் கதிர்களைச் சுமந்துகொண்டு, கெம்பீரத்தோடே திரும்பிவருவான்."
  },
  {
    "id": 342,
    "ref": "Proverbs 1:7",
    "category": "Wisdom & Guidance",
    "verseTextEn": "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction.",
    "verseTextTa": "கர்த்தருக்குப் பயப்படுதலே ஞானத்தின் ஆரம்பம்; மூடர்கள் ஞானத்தையும் போதகத்தையும் அசட்டைபண்ணுகிறார்கள்."
  },
  {
    "id": 343,
    "ref": "Psalm 33:13-15",
    "category": "Wisdom & Guidance",
    "verseTextEn": "From heaven the Lord looks down and sees all mankind; from his dwelling place he watches all who live on earth— he who forms the hearts of all, who considers everything they do.",
    "verseTextTa": "கர்த்தர் பரலோகத்திலிருந்து பார்த்து, மனுபுத்திரர் அனைவரையும் பார்க்கிறார்; தாம் வாசமாயிருக்கும் ஸ்தலத்திலிருந்து பூமியில் குடியிருக்கிற எல்லாரையும் கவனிக்கிறார்; அவர் அவர்களுடைய இருதயங்களையெல்லாம் உண்டாக்கி, அவர்களுடைய கிரியைகளையெல்லாம் கவனிக்கிறவர்."
  },
  {
    "id": 344,
    "ref": "Colossians 1:13-14",
    "category": "Love",
    "verseTextEn": "For he has rescued us from the dominion of darkness and brought us into the kingdom of the Son he loves, in whom we have redemption, the forgiveness of sins.",
    "verseTextTa": "அவர் நம்மை இருளின் அதிகாரத்திலிருந்து விடுவித்து, தமக்குப் பிரியமான குமாரனுடைய ராஜ்யத்தில் சேர்த்திருக்கிறார்; அவரில் நமக்கு மீட்பும், பாவ மன்னிப்புமுண்டு."
  },
  {
    "id": 345,
    "ref": "Psalm 29:1-2",
    "category": "Strength",
    "verseTextEn": "Ascribe to the Lord, you heavenly beings, ascribe to the Lord glory and strength. Ascribe to the Lord the glory due his name; worship the Lord in the splendor of his holiness.",
    "verseTextTa": "பரலோகத்திலுள்ள வல்லவர்களே, கர்த்தருக்குக் கீர்த்தியையும் வல்லமையையும் ஒப்புக்கொடுங்கள். அவருடைய நாமத்தின் மகிமையைக் கர்த்தருக்கு ஒப்புக்கொடுத்து, பரிசுத்த அலங்காரத்தோடே கர்த்தரை வணங்குங்கள்."
  },
  {
    "id": 346,
    "ref": "John 5:24",
    "category": "Faith",
    "verseTextEn": "Very truly I tell you, whoever hears my word and believes him who sent me has eternal life and will not be judged but has crossed over from death to life.",
    "verseTextTa": "உண்மையாகவே உண்மையாகவே நான் உங்களுக்குச் சொல்லுகிறேன், என் வசனத்தைக் கேட்டு, என்னை அனுப்பினவரை விசுவாசிக்கிறவன் நித்திய ஜீவனை அடைந்திருக்கிறான்; அவன் ஆக்கினைக்கு வராமல், மரணத்தை விட்டு ஜீவனில் பிரவேசித்திருக்கிறான்."
  },
  {
    "id": 347,
    "ref": "Psalm 146:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Praise the Lord. Praise the Lord, my soul. I will praise the Lord all my life; I will sing praise to my God as long as I live.",
    "verseTextTa": "அல்லேலூயா! என் ஆத்துமாவே, கர்த்தரைத் துதி. நான் உயிரோடிருக்கும்வரைக்கும் கர்த்தரைத் துதிப்பேன்; நான் உள்ளளவும் என் தேவனைக் கீர்த்தனம்பண்ணுவேன்."
  },
  {
    "id": 348,
    "ref": "Psalm 91:1",
    "category": "Strength",
    "verseTextEn": "Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty.",
    "verseTextTa": "உன்னதத்திலே வாசமாயிருக்கிறவனே, சர்வவல்லவனுடைய நிழலிலே தங்கியிருப்பான்."
  },
  {
    "id": 349,
    "ref": "Ephesians 4:26-27",
    "category": "Generosity",
    "verseTextEn": "In your anger do not sin: Do not let the sun go down while you are still angry, and do not give the devil a foothold.",
    "verseTextTa": "கோபித்துக்கொண்டு பாவம் செய்யாதிருங்கள்; சூரியன் அஸ்தமிக்குமுன்னே உங்கள் கோபம் தணியட்டும்; பிசாசுக்கு இடங்கொடாதிருங்கள்."
  },
  {
    "id": 350,
    "ref": "Psalm 40:1",
    "category": "Perseverance",
    "verseTextEn": "I waited patiently for the Lord; he turned to me and heard my cry.",
    "verseTextTa": "நான் கர்த்தருக்குக் காத்திருக்கக் காத்திருந்தேன்; அவர் எனக்குச் செவிசாய்த்து, என் மன்றாட்டைக் கேட்டருளினார்."
  },
  {
    "id": 351,
    "ref": "Matthew 6:31-32",
    "category": "Gospel & Grace",
    "verseTextEn": "So do not worry, saying, 'What shall we eat?' or 'What shall we drink?' or 'What shall we wear?' For the pagans run after all these things, and your heavenly Father knows that you need them.",
    "verseTextTa": "ஆகையால் நாம் என்ன புசிப்போம், என்ன குடிப்போம், என்ன தரிப்போம் என்று கவலைப்படாதீர்கள். இவைகளையெல்லாம் புறஜாதியார் தேடுகிறார்கள்; உங்கள் பரலோகப் பிதா இவைகளெல்லாம் உங்களுக்கு வேண்டுமென்று அறிந்திருக்கிறார்."
  },
  {
    "id": 352,
    "ref": "Psalm 42:5",
    "category": "Hope",
    "verseTextEn": "Why, my soul, are you downcast? Why so disturbed within me? Put your hope in God, for I will yet praise him, my Savior and my God.",
    "verseTextTa": "என் ஆத்துமாவே, நீ ஏன் கலங்குகிறாய்? நீ ஏன் எனக்குள்ளே கலக்கமாயிருக்கிறாய்? நீ தேவனிடத்தில் நம்பிக்கையாயிரு; அவரே என் சமுகத்தின் இரட்சிப்பும் என் தேவனுமாயிருக்கிறபடியால் நான் இன்னும் அவரைத் துதிப்பேன்."
  },
  {
    "id": 353,
    "ref": "Romans 6:22",
    "category": "Salvation & Life",
    "verseTextEn": "But now that you have been set free from sin and have become slaves of God, the benefit you reap leads to holiness, and the result is eternal life.",
    "verseTextTa": "இப்பொழுது நீங்கள் பாவத்திற்கு விடுதலையடைந்து, தேவனுக்கு அடிமைகளானபடியால், உங்களுக்குப் பரிசுத்தமுண்டாகும் பலனும், முடிவில் நித்திய ஜீவனுமுண்டு."
  },
  {
    "id": 354,
    "ref": "Psalm 51:1-2",
    "category": "Love",
    "verseTextEn": "Have mercy on me, O God, according to your unfailing love; according to your great compassion blot out my transgressions. Wash away all my iniquity and cleanse me from my sin.",
    "verseTextTa": "தேவனே, உமது கிருபையின்படி எனக்கு இரங்கும்; உமது மிகுந்த இரக்கங்களின்படி என் மீறுதல்களை அகற்றும். என் அக்கிரமங்களையெல்லாம் கழுவி, என் பாவத்தைச் சுத்திகரியும்."
  },
  {
    "id": 355,
    "ref": "2 Corinthians 4:18",
    "category": "General",
    "verseTextEn": "So we fix our eyes not on what is seen, but on what is unseen, since what is seen is temporary, but what is unseen is eternal.",
    "verseTextTa": "நாம் காண்கிறவைகளைப் பாராமல், காணப்படாதவைகளைப் பார்க்கிறோம்; காண்கிறவைகள் நிலையற்றவைகள், காணப்படாதவைகளோ நிலையுள்ளவைகள்."
  },
  {
    "id": 356,
    "ref": "Psalm 19:7-8",
    "category": "Trust",
    "verseTextEn": "The law of the Lord is perfect, refreshing the soul. The statutes of the Lord are trustworthy, making wise the simple. The precepts of the Lord are right, giving joy to the heart.",
    "verseTextTa": "கர்த்தருடைய நியாயப்பிரமாணம் உத்தமம்; அது ஆத்துமாவைப் புத்துயிர்ப்பிக்கிறது. கர்த்தருடைய சாட்சி உண்மையானது; அது சாதாரணரை ஞானிகளாக்குகிறது. கர்த்தருடைய கட்டளைகள் நேரானவைகள்; அவைகள் இருதயத்தை மகிழ்விக்கின்றன."
  },
  {
    "id": 357,
    "ref": "Romans 4:20-21",
    "category": "Strength",
    "verseTextEn": "Yet he did not waver through unbelief regarding the promise of God, but was strengthened in his faith and gave glory to God, being fully persuaded that God had power to do what he had promised.",
    "verseTextTa": "அவன் தேவனுடைய வாக்குத்தத்தத்தைக்குறித்து அவிசுவாசமாய்ச் சஞ்சலப்படாமல், விசுவாசத்தில் பலப்பட்டு, தேவனுக்கு மகிமை செலுத்தினான். தேவன் தாம் வாக்குத்தத்தம் பண்ணினதை நிறைவேற்ற வல்லவர் என்று முழுவதும் நம்பினான்."
  },
  {
    "id": 358,
    "ref": "Psalm 89:15-16",
    "category": "Blessing",
    "verseTextEn": "Blessed are those who have learned to acclaim you, who walk in the light of your presence, Lord. They rejoice in your name all day long; they celebrate your righteousness.",
    "verseTextTa": "ஆர்ப்பரிக்கும் சத்தத்தை அறிந்த ஜனங்கள் பாக்கியவான்கள்; கர்த்தாவே, அவர்கள் உமது முகத்தின் ஒளியில் நடப்பார்கள். உமது நாமத்தில் நாளெல்லாம் களிகூர்ந்து, உமது நீதியில் உயர்த்தப்படுவார்கள்."
  },
  {
    "id": 359,
    "ref": "John 3:17",
    "category": "Light & Witness",
    "verseTextEn": "For God did not send his Son into the world to condemn the world, but to save the world through him.",
    "verseTextTa": "தேவன் தம்முடைய குமாரனை உலகத்திற்கு ஆக்கினை செய்யும்படி அல்ல, அவராலே உலகம் இரட்சிக்கப்படும்படியே அனுப்பினார்."
  },
  {
    "id": 360,
    "ref": "Psalm 40:16",
    "category": "Prayer",
    "verseTextEn": "But may all who seek you rejoice and be glad in you; may those who long for your saving help always say, 'The Lord is great!'",
    "verseTextTa": "உம்மைத் தேடுகிறவர்களெல்லாரும் உம்மில் களிகூர்ந்து சந்தோஷப்படுவார்களாக; உமது இரட்சிப்பை நேசிக்கிறவர்கள் எப்பொழுதும் கர்த்தர் பெரியவர் என்று சொல்லுவார்களாக."
  },
  {
    "id": 361,
    "ref": "Galatians 5:1",
    "category": "Comfort & Healing",
    "verseTextEn": "It is for freedom that Christ has set us free. Stand firm, then, and do not let yourselves be burdened again by a yoke of slavery.",
    "verseTextTa": "கிறிஸ்து நம்மை விடுதலையாக்கினார்; ஆகையால் நீங்கள் நிலைத்திருந்து, மறுபடியும் அடிமைத்தனத்தின் நுகத்தின் கீழ் அகப்படாதிருங்கள்."
  },
  {
    "id": 362,
    "ref": "Psalm 103:11-12",
    "category": "Love",
    "verseTextEn": "For as high as the heavens are above the earth, so great is his love for those who fear him; as far as the east is from the west, so far has he removed our transgressions from us.",
    "verseTextTa": "பூமிக்கு வானம் உயர்ந்திருக்கிறதுபோல, தமக்குப் பயப்படுகிறவர்களிடத்தில் அவருடைய கிருபை மேன்மையாயிருக்கிறது. கிழக்கு மேற்குக்கு எவ்வளவு தூரமோ, அவ்வளவு தூரமாய் நம்முடைய மீறுதல்களை நம்மைவிட்டு அகற்றியிருக்கிறார்."
  },
  {
    "id": 363,
    "ref": "Hebrews 4:16",
    "category": "Trust",
    "verseTextEn": "Let us then approach God's throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.",
    "verseTextTa": "ஆதலால் நாம் இரக்கத்தை அடைந்து, தேவையான காலத்தில் சகாயம் பெறும் கிருபையைக் காணும்படி, தைரியத்தோடே கிருபையின் சிங்காசனத்தினிடத்தில் அணுகக்கடவோம்."
  },
  {
    "id": 364,
    "ref": "Psalm 118:8-9",
    "category": "Trust",
    "verseTextEn": "It is better to take refuge in the Lord than to trust in humans. It is better to take refuge in the Lord than to trust in princes.",
    "verseTextTa": "மனுஷனை நம்புகிறதைப்பார்க்கிலும் கர்த்தரிடத்தில் அடைக்கலமாயிருப்பது நல்லது. பிரபுக்களை நம்புகிறதைப்பார்க்கிலும் கர்த்தரிடத்தில் அடைக்கலமாயிருப்பது நல்லது."
  },
  {
    "id": 365,
    "ref": "Romans 15:4",
    "category": "Courage",
    "verseTextEn": "For everything that was written in the past was written to teach us, so that through the endurance taught in the Scriptures and the encouragement they provide we might have hope.",
    "verseTextTa": "முன்பு எழுதப்பட்டவைகள் எல்லாம் நமக்குப் போதிக்கும்படி எழுதப்பட்டிருக்கிறன; அவைகளால் நாம் பொறுமையும், வேதவாக்கியங்களால் தேற்றுதலும் அடைந்து, நம்பிக்கையுள்ளவர்களாயிருக்கலாம்."
  },
  {
    "id": 366,
    "ref": "Psalm 34:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "I will extol the Lord at all times; his praise will always be on my lips. I will glory in the Lord; let the afflicted hear and rejoice.",
    "verseTextTa": "எக்காலத்திலும் கர்த்தரை ஸ்தோத்திரிப்பேன்; அவருடைய துதி எப்பொழுதும் என் வாயிலிருக்கும். என் ஆத்துமா கர்த்தரில் மேன்மைபாராட்டும்; சிறுமையுள்ளவர்கள் அதைக் கேட்டு மகிழ்வார்கள்."
  },
  {
    "id": 367,
    "ref": "1 Corinthians 2:9",
    "category": "Love",
    "verseTextEn": "However, as it is written: What no eye has seen, what no ear has heard, and what no human mind has conceived—the things God has prepared for those who love him.",
    "verseTextTa": "எழுதியிருக்கிறபடியே: கண் காணாதவைகளும், காது கேளாதவைகளும், மனுஷனுடைய இருதயத்தில் உதிக்காதவைகளுமானவைகளை தேவன் தம்மில் அன்புகூருகிறவர்களுக்கு ஆயத்தம்பண்ணியிருக்கிறார்."
  },
  {
    "id": 368,
    "ref": "Psalm 119:1-2",
    "category": "Prayer",
    "verseTextEn": "Blessed are those whose ways are blameless, who walk according to the law of the Lord. Blessed are those who keep his statutes and seek him with all their heart.",
    "verseTextTa": "வழியில் உத்தமர்களும், கர்த்தருடைய நியாயப்பிரமாணத்தில் நடக்கிறவர்களும் பாக்கியவான்கள். அவருடைய சாட்சிகளைக் கைக்கொண்டு, முழு இருதயத்தோடும் அவரைத் தேடுகிறவர்கள் பாக்கியவான்கள்."
  },
  {
    "id": 369,
    "ref": "Philippians 2:13",
    "category": "Faith & Life",
    "verseTextEn": "For it is God who works in you to will and to act in order to fulfill his good purpose.",
    "verseTextTa": "தமது நன்மை நோக்கத்தின்படி நீங்கள் சித்தங்கொள்ளவும் கிரியை செய்யவும், உங்களில் கிரியை செய்கிறவர் தேவனே."
  },
  {
    "id": 370,
    "ref": "Psalm 32:8",
    "category": "Comfort & Refuge",
    "verseTextEn": "I will instruct you and teach you in the way you should go; I will counsel you with my loving eye on you.",
    "verseTextTa": "நான் உனக்கு ஞானத்தைப் போதித்து, நீ நடக்கவேண்டிய வழியில் உனக்குப் போதகம் செய்வேன்; உன்மேல் என் கண்ணை வைத்து உனக்கு ஆலோசனை சொல்லுவேன்."
  },
  {
    "id": 371,
    "ref": "Ephesians 4:29",
    "category": "Faith & Life",
    "verseTextEn": "Do not let any unwholesome talk come out of your mouths, but only what is helpful for building others up according to their needs, that it may benefit those who listen.",
    "verseTextTa": "உங்கள் வாயிலிருந்து கேடான வார்த்தை ஒன்றும் புறப்படாதிருப்பதாக; வேண்டுமானால், கேட்கிறவர்களுக்கு ஆதாயத்தை உண்டாக்கும்படி, உபயோகத்திற்குத் தக்கதும் கிருபையுள்ளதுமான வார்த்தையையே சொல்லுங்கள்."
  },
  {
    "id": 372,
    "ref": "Psalm 148:1-2",
    "category": "Praise & Worship",
    "verseTextEn": "Praise the Lord. Praise the Lord from the heavens; praise him in the heights above. Praise him, all his angels; praise him, all his heavenly hosts.",
    "verseTextTa": "அல்லேலூயா! பரலோகத்திலிருந்து கர்த்தரைத் துதியுங்கள்; உன்னதத்திலே அவரைத் துதியுங்கள். அவருடைய தூதர்களே, அவரைத் துதியுங்கள்; அவருடைய சர்வ சேனைகளே, அவரைத் துதியுங்கள்."
  },
  {
    "id": 373,
    "ref": "John 10:27-28",
    "category": "Salvation & Life",
    "verseTextEn": "My sheep listen to my voice; I know them, and they follow me. I give them eternal life, and they shall never perish; no one will snatch them out of my hand.",
    "verseTextTa": "என் ஆடுகள் என் சத்தத்தைக் கேட்கும்; நான் அவைகளை அறிவேன், அவைகள் என்னைப் பின்பற்றும். நான் அவைகளுக்கு நித்திய ஜீவனைக் கொடுக்கிறேன்; அவைகள் ஒருபோதும் கெட்டுப்போகமாட்டாது; ஒருவனும் அவைகளை என் கைக்கு விலக்கிப்பிடித்துக்கொள்ளமாட்டான்."
  },
  {
    "id": 374,
    "ref": "Psalm 107:1-2",
    "category": "Love",
    "verseTextEn": "Give thanks to the Lord, for he is good; his love endures forever. Let the redeemed of the Lord tell their story—those he redeemed from the hand of the foe.",
    "verseTextTa": "கர்த்தருக்கு ஸ்தோத்திரம் செய்யுங்கள்; அவர் நல்லவர்; அவருடைய கிருபை என்றென்றைக்கும் உண்டு. கர்த்தரால் மீட்கப்பட்டவர்கள் தம்முடைய சத்துருவின் கையிலிருந்து அவர் மீட்டவர்கள் இப்படிச் சொல்லக்கடவர்கள்."
  },
  {
    "id": 375,
    "ref": "Hebrews 6:19",
    "category": "Hope",
    "verseTextEn": "We have this hope as an anchor for the soul, firm and secure. It enters the inner sanctuary behind the curtain.",
    "verseTextTa": "நாம் வைத்திருக்கும் நம்பிக்கையோ ஆத்துமாவுக்குப் பாதுகாப்பும் உறுதியுமான நங்கூரமாயிருக்கிறது; அது திரைச்சீலையினுள்ளே, உள்ளான பரிசுத்த ஸ்தலத்தில் பிரவேசிக்கிறது."
  },
  {
    "id": 376,
    "ref": "Psalm 4:8",
    "category": "Peace",
    "verseTextEn": "In peace I will lie down and sleep, for you alone, Lord, make me dwell in safety.",
    "verseTextTa": "நான் சமாதானத்தோடே படுத்துத் தூங்குவேன்; கர்த்தாவே, நீர் ஒருவர் மாத்திரம் என்னை நிர்ப்பயமாய் வாசம்பண்ணப்பண்ணுகிறீர்."
  },
  {
    "id": 377,
    "ref": "2 Corinthians 12:9",
    "category": "Grace & Forgiveness",
    "verseTextEn": "But he said to me, 'My grace is sufficient for you, for my power is made perfect in weakness.' Therefore I will boast all the more gladly about my weaknesses, so that Christ's power may rest on me.",
    "verseTextTa": "அவர் என்னை நோக்கி: என் கிருபை உனக்குப் போதும்; பலவீனத்திலே என் பெலன் பூரணமாய் விளங்கும் என்றார். ஆகையால் கிறிஸ்துவின் பெலன் என்மேல் தங்கும்படிக்கு, நான் மிகுந்த சந்தோஷத்தோடே என் பலவீனங்களைக்குறித்து மேன்மைபாராட்டுவேன்."
  },
  {
    "id": 378,
    "ref": "Psalm 130:5-6",
    "category": "Hope",
    "verseTextEn": "I wait for the Lord, my whole being waits, and in his word I put my hope. I wait for the Lord more than watchmen wait for the morning, more than watchmen wait for the morning.",
    "verseTextTa": "நான் கர்த்தருக்குக் காத்திருக்கிறேன்; என் ஆத்துமா காத்திருக்கிறது; அவருடைய வசனத்தில் நான் நம்பிக்கையாயிருக்கிறேன். காலைக்காகக் காத்திருக்கிற காவற்காரரிலும் அதிகமாய் என் ஆத்துமா கர்த்தருக்காகக் காத்திருக்கிறது."
  },
  {
    "id": 379,
    "ref": "Philippians 1:6",
    "category": "Faith & Life",
    "verseTextEn": "Being confident of this, that he who began a good work in you will carry it on to completion until the day of Christ Jesus.",
    "verseTextTa": "இயேசு கிறிஸ்துவினுடைய நாள்வரைக்கும், உங்களில் நற்கிரியையைத் துவக்கினவர் அதைப் பூரணப்படுத்துவார் என்று நிச்சயமாய் அறிந்திருக்கிறேன்."
  },
  {
    "id": 380,
    "ref": "Psalm 34:1",
    "category": "Praise & Worship",
    "verseTextEn": "I will extol the Lord at all times; his praise will always be on my lips.",
    "verseTextTa": "எக்காலத்திலும் கர்த்தரை ஸ்தோத்திரிப்பேன்; அவருடைய துதி எப்பொழுதும் என் வாயிலிருக்கும்."
  },
  {
    "id": 381,
    "ref": "1 Corinthians 12:4-6",
    "category": "General",
    "verseTextEn": "There are different kinds of gifts, but the same Spirit distributes them. There are different kinds of service, but the same Lord. There are different kinds of working, but in all of them and in everyone it is the same God at work.",
    "verseTextTa": "வரங்களில் வகைவேறுபாடுகளுண்டு, ஆனாலும் ஆவி ஒன்றே. ஊழியங்களில் வகைவேறுபாடுகளுண்டு, ஆனாலும் கர்த்தர் ஒன்றே. கிரியைகளில் வகைவேறுபாடுகளுண்டு, ஆனாலும் எல்லாருக்குள்ளும் சகலத்தையும் கிரியை செய்கிற தேவன் ஒருவரே."
  },
  {
    "id": 382,
    "ref": "Psalm 119:25-26",
    "category": "Comfort & Refuge",
    "verseTextEn": "I am laid low in the dust; preserve my life according to your word. I gave an account of my ways and you answered me; teach me your decrees.",
    "verseTextTa": "என் ஆத்துமா மண்ணோடு ஒட்டிக்கொண்டிருக்கிறது; உமது வசனத்தின்படியே என்னை உயிர்ப்பியும். என் வழிகளை அறிவித்தேன்; நீர் எனக்கு உத்தரவு அருளினீர்; உமது கட்டளைகளை எனக்குப் போதியும்."
  },
  {
    "id": 383,
    "ref": "James 1:2-3",
    "category": "Faith",
    "verseTextEn": "Consider it pure joy, my brothers and sisters, whenever you face trials of many kinds, because you know that the testing of your faith produces perseverance.",
    "verseTextTa": "என் சகோதரரே, நீங்கள் பலவிதமான சோதனைகளில் அகப்பட்டிருக்கும்போது, அதை மகா சந்தோஷமாக எண்ணுங்கள். உங்கள் விசுவாசத்தின் பரீட்சையானது பொறுமையை உண்டாக்கும் என்று அறிந்திருக்கிறீர்கள்."
  },
  {
    "id": 384,
    "ref": "Psalm 11:7",
    "category": "Love",
    "verseTextEn": "For the Lord is righteous, he loves justice; the upright will see his face.",
    "verseTextTa": "கர்த்தர் நீதிமான், நீதியின்மேல் அன்புகூருகிறார்; உத்தமர் அவருடைய முகத்தைக் காண்பார்கள்."
  },
  {
    "id": 385,
    "ref": "Romans 8:32",
    "category": "Generosity",
    "verseTextEn": "He who did not spare his own Son, but gave him up for us all—how will he not also, along with him, graciously give us all things?",
    "verseTextTa": "தம்முடைய சொந்த குமாரனையும் தவிராது, நாம் எல்லாருக்காகவும் அவரை ஒப்புக்கொடுத்தவர், அவரோடேகூட எல்லாவற்றையும் நமக்கு இலவசமாகக் கொடுக்கமாட்டாரோ?"
  },
  {
    "id": 386,
    "ref": "Psalm 91:5-6",
    "category": "Comfort & Refuge",
    "verseTextEn": "You will not fear the terror of night, nor the arrow that flies by day, nor the pestilence that stalks in the darkness, nor the plague that destroys at midday.",
    "verseTextTa": "இரவுச் சமயத்தின் பயத்திற்கும், பகலில் பறக்கும் அம்பிற்கும், இருளில் நடமாடும் கொள்ளைநோய்க்கும், பகலில் அழிக்கும் வாதையினாலும் நீ பயப்படாதிருப்பாய்."
  },
  {
    "id": 387,
    "ref": "Colossians 3:12",
    "category": "Love",
    "verseTextEn": "Therefore, as God's chosen people, holy and dearly loved, clothe yourselves with compassion, kindness, humility, gentleness and patience.",
    "verseTextTa": "ஆகையால், தேவனுடைய தெரிந்துகொள்ளப்பட்டவர்களும், பரிசுத்தவான்களும், பிரியமானவர்களுமான நீங்கள், மனவுருக்கம், தயவு, தாழ்மை, சாந்தம், பொறுமை இவைகளைத் தரித்துக்கொள்ளுங்கள்."
  },
  {
    "id": 388,
    "ref": "Psalm 50:1-2",
    "category": "Strength",
    "verseTextEn": "The Mighty One, God, the Lord, speaks and summons the earth from the rising of the sun to where it sets. From Zion, perfect in beauty, God shines forth.",
    "verseTextTa": "தேவாதிதேவனாகிய கர்த்தர் கீழ்திசைமுதல் மேற்றிசைவரைக்கும் பூமிக்குக் கூப்பிட்டு விரித்தார். சீயோனிலே சௌந்தரியபூரணனான தேவன் பிரகாசித்தார்."
  },
  {
    "id": 389,
    "ref": "Galatians 5:22-23",
    "category": "Love",
    "verseTextEn": "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law.",
    "verseTextTa": "ஆவியின் கனியோ அன்பு, சந்தோஷம், சமாதானம், நீடிய பொறுமை, தயவு, நற்குணம், விசுவாசம், சாந்தம், இந்திரிய அடக்கம். இப்படிப்பட்டவைகளுக்கு விரோதமான நியாயப்பிரமாணம் ஒன்றுமில்லை."
  },
  {
    "id": 390,
    "ref": "Psalm 95:6-7",
    "category": "Praise & Worship",
    "verseTextEn": "Come, let us bow down in worship, let us kneel before the Lord our Maker; for he is our God and we are the people of his pasture, the flock under his care.",
    "verseTextTa": "வாருங்கள், நாம் பணிந்து வணங்கி, நம்மை உண்டாக்கின கர்த்தருக்கு முன்பாக முழங்கால்படியுவோம். அவரே நம்முடைய தேவன்; நாம் அவரின் மேய்ச்சலின் ஜனங்களும், அவர் கைக்கு ஆடுகளுமாயிருக்கிறோம்."
  },
  {
    "id": 391,
    "ref": "Ephesians 5:8-9",
    "category": "Light & Witness",
    "verseTextEn": "For you were once darkness, but now you are light in the Lord. Live as children of light (for the fruit of the light consists in all goodness, righteousness and truth).",
    "verseTextTa": "நீங்கள் முன்னே இருளாயிருந்தீர்கள்; இப்பொழுதோ கர்த்தருக்குள் வெளிச்சமாயிருக்கிறீர்கள்; வெளிச்சத்தின் பிள்ளைகளாக நடந்துகொள்ளுங்கள்; வெளிச்சத்தின் கனியோ சகல நற்குணத்திலும், நீதியிலும், சத்தியத்திலும் இருக்கிறது."
  },
  {
    "id": 392,
    "ref": "Psalm 139:13-14",
    "category": "Praise & Worship",
    "verseTextEn": "For you created my inmost being; you knit me together in my mother's womb. I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.",
    "verseTextTa": "என் உள்ளுக்குள்ளே இருக்கிறதை நீர் உண்டாக்கினீர்; என் தாயின் வயிற்றில் என்னைப் பின்னினீர். நான் பயங்கரமும் அதிசயமுமான விதத்தில் உண்டாக்கப்பட்டபடியால், உம்மைத் துதிக்கிறேன்; உம்முடைய கிரியைகள் அதிசயமானவைகள்; என் ஆத்துமா அதை நன்றாய் அறியும்."
  },
  {
    "id": 393,
    "ref": "Hebrews 11:6",
    "category": "Faith",
    "verseTextEn": "And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.",
    "verseTextTa": "விசுவாசமில்லாமல் தேவனுக்குப் பிரியமாயிருப்பது கூடாத காரியம்; அவரிடத்தில் வருபவன் தேவன் உண்டென்றும், அவர் தம்மைத் தேடுகிறவர்களுக்குப் பலன் கொடுக்கிறவரென்றும் விசுவாசிக்கவேண்டும்."
  },
  {
    "id": 394,
    "ref": "Psalm 100:4-5",
    "category": "Love",
    "verseTextEn": "Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name. For the Lord is good and his love endures forever; his faithfulness continues through all generations.",
    "verseTextTa": "ஸ்தோத்திரத்தோடே அவருடைய வாசல்களிலும், துதியோடே அவருடைய பிராகாரங்களிலும் பிரவேசியுங்கள்; அவருக்கு ஸ்தோத்திரம் பண்ணி, அவருடைய நாமத்தைத் துதியுங்கள். கர்த்தர் நல்லவர், அவருடைய கிருபை என்றென்றைக்கும் உண்டு; அவருடைய சத்தியம் தலைமுறை தலைமுறையாய் நிலைத்திருக்கிறது."
  },
  {
    "id": 395,
    "ref": "Romans 13:10",
    "category": "Love",
    "verseTextEn": "Love does no harm to a neighbor. Therefore love is the fulfillment of the law.",
    "verseTextTa": "அன்பானது பக்கத்தானுக்குத் தீமை செய்யாது; ஆகையால் அன்பே நியாயப்பிரமாணத்தின் பூரணம்."
  },
  {
    "id": 396,
    "ref": "Psalm 81:1-2",
    "category": "Strength",
    "verseTextEn": "Sing for joy to God our strength; shout aloud to the God of Jacob! Begin the music, strike the timbrel, play the melodious harp and lyre.",
    "verseTextTa": "நம்முடைய பெலனாகிய தேவனை நோக்கிக் கெம்பீரித்துப் பாடுங்கள்; யாக்கோபின் தேவனை நோக்கி ஆர்ப்பரியுங்கள். கீதத்தை ஆரம்பித்து, தம்புராவை மிடறி, சங்கீத மண்டையத்தையும் வீணையையும் கொண்டு கீதம்பண்ணுங்கள்."
  },
  {
    "id": 397,
    "ref": "2 Timothy 3:16-17",
    "category": "General",
    "verseTextEn": "All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness, so that the servant of God may be thoroughly equipped for every good work.",
    "verseTextTa": "வேதம் முழுவதும் தேவ ஆவியினால் அருளப்பட்டது; உபதேசத்திற்கும் கண்டனத்திற்கும் திருத்தத்திற்கும் நீதியிலே பயிற்சிகொடுப்பதற்கும் பிரயோஜனமுள்ளது. அதனால் தேவனுடைய மனுஷன் பூரணனும், எல்லா நற்கிரியைகளுக்கும் தயாராயிருக்கிறவனுமாகியிருப்பான்."
  },
  {
    "id": 398,
    "ref": "Psalm 112:6-7",
    "category": "Trust",
    "verseTextEn": "Surely the righteous will never be shaken; they will be remembered forever. They will have no fear of bad news; their hearts are steadfast, trusting in the Lord.",
    "verseTextTa": "நீதிமான் ஒருபோதும் அசையான்; அவன் என்றென்றைக்கும் நினைவிலிருக்கிறான். அவன் பொல்லாத செய்திக்குப் பயப்படான்; கர்த்தரில் நம்பிக்கையாயிருந்தபடியால், அவன் இருதயம் திடமும் நிச்சயமுமாயிருக்கிறது."
  },
  {
    "id": 399,
    "ref": "Romans 8:37",
    "category": "Love",
    "verseTextEn": "No, in all these things we are more than conquerors through him who loved us.",
    "verseTextTa": "இவைகளெல்லாவற்றிலும் நம்மிடத்தில் அன்புகூர்ந்தவராலே நாம் மிகுந்த ஜெயமடைகிறோம்."
  },
  {
    "id": 400,
    "ref": "Psalm 150:6",
    "category": "Praise & Worship",
    "verseTextEn": "Let everything that has breath praise the Lord. Praise the Lord.",
    "verseTextTa": "சுவாசமுள்ள யாவும் கர்த்தரைத் துதிப்பதாக. அல்லேலூயா!"
  }
];

module.exports = DEFAULT_VERSES;
