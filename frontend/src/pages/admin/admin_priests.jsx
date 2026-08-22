import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit, FiX } from 'react-icons/fi';
import { GiChurch } from 'react-icons/gi';
import api, { getMediaUrl } from '../../services/api';
import { SectionLoader } from '../../components/common/common_loader';

export default function AdminPriests() {
  const [priests, setPriests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    api.get('/priests')
      .then(r => setPriests(r.data.priests || []))
      .finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setPreviewUrl(null);
    setIsPhotoRemoved(false);
    reset();
    setModal(true);
  };

  const openEdit = (priest) => {
    setEditing(priest);
    setPreviewUrl(null);
    setIsPhotoRemoved(false);
    reset();
    Object.entries(priest).forEach(([k, v]) => {
      if (k === 'startDate' || k === 'endDate') {
        if (v) {
          try {
            const d = new Date(v);
            if (!isNaN(d.getTime())) {
              setValue(k, d.toISOString().split('T')[0]);
              return;
            }
          } catch (e) { }
        }
        setValue(k, '');
      } else {
        setValue(k, v);
      }
    });
    setModal(true);
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (k !== 'photoFile' && k !== 'photo' && v !== undefined && v !== null && v !== '') {
          formData.append(k, v);
        }
      });

      if (isPhotoRemoved && !data.photoFile?.[0]) {
        formData.append('removePhoto', 'true');
      } else if (data.photoFile?.[0]) {
        formData.append('photo', data.photoFile[0]);
      }

      if (editing) {
        const res = await api.put(`/priests/${editing._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPriests(prev => prev.map(p => p._id === editing._id ? res.data.priest : p));
        toast.success('Priest updated successfully');
      } else {
        const res = await api.post('/priests', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setPriests(prev => [res.data.priest, ...prev]);
        toast.success('Priest added successfully');
      }
      setModal(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save priest');
    }
  };

  const deletePriest = async (id) => {
    if (!confirm('Delete this priest?')) return;
    try {
      await api.delete(`/priests/${id}`);
      setPriests(prev => prev.filter(p => p._id !== id));
      toast.success('Priest deleted');
    } catch (e) {
      toast.error('Failed to delete priest');
    }
  };

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <div className="flex flex-row items-center justify-between gap-3 mb-6">
          <h1 className="font-display text-lg sm:text-2xl font-bold text-church-royal-blue">Manage Priests</h1>
          <button onClick={openAdd} className="btn-gold py-2 sm:py-2 px-3 sm:px-3 shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0">
            <FiPlus className="text-sm sm:text-base shrink-0 text-white" />
            <span className="flex flex-col text-left leading-tight text-[12px] sm:text-xs font-bold text-white">
              <span>Add Priest</span>

            </span>
          </button>
        </div>

        {loading ? <SectionLoader /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {priests.map((p, i) => (
              <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="church-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full bg-church-gradient flex items-center justify-center overflow-hidden flex-shrink-0 border border-gold-400/40">
                    {p.photo ? (
                      <img src={getMediaUrl(p.photo)} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <GiChurch className="text-white text-2xl" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                    <p className="text-church-gold text-xs font-bold">{p.designation}</p>
                    {p.isCurrent && <span className="badge badge-green text-[10px] mt-1 inline-block">Current Priest</span>}
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Edit">
                    <FiEdit />
                  </button>
                  <button onClick={() => deletePriest(p._id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Delete">
                    <FiTrash2 />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                <h2 className="font-display text-xl font-bold text-church-royal-blue">{editing ? 'Edit Priest' : 'Add Priest'}</h2>
                <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="church-label">Name *</label>
                  <input {...register('name', { required: true })} className="church-input" placeholder="Rev. Fr. Name" />
                </div>
                <div>
                  <label className="church-label">Designation *</label>
                  <select {...register('designation', { required: true })} className="church-select">
                    <option value="">Select Designation</option>
                    <option value="Parish Priest">Parish Priest</option>
                    <option value="Assistant Priest">Assistant Priest</option>
                    <option value="Former Parish Priest">Former Parish Priest</option>
                    <option value="Deacon">Deacon</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="church-label">Start Date</label>
                    <input {...register('startDate')} type="date" className="church-input" />
                  </div>
                  <div>
                    <label className="church-label">End Date</label>
                    <input {...register('endDate')} type="date" className="church-input" />
                  </div>
                </div>
                <div>
                  <label className="church-label">Phone</label>
                  <input {...register('phone')} className="church-input" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="church-label">Email</label>
                  <input {...register('email')} type="email" className="church-input" placeholder="priest@sjdb.in" />
                </div>
                <div>
                  <label className="church-label">Biography</label>
                  <textarea {...register('bio')} rows={3} className="church-input resize-none" placeholder="Short description or ministry details..." />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input {...register('isCurrent')} type="checkbox" className="rounded text-church-gold w-4 h-4" />
                  <span className="text-sm text-gray-700 font-semibold">Current priest</span>
                </label>

                {/* Photo Preview & Upload */}
                <div className="border-t border-gray-100 pt-3">
                  <label className="church-label mb-2 block">Photo</label>
                  {(previewUrl || (editing?.photo && !isPhotoRemoved)) && (
                    <div className="mb-3 flex items-center justify-between gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-church-gold shadow-sm flex-shrink-0 bg-church-gradient flex items-center justify-center">
                          <img
                            src={previewUrl || getMediaUrl(editing?.photo)}
                            alt="Priest Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">
                            {previewUrl ? 'New Photo Selected' : 'Existing Priest Photo'}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {previewUrl ? 'This photo will replace the existing one' : 'Leave empty to keep existing photo'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPhotoRemoved(true);
                          setPreviewUrl(null);
                          setValue('photoFile', null);
                        }}
                        className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-100 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold transition-all flex-shrink-0"
                        title="Remove Photo"
                      >
                        <FiTrash2 size={12} /> Remove
                      </button>
                    </div>
                  )}

                  {isPhotoRemoved && !previewUrl && (
                    <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">
                       Photo will be removed upon saving unless a new photo is selected below.
                    </div>
                  )}

                  <input
                    {...register('photoFile')}
                    type="file"
                    accept="image/*"
                    className="church-input"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                        setIsPhotoRemoved(false);
                      }
                    }}
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-gold w-full justify-center py-3 mt-4 text-sm font-bold shadow-md">
                  {isSubmitting ? 'Saving...' : editing ? 'Update Priest' : 'Add Priest'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
