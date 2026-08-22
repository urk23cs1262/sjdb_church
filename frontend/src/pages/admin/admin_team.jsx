import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiArrowUp, FiArrowDown,
  FiSearch, FiX, FiCheck, FiUser, FiMail, FiPhone, FiTag, FiImage, FiSliders, FiRefreshCw
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';
import { useForm } from 'react-hook-form';

const DEPARTMENTS = [
  'Leadership',
  'Administration',
  'Parish Council',
  'Catechism',
  'Youth Ministry',
  'Altar Servers',
  'Choir Team',
  'Society of St. Vincent de Paul (SSVP)',
  'Website Technical Team',
  'Volunteers'
];

const DEPARTMENT_POSITIONS = {
  'Catechism': [
    'Catechism Coordinator',
    'Assistant Catechism Coordinator',
    'Parish Priest (Spiritual Director)',
    'Assistant Priest',
    'Pre-Communion Teacher',
    'First Holy Communion Teacher',
    'Confirmation Teacher',
    'Class I Catechism Teacher',
    'Class II Catechism Teacher',
    'Class III Catechism Teacher',
    'Class IV Catechism Teacher',
    'Class V Catechism Teacher',
    'Class VI Catechism Teacher',
    'Class VII Catechism Teacher',
    'Class VIII Catechism Teacher',
    'Class IX Catechism Teacher',
    'Class X Catechism Teacher',
    'Class XI Catechism Teacher',
    'Class XII Catechism Teacher',
    'Attendance Coordinator',
    'Examination Coordinator',
    'Event Coordinator',
    'Retreat Coordinator',
    'Sacrament Preparation Coordinator',
    'Parent Coordinator',
    'Librarian',
    'Office Assistant',
    'Volunteer Catechist'
  ],
  'Website Technical Team': [
    'Technical Coordinator',
    'Website Administrator',
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'UI/UX Designer',
    'Database Administrator',
    'DevOps / Server Administrator',
    'Mobile App Developer',
    'Graphic Designer',
    'Content Manager',
    'Technical Support',
    'Digital Media Coordinator'
  ],
  'Leadership': [
    'Parish Priest',
    'Assistant Parish Priest',
    'Parish Administrator',
    'Spiritual Director',
    'Parish Vicar'
  ],
  'Administration': [
    'Parish Secretary',
    'Office Manager',
    'Accountant',
    'Records Officer',
    'Receptionist'
  ],
  'Parish Council': [
    'Parish Council President',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Ward Representative',
    'Executive Member'
  ],
  'Choir Team': [
    'Choir Director',
    'Lead Vocalist',
    'Parish Organist & Keyboardist',
    'Lead Guitarist',
    'Violinist',
    'Chorister'
  ],
  'Society of St. Vincent de Paul (SSVP)': [
    'Thalaivar (President / தலைவர்)',
    'Vice President',
    'Secretary',
    'Treasurer',
    'Active Member'
  ]
};

export default function TeamAdmin() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('All');
  const [search, setSearch] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm();

  const currentDeptValue = watch('department') || '';
  const [deptSelected, setDeptSelected] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/team/admin');
      setMembers(res.data.members || []);
    } catch (err) {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    setPhotoFile(null);
    setPhotoPreview('');
    reset({
      name: '',
      role: '',
      department: '',
      subGroup: '',
      assignedClass: '',
      qualification: '',
      yearsOfService: '',
      badge: '',
      description: '',
      email: '',
      phone: '',
      order: members.length + 1,
      isActive: true,
      facebook: '',
      instagram: '',
      linkedin: ''
    });
    setDeptSelected(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setPhotoFile(null);
    setPhotoPreview(member.image ? getMediaUrl(member.image) : '');
    reset({
      name: member.name || '',
      role: member.role || '',
      department: member.department || 'Leadership',
      subGroup: member.subGroup || '',
      assignedClass: member.assignedClass || '',
      qualification: member.qualification || '',
      yearsOfService: member.yearsOfService || '',
      badge: member.badge || '',
      description: member.description || '',
      email: member.email || '',
      phone: member.phone || '',
      order: member.order || 1,
      isActive: member.isActive !== false,
      facebook: member.socialLinks?.facebook || '',
      instagram: member.socialLinks?.instagram || '',
      linkedin: member.socialLinks?.linkedin || ''
    });
    setDeptSelected(true); // editing — dept already set, show all fields
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingMember(null);
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('role', data.role);
    formData.append('department', data.department);
    formData.append('subGroup', data.subGroup || '');
    formData.append('assignedClass', data.assignedClass || '');
    formData.append('qualification', data.qualification || '');
    formData.append('yearsOfService', data.yearsOfService || '');
    formData.append('badge', data.badge || '');
    formData.append('description', data.description || '');
    formData.append('email', data.email || '');
    formData.append('phone', data.phone || '');
    formData.append('order', data.order || 1);
    formData.append('isActive', data.isActive);

    const socialLinks = {
      facebook: data.facebook || '',
      instagram: data.instagram || '',
      linkedin: data.linkedin || ''
    };
    formData.append('socialLinks', JSON.stringify(socialLinks));

    if (photoFile) {
      formData.append('photo', photoFile);
    }

    try {
      if (editingMember) {
        await api.put(`/team/${editingMember._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Team member updated successfully');
      } else {
        await api.post('/team', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Team member added successfully');
      }
      closeModal();
      fetchMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save team member');
    }
  };

  const toggleActive = async (member) => {
    try {
      const res = await api.put(`/team/${member._id}/toggle`);
      setMembers(prev => prev.map(m => m._id === member._id ? { ...m, isActive: res.data.member.isActive } : m));
      toast.success(`Member ${res.data.member.isActive ? 'activated' : 'hidden'}`);
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const deleteMember = async (id) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    try {
      await api.delete(`/team/${id}`);
      setMembers(prev => prev.filter(m => m._id !== id));
      toast.success('Team member deleted');
    } catch {
      toast.error('Failed to delete member');
    }
  };

  const deleteAllMembers = async () => {
    if (!window.confirm(` ARE YOU SURE? This will permanently delete ALL ${members.length} team members!`)) return;
    try {
      const res = await api.delete('/team/all/members');
      setMembers([]);
      toast.success(res.data.message || 'All team members deleted');
    } catch {
      toast.error('Failed to delete all members');
    }
  };

  const deleteCategoryMembers = async (dept) => {
    const deptMembersCount = members.filter(m => m.department === dept).length;
    if (!window.confirm(`Are you sure you want to delete all ${deptMembersCount} member(s) in "${dept}"?`)) return;
    try {
      const res = await api.delete(`/team/category/${encodeURIComponent(dept)}`);
      setMembers(prev => prev.filter(m => m.department !== dept));
      toast.success(res.data.message || `Deleted members in ${dept}`);
    } catch {
      toast.error('Failed to delete category members');
    }
  };

  const moveMember = async (index, direction) => {
    const newMembers = [...members];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newMembers.length) return;

    const temp = newMembers[index];
    newMembers[index] = newMembers[targetIndex];
    newMembers[targetIndex] = temp;

    const items = newMembers.map((m, idx) => ({ id: m._id, order: idx + 1 }));
    setMembers(newMembers.map((m, idx) => ({ ...m, order: idx + 1 })));

    try {
      await api.post('/team/reorder', { items });
      toast.success('Display order updated');
    } catch {
      toast.error('Failed to update order');
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesDept = selectedDept === 'All' || m.department === selectedDept;
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      m.department.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const positionsForSelectedDept = DEPARTMENT_POSITIONS[currentDeptValue] || [
    'Coordinator', 'Member', 'Leader', 'Assistant', 'Volunteer'
  ];

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-church-royal-blue">
            MANAGE TEAM MEMBERS ({members.length})
          </h1>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {members.length > 0 && (
              <button
                type="button"
                onClick={deleteAllMembers}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FiTrash2 className="text-base" /> Delete All Members
              </button>
            )}
            <button
              onClick={openAddModal}
              className="btn-gold text-xs sm:text-sm py-2 px-4 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FiPlus className="text-sm sm:text-base shrink-0 text-amber-900" />
              <span className="flex flex-col text-left leading-tight text-[10px] sm:text-xs font-bold">
                <span>Add</span>
                <span>Team Member</span>
              </span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDept('All')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${selectedDept === 'All'
              ? 'bg-church-gold text-white shadow-gold'
              : 'bg-white text-gray-600 hover:bg-gold-50 border border-gray-200'
              }`}
          >
            All ({members.length})
          </button>
          {DEPARTMENTS.map(dept => {
            const count = members.filter(m => m.department === dept).length;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${selectedDept === dept
                  ? 'bg-church-gold text-white shadow-gold'
                  : 'bg-white text-gray-600 hover:bg-gold-50 border border-gray-200'
                  }`}
              >
                {dept} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Members Table */}
        {loading ? (
          <SectionLoader />
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                  <th className="text-left py-3 px-4">Order</th>
                  <th className="text-left py-3 px-4">Member Info</th>
                  <th className="text-left py-3 px-4">Department & Sub-Group</th>
                  <th className="text-left py-3 px-4">Contact</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, idx) => (
                  <tr key={m._id} className="border-b border-gray-50 hover:bg-gold-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-bold text-gray-500">
                        <span>#{m.order || idx + 1}</span>
                        <div className="flex flex-col">
                          <button onClick={() => moveMember(idx, -1)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-church-gold disabled:opacity-30 cursor-pointer"><FiArrowUp size={12} /></button>
                          <button onClick={() => moveMember(idx, 1)} disabled={idx === filteredMembers.length - 1} className="p-0.5 text-gray-400 hover:text-church-gold disabled:opacity-30 cursor-pointer"><FiArrowDown size={12} /></button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-church-royal-blue text-white font-bold flex items-center justify-center flex-shrink-0 border border-church-gold/40">
                          {m.image ? (
                            <img src={getMediaUrl(m.image)} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.name?.[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{m.name}</p>
                          <p className="text-church-gold text-xs font-semibold">{m.role}</p>
                          {(m.assignedClass || m.qualification) && (
                            <p className="text-[10px] text-gray-500">{m.assignedClass} {m.qualification ? `(${m.qualification})` : ''}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 font-bold text-[10px] rounded-md uppercase">
                          {m.department}
                        </span>
                        {m.subGroup && (
                          <span className="block text-[10px] font-semibold text-gray-600">
                             {m.subGroup}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 space-y-0.5">
                      {m.email && <div className="flex items-center gap-1"><FiMail className="text-gray-400" /> {m.email}</div>}
                      {m.phone && <div className="flex items-center gap-1"><FiPhone className="text-gray-400" /> {m.phone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleActive(m)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${m.isActive
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-500 border border-gray-300'
                          }`}
                      >
                        {m.isActive ? <FiEye size={12} /> : <FiEyeOff size={12} />}
                        <span>{m.isActive ? 'Active' : 'Hidden'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(m)} className="text-blue-600 hover:text-blue-800 p-1 cursor-pointer"><FiEdit2 size={16} /></button>
                        <button onClick={() => deleteMember(m._id)} className="text-red-600 hover:text-red-800 p-1 cursor-pointer"><FiTrash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Team Member Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={closeModal}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-church-royal-blue">
                    {editingMember ? 'Edit Team Member' : 'Add New Team Member'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure profile, contact, role and department according to the selected category
                  </p>
                </div>
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"><FiX size={20} /></button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs sm:text-sm">

                {/* ── Department selector — always visible ─────────────── */}
                <div>
                  <label className="church-label">Department *</label>
                  <select
                    {...register('department', { required: true })}
                    className="church-select"
                    onChange={e => {
                      setValue('department', e.target.value);
                      setDeptSelected(Boolean(e.target.value));
                    }}
                  >
                    {!deptSelected && <option value="">— Select a Department —</option>}
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {!deptSelected && (
                    <p className="text-xs text-amber-700 mt-1.5 font-medium"> Select a department to continue filling in the details.</p>
                  )}
                </div>

                {/* ── All other fields — shown only after dept is chosen ── */}
                <AnimatePresence>
                  {deptSelected && (
                    <motion.div
                      key="rest-of-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div>
                          <label className="church-label">Sub-Group / Team Section</label>
                          <select {...register('subGroup')} className="church-select">
                            <option value="">Standard Group</option>
                            {currentDeptValue === 'Catechism' ? (
                              <>
                                <option value="Leadership"> Leadership (Coordinators / Priests)</option>
                                <option value="Teachers"> Teachers (Class &amp; Sacrament Teachers)</option>
                                <option value="Support Team"> Support Team (Attendance, Exams, Retreats)</option>
                              </>
                            ) : currentDeptValue === 'Website Technical Team' ? (
                              <>
                                <option value="Development"> Full Stack / Backend / Frontend</option>
                                <option value="UI/UX Design"> UI/UX &amp; Graphic Design</option>
                                <option value="Infrastructure"> DevOps &amp; Server Security</option>
                                <option value="Content &amp; Support"> Content &amp; Digital Media</option>
                              </>
                            ) : currentDeptValue === 'Parish Council' ? (
                              <>
                                <option value="Executive Officers"> Executive Officers</option>
                                <option value="Committee Chairs"> Committee Chairs</option>
                                <option value="Ward Representatives"> Ward Representatives</option>
                              </>
                            ) : (
                              <>
                                <option value="Leadership"> Leadership</option>
                                <option value="Core Team"> Core Team</option>
                                <option value="Volunteers"> Volunteers</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="church-label">Full Name *</label>
                          <input {...register('name', { required: 'Name is required' })} className="church-input" placeholder="e.g. Antony Raj / Rev. Fr. John" />
                        </div>

                        <div>
                          <label className="church-label">Role / Title *</label>
                          <input {...register('role', { required: 'Role is required' })} list="positions-list" className="church-input" placeholder={`Select or type ${currentDeptValue} role...`} />
                          <datalist id="positions-list">
                            {positionsForSelectedDept.map(pos => (
                              <option key={pos} value={pos} />
                            ))}
                          </datalist>
                        </div>

                        {/* Department-Specific Dynamic Inputs */}
                        {currentDeptValue === 'Catechism' && (
                          <>
                            <div>
                              <label className="church-label">Assigned Class (Optional)</label>
                              <input {...register('assignedClass')} className="church-input" placeholder="e.g. First Holy Communion, Class V" />
                            </div>

                            <div>
                              <label className="church-label">Qualification (Optional)</label>
                              <input {...register('qualification')} className="church-input" placeholder="e.g. M.A., B.Ed., Diploma in Catechetics" />
                            </div>

                            <div>
                              <label className="church-label">Years of Service (Optional)</label>
                              <input {...register('yearsOfService')} className="church-input" placeholder="e.g. 5 Years" />
                            </div>
                          </>
                        )}

                        {currentDeptValue === 'Website Technical Team' && (
                          <>
                            <div>
                              <label className="church-label">Specialization / Tech Stack (Optional)</label>
                              <input {...register('qualification')} className="church-input" placeholder="e.g. React, Node.js, MongoDB, Figma" />
                            </div>

                            <div>
                              <label className="church-label">Years of Experience (Optional)</label>
                              <input {...register('yearsOfService')} className="church-input" placeholder="e.g. 3 Years" />
                            </div>
                          </>
                        )}

                        {currentDeptValue === 'Choir Team' && (
                          <div>
                            <label className="church-label">Musical Instrument / Voice (Optional)</label>
                            <input {...register('assignedClass')} className="church-input" placeholder="e.g. Pipe Organ, Keyboard, Soprano" />
                          </div>
                        )}

                        <div>
                          <label className="church-label">Badge Label (Optional)</label>
                          <input {...register('badge')} className="church-input" placeholder="e.g. Parish Priest, Coordinator" />
                        </div>

                        <div>
                          <label className="church-label">Email Address</label>
                          <input type="email" {...register('email')} className="church-input" placeholder="e.g. email@sjdbchurch.org" />
                        </div>

                        <div>
                          <label className="church-label">Phone Number</label>
                          <input {...register('phone')} className="church-input" placeholder="e.g. +91 98765 43210" />
                        </div>

                        <div>
                          <label className="church-label">Display Order Index</label>
                          <input type="number" {...register('order')} className="church-input" placeholder="1" />
                        </div>

                        <div>
                          <label className="church-label">Visibility Status</label>
                          <select {...register('isActive')} className="church-select">
                            <option value="true">Active (Visible on Website)</option>
                            <option value="false">Hidden (Draft / Internal)</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="church-label">Description / Bio Quote</label>
                          <textarea {...register('description')} rows={3} className="church-input py-2 resize-none" placeholder="Short bio or quote describing responsibilities..." />
                        </div>
                      </div>

                      {/* Photo Preview & File Input */}
                      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-church-royal-blue text-white font-bold flex items-center justify-center flex-shrink-0 border border-church-gold">
                          {photoPreview ? (
                            <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <FiImage size={24} />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="church-label">Profile Photo</label>
                          <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-church-gold file:text-white hover:file:bg-church-gold-light cursor-pointer" />
                        </div>
                      </div>

                      {/* Social Links */}
                      <div className="pt-3 border-t border-gray-100 space-y-3">
                        <p className="font-bold text-gray-700 text-xs flex items-center gap-1.5"><FiSliders /> Social Media Profiles (Optional)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input {...register('facebook')} className="church-input text-xs" placeholder="Facebook URL" />
                          <input {...register('instagram')} className="church-input text-xs" placeholder="Instagram URL" />
                          <input {...register('linkedin')} className="church-input text-xs" placeholder="LinkedIn URL" />
                        </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button type="button" onClick={closeModal} className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="btn-gold flex-1 justify-center py-2.5 text-xs font-bold shadow-gold cursor-pointer">
                          {isSubmitting ? 'Saving...' : (editingMember ? 'Save Changes' : 'Add Team Member')}
                        </button>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Always-visible Cancel when no dept selected yet */}
                {!deptSelected && (
                  <div className="pt-2">
                    <button type="button" onClick={closeModal} className="btn-ghost w-full justify-center py-2.5 text-xs font-bold cursor-pointer">
                      Cancel
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
