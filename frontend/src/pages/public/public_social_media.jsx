import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiInstagram, FiYoutube, FiFacebook, FiExternalLink, FiCheckCircle, FiShare2 } from 'react-icons/fi';
import { FaWhatsapp, FaBullhorn } from 'react-icons/fa';
import PageHero from '../../components/common/common_page_hero';
import churchLogo from '../../assets/church_extirior.png';
import sjdbProfilePic from '../../assets/sjdb_image_round_2.png';
import { getWhatsAppNumber, getWhatsAppChannelUrl } from '../../config/contactConfig';

export default function SocialMedia() {
  const { t, i18n } = useTranslation();
  const isTamil = i18n.language === 'ta';

  const whatsappRaw = getWhatsAppNumber() || '919655639144';
  const whatsappUrl = `https://wa.me/${whatsappRaw}`;
  const whatsappChannelUrl = getWhatsAppChannelUrl() || 'https://whatsapp.com/channel/0029VbE3th71iUxSmSsBYg3D';

  const primaryCards = [
    {
      id: 'instagram',
      platform: 'Instagram',
      handle: '@sjdb_church',
      officialLabel: isTamil ? 'அதிகாரப்பூர்வ பக்கம்' : 'Official Page',
      url: 'https://www.instagram.com/sjdb_church?stkn=MW82ZXpsbW4xMTRyeQ==',
      icon: FiInstagram,
      avatar: sjdbProfilePic,
      avatarAlt: 'St. John De Britto Church Instagram Profile Picture',
      description: isTamil
        ? 'தினசரி ஆன்மீக சிந்தனைகள், பெருவிழா கொண்டாட்டங்கள், புகைப்படங்கள், ரீல்ஸ் மற்றும் பங்கு நிகழ்வுகளுக்கு எங்களை பின்தொடருங்கள்.'
        : 'Follow our official Instagram for daily spiritual reflections, holy feast celebrations, reels, event photos, and community activities.',
      buttonText: isTamil ? 'இன்ஸ்டாகிராமில் பார்க்க' : 'Visit Instagram',
      accentGradient: 'from-amber-500 via-pink-500 to-purple-600',
      btnGradient: 'from-amber-500 via-pink-600 to-purple-600 hover:from-amber-600 hover:via-pink-700 hover:to-purple-700',
      iconColor: 'text-pink-600',
      badgeBg: 'bg-pink-50 text-pink-700 border-pink-200'
    },
    {
      id: 'youtube',
      platform: 'YouTube',
      handle: '@sjdbchurch',
      officialLabel: isTamil ? 'அதிகாரப்பூர்வ அலைவரிசை' : 'Official Channel',
      url: 'https://www.youtube.com/@yourchannelhandle',
      icon: FiYoutube,
      avatar: churchLogo,
      avatarAlt: 'St. John De Britto Church YouTube Channel Profile Picture',
      description: isTamil
        ? 'ஞாயிறு திருப்பலி, அருளுரைகள், பாடல்கள், திருவிழா நவநாட்கள் மற்றும் பக்தி நிகழ்வுகளுக்கு எமது அலைவரிசையை சப்ஸ்கிரைப் செய்யுங்கள்.'
        : 'Subscribe to our YouTube channel for Sunday Holy Mass broadcasts, choir hymns, homilies, and special feast novenas.',
      buttonText: isTamil ? 'யூடியூபில் பார்க்க' : 'Visit YouTube',
      accentGradient: 'from-red-600 to-rose-700',
      btnGradient: 'from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800',
      iconColor: 'text-red-600',
      badgeBg: 'bg-red-50 text-red-700 border-red-200'
    },
    {
      id: 'facebook',
      platform: 'Facebook',
      handle: '@sjdbchurch',
      officialLabel: isTamil ? 'அதிகாரப்பூர்வ பக்கம்' : 'Official Page',
      url: 'https://www.facebook.com/YourPageName',
      icon: FiFacebook,
      avatar: churchLogo,
      avatarAlt: 'St. John De Britto Church Facebook Profile Picture',
      description: isTamil
        ? 'பங்கு அறிவிப்புகள், திருவிழா புகைப்பட ஆல்பங்கள், சமூக நிகழ்வுகள் மற்றும் உடனடி தகவல்களுக்காக எமது பேஸ்புக் பக்கத்தை பின்தொடருங்கள்.'
        : 'Connect with our parish Facebook community for pastoral announcements, parish feasts, parish photo albums, and community updates.',
      buttonText: isTamil ? 'பேஸ்புக்கில் பார்க்க' : 'Visit Facebook',
      accentGradient: 'from-blue-600 to-indigo-700',
      btnGradient: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
      iconColor: 'text-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200'
    }
  ];

  const communityCards = [
    {
      id: 'whatsapp-community',
      platform: 'WhatsApp',
      handle: '+91 96556 39144',
      officialLabel: isTamil ? 'பங்கு உதவி & சாட்பாட்' : 'Parish Communication',
      url: whatsappUrl,
      icon: FaWhatsapp,
      avatar: sjdbProfilePic,
      avatarAlt: 'St. John De Britto Church WhatsApp Contact Picture',
      description: isTamil
        ? 'திருப்பலி பதிவு, சான்றிதழ் விவரங்கள், பங்கு அலுவலக தொடர்பு மற்றும் உடனடி வழிகாட்டலுக்கு வாட்ஸ்அப்பில் இணையுங்கள்.'
        : 'Connect directly with our parish desk on WhatsApp for Mass intention bookings, certificate inquiries, and pastoral support.',
      buttonText: isTamil ? 'வாட்ஸ்அப்பில் தொடர்பு கொள்ள' : 'Connect on WhatsApp',
      accentGradient: 'from-emerald-500 to-green-600',
      btnGradient: 'from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800',
      iconColor: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      id: 'whatsapp-channel',
      platform: 'WhatsApp Channel',
      handle: 'St. John De Britto Announcements',
      officialLabel: isTamil ? 'அறிவிப்பு சேனல்' : 'Broadcast Channel',
      url: whatsappChannelUrl,
      icon: FaBullhorn,
      avatar: churchLogo,
      avatarAlt: 'St. John De Britto Church WhatsApp Channel Picture',
      description: isTamil
        ? 'ஆலயத்தின் முக்கிய அறிவிப்புகள், திருப்பலி நேரங்கள், மறைமாவட்ட சுற்றறிக்கைகள் மற்றும் விழா நிரல்களை உடனுக்குடன் பெற இந்த சேனலில் இணையுங்கள்.'
        : 'Follow our official broadcast channel for instant church announcements, liturgical schedules, feast bulletins, and parish notices.',
      buttonText: isTamil ? 'சேனலில் இணைய' : 'Follow WhatsApp Channel',
      accentGradient: 'from-teal-600 to-emerald-700',
      btnGradient: 'from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800',
      iconColor: 'text-teal-600',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-200'
    }
  ];

  const renderCard = (item, index) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="group relative bg-white rounded-2xl shadow-card border border-gray-100/90 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden"
    >
      {/* Subtle branded top accent */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${item.accentGradient}`} />

      <div className="p-6 sm:p-7 flex flex-col flex-1">
        {/* Header: Platform Icon & Official Badge */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:scale-110 transition-transform duration-300">
              <item.icon className={`text-2xl ${item.iconColor}`} />
            </div>
            <div>
              <h2 className="font-display font-bold text-gray-900 text-lg leading-tight">
                {item.platform}
              </h2>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${item.badgeBg}`}>
            <FiCheckCircle className="text-xs" />
            <span>{item.officialLabel}</span>
          </span>
        </div>

        {/* Profile Picture & Account Details */}
        <div className="flex items-center gap-4 mb-4">
          <div className={`relative shrink-0 w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden p-0.5 bg-gradient-to-tr ${item.accentGradient} shadow-md`}>
            <img
              src={item.avatar}
              alt={item.avatarAlt}
              className="w-full h-full object-cover rounded-full bg-white group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-base sm:text-lg truncate group-hover:text-church-royal-blue transition-colors">
              {item.handle}
            </p>
            <p className="text-xs text-church-gold font-medium mt-0.5 font-tamil">
              {isTamil ? 'புனித அருளானந்தர் தேவாலயம்' : 'St. John De Britto Church'}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
          {item.description}
        </p>

        {/* Action Button */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.buttonText} - ${item.platform} (${item.handle})`}
          className={`w-full py-3 px-5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 shadow-md transition-all duration-200 bg-gradient-to-r ${item.btnGradient} hover:shadow-lg active:scale-[0.99]`}
        >
          <item.icon className="text-base" />
          <span>{item.buttonText}</span>
          <FiExternalLink className="text-sm opacity-80" />
        </a>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen pt-10 bg-church-cream">
      {/* Hero Section */}
      <PageHero
        title={isTamil ? "சமூக ஊடகங்கள்" : "SOCIAL MEDIA"}
        subtitle={isTamil ? "புனித அருளானந்தர் தேவாலயத்துடன் இணைந்திருங்கள்" : "Stay connected with St. John De Britto Church"}
        description={
          isTamil
            ? "எமது அதிகாரப்பூர்வ சமூக ஊடக தளங்கள் வழியே இறைவார்த்தை, திருப்பலி நிகழ்வுகள் மற்றும் பங்கு செய்திகளை உடனுக்குடன் பெற்றிடுங்கள்."
            : "Join our official church channels for spiritual reflections, parish announcements, celebrations, and direct pastoral communication."
        }
      />

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Instagram, YouTube, Facebook (3 per row on Desktop, 2 on Tablet, 1 on Mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
            {primaryCards.map((item, index) => renderCard(item, index))}
          </div>

          {/* Bottom Row: WhatsApp & WhatsApp Channel (2 centered on Desktop & Tablet, 1 on Mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {communityCards.map((item, index) => renderCard(item, index + primaryCards.length))}
          </div>

          {/* Parish Digital Community Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 sm:p-10 text-center max-w-4xl mx-auto border border-gold-400/20 shadow-lg mt-14 bg-white/85"
          >
            <div className="w-12 h-12 rounded-full bg-church-royal-blue/10 text-church-royal-blue flex items-center justify-center mx-auto mb-4 border border-church-royal-blue/20">
              <FiShare2 className="text-2xl text-church-royal-blue" />
            </div>
            <h2 className="section-title mb-3 text-2xl sm:text-3xl">
              {isTamil ? 'பங்கு குடும்பத்துடன் இணைந்திருங்கள்' : 'Stay in Touch with Parish Life'}
            </h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              {isTamil
                ? 'புனித அருளானந்தர் ஆலயத்தின் தினசரி நிகழ்வுகள், திருப்பலி நேரங்கள் மற்றும் ஆன்மீக செய்திகளை எமது அதிகாரப்பூர்வ சமூக வலைதள பக்கங்கள் மூலம் உடனடியாக தெரிந்து கொள்ளுங்கள்.'
                : 'Follow our official digital channels to receive parish news, spiritual reflections, festival celebrations, and liturgical updates wherever you are.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.instagram.com/sjdb_church?stkn=MW82ZXpsbW4xMTRyeQ=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @sjdb_church"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white text-xs sm:text-sm font-semibold hover:opacity-95 transition-all shadow-sm hover:scale-105"
              >
                <FiInstagram className="text-base" />
                <span>Instagram</span>
              </a>
              <a
                href="https://www.youtube.com/@yourchannelhandle"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube @sjdbchurch"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition-all shadow-sm hover:scale-105"
              >
                <FiYoutube className="text-base" />
                <span>YouTube</span>
              </a>
              <a
                href="https://www.facebook.com/YourPageName"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook @sjdbchurch"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:scale-105"
              >
                <FiFacebook className="text-base" />
                <span>Facebook</span>
              </a>
              <a
                href={whatsappChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp Channel"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs sm:text-sm font-semibold hover:bg-teal-700 transition-all shadow-sm hover:scale-105"
              >
                <FaBullhorn className="text-sm" />
                <span>WhatsApp Channel</span>
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Parish WhatsApp"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm hover:scale-105"
              >
                <FaWhatsapp className="text-base" />
                <span>WhatsApp</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
