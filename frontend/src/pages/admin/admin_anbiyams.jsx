import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiCheck, FiDownload,
  FiCalendar, FiClock, FiMapPin, FiRefreshCw, FiUserCheck, FiUserPlus,
  FiGift, FiHeart, FiMove, FiCheckSquare, FiFilter, FiImage, FiFileText
} from 'react-icons/fi';
import { GiChurch, GiBookmark } from 'react-icons/gi';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

const ANBIYAM_ROLES = [
  'Leader',
  'Vice Leader',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Prayer Coordinator',
  'Youth Coordinator',
  'Choir Representative',
  'Catechism Representative',
  'Liturgy Representative',
  'Volunteer',
  'Member'
];

export default function AnbiyamAdmin() {
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' or 'members'
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterRole, setFilterRole] = useState('All');
  const [filterGender, setFilterGender] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Modals state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupPhotoFile, setGroupPhotoFile] = useState(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState('');

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberPhotoFile, setMemberPhotoFile] = useState(null);
  const [memberPhotoPreview, setMemberPhotoPreview] = useState('');

  const [transferMemberObj, setTransferMemberObj] = useState(null);
  const [targetAnbiyamId, setTargetAnbiyamId] = useState('');

  const [attendanceMemberObj, setAttendanceMemberObj] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('Present');
  const [attendanceNotes, setAttendanceNotes] = useState('');

  // React Hook Form for Group and Member
  const { register: regGroup, handleSubmit: subGroup, reset: resetGroup, formState: { isSubmitting: isSubmittingGroup } } = useForm();
  const { register: regMember, handleSubmit: subMember, reset: resetMember, setValue: setMemberVal, formState: { isSubmitting: isSubmittingMember } } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resGroups, resMembers, resStats] = await Promise.all([
        api.get('/anbiyam/groups'),
        api.get('/anbiyam/members'),
        api.get('/anbiyam/stats')
      ]);
      setGroups(resGroups.data.anbiyams || []);
      setMembers(resMembers.data.members || []);
      setStats(resStats.data.stats || {});
    } catch (err) {
      toast.error('Failed to load Anbiyam data');
    } finally {
      setLoading(false);
    }
  };

  // ── Group Modals ────────────────────────────────────────────────────────────
  const openAddGroupModal = () => {
    setEditingGroup(null);
    setGroupPhotoFile(null);
    setGroupPhotoPreview('');
    resetGroup({
      name: '',
      patronSaint: '',
      description: '',
      establishedDate: '',
      areaStreetZone: '',
      meetingDay: 'Sunday',
      meetingTime: '06:30 PM',
      meetingFrequency: 'Monthly',
      meetingVenue: '',
      leaderName: '',
      leaderPhone: '',
      viceLeaderName: '',
      secretaryName: '',
      contactPerson: '',
      isActive: true
    });
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (g) => {
    setEditingGroup(g);
    setGroupPhotoFile(null);
    setGroupPhotoPreview(g.image ? getMediaUrl(g.image) : '');
    resetGroup({
      name: g.name || '',
      patronSaint: g.patronSaint || '',
      description: g.description || '',
      establishedDate: g.establishedDate ? new Date(g.establishedDate).toISOString().split('T')[0] : '',
      areaStreetZone: g.areaStreetZone || '',
      meetingDay: g.meetingDay || '',
      meetingTime: g.meetingTime || '',
      meetingFrequency: g.meetingFrequency || 'Monthly',
      meetingVenue: g.meetingVenue || '',
      leaderName: g.leaderName || '',
      leaderPhone: g.leaderPhone || '',
      viceLeaderName: g.viceLeaderName || '',
      secretaryName: g.secretaryName || '',
      contactPerson: g.contactPerson || '',
      isActive: g.isActive !== false
    });
    setIsGroupModalOpen(true);
  };

  const onSaveGroup = async (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => formData.append(key, data[key]));
    if (groupPhotoFile) formData.append('image', groupPhotoFile);

    try {
      if (editingGroup) {
        await api.put(`/anbiyam/groups/${editingGroup._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Anbiyam unit updated successfully');
      } else {
        await api.post('/anbiyam/groups', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Anbiyam unit created successfully');
      }
      setIsGroupModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save Anbiyam group');
    }
  };

  const deleteGroup = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" and all its members?`)) return;
    try {
      await api.delete(`/anbiyam/groups/${id}`);
      toast.success('Anbiyam group deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete group');
    }
  };

  // ── Member Modals ───────────────────────────────────────────────────────────
  const openAddMemberModal = () => {
    setEditingMember(null);
    setMemberPhotoFile(null);
    setMemberPhotoPreview('');
    resetMember({
      fullName: '',
      familyId: '',
      gender: 'male',
      dob: '',
      phone: '',
      email: '',
      address: '',
      familyName: '',
      baptismName: '',
      occupation: '',
      bloodGroup: '',
      notes: '',
      anbiyam: groups[0]?._id || '',
      role: 'Member',
      dateJoined: new Date().toISOString().split('T')[0],
      isActive: true,
      headOfFamily: '',
      spouseName: '',
      numberOfFamilyMembers: 1,
      weddingAnniversary: '',
      emergencyContact: ''
    });
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (m) => {
    setEditingMember(m);
    setMemberPhotoFile(null);
    setMemberPhotoPreview(m.profilePhoto ? getMediaUrl(m.profilePhoto) : '');
    resetMember({
      fullName: m.fullName || '',
      familyId: m.familyId || '',
      gender: m.gender || 'male',
      dob: m.dob ? new Date(m.dob).toISOString().split('T')[0] : '',
      phone: m.phone || '',
      email: m.email || '',
      address: m.address || '',
      familyName: m.familyName || '',
      baptismName: m.baptismName || '',
      occupation: m.occupation || '',
      bloodGroup: m.bloodGroup || '',
      notes: m.notes || '',
      anbiyam: m.anbiyam?._id || m.anbiyam || '',
      role: m.role || 'Member',
      dateJoined: m.dateJoined ? new Date(m.dateJoined).toISOString().split('T')[0] : '',
      isActive: m.isActive !== false,
      headOfFamily: m.headOfFamily || '',
      spouseName: m.spouseName || '',
      numberOfFamilyMembers: m.numberOfFamilyMembers || 1,
      weddingAnniversary: m.weddingAnniversary ? new Date(m.weddingAnniversary).toISOString().split('T')[0] : '',
      emergencyContact: m.emergencyContact || ''
    });
    setIsMemberModalOpen(true);
  };

  const onSaveMember = async (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => formData.append(key, data[key]));
    if (memberPhotoFile) formData.append('profilePhoto', memberPhotoFile);

    try {
      if (editingMember) {
        await api.put(`/anbiyam/members/${editingMember._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Member updated successfully');
      } else {
        await api.post('/anbiyam/members', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Member added successfully');
      }
      setIsMemberModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save member');
    }
  };

  const deleteMember = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete member "${name}"?`)) return;
    try {
      await api.delete(`/anbiyam/members/${id}`);
      toast.success('Member deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete member');
    }
  };

  // ── Member Transfer ─────────────────────────────────────────────────────────
  const handleTransferSubmit = async () => {
    if (!transferMemberObj || !targetAnbiyamId) return;
    try {
      await api.put(`/anbiyam/members/${transferMemberObj._id}/transfer`, { targetAnbiyamId });
      toast.success(`Transferred member to selected Anbiyam`);
      setTransferMemberObj(null);
      setTargetAnbiyamId('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to transfer member');
    }
  };

  // ── Member Attendance ──────────────────────────────────────────────────────
  const handleAttendanceSubmit = async () => {
    if (!attendanceMemberObj) return;
    try {
      await api.post('/anbiyam/attendance', {
        memberIds: [attendanceMemberObj._id],
        date: attendanceDate,
        status: attendanceStatus,
        notes: attendanceNotes
      });
      toast.success('Attendance recorded');
      setAttendanceMemberObj(null);
      fetchData();
    } catch {
      toast.error('Failed to record attendance');
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (filteredMembers.length === 0) {
      toast.error('No members to export');
      return;
    }
    const headers = [
      'Member ID', 'Full Name', 'Anbiyam', 'Role', 'Gender', 'DOB', 'Age',
      'Phone', 'Email', 'Address', 'Family Name', 'Family ID', 'Head of Family',
      'Spouse Name', 'No. of Family Members', 'Wedding Anniversary', 'Emergency Contact', 'Status'
    ];

    const rows = filteredMembers.map(m => {
      const birthYear = m.dob ? new Date(m.dob).getFullYear() : null;
      const age = birthYear ? (new Date().getFullYear() - birthYear) : '';
      return [
        `"${m.memberId || ''}"`,
        `"${m.fullName || ''}"`,
        `"${m.anbiyam?.name || ''}"`,
        `"${m.role || ''}"`,
        `"${m.gender || ''}"`,
        `"${m.dob ? new Date(m.dob).toLocaleDateString() : ''}"`,
        `"${age}"`,
        `"${m.phone || ''}"`,
        `"${m.email || ''}"`,
        `"${(m.address || '').replace(/"/g, '""')}"`,
        `"${m.familyName || ''}"`,
        `"${m.familyId || ''}"`,
        `"${m.headOfFamily || ''}"`,
        `"${m.spouseName || ''}"`,
        `"${m.numberOfFamilyMembers || 1}"`,
        `"${m.weddingAnniversary ? new Date(m.weddingAnniversary).toLocaleDateString() : ''}"`,
        `"${m.emergencyContact || ''}"`,
        `"${m.isActive ? 'Active' : 'Inactive'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Anbiyam_Members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully!');
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    if (filteredMembers.length === 0) {
      toast.error('No members to export');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const exportDate = new Date().toLocaleString();

      doc.setTextColor(30, 58, 138); // Royal blue
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text("St. John de Britto's Church • Kalayarkoil", pageWidth / 2, 14, { align: 'center' });

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("ANBIYAM WARD MEMBERS DIRECTORY REPORT", pageWidth / 2, 21, { align: 'center' });

      doc.setDrawColor(212, 160, 23); // Gold border line
      doc.setLineWidth(0.8);
      doc.line(14, 25, pageWidth - 14, 25);

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(`Total Exported Records: ${filteredMembers.length}`, 14, 31);
      doc.text(`Exported On: ${exportDate}`, pageWidth - 14, 31, { align: 'right' });

      const tableHeaders = [['#', 'Member ID', 'Full Name', 'Anbiyam Group', 'Role', 'Gender', 'Phone', 'Family Name', 'Status']];

      const tableData = filteredMembers.map((m, i) => [
        i + 1,
        m.memberId || 'N/A',
        m.fullName || 'N/A',
        m.anbiyam?.name || 'N/A',
        m.role || 'Member',
        m.gender || 'N/A',
        m.phone || 'N/A',
        m.familyName || 'N/A',
        m.isActive ? 'Active' : 'Inactive'
      ]);

      autoTable(doc, {
        startY: 35,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 35, left: 14, right: 14 }
      });

      doc.save(`Anbiyam_Members_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF report exported successfully!');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to export PDF report');
    }
  };

  // Filtered members list
  const filteredMembers = members.filter(m => {
    const matchesGroup = filterGroup === 'All' || m.anbiyam?._id === filterGroup || m.anbiyam === filterGroup;
    const matchesRole = filterRole === 'All' || m.role === filterRole;
    const matchesGender = filterGender === 'All' || m.gender === filterGender;
    const matchesStatus = filterStatus === 'All' || (filterStatus === 'active' ? m.isActive : !m.isActive);
    const matchesSearch = !search ||
      m.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      m.memberId?.toLowerCase().includes(search.toLowerCase()) ||
      m.familyId?.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search) ||
      m.familyName?.toLowerCase().includes(search.toLowerCase());

    return matchesGroup && matchesRole && matchesGender && matchesStatus && matchesSearch;
  });

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue flex items-center gap-2">
              <GiChurch className="text-church-gold" /> ANBIYAM MANAGEMENT
            </h1>
            {/* <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive control panel for all Basic Ecclesial Community wards, leadership & parish members
            </p> */}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddGroupModal}
              className="px-4 py-2 bg-church-royal-blue text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:bg-blue-900 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FiPlus /> New Anbiyam Unit
            </button>

            <button
              onClick={openAddMemberModal}
              className="btn-gold text-xs sm:text-sm py-2 px-4 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FiUserPlus /> Add Anbiyam Member
            </button>
          </div>
        </div>

        {/* Dashboard Statistics Header Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-3">
          <div className="bg-gradient-to-br from-blue-700 to-indigo-900 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-blue-200">Total Anbiyams</p>
            <p className="text-xl font-black mt-1">{stats.totalAnbiyams || groups.length}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-emerald-200">Total Members</p>
            <p className="text-xl font-black mt-1">{stats.totalMembers || members.length}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-blue-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-indigo-200">Male Members</p>
            <p className="text-xl font-black mt-1">{stats.maleMembers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-pink-600 to-rose-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-pink-200">Female Members</p>
            <p className="text-xl font-black mt-1">{stats.femaleMembers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-indigo-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-purple-200">Youth (13–30)</p>
            <p className="text-xl font-black mt-1">{stats.youthMembers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-600 to-yellow-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-amber-200">Seniors (60+)</p>
            <p className="text-xl font-black mt-1">{stats.seniorMembers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-emerald-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-green-200">Active Status</p>
            <p className="text-xl font-black mt-1">{stats.activeMembers || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-slate-600 to-gray-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-slate-200">Inactive</p>
            <p className="text-xl font-black mt-1">{stats.inactiveMembers || 0}</p>
          </div>

          {/* <div className="bg-gradient-to-br from-rose-500 to-pink-700 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-rose-200"> Today B'day</p>
            <p className="text-xl font-black mt-1">{stats.todayBirthdaysCount || 0}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-700 to-red-800 text-white rounded-2xl p-3 shadow-sm border border-white/10">
            <p className="text-[10px] uppercase font-bold text-amber-200"> Anniversaries</p>
            <p className="text-xl font-black mt-1">{stats.upcomingAnniversariesCount || 0}</p>
          </div> */}
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${activeTab === 'groups'
                ? 'border-church-gold text-church-royal-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <GiChurch className="text-lg" /> Anbiyam Units / Wards ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${activeTab === 'members'
                ? 'border-church-gold text-church-royal-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <FiUsers className="text-lg" /> Member Directory ({members.length})
          </button>
        </div>

        {loading ? (
          <SectionLoader />
        ) : activeTab === 'groups' ? (
          /* ── TAB 1: ANBIYAM GROUPS GRID ───────────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((g) => (
              <div key={g._id} className="glass-card bg-white p-5 flex flex-col justify-between shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-church-royal-blue text-white font-bold flex items-center justify-center border border-church-gold/40 flex-shrink-0">
                        {g.image ? (
                          <img src={getMediaUrl(g.image)} alt={g.name} className="w-full h-full object-cover" />
                        ) : (
                          <GiChurch className="text-2xl" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-gray-900 text-base">{g.name}</h3>
                        <p className="text-xs text-church-gold font-semibold">{g.patronSaint ? `Saint: ${g.patronSaint}` : 'BCC Ward'}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${g.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {g.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {g.description && (
                    <p className="text-xs text-gray-600 italic mb-4 border-l-2 border-amber-300 pl-2">
                      "{g.description}"
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 mb-4 text-center">
                    <div>
                      <span className="text-xs text-gray-500 block font-medium">Registered Members</span>
                      <span className="text-base font-black text-church-royal-blue">{g.memberCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block font-medium">Active Members</span>
                      <span className="text-base font-black text-emerald-700">{g.activeCount || 0}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <FiCalendar className="text-amber-600" />
                      <span><strong>Schedule:</strong> {g.meetingDay || 'TBD'} {g.meetingTime ? `at ${g.meetingTime}` : ''} ({g.meetingFrequency || 'Monthly'})</span>
                    </div>
                    {g.meetingVenue && (
                      <div className="flex items-center gap-2">
                        <FiMapPin className="text-amber-600" />
                        <span><strong>Venue:</strong> {g.meetingVenue}</span>
                      </div>
                    )}
                    {g.leaderName && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <FiUserCheck className="text-blue-600" />
                        <span><strong>Leader:</strong> {g.leaderName} {g.leaderPhone ? `(${g.leaderPhone})` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEditGroupModal(g)}
                    className="flex-1 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FiEdit2 size={13} /> Edit Anbiyam
                  </button>
                  <button
                    onClick={() => deleteGroup(g._id, g.name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    title="Delete Group"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── TAB 2: MEMBER DIRECTORY ──────────────────────────────────────── */
          <div className="space-y-4">

            {/* Search & Filter Controls */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, member ID, phone, family..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium focus:outline-hidden focus:border-church-gold"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={exportToCSV}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Export Members to CSV File"
                  >
                    <FiDownload /> Export CSV
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Export Members Directory PDF Report"
                  >
                    <FiFileText /> Export PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Anbiyam Group</label>
                  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="church-select py-1.5 text-xs">
                    <option value="All">All Anbiyams ({groups.length})</option>
                    {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Role</label>
                  <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="church-select py-1.5 text-xs">
                    <option value="All">All Roles</option>
                    {ANBIYAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Gender</label>
                  <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="church-select py-1.5 text-xs">
                    <option value="All">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="church-select py-1.5 text-xs">
                    <option value="All">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Members Directory Table */}
            <div className="glass-card overflow-x-auto bg-white border border-gray-200">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 uppercase text-[11px] font-bold text-gray-400 bg-gray-50/80">
                    <th className="py-3 px-4 text-left">Member Info</th>
                    <th className="py-3 px-4 text-left">Anbiyam & Role</th>
                    <th className="py-3 px-4 text-left">Contact & Address</th>
                    <th className="py-3 px-4 text-left">Family Details</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => {
                    const birthYear = m.dob ? new Date(m.dob).getFullYear() : null;
                    const age = birthYear ? (new Date().getFullYear() - birthYear) : null;
                    return (
                      <tr key={m._id} className="border-b border-gray-100 hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-church-royal-blue text-white font-bold flex items-center justify-center flex-shrink-0 border border-church-gold/40">
                              {m.profilePhoto ? (
                                <img src={getMediaUrl(m.profilePhoto)} alt={m.fullName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{m.fullName?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{m.fullName}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono font-bold mt-0.5">
                                <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">{m.memberId}</span>
                                {m.familyId && <span className="bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-300">Fam: {m.familyId}</span>}
                              </div>
                              {age && <span className="text-[10px] text-gray-400">Age: {age} yrs ({m.gender})</span>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 font-bold text-[11px] rounded-md border border-blue-200">
                              {m.anbiyam?.name || 'Unassigned'}
                            </span>
                            <span className="block text-[11px] font-bold text-church-gold">
                              {m.role || 'Member'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-xs text-gray-600 space-y-0.5">
                          {m.phone && <p className="font-semibold text-gray-800"> {m.phone}</p>}
                          {m.email && <p className="text-gray-500 text-[11px]"> {m.email}</p>}
                          {m.address && <p className="text-[10px] text-gray-400 truncate max-w-[160px]"> {m.address}</p>}
                        </td>

                        <td className="py-3 px-4 text-xs text-gray-600 space-y-0.5">
                          {m.familyName && <p className="font-bold text-gray-800">Household: {m.familyName}</p>}
                          {m.headOfFamily && <p className="text-[11px]">Head: {m.headOfFamily}</p>}
                          {m.spouseName && <p className="text-[11px]">Spouse: {m.spouseName}</p>}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${m.isActive ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'
                            }`}>
                            {m.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEditMemberModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Edit Member"><FiEdit2 size={15} /></button>
                            <button onClick={() => setTransferMemberObj(m)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer" title="Transfer Anbiyam"><FiMove size={15} /></button>
                            <button onClick={() => setAttendanceMemberObj(m)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Record Attendance"><FiCheckSquare size={15} /></button>
                            <button onClick={() => deleteMember(m._id, m.fullName)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer" title="Delete Member"><FiTrash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 italic">
                        No members found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL 1: ADD / EDIT ANBIYAM GROUP ────────────────────────────────── */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsGroupModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="font-display text-lg font-bold text-church-royal-blue">
                  {editingGroup ? 'Edit Anbiyam Unit' : 'Create New Anbiyam Unit'}
                </h2>
                <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
              </div>

              <form onSubmit={subGroup(onSaveGroup)} className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="church-label">Anbiyam Name *</label>
                    <input {...regGroup('name', { required: true })} className="church-input" placeholder="e.g. St. Antony Anbiyam" />
                  </div>

                  <div>
                    <label className="church-label">Patron Saint</label>
                    <input {...regGroup('patronSaint')} className="church-input" placeholder="e.g. St. Anthony of Padua" />
                  </div>

                  <div>
                    <label className="church-label">Area / Street / Ward Zone</label>
                    <input {...regGroup('areaStreetZone')} className="church-input" placeholder="e.g. Main Street Ward #4" />
                  </div>

                  <div>
                    <label className="church-label">Established Date</label>
                    <input type="date" {...regGroup('establishedDate')} className="church-input" />
                  </div>

                  <div>
                    <label className="church-label">Meeting Day</label>
                    <input {...regGroup('meetingDay')} className="church-input" placeholder="e.g. Every Sunday / 2nd Saturday" />
                  </div>

                  <div>
                    <label className="church-label">Meeting Time</label>
                    <input {...regGroup('meetingTime')} className="church-input" placeholder="e.g. 06:30 PM" />
                  </div>

                  <div>
                    <label className="church-label">Meeting Frequency</label>
                    <select {...regGroup('meetingFrequency')} className="church-select">
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-weekly">Bi-weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="church-label">Meeting Venue</label>
                    <input {...regGroup('meetingVenue')} className="church-input" placeholder="e.g. Rotating Family Houses / St. Antony Chapel" />
                  </div>

                  <div>
                    <label className="church-label">Leader Name</label>
                    <input {...regGroup('leaderName')} className="church-input" placeholder="Name of Anbiyam Leader" />
                  </div>

                  <div>
                    <label className="church-label">Leader Phone</label>
                    <input {...regGroup('leaderPhone')} className="church-input" placeholder="Phone number" />
                  </div>

                  <div>
                    <label className="church-label">Vice Leader Name</label>
                    <input {...regGroup('viceLeaderName')} className="church-input" placeholder="Vice leader name" />
                  </div>

                  <div>
                    <label className="church-label">Secretary Name</label>
                    <input {...regGroup('secretaryName')} className="church-input" placeholder="Secretary name" />
                  </div>

                  <div>
                    <label className="church-label">Contact Person (Public)</label>
                    <input {...regGroup('contactPerson')} className="church-input" placeholder="Optional contact name for website" />
                  </div>

                  <div>
                    <label className="church-label">Active Status</label>
                    <select {...regGroup('isActive')} className="church-select">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="church-label">Description / Mission</label>
                    <textarea {...regGroup('description')} rows={2} className="church-input py-2 resize-none" placeholder="Brief details about this Anbiyam..." />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-church-royal-blue text-white flex items-center justify-center flex-shrink-0">
                    {groupPhotoPreview ? <img src={groupPhotoPreview} alt="preview" className="w-full h-full object-cover" /> : <FiImage size={24} />}
                  </div>
                  <div>
                    <label className="church-label">Group Photo (Optional)</label>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setGroupPhotoFile(f); setGroupPhotoPreview(URL.createObjectURL(f)); } }} className="text-xs text-gray-500" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsGroupModalOpen(false)} className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isSubmittingGroup} className="btn-gold flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">
                    {isSubmittingGroup ? 'Saving...' : 'Save Anbiyam Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: ADD / EDIT ANBIYAM MEMBER (4 SECTIONS) ────────────────── */}
      <AnimatePresence>
        {isMemberModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onClick={() => setIsMemberModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-church-royal-blue">
                    {editingMember ? `Edit Member (${editingMember.memberId})` : 'Add New Anbiyam Member'}
                  </h2>
                  <p className="text-xs text-gray-500">Enter personal, church, and family details for member registration</p>
                </div>
                <button onClick={() => setIsMemberModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
              </div>

              <form onSubmit={subMember(onSaveMember)} className="space-y-6 text-xs sm:text-sm">

                {/* SECTION 1: Personal Information */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="font-bold text-church-royal-blue text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                    1. Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="church-label">Full Name *</label>
                      <input {...regMember('fullName', { required: true })} className="church-input" placeholder="Full Member Name" />
                    </div>

                    <div>
                      <label className="church-label">Family ID (Optional)</label>
                      <input {...regMember('familyId')} className="church-input" placeholder="e.g. FAM-102" />
                    </div>

                    <div>
                      <label className="church-label">Gender *</label>
                      <select {...regMember('gender', { required: true })} className="church-select">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="church-label">Date of Birth</label>
                      <input type="date" {...regMember('dob')} className="church-input" />
                    </div>

                    <div>
                      <label className="church-label">Mobile Number</label>
                      <input {...regMember('phone')} className="church-input" placeholder="+91 98765 43210" />
                    </div>

                    <div>
                      <label className="church-label">Email Address</label>
                      <input type="email" {...regMember('email')} className="church-input" placeholder="email@example.com" />
                    </div>

                    <div>
                      <label className="church-label">Household Family Name</label>
                      <input {...regMember('familyName')} className="church-input" placeholder="e.g. Joseph Family" />
                    </div>

                    <div>
                      <label className="church-label">Baptism Name (Optional)</label>
                      <input {...regMember('baptismName')} className="church-input" placeholder="e.g. Francis Xavier" />
                    </div>

                    <div>
                      <label className="church-label">Occupation</label>
                      <input {...regMember('occupation')} className="church-input" placeholder="e.g. Teacher, Engineer" />
                    </div>

                    <div>
                      <label className="church-label">Blood Group (Optional)</label>
                      <input {...regMember('bloodGroup')} className="church-input" placeholder="e.g. O+, A+" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="church-label">Residential Address</label>
                      <textarea {...regMember('address')} rows={2} className="church-input py-2 resize-none" placeholder="Full residential street address..." />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Church & Anbiyam Details */}
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                  <h3 className="font-bold text-amber-950 text-xs uppercase tracking-wider border-b border-amber-200 pb-2">
                    2. Church &amp; Anbiyam Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="church-label">Anbiyam Group *</label>
                      <select {...regMember('anbiyam', { required: true })} className="church-select">
                        {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="church-label">Anbiyam Role *</label>
                      <select {...regMember('role', { required: true })} className="church-select">
                        {ANBIYAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="church-label">Date Joined Anbiyam</label>
                      <input type="date" {...regMember('dateJoined')} className="church-input" />
                    </div>

                    <div>
                      <label className="church-label">Active / Inactive Status</label>
                      <select {...regMember('isActive')} className="church-select">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Family Details */}
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 space-y-3">
                  <h3 className="font-bold text-blue-950 text-xs uppercase tracking-wider border-b border-blue-200 pb-2">
                    3. Family Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="church-label">Head of Family Name</label>
                      <input {...regMember('headOfFamily')} className="church-input" placeholder="e.g. Antony Raj" />
                    </div>

                    <div>
                      <label className="church-label">Spouse Name</label>
                      <input {...regMember('spouseName')} className="church-input" placeholder="e.g. Maria Rose" />
                    </div>

                    <div>
                      <label className="church-label">Number of Family Members</label>
                      <input type="number" {...regMember('numberOfFamilyMembers')} className="church-input" placeholder="1" />
                    </div>

                    <div>
                      <label className="church-label">Wedding Anniversary Date</label>
                      <input type="date" {...regMember('weddingAnniversary')} className="church-input" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="church-label">Emergency Contact Number / Info</label>
                      <input {...regMember('emergencyContact')} className="church-input" placeholder="e.g. +91 98765 43210 (Brother)" />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: Profile Photo & Admin Notes */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-church-royal-blue text-white flex items-center justify-center flex-shrink-0 border border-church-gold">
                      {memberPhotoPreview ? <img src={memberPhotoPreview} alt="preview" className="w-full h-full object-cover" /> : <FiImage size={24} />}
                    </div>
                    <div className="flex-1">
                      <label className="church-label">Profile Photo (Optional)</label>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setMemberPhotoFile(f); setMemberPhotoPreview(URL.createObjectURL(f)); } }} className="text-xs text-gray-500" />
                    </div>
                  </div>

                  <div>
                    <label className="church-label">Admin Notes</label>
                    <textarea {...regMember('notes')} rows={2} className="church-input py-2 resize-none" placeholder="Internal notes or comments about member..." />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsMemberModalOpen(false)} className="btn-ghost flex-1 justify-center py-3 text-xs font-bold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isSubmittingMember} className="btn-gold flex-1 justify-center py-3 text-xs font-bold cursor-pointer shadow-gold">
                    {isSubmittingMember ? 'Saving...' : 'Save Member Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: TRANSFER MEMBER TO ANOTHER ANBIYAM ─────────────────────── */}
      <AnimatePresence>
        {transferMemberObj && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setTransferMemberObj(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <FiMove className="text-amber-600" /> Transfer Anbiyam Member
                </h3>
                <button onClick={() => setTransferMemberObj(null)} className="text-gray-400"><FiX size={18} /></button>
              </div>

              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p><strong>Member:</strong> {transferMemberObj.fullName} ({transferMemberObj.memberId})</p>
                <p><strong>Current Anbiyam:</strong> {transferMemberObj.anbiyam?.name || 'Unassigned'}</p>
              </div>

              <div>
                <label className="church-label">Select Target Anbiyam Group *</label>
                <select value={targetAnbiyamId} onChange={e => setTargetAnbiyamId(e.target.value)} className="church-select">
                  <option value="">Select Destination Anbiyam</option>
                  {groups.filter(g => g._id !== transferMemberObj.anbiyam?._id).map(g => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setTransferMemberObj(null)} className="btn-ghost flex-1 py-2 text-xs font-bold">Cancel</button>
                <button onClick={handleTransferSubmit} disabled={!targetAnbiyamId} className="btn-gold flex-1 py-2 text-xs font-bold disabled:opacity-50">Confirm Transfer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 4: RECORD ATTENDANCE ───────────────────────────────────────── */}
      <AnimatePresence>
        {attendanceMemberObj && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setAttendanceMemberObj(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <FiCheckSquare className="text-emerald-600" /> Record Meeting Attendance
                </h3>
                <button onClick={() => setAttendanceMemberObj(null)} className="text-gray-400"><FiX size={18} /></button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-gray-700 space-y-1">
                <p><strong>Member:</strong> {attendanceMemberObj.fullName} ({attendanceMemberObj.memberId})</p>
                <p><strong>Anbiyam:</strong> {attendanceMemberObj.anbiyam?.name || 'N/A'}</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="church-label">Meeting Date</label>
                  <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="church-input" />
                </div>

                <div>
                  <label className="church-label">Attendance Status</label>
                  <select value={attendanceStatus} onChange={e => setAttendanceStatus(e.target.value)} className="church-select">
                    <option value="Present"> Present</option>
                    <option value="Absent"> Absent</option>
                  </select>
                </div>

                <div>
                  <label className="church-label">Notes (Optional)</label>
                  <input type="text" value={attendanceNotes} onChange={e => setAttendanceNotes(e.target.value)} placeholder="Reason or meeting topic..." className="church-input" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setAttendanceMemberObj(null)} className="btn-ghost flex-1 py-2 text-xs font-bold">Cancel</button>
                <button onClick={handleAttendanceSubmit} className="btn-gold flex-1 py-2 text-xs font-bold">Save Attendance</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
