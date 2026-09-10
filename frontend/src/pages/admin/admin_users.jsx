import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiTrash2, FiEdit, FiUserCheck, FiUserX, FiX, FiSliders, FiShield, FiClock, FiCheckCircle, FiXCircle, FiFileText, FiTag, FiMaximize, FiLoader, FiUserPlus, FiAlertTriangle, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useForm } from 'react-hook-form';
import MemberSettingsModal from '../../components/admin/admin_member_settings_modal';
import AddUserModal from '../../components/admin/admin_add_user_modal';
import MessageUserModal from '../../components/admin/admin_message_user_modal';

export default function AdminUsers() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsMember, setSettingsMember] = useState(null);
  const [messageUser, setMessageUser] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'requests' ? 'requests' : 'users'); // 'users' | 'requests'
  const [requestHistory, setRequestHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Member QR Scan & Lookup State
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [scannedUserResult, setScannedUserResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Member & Family ID Format State
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formatData, setFormatData] = useState({
    prefix: 'SJDB_M',
    padLength: 2,
    sample: 'SJDB_M01',
    familyPrefix: 'SJDB_FAM-',
    familyPadLength: 2,
    familySample: 'SJDB_FAM-01'
  });
  const [newPrefix, setNewPrefix] = useState('SJDB_M');
  const [newPadLength, setNewPadLength] = useState(2);
  const [newFamilyPrefix, setNewFamilyPrefix] = useState('SJDB_FAM-');
  const [newFamilyPadLength, setNewFamilyPadLength] = useState(2);
  const [isUpdatingFormat, setIsUpdatingFormat] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [existingFamilies, setExistingFamilies] = useState([]);
  const [familyIdStatus, setFamilyIdStatus] = useState(null);
  const [isResolvingFamily, setIsResolvingFamily] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm();

  const fetchExistingFamilies = async () => {
    try {
      const res = await api.get('/users/existing-families');
      if (res.data.success) {
        setExistingFamilies(res.data.families || []);
      }
    } catch (e) {
      console.warn('Failed to load existing families:', e);
    }
  };

  const handleFamilyNameChange = async (newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      setFamilyIdStatus(null);
      return;
    }

    // Check local existing list first
    const found = existingFamilies.find(f => f.familyName.trim().toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setValue('familyId', found.familyId);
      setFamilyIdStatus({
        isExisting: true,
        familyId: found.familyId,
        message: `Existing Family (${found.memberCount} member${found.memberCount > 1 ? 's' : ''})`
      });
      return;
    }

    // Query backend to resolve or generate next familyId
    setIsResolvingFamily(true);
    try {
      const res = await api.get(`/users/family-id-by-name?name=${encodeURIComponent(trimmed)}&excludeId=${editingUser?._id || ''}`);
      if (res.data.success && res.data.familyId) {
        setValue('familyId', res.data.familyId);
        setFamilyIdStatus({
          isExisting: res.data.isExisting,
          familyId: res.data.familyId,
          message: res.data.isExisting ? 'Existing Family ID matched' : 'New Family ID generated'
        });
      }
    } catch (e) {
      console.warn('Family ID resolution error:', e);
    } finally {
      setIsResolvingFamily(false);
    }
  };


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, ...(search && { search }) });
      const res = await api.get(`/users?${params}`);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch { toast.error('Failed to fetch users'); }
    finally { setLoading(false); }
  };

  const fetchRequestHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/permission-requests/admin/history');
      setRequestHistory(res.data.requests || []);
    } catch { toast.error('Failed to fetch permission request audit log'); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'requests') fetchRequestHistory();
  }, [page, search, activeTab]);

  // Auto-fetch and open user record when ?highlight=userId is in URL
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId) return;

    // Check if user is already in current loaded page
    const existing = users.find(u => String(u._id) === String(highlightId));
    if (existing) {
      openEditModal(existing);
      return;
    }

    // Otherwise, directly fetch from API so it ALWAYS works even if user is on another page
    api.get(`/users/${highlightId}`)
      .then(res => {
        if (res.data?.user) {
          openEditModal(res.data.user);
          toast.success(`User Record Loaded: ${res.data.user.name}`);
        }
      })
      .catch(err => {
        console.warn('Failed to load highlighted user:', err.message);
      });
  }, [searchParams, users]);

  const fetchFormatInfo = async () => {
    try {
      const res = await api.get('/users/member-id-format');
      if (res.data.success) {
        setFormatData(res.data);
        setNewPrefix(res.data.prefix || 'SJDB_M');
        setNewPadLength(res.data.padLength || 2);
        setNewFamilyPrefix(res.data.familyPrefix || 'SJDB_FAM-');
        setNewFamilyPadLength(res.data.familyPadLength || 2);
      }
    } catch (e) {
      console.error('Failed to fetch format info:', e);
    }
  };

  const openFormatModal = () => {
    fetchFormatInfo();
    setShowFormatModal(true);
  };

  const handleUpdateFormat = async (e) => {
    e.preventDefault();
    if (!newPrefix || !newPrefix.trim()) {
      return toast.error('Please enter a valid Member ID prefix');
    }
    if (!newFamilyPrefix || !newFamilyPrefix.trim()) {
      return toast.error('Please enter a valid Family ID prefix');
    }
    setIsUpdatingFormat(true);
    const toastId = toast.loading('Regenerating Member & Family IDs for all users...');
    try {
      const res = await api.post('/users/update-member-id-format', {
        prefix: newPrefix.trim(),
        padLength: Number(newPadLength),
        familyPrefix: newFamilyPrefix.trim(),
        familyPadLength: Number(newFamilyPadLength)
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Member & Family IDs regenerated successfully!', { id: toastId });
        setShowFormatModal(false);
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update format', { id: toastId });
    } finally {
      setIsUpdatingFormat(false);
    }
  };

  const handleScanLookup = async (codeToSearch) => {
    const code = codeToSearch || scanCodeInput;
    if (!code || !code.trim()) {
      return toast.error('Please enter or scan a Member ID / QR code');
    }
    setIsScanning(true);
    setScannedUserResult(null);
    try {
      const res = await api.get(`/users/lookup/scan?code=${encodeURIComponent(code.trim())}`);
      if (res.data.success) {
        setScannedUserResult(res.data.user);
        toast.success(`Member found: ${res.data.user.name}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'No member found matching scanned code');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isActive: !u.isActive } : u));
      toast.success(`User ${!user.isActive ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Failed'); }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    fetchExistingFamilies();
    setValue('name', user.name || '');
    setValue('email', user.email || '');
    setValue('phone', user.phone || '');
    setValue('gender', user.gender || '');
    setValue('dob', user.dob ? new Date(user.dob).toISOString().slice(0, 10) : '');
    setValue('address', user.address || '');
    setValue('subStation', user.subStation || '');
    setValue('familyName', user.familyName || '');
    setValue('familyId', user.familyId || '');
    setValue('parishZone', user.parishZone || '');
    setValue('anbiyam', user.anbiyam || user.sccGroup || '');
    setValue('weddingDate', user.weddingDate ? new Date(user.weddingDate).toISOString().slice(0, 10) : '');
    setValue('bloodGroup', user.bloodGroup || '');
    setValue('memberStatus', user.memberStatus || 'Active');
    setValue('parishMemberId', user.parishMemberId || '');
    setValue('role', user.role || 'user');

    if (user.familyId) {
      setFamilyIdStatus({
        isExisting: true,
        familyId: user.familyId,
        message: 'Current Assigned Family ID'
      });
    } else {
      setFamilyIdStatus(null);
    }

    // Sacraments
    setValue('baptismDate', user.sacraments?.baptismDate ? new Date(user.sacraments.baptismDate).toISOString().slice(0, 10) : '');
    setValue('baptismParish', user.sacraments?.baptismParish || '');
    setValue('baptismCertNo', user.sacraments?.baptismCertNo || '');
    setValue('firstCommunionDate', user.sacraments?.firstCommunionDate ? new Date(user.sacraments.firstCommunionDate).toISOString().slice(0, 10) : '');
    setValue('confirmationDate', user.sacraments?.confirmationDate ? new Date(user.sacraments.confirmationDate).toISOString().slice(0, 10) : '');
    setValue('marriageDate', user.sacraments?.marriageDate ? new Date(user.sacraments.marriageDate).toISOString().slice(0, 10) : '');
    setValue('spouseName', user.sacraments?.spouseName || '');
  };

  const onUpdateUser = async (data) => {
    try {
      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        gender: data.gender,
        dob: data.dob,
        address: data.address,
        subStation: data.subStation,
        familyName: data.familyName,
        familyId: data.familyId,
        parishZone: data.parishZone,
        anbiyam: data.anbiyam || data.sccGroup,
        weddingDate: data.weddingDate,
        bloodGroup: data.bloodGroup,
        memberStatus: data.memberStatus,
        parishMemberId: data.parishMemberId,
        role: data.role,
        sacraments: {
          baptismDate: data.baptismDate,
          baptismParish: data.baptismParish,
          baptismCertNo: data.baptismCertNo,
          firstCommunionDate: data.firstCommunionDate,
          confirmationDate: data.confirmationDate,
          marriageDate: data.marriageDate,
          spouseName: data.spouseName
        }
      };
      await api.put(`/users/${editingUser._id}`, payload);
      toast.success('User details & sacraments updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting ${userToDelete.name || 'user'} permanently...`);
    try {
      await api.delete(`/users/${userToDelete._id}`);
      setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
      setTotal(prev => Math.max(0, prev - 1));
      toast.success(`User "${userToDelete.name}" was permanently deleted`, { id: toastId });
      setUserToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadUserPdf = async (userId, userName) => {
    const toastId = toast.loading(`Generating PDF for ${userName}...`);
    try {
      const res = await api.get(`/users/${userId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `User_${(userName || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded!', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to download PDF report', { id: toastId });
    }
  };

  const downloadAllUsersPdf = async () => {
    const toastId = toast.loading('Generating All Users PDF Report...');
    try {
      const res = await api.get('/users/export/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `All_Users_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Master Users PDF exported successfully!', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to export master PDF report', { id: toastId });
    }
  };

  const downloadExcelReport = () => {
    if (!users || users.length === 0) return toast.error('No members available to export');
    const headers = ['Parish Member ID', 'Family ID', 'Name', 'Phone', 'Email', 'Gender', 'DOB', 'Wedding Date', 'Parish Zone', 'Anbiyam Name', 'SubStation', 'Blood Group', 'Status', 'Role'];
    const rows = users.map(u => [
      `"${u.parishMemberId || ''}"`,
      `"${u.familyId || ''}"`,
      `"${u.name || ''}"`,
      `"${u.phone || ''}"`,
      `"${u.email || ''}"`,
      `"${u.gender || ''}"`,
      `"${u.dob ? new Date(u.dob).toLocaleDateString() : ''}"`,
      `"${u.weddingDate ? new Date(u.weddingDate).toLocaleDateString() : ''}"`,
      `"${u.parishZone || ''}"`,
      `"${u.anbiyam || u.sccGroup || ''}"`,
      `"${u.subStation || ''}"`,
      `"${u.bloodGroup || ''}"`,
      `"${u.memberStatus || (u.isActive ? 'Active' : 'Inactive')}"`,
      `"${u.role || 'user'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Parish_Members_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Excel/CSV Member Roster exported successfully!');
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        {/* Header Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">Manage Users ({total})</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Parish members registry & enterprise privacy governance</p>
          </div>

          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
            {/* <button
              onClick={() => { setShowScanModal(true); setScannedUserResult(null); setScanCodeInput(''); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
              title="Scan QR code or search member to view text & PDF"
            >
              <FiMaximize className="text-sm" /> Scan Member QR
            </button> */}

            <button
              onClick={downloadAllUsersPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Export All Users PDF Report"
            >
              <FiFileText className="text-sm" /> Export All PDF
            </button>

            <button
              onClick={downloadExcelReport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Export All Members Roster to Excel / CSV"
            >
              <FiFileText className="text-sm" /> Export Excel
            </button>

            <button
              onClick={openFormatModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Modify Member ID Prefix & Number Format"
            >
              <FiTag className="text-sm" /> Modify Member ID Format
            </button>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-church-royal-blue hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              title="Register and Add New Parish Member"
            >
              <FiUserPlus className="text-sm text-white" /> Add User
            </button>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl whitespace-nowrap">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-church-gold text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Members List
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'requests' ? 'bg-church-gold text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <FiShield /> Permission Requests Log
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'users' ? (
          <>
            <div className="flex justify-end mb-4">
              <div className="relative w-full sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="church-input pl-10 w-full text-sm" placeholder="Search users..." />
              </div>
            </div>

            {loading ? <SectionLoader /> : (
              <div className="glass-card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                      <th className="text-left py-3 px-4">Member Info</th>
                      <th className="text-left py-3 px-4">Member ID</th>
                      <th className="text-left py-3 px-4">Family ID & Zone</th>
                      <th className="text-left py-3 px-4">Contact</th>
                      <th className="text-left py-3 px-4">Blood Group</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Role</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <motion.tr key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-gray-50 hover:bg-gold-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-church-gradient flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-sm">{u.name?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                              <p className="text-gray-400 text-xs">{u.email || u.subStation || '—'}</p>
                              {(u.anbiyam || u.sccGroup) && <p className="text-[10px] text-amber-700 font-medium">Anbiyam: {u.anbiyam || u.sccGroup}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100/90 text-amber-950 border border-amber-300 shadow-2xs">
                            {u.parishMemberId || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-100/90 text-purple-950 border border-purple-300 shadow-2xs">
                            {u.familyId || '—'}
                          </span>
                          {u.parishZone && <span className="text-gray-400 text-[10px] block">{u.parishZone}</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-700 font-medium">
                          {u.phone || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {u.bloodGroup ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-md">
                              {u.bloodGroup}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${u.memberStatus === 'Deceased' ? 'bg-gray-200 text-gray-800 border border-gray-400' :
                              u.memberStatus === 'Transferred' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                u.memberStatus === 'Inactive' || !u.isActive ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  'bg-green-100 text-green-800 border border-green-300'
                            }`}>
                            {u.memberStatus || (u.isActive ? 'Active' : 'Inactive')}
                          </span>
                        </td>
                        <td className="py-3 px-4"><span className={`badge ${u.role === 'admin' ? 'badge-red' : 'badge-blue'} capitalize`}>{u.role}</span></td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setMessageUser(u)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors cursor-pointer" title="Send Message to Member">
                              <FiMail className="text-base" />
                            </button>
                            <button onClick={() => downloadUserPdf(u._id, u.name)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer" title="Download PDF Report">
                              <FiFileText />
                            </button>
                            <button onClick={() => setSettingsMember(u)} className="p-1.5 rounded-lg hover:bg-gold-100 text-church-gold transition-colors cursor-pointer" title="View / Request Member Settings">
                              <FiSliders />
                            </button>
                            <button onClick={() => toggleActive(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer" title={u.isActive ? 'Deactivate' : 'Activate'}>
                              {u.isActive ? <FiUserX className="text-red-500" /> : <FiUserCheck className="text-green-500" />}
                            </button>
                            <button onClick={() => openEditModal(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer" title="Edit User">
                              <FiEdit className="text-gray-400 hover:text-church-royal-blue" />
                            </button>
                            <button onClick={() => setUserToDelete(u)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors cursor-pointer" title="Delete User">
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {users.length === 0 && <p className="text-center py-10 text-gray-400">No users found</p>}

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Showing {users.length} of {total}</p>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">← Prev</button>
                    <button disabled={users.length < 20} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">Next →</button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Permission Requests Audit Log Tab */
          <div className="glass-card p-4">
            <h2 className="font-bold text-base text-church-royal-blue mb-4 flex items-center gap-2">
              <FiShield className="text-church-gold" /> Permission Request Audit Log
            </h2>
            {loadingHistory ? <SectionLoader /> : requestHistory.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">No permission requests recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Requested By</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Requested Changes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requestHistory.map(req => (
                      <tr key={req._id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-gray-800">
                          {req.userId?.name} <span className="text-gray-400 block text-[10px] font-normal">{req.userId?.phone}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-medium">{req.adminId?.name || 'Admin'}</td>
                        <td className="py-3 px-4 text-gray-700 italic max-w-xs truncate">{req.reason}</td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {Object.entries(req.requestedChanges || {}).map(([key, diff]) => (
                              <p key={key} className="text-[11px] text-gray-600">
                                <span className="font-semibold text-gray-800">{diff.label}:</span>{' '}
                                <span className="line-through text-gray-400">{String(diff.old)}</span> →{' '}
                                <span className="font-bold text-church-royal-blue">{String(diff.new)}</span>
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${req.status === 'approved' ? 'bg-green-100 text-green-700' :
                              req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                            {req.status === 'approved' && <FiCheckCircle />}
                            {req.status === 'rejected' && <FiXCircle />}
                            {req.status === 'pending' && <FiClock />}
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Member Settings Modal */}
      {settingsMember && (
        <MemberSettingsModal member={settingsMember} onClose={() => setSettingsMember(null)} />
      )}


      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setEditingUser(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-xl max-h-[88vh] shadow-2xl relative my-auto flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-church-royal-blue">User Records & Details</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${editingUser.isActive && !editingUser.isSuspended ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {editingUser.isSuspended ? 'Suspended' : editingUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {editingUser.isVerified && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                        <FiCheckCircle className="text-[11px]" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Update member personal profile, sacraments & role information</p>
                </div>
                <div className="flex items-center gap-2">
                  {(!editingUser.isActive || editingUser.isSuspended) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.put(`/security/users/${editingUser._id}/reactivate`);
                          setEditingUser(prev => ({ ...prev, isActive: true, isSuspended: false, isVerified: true }));
                          toast.success('Account Reactivated & Set to Active!');
                          fetchUsers();
                        } catch (err) {
                          toast.error('Reactivation failed');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <FiCheckCircle size={12} /> Reactivate
                    </button>
                  )}
                  <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"><FiX size={20} /></button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onUpdateUser)} className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="church-label">Full Name *</label>
                      <input {...register('name', { required: true })} className="church-input" placeholder="Full Name" />
                    </div>

                    <div>
                      <label className="church-label">Gender</label>
                      <select {...register('gender')} className="church-select">
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="church-label">Date of Birth</label>
                      <input type="date" {...register('dob')} placeholder="dd - mm - yyyy" className="church-input" />
                    </div>

                    <div>
                      <label className="church-label">Phone Number *</label>
                      <input {...register('phone', { required: true })} className="church-input" placeholder="Phone Number" />
                    </div>

                    <div>
                      <label className="church-label">Email Address</label>
                      <input {...register('email')} type="email" className="church-input" placeholder="Email Address" />
                    </div>

                    <div>
                      <label className="church-label">Parish Member ID (Editable)</label>
                      <input {...register('parishMemberId')} className="church-input font-mono font-bold text-church-royal-blue bg-amber-50/50 border-amber-300 focus:border-amber-500" placeholder="e.g. SJDB_M01" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="church-label mb-0">Family Name</label>
                        {isResolvingFamily && <span className="text-[10px] text-amber-700 animate-pulse font-bold">Syncing Family ID...</span>}
                      </div>
                      <input
                        {...register('familyName')}
                        list="existing-family-names"
                        onChange={(e) => {
                          setValue('familyName', e.target.value);
                          handleFamilyNameChange(e.target.value);
                        }}
                        className="church-input"
                        placeholder="e.g. ARN, Fernandes Family"
                        autoComplete="off"
                      />
                      <datalist id="existing-family-names">
                        {existingFamilies.map((f, idx) => (
                          <option key={idx} value={f.familyName}>
                            {f.familyId} ({f.memberCount} member{f.memberCount > 1 ? 's' : ''})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="church-label mb-0">Family ID (Auto-Synced / Editable)</label>
                      </div>
                      <input
                        {...register('familyId')}
                        className="church-input font-mono font-bold text-purple-900 bg-purple-50/50 border-purple-300 focus:border-purple-500"
                        placeholder="e.g. SJDB_FAM-01"
                      />
                      {familyIdStatus && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                            familyIdStatus.isExisting
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                          }`}>
                            {familyIdStatus.isExisting ? '✓' : '★'} {familyIdStatus.message}: <strong>{familyIdStatus.familyId}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="church-label">Anbiyam Name</label>
                      <input {...register('anbiyam')} className="church-input" placeholder="Enter your Anbiyam Name" />
                    </div>

                    <div>
                      <label className="church-label">Sub-Station</label>
                      <input {...register('subStation')} className="church-input" placeholder="Sub-station (e.g. Kalayarkoil)" />
                    </div>

                    <div>
                      <label className="church-label">Blood Group</label>
                      <input
                        {...register('bloodGroup')}
                        list="blood-group-options"
                        className="church-input"
                        placeholder="e.g. A+, B-, O+, AB+"
                        autoComplete="off"
                      />
                      <datalist id="blood-group-options">
                        <option value="A+" />
                        <option value="A-" />
                        <option value="B+" />
                        <option value="B-" />
                        <option value="O+" />
                        <option value="O-" />
                        <option value="AB+" />
                        <option value="AB-" />
                      </datalist>
                    </div>

                    <div>
                      <label className="church-label">Member Status</label>
                      <select {...register('memberStatus')} className="church-select font-bold">
                        <option value="Active"> Active</option>
                        <option value="Inactive"> Inactive</option>
                        <option value="Deceased"> Deceased</option>
                        <option value="Transferred"> Transferred</option>
                      </select>
                    </div>

                    <div>
                      <label className="church-label">Wedding Date (Anniversary)</label>
                      <input type="date" {...register('weddingDate')} placeholder="dd - mm - yyyy" className="church-input" />
                    </div>

                    <div>
                      <label className="church-label">User Role *</label>
                      <select {...register('role', { required: true })} className="church-select">
                        <option value="user">User (Parish Member)</option>
                        <option value="admin">Admin (Full System Access)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="church-label">Residential Address</label>
                      <textarea {...register('address')} rows={2} className="church-input py-2 text-xs resize-none" placeholder="Enter full address" />
                    </div>
                  </div>

                  {/* Sacramental Milestones Section */}
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <p className="font-bold text-gray-800 text-xs flex items-center gap-1.5 font-display">
                       Sacramental Milestones & Certificates
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60">
                      <div>
                        <label className="church-label text-[10px]">Baptism Date</label>
                        <input type="date" {...register('baptismDate')} placeholder="dd - mm - yyyy" className="church-input text-xs" />
                      </div>
                      <div>
                        <label className="church-label text-[10px]">First Holy Communion Date</label>
                        <input type="date" {...register('firstCommunionDate')} placeholder="dd - mm - yyyy" className="church-input text-xs" />
                      </div>
                      <div>
                        <label className="church-label text-[10px]">Confirmation Date</label>
                        <input type="date" {...register('confirmationDate')} placeholder="dd - mm - yyyy" className="church-input text-xs" />
                      </div>
                      <div>
                        <label className="church-label text-[10px]">Holy Matrimony Date</label>
                        <input type="date" {...register('marriageDate')} placeholder="dd - mm - yyyy" className="church-input text-xs" />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="church-label text-[10px]">Spouse Name</label>
                        <input {...register('spouseName')} className="church-input text-xs" placeholder="Spouse Full Name" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 flex-shrink-0">
                  <button type="button" onClick={() => setEditingUser(null)} className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn-gold flex-1 justify-center py-2.5 text-xs font-bold shadow-gold cursor-pointer">
                    {isSubmitting ? 'Saving...' : 'Save & Update Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Modify Member & Family ID Format Modal */}
        <AnimatePresence>
          {showFormatModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowFormatModal(false)}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] shadow-2xl relative my-auto flex flex-col overflow-hidden"
              >
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 flex-shrink-0">
                  <div>
                    <h2 className="font-display text-xl font-bold text-church-royal-blue flex items-center gap-2">
                      <FiTag className="text-church-gold" /> Modify Member & Family ID Format
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Configure global Parish Member ID and Family ID structures for all members</p>
                  </div>
                  <button onClick={() => setShowFormatModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <FiX size={20} />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <form onSubmit={handleUpdateFormat} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Format Comparison Overview */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2">
                      <p className="font-bold flex items-center gap-1.5"><FiTag /> Format Comparison Overview:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-amber-300/60 shadow-2xs space-y-1">
                          <span className="text-gray-500 block font-sans text-[10px] font-semibold mb-0.5">Previous Formats:</span>
                          <p className="font-bold text-gray-800 break-all">Member: {formatData.prefix || 'SJDB_M'}01...</p>
                          <p className="font-bold text-amber-800 break-all">Family: {formatData.familyPrefix || 'SJDB_FAM-'}01...</p>
                        </div>
                        <div className="bg-amber-100/90 p-2.5 rounded-lg border border-amber-400 font-bold text-amber-950 shadow-2xs space-y-1">
                          <span className="text-amber-800 block font-sans text-[10px] font-semibold mb-0.5">New Format Previews:</span>
                          <p className="break-all text-blue-900">Member: {newPrefix.trim() || 'SJDB_M'}{String(1).padStart(Number(newPadLength), '0')}...</p>
                          <p className="break-all text-purple-900">Family: {newFamilyPrefix.trim() || 'SJDB_FAM-'}{String(1).padStart(Number(newFamilyPadLength), '0')}...</p>
                        </div>
                      </div>
                    </div>

                    {/* Member ID Section */}
                    <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-3">
                      <h4 className="font-bold text-xs text-church-royal-blue uppercase tracking-wider">Parish Member ID Configuration</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="church-label text-[11px]">Member ID Prefix *</label>
                          <input
                            value={newPrefix}
                            onChange={e => setNewPrefix(e.target.value.toUpperCase())}
                            className="church-input font-mono font-bold tracking-wider uppercase text-church-royal-blue text-xs"
                            placeholder="e.g. SJDB_M, STJDB_"
                          />
                        </div>
                        <div>
                          <label className="church-label text-[11px]">Number Digits Format *</label>
                          <select
                            value={newPadLength}
                            onChange={e => setNewPadLength(Number(e.target.value))}
                            className="church-select font-mono text-xs"
                          >
                            <option value={2}>2 Digits (01, 02... 99)</option>
                            <option value={3}>3 Digits (001, 002... 999)</option>
                            <option value={4}>4 Digits (0001, 0002... 9999)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Family ID Section */}
                    <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 space-y-3">
                      <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider">Family Member ID Configuration</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="church-label text-[11px]">Family ID Prefix *</label>
                          <input
                            value={newFamilyPrefix}
                            onChange={e => setNewFamilyPrefix(e.target.value.toUpperCase())}
                            className="church-input font-mono font-bold tracking-wider uppercase text-purple-900 text-xs"
                            placeholder="e.g. SJDB_FAM-, FAM-"
                          />
                        </div>
                        <div>
                          <label className="church-label text-[11px]">Number Digits Format *</label>
                          <select
                            value={newFamilyPadLength}
                            onChange={e => setNewFamilyPadLength(Number(e.target.value))}
                            className="church-select font-mono text-xs"
                          >
                            <option value={2}>2 Digits (01, 02... 99)</option>
                            <option value={3}>3 Digits (001, 002... 999)</option>
                            <option value={4}>4 Digits (0001, 0002... 9999)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-start gap-2">
                      <span>
                        <strong>Note:</strong> Saving will immediately re-generate and re-assign both <strong>Parish Member IDs</strong> and <strong>Family IDs</strong> for all {total} existing members in sequential order of registration date, and apply this format to all new registrations.
                      </span>
                    </div>
                  </div>

                  {/* Fixed Footer */}
                  <div className="p-4 sm:px-6 bg-gray-50/70 border-t border-gray-100 flex gap-3 flex-shrink-0">
                    <button type="button" onClick={() => setShowFormatModal(false)} className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">
                      Cancel
                    </button>
                    <button type="submit" disabled={isUpdatingFormat} className="btn-gold flex-1 justify-center py-2.5 text-xs font-bold shadow-gold cursor-pointer">
                      {isUpdatingFormat ? 'Regenerating IDs...' : 'Apply Format to All Users'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Member QR Scan & Profile Lookup Modal */}
      <AnimatePresence>
        {showScanModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative border border-church-gold/20"
            >
              <button
                onClick={() => setShowScanModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FiX className="text-xl" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                  <FiMaximize />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-church-royal-blue">Member QR Scan & Profile Lookup</h2>
                  <p className="text-gray-500 text-xs">Scan a member's PDF report QR code or enter Member ID / Phone / Email</p>
                </div>
              </div>

              {/* Search / Scan Input */}
              <div className="space-y-3 mb-6">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Scan QR Code Text or Enter Member ID / Phone / Email
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={scanCodeInput}
                      onChange={e => setScanCodeInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleScanLookup()}
                      placeholder="Scan QR text, or enter SJDB_M03 / User ID..."
                      className="church-input pl-10 pr-4 py-2.5 text-xs sm:text-sm w-full font-mono"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => handleScanLookup()}
                    disabled={isScanning}
                    className="btn-gold px-5 py-2.5 text-xs font-bold flex items-center gap-2 shadow-gold whitespace-nowrap"
                  >
                    {isScanning ? <FiLoader className="animate-spin" /> : <FiSearch />}
                    {isScanning ? 'Searching...' : 'Scan / Lookup'}
                  </button>
                </div>
              </div>

              {/* Scanned Result Text & Download PDF Card */}
              {scannedUserResult ? (
                <div className="space-y-5 border-t border-gray-100 pt-5">
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-xs leading-relaxed space-y-2 border border-slate-700 shadow-inner">
                    <div className="text-amber-400 font-bold text-sm pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span>ST. JOHN DE BRITTO'S CHURCH</span>
                      <span className="bg-amber-400/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-sans">
                        {scannedUserResult.statusText}
                      </span>
                    </div>
                    <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                      <p><span className="text-slate-400 font-sans">Full Name:</span> <strong className="text-white">{scannedUserResult.name}</strong></p>
                      <p><span className="text-slate-400 font-sans">Member ID:</span> <strong className="text-amber-300 font-mono">{scannedUserResult.parishMemberId}</strong></p>
                      <p><span className="text-slate-400 font-sans">Phone:</span> {scannedUserResult.phone}</p>
                      <p><span className="text-slate-400 font-sans">Email:</span> {scannedUserResult.email}</p>
                      <p><span className="text-slate-400 font-sans">Date of Birth:</span> {scannedUserResult.dob}</p>
                      <p><span className="text-slate-400 font-sans">Gender:</span> {scannedUserResult.gender}</p>
                      <p><span className="text-slate-400 font-sans">Role:</span> {scannedUserResult.role}</p>
                      <p><span className="text-slate-400 font-sans">Last Login:</span> {scannedUserResult.lastLogin}</p>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-sans">
                      <p> Address: {scannedUserResult.address}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => downloadUserPdf(scannedUserResult._id, scannedUserResult.name)}
                      className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <FiFileText className="text-lg" /> Download Member PDF Report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <FiMaximize className="text-4xl text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">No member scanned yet</p>
                  <p className="text-[11px] text-gray-400 mt-1">Scan a printed report QR code with your scanner, or type a Member ID above to display text details and download PDF</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={() => {
          fetchUsers();
        }}
      />

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => !isDeleting && setUserToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 w-full max-w-[420px] text-center shadow-2xl relative border border-gray-100"
            >
              {/* Circular Red Trash/Alert Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border-4 border-red-100 shadow-sm">
                <FiTrash2 className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" />
              </div>

              {/* Title */}
              <h2 className="font-serif text-2xl sm:text-[24px] font-bold text-church-royal-blue tracking-wide mb-2">
                Delete User Permanently?
              </h2>

              {/* Description */}
              <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-4 px-2">
                Are you sure you want to permanently delete{' '}
                <strong className="text-gray-900 font-semibold">{userToDelete.name}</strong>?
              </p>

              {/* Target User Info Summary Card */}
              <div className="bg-gray-50 rounded-2xl p-3.5 mb-4 text-left border border-gray-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Member ID:</span>
                  <span className="font-mono font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                    {userToDelete.parishMemberId || 'N/A'}
                  </span>
                </div>
                {userToDelete.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Email:</span>
                    <span className="text-gray-700 font-semibold truncate max-w-[200px]">{userToDelete.email}</span>
                  </div>
                )}
                {userToDelete.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Phone:</span>
                    <span className="text-gray-700 font-semibold">{userToDelete.phone}</span>
                  </div>
                )}
                {userToDelete.role && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Role:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      userToDelete.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {userToDelete.role}
                    </span>
                  </div>
                )}
              </div>

              {/* Warning box */}
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 mb-6 text-[11px] text-red-700 font-medium leading-normal text-left flex items-start gap-2">
                <FiAlertTriangle className="text-red-600 flex-shrink-0 mt-0.5 text-sm" />
                <span>This action cannot be undone. All records, sacraments, and account access for this user will be removed permanently.</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3.5 w-full">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setUserToDelete(null)}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDeleteUser}
                  className="w-full py-3 sm:py-3.5 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md active:scale-95 text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <FiLoader className="animate-spin text-sm" /> Deleting...
                    </>
                  ) : (
                    <>
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MESSAGE USER MODAL */}
      {messageUser && (
        <MessageUserModal
          user={messageUser}
          onClose={() => setMessageUser(null)}
          onMessageSent={() => fetchUsers()}
        />
      )}
    </div>
  );
}
