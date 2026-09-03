import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit, FiX } from 'react-icons/fi';

import api, { UPLOADS_URL, getMediaUrl } from '../../services/api';
import { SectionLoader } from '../common/common_loader';

export default function AdminCRUD({ resource, title, fields, hasImage, categories, onDeleteAll }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isImageRemoved, setIsImageRemoved] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [generatingAi, setGeneratingAi] = useState({});
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm();

  const getSingularTitle = (t) => {
    if (t === 'Gallery' || t === 'Gallery Item') return 'Gallery Item';
    if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
    if (t.endsWith('s')) return t.slice(0, -1);
    return t;
  };
  const singularTitle = getSingularTitle(title);
  const pluralTitle = title === 'Gallery Item' ? 'Gallery' : title;

  const handleAiGenerate = async (fieldName) => {
    const currentValues = watch();
    const titleVal = currentValues.title || currentValues.subject || currentValues.name || '';
    if (!titleVal || !titleVal.trim()) {
      toast.error('Please enter a Title or Name first so AI can generate content!');
      return;
    }

    setGeneratingAi(prev => ({ ...prev, [fieldName]: true }));
    try {
      const res = await api.post('/ai/generate-content', {
        type: resource,
        title: titleVal,
        field: fieldName,
        category: currentValues.category || '',
        album: currentValues.album || '',
        venue: currentValues.venue || currentValues.churchLocation || '',
        role: currentValues.role || '',
        date: currentValues.date || currentValues.eventDate || '',
        time: currentValues.time || currentValues.eventTime || '',
        organizer: currentValues.organizer || '',
        priority: currentValues.priority || '',
        expiresAt: currentValues.expiresAt || '',
        registrationRequired: currentValues.registrationRequired || currentValues.requiresRegistration || false
      });
      if (res.data?.text) {
        setValue(fieldName, res.data.text);
        toast.success(`Generated ${singularTitle} ${fieldName} with AI!`);
      }
    } catch {
      toast.error('Failed to generate AI content');
    } finally {
      setGeneratingAi(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const catQuery = selectedCategory && selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
      const adminParam = '&admin=true&all=true';
      const res = await api.get(`/${resource}?page=${page}&limit=20${catQuery}${adminParam}`);
      setItems(res.data[Object.keys(res.data).find(k => Array.isArray(res.data[k]))] || []);
      setTotal(res.data.total !== undefined ? res.data.total : (res.data[Object.keys(res.data).find(k => Array.isArray(res.data[k]))]?.length || 0));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, [page, resource, selectedCategory]);

  const openAdd = () => {
    setEditing(null);
    setImagePreview(null);
    setIsImageRemoved(false);
    const defaultVals = {};
    fields.forEach(f => {
      if (f.defaultValue !== undefined) defaultVals[f.name] = f.defaultValue;
    });
    reset(defaultVals);
    setModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setImagePreview(item.imageUrl || item.photo || item.image || null);
    setIsImageRemoved(false);
    fields.forEach(f => setValue(f.name, item[f.name]));
    setModal(true);
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (k === 'imageFile' && v?.[0]) formData.append('image', v[0]);
        else if (v !== undefined && v !== '') formData.append(k, v);
      });
      if (isImageRemoved && !data.imageFile?.[0]) {
        formData.append('removeImage', 'true');
      }
      const config = hasImage ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
      if (editing) {
        await api.put(`/${resource}/${editing._id}`, hasImage ? formData : data, config);
        toast.success(`${singularTitle} updated`);
      } else {
        await api.post(`/${resource}`, hasImage ? formData : data, config);
        toast.success(`${singularTitle} added`);
      }
      setModal(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/${resource}/${id}`);
      setItems(prev => prev.filter(i => i._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed');
    }
  };

  const displayValue = (item) => item.title || item.name || item.subject || item._id;

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6">
        <div className="flex flex-row items-center justify-between gap-2 mb-6">
          <h1 className="font-display text-sm sm:text-2xl font-bold text-church-royal-blue uppercase tracking-tight">
            Manage {title} <span className="normal-case opacity-75">({total})</span>
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {onDeleteAll && items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to permanently delete all ${selectedCategory !== 'all' ? selectedCategory : ''} ${title.toLowerCase()} items?`)) {
                    onDeleteAll(selectedCategory);
                  }
                }}
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <FiTrash2 className="text-xs sm:text-base" /> <span className="hidden sm:inline">Delete All</span>
              </button>
            )}
            <button 
              onClick={openAdd} 
              className="btn-gold py-1.5 sm:py-2 px-3 sm:px-4 shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <FiPlus className="text-[16px] sm:text-base shrink-0 text-white" />
              {singularTitle.length > 7 ? (
                <span className="flex flex-col text-left leading-tight text-[13px] sm:text-xs font-bold">
                  <span>Add</span>
                  <span>{singularTitle}</span>
                </span>
              ) : (
                <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Add {singularTitle}</span>
              )}
            </button>
          </div>
        </div>

        {categories && categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-church-gold text-white shadow-gold'
                    : 'bg-white text-gray-600 hover:bg-gold-50 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? <SectionLoader /> : (
          <>
            <div className="glass-card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                    <th className="text-left py-3 px-4">Item</th>
                    {fields.slice(0, 2).filter(f => !['checkbox'].includes(f.type)).map(f => (
                      <th key={f.name} className="text-left py-3 px-4">{f.label}</th>
                    ))}
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <motion.tr key={item._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-gray-50 hover:bg-gold-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {(hasImage && (item.imageUrl || item.photo || item.image)) && (
                            <img 
                              src={(item.imageUrl || item.photo || item.image).startsWith('http') 
                                ? (item.imageUrl || item.photo || item.image) 
                                : `${UPLOADS_URL.replace('/uploads', '')}${(item.imageUrl || item.photo || item.image).startsWith('/') ? '' : '/'}${item.imageUrl || item.photo || item.image}`
                              } 
                              alt="" 
                              className="w-10 h-10 rounded-lg object-cover" 
                            />
                          )}
                          <p className="font-semibold text-gray-800 text-sm truncate max-w-xs">{displayValue(item)}</p>
                        </div>
                      </td>
                      {fields.slice(0, 2).filter(f => !['checkbox'].includes(f.type)).map(f => (
                        <td key={f.name} className="py-3 px-4 text-sm text-gray-500 truncate max-w-[180px]">
                          {f.type === 'date' ? (item[f.name] ? new Date(item[f.name]).toLocaleDateString() : '—') : item[f.name] || '—'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><FiEdit /></button>
                          <button onClick={() => deleteItem(item._id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"><FiTrash2 /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <p className="text-center py-10 text-gray-400">No {title.toLowerCase()} found</p>}

              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 ">
                <p className="text-sm text-gray-500">Showing {items.length} of {total}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">← Prev</button>
                  <button disabled={items.length < 20} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">Next →</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setModal(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] shadow-2xl relative my-auto flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-display text-xl font-bold text-church-royal-blue">{editing ? `Edit ${singularTitle}` : `Add ${singularTitle}`}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                {fields.map(f => (
                  <div key={f.name}>
                    {f.type !== 'checkbox' && (
                      <div className="flex items-center justify-between mb-1">
                        <label className="church-label mb-0">{f.label}{f.required && ' *'}</label>
                        {f.type === 'textarea' && (
                          <button
                            type="button"
                            onClick={() => handleAiGenerate(f.name)}
                            disabled={generatingAi[f.name]}
                            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full transition-all shadow-xs cursor-pointer"
                          >
                            {generatingAi[f.name] ? 'AI Writing...' : 'Fill with AI'}
                          </button>
                        )}
                      </div>
                    )}
                    {f.type === 'textarea' ? (
                      <textarea {...register(f.name, { required: f.required })} rows={4} className="church-input resize-none" placeholder={f.placeholder || `Enter ${f.label.toLowerCase()} or click 'Fill with AI'`} />
                    ) : f.type === 'select' ? (
                      <select {...register(f.name)} className="church-select">
                        <option value="">Select {f.label.toLowerCase()}</option>
                        {f.options?.map(o => <option key={o} value={o} className="capitalize">{o.replace('_', ' ')}</option>)}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input {...register(f.name)} type="checkbox" className="rounded text-church-gold" />
                        <span className="text-sm text-gray-600 ">{f.label}</span>
                      </label>
                    ) : (
                      <input {...register(f.name, { required: f.required })} type={f.type || 'text'} className="church-input" placeholder={f.placeholder} />
                    )}
                  </div>
                ))}
                {hasImage && (
                  <div className="border-t border-gray-100 pt-3">
                    <label className="church-label mb-2 block">Image</label>
                    {(imagePreview || (editing?.image && !isImageRemoved)) && (
                      <div className="mb-3 flex items-center justify-between gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3">
                          <img
                            src={imagePreview || getMediaUrl(editing?.image)}
                            alt="Preview"
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                          />
                          <div>
                            <p className="text-xs font-bold text-gray-700">
                              {imagePreview?.startsWith('blob:') ? 'New Image Selected' : 'Existing Image'}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {imagePreview?.startsWith('blob:') ? 'Will replace existing image' : 'Leave empty to keep existing image'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsImageRemoved(true);
                            setImagePreview(null);
                            setValue('imageFile', null);
                          }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-100 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold transition-all flex-shrink-0"
                          title="Remove Image"
                        >
                          <FiTrash2 size={12} /> Remove
                        </button>
                      </div>
                    )}

                    {isImageRemoved && !imagePreview && (
                      <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">
                         Image will be removed upon saving unless a new image is selected below.
                      </div>
                    )}

                    <input
                      {...register('imageFile')}
                      type="file"
                      accept="image/*"
                      className="church-input"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          setImagePreview(URL.createObjectURL(e.target.files[0]));
                          setIsImageRemoved(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex gap-3">
                <button type="button" onClick={() => setModal(false)} className="btn-ghost flex-1 justify-center py-2.5 text-xs font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-gold flex-1 justify-center py-2.5 text-xs font-bold shadow-gold cursor-pointer">
                  {isSubmitting ? 'Saving...' : editing ? `Update ${singularTitle}` : `Add ${singularTitle}`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
