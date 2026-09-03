import churchLogo from '../../assets/church_extirior.png';
import api from '../../services/api';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock, FiSend, FiHelpCircle, FiArrowRight } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { GiChurch } from 'react-icons/gi';
import PageHero from '../../components/common/common_page_hero';

export default function Contact() {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const [whatsappNumber, setWhatsappNumber] = useState('919655639144');

  useEffect(() => {
    api.get('/settings')
      .then(res => {
        const num = res.data?.settings?.whatsappBotPhoneNumber || res.data?.settings?.whatsapp_bot_phone_number;
        if (num) {
          setWhatsappNumber(String(num).replace(/\D/g, ''));
        }
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (data) => {
    try {
      await api.post('/tickets', {
        subject: data.subject,
        message: data.message,
        category: 'enquiry',
        priority: 'medium'
      });
      toast.success('Message sent! We will get back to you soon.');
      reset();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send message');
    }
  };

  return (
    <div className="min-h-screen pt-10 bg-church-cream ">
      <PageHero title={<>{t('nav.contact')}</>} subtitle={<>{t('home.getInTouch')}</>} />

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Info */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="section-title mb-8">Church Information</h2>
              <div className="space-y-5 mb-8">
                {[
                  { icon: <FiMapPin />, title: 'Address', content: 'RJWM+XQ4, Murthi Nagar, Kalayarkoil, Tamil Nadu 630551, India' },
                  { icon: <FiPhone />, title: 'Phone', content: '+91 04577 XXXXXX', link: 'tel:+9104577' },
                  { icon: <FiMail />, title: 'Email', content: 'sjdbchurch@gmail.com', link: 'mailto:sjdbchurch@gmail.com' },
                  { icon: <FiClock />, title: 'Office Hours', content: 'Monday – Saturday: 9:00 AM – 5:00 PM\nClosed on Sundays and public holidays' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-church-gradient flex items-center justify-center flex-shrink-0 shadow-gold">
                      <span className="text-white">{item.icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{item.title}</p>
                      {item.link ? (
                        <a href={item.link} className="text-church-gold hover:underline text-sm">{item.content}</a>
                      ) : (
                        <p className="text-gray-500 text-sm whitespace-pre-line">{item.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* FAQ Quick Link Banner */}
              <Link
                to="/faq"
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50/90 border border-amber-300/80 p-4 sm:p-5 rounded-2xl hover:bg-amber-100/90 transition-all shadow-xs mb-5 group"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-church-gold text-white flex items-center justify-center text-xl shadow-gold flex-shrink-0 mt-0.5 sm:mt-0">
                    <FiHelpCircle />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-amber-950 text-sm leading-snug">{t('contact.faqTitle', 'Have a Quick Question?')}</h4>
                    <p className="text-xs text-amber-800 leading-relaxed mt-0.5">{t('contact.faqDesc', 'Check our Frequently Asked Questions (FAQ) for instant answers.')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-church-gold group-hover:translate-x-1 transition-transform flex items-center gap-1 shrink-0 self-end sm:self-auto pt-1 sm:pt-0">
                  {t('common.viewFaqs', 'View FAQs')} <FiArrowRight />
                </span>
              </Link>

              {/* WhatsApp & SJDB Connect Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello St. John de Britto's Church")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-green-600 text-white px-4 py-3.5 rounded-2xl transition-all shadow-lg font-bold text-xs sm:text-sm text-center"
                >
                  <FaWhatsapp className="text-xl flex-shrink-0" /> <span className="truncate">{t('contact.chatWhatsapp', 'Chat with us on WhatsApp')}</span>
                </a>

                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 bg-church-royal-blue hover:bg-blue-900 text-white border-2 border-church-gold px-4 py-3.5 rounded-2xl transition-all shadow-lg font-bold text-xs sm:text-sm text-center"
                >
                  <GiChurch className="text-xl text-church-gold flex-shrink-0" /> <span className="truncate">{t('contact.chatSjdbConnect', 'Chat with SJDB Connect')}</span>
                </a>
              </div>

              {/* Google Maps */}
              <div className="rounded-2xl overflow-hidden shadow-card border border-gray-100 ">
                <iframe
                  title="St. John de Britto's Church Location"
                  width="100%" height="320"
                  style={{ border: 0 }}
                  loading="lazy"
                  src="https://maps.google.com/maps?q=St.+John+de+Britto+Church,+Kalayarkoil,+Tamil+Nadu+630551&t=&z=16&ie=UTF8&iwloc=&output=embed"
                />

              </div>
            </motion.div>

            {/* Contact form */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="flex items-center justify-between mb-8">
                <h2 className="section-title mb-0">Send Us a Message</h2>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 glass-card p-5 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="church-label">Your Name *</label>
                    <input {...register('name', { required: true })} className="church-input" placeholder="Enter your name" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">Required</p>}
                  </div>
                  <div>
                    <label className="church-label">Phone</label>
                    <input {...register('phone')} className="church-input" placeholder="Enter your phone number" />
                  </div>
                </div>
                <div>
                  <label className="church-label">Email *</label>
                  <input {...register('email', { required: true, pattern: /^\S+@\S+$/i })} className="church-input" placeholder="Enter your Email" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">Valid email required</p>}
                </div>
                <div>
                  <label className="church-label">Subject *</label>
                  <input {...register('subject', { required: true })} className="church-input" placeholder="How can we help you?" />
                </div>
                <div>
                  <label className="church-label">Message *</label>
                  <textarea {...register('message', { required: true })} rows={5} className="church-input resize-none" placeholder="Your message here..." />
                  {errors.message && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-gold w-full justify-center py-4 text-base">
                  {isSubmitting ? <span className="animate-spin"></span> : <FiSend />}
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
