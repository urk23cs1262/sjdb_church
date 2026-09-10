import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiUsers, FiCalendar, FiArrowRight, FiInfo, FiFileText } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminRegistrations() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const r = await api.get('/events?all=true');
      const regEvents = (r.data.events || []).filter(e => e.registrationRequired);
      setEvents(regEvents);
    } catch (e) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = (event) => {
    const regs = event.registrations || [];
    if (regs.length === 0) {
      toast.error('No registrations to download');
      return;
    }

    setIsExportingPDF(true);
    try {
      // Landscape orientation
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const exportDate = new Date().toLocaleString();

      // Simple Header - No background color
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text("St. John de Britto's Church", pageWidth / 2, 15, { align: 'center' });

      // Tamil Name - Using a workaround (English label if rendering fails, or standard text)
      // Since standard jsPDF doesn't support Tamil, we'll use a very simple fallback or a large clear label
      // doc.setFontSize(12);
      // doc.setFont('helvetica', 'normal');
      // doc.text("புனித அருளானந்தர் ஆலயம்", pageWidth / 2, 22, { align: 'center' });

      doc.setFontSize(10);
      doc.text("Administration Management System", pageWidth / 2, 28, { align: 'center' });

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 32, pageWidth - 14, 32);

      // Event Info Section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("EVENT REGISTRATION REPORT", 14, 42);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Event: ${event.title}`, 14, 50);
      doc.text(`Event Date: ${new Date(event.date).toLocaleDateString()}`, 14, 56);
      doc.text(`Total Participants: ${regs.length}`, 14, 62);
      doc.text(`Exported On: ${exportDate}`, pageWidth - 14, 62, { align: 'right' });

      // Table
      const tableData = regs.map((r, i) => [
        i + 1,
        r.name,
        r.phone,
        r.email,
        r.gender,
        r.comingFrom,
        new Date(r.registeredAt).toLocaleDateString()
      ]);

      autoTable(doc, {
        startY: 70,
        head: [['S.No', 'Name', 'Phone', 'Email', 'Gender', 'Sub-station', 'Date Registered']],
        body: tableData,
        theme: 'grid', // Simple table with borders
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [0, 0, 0],
          fontSize: 10,
          fontStyle: 'bold',
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        styles: { 
          fontSize: 9,
          cellPadding: 4,
          overflow: 'linebreak',
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 60 },
          4: { cellWidth: 20 },
          5: { cellWidth: 45 },
          6: { cellWidth: 35 }
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255]
        },
        margin: { top: 70 },
        didDrawPage: (data) => {
          // Footer
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(
            "Generated from St. John de Britto Church Administration System",
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
        }
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title.toLowerCase().replace(/\s+/g, '-')}-registrations.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF report generated!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const downloadCSV = (event) => {
    const regs = event.registrations || [];
    if (regs.length === 0) {
      toast.error('No registrations to download');
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Gender', 'Sub-station', 'Date Registered'];
    const rows = regs.map(r => [
      r.name,
      r.phone,
      r.email,
      r.gender,
      r.comingFrom,
      new Date(r.registeredAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Registrations_${event.title.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <SectionLoader />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-church-royal-blue">Event Registrations</h2>
          <p className="text-gray-500">View and download registration reports for church events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Events List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
            <FiCalendar className="text-church-gold" /> Select Event
          </h3>
          {events.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400">
              No events found with registration enabled.
            </div>
          ) : (
            events.map(ev => (
              <button
                key={ev._id}
                onClick={() => setSelectedEvent(ev)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedEvent?._id === ev._id
                    ? 'bg-church-royal-blue text-white border-church-royal-blue shadow-lg'
                    : 'bg-white text-gray-700 border-gray-100 hover:border-church-gold'
                }`}
              >
                <h4 className="font-bold line-clamp-1">{ev.title}</h4>
                <div className={`flex items-center justify-between mt-2 text-xs ${selectedEvent?._id === ev._id ? 'text-white/80' : 'text-gray-400'}`}>
                  <span>{new Date(ev.date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1">
                    <FiUsers /> {ev.registrations?.length || 0} registered
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Registrations Table */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedEvent ? (
              <motion.div
                key={selectedEvent._id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-3xl shadow-card overflow-hidden"
              >
                <div className="p-6 bg-church-gradient text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold">{selectedEvent.title}</h3>
                    <p className="text-white/70 text-sm">Total: {selectedEvent.registrations?.length || 0} participants</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadCSV(selectedEvent)}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                    >
                      <FiDownload /> CSV
                    </button>
                    <button
                      disabled={isExportingPDF}
                      onClick={() => downloadPDF(selectedEvent)}
                      className="bg-white text-church-royal-blue px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gold-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isExportingPDF ? (
                        <div className="w-4 h-4 border-2 border-church-royal-blue border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiFileText />
                      )}
                      Export PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Info</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(selectedEvent.registrations || []).length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                            No users have registered for this event yet.
                          </td>
                        </tr>
                      ) : (
                        selectedEvent.registrations.map((reg, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-all">
                            <td className="px-6 py-4">
                              <p className="font-bold text-gray-800">{reg.name}</p>
                              <p className="text-xs text-gray-400 capitalize">{reg.gender}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-700">{reg.phone}</p>
                              <p className="text-xs text-gray-400">{reg.email}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-gold-100 text-gold-800 rounded text-[10px] font-bold uppercase">
                                {reg.comingFrom}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">
                              {new Date(reg.registeredAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-blue-50 text-church-royal-blue rounded-full flex items-center justify-center mb-4">
                  <FiInfo className="text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No Event Selected</h3>
                <p className="text-gray-400 max-w-xs">Please select an event from the left sidebar to view participant registrations.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
