// import { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { useForm, useFieldArray } from 'react-hook-form';
// import toast from 'react-hot-toast';
// import { Link } from 'react-router-dom';
// import { FiUser, FiArrowLeft, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi';
// import api, { UPLOADS_URL } from '../../services/api';
// import { useAuth } from '../../context/context_auth_context';

// const SUB_STATIONS = [
// "Kalayarkoil (Main Parish)",
// "Pallithammam",
// "Nedungulam",
// "Kalluvazhy",
// "Natarajapuram",
// "Susaiapparpattinam",
// "Maravamangalam",
// "Other"
// ];

// const FAMILY_ROLES = ['Father', 'Mother', 'Elder Son', 'Younger Son', 'Elder Daughter', 'Younger Daughter', 'Grandfather', 'Grandmother', 'Other'];

// export default function Profile() {
// const { user, fetchMe } = useAuth();
// const { register, handleSubmit, control, setValue, watch, reset, formState: { isSubmitting } } = useForm({
// defaultValues: {
// ...user,
// dob: user?.dob ? new Date(user.dob).toISOString().split('T')[0] : ''
// }
// });

// // Sync form with user data when it loads
// useEffect(() => {
// fetchMe();
// }, []);

// useEffect(() => {
// if (user) {
// reset({
// ...user,
// dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : ''
// });
// }
// }, [user, reset]);

// const { fields, append, remove } = useFieldArray({
// control,
// name: "familyMembers"
// });

// const [photo, setPhoto] = useState(null);
// const watchedFamilyRole = watch('familyRole');
// const watchedMembers = watch('familyMembers');

// const onSubmit = async (data) => {
// try {
// const formData = new FormData();
      
// // Map custom roles if "Other" was selected
// const processedData = {
// ...data,
// familyRole: data.familyRole === 'Other' ? data.familyRoleOther : data.familyRole,
// familyMembers: data.familyMembers?.map(m => ({
// name: m.name,
// role: m.role === 'Other' ? m.roleOther : m.role
// })) || []
// };

// Object.entries(processedData).forEach(([k, v]) => {
// if (k === 'familyMembers') {
// formData.append(k, JSON.stringify(v));
// } else if (v !== undefined && v !== null) {
// formData.append(k, v);
// }
// });
// if (photo) formData.append('photo', photo);

// await api.put('/users/profile', formData, {
// headers: { 'Content-Type': 'multipart/form-data' }
// });
// await fetchMe();
// toast.success('Profile updated successfully!');
// } catch (e) {
// toast.error(e.response?.data?.message || 'Update failed');
// }
// };

// return (
// <div className="min-h-screen pt-24 bg-church-cream ">
// <div className="bg-gray-600 py-10">
// <div className="max-w-4xl mx-auto px-4">
// <Link to="/dashboard" className="text-gold-400 text-sm hover:underline flex items-center gap-1 mb-3">
// <FiArrowLeft /> Back to Dashboard
// </Link>
// <h1 className="font-display text-3xl font-bold text-white">Edit Profile</h1>
// </div>
// </div>

// <div className="max-w-4xl mx-auto px-4 py-10">
// <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
// {/* Main Profile Info */}
// <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="church-card p-8">
// <div className="flex items-center gap-5 mb-8 pb-8 border-b border-gray-100">
// <div className="relative">
// <div className="w-24 h-24 rounded-full bg-church-gradient flex items-center justify-center overflow-hidden shadow-gold">
// {photo ? (
// <img src={URL.createObjectURL(photo)} className="w-full h-full object-cover" />
// ) : user?.profilePhoto ? (
// <img src={user.profilePhoto.startsWith('http') ? user.profilePhoto : `${UPLOADS_URL.replace('/uploads', '')}${user.profilePhoto.startsWith('/') ? '' : '/'}${user.profilePhoto}`} className="w-full h-full object-cover" />
// ) : (
// <FiUser className="text-white text-4xl" />
// )}
// </div>
// <label className="absolute bottom-0 right-0 w-8 h-8 bg-church-gold rounded-full flex items-center justify-center cursor-pointer hover:bg-church-gold-light transition-colors shadow-lg">
// <span className="text-white text-sm"></span>
// <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files[0])} />
// </label>
// </div>
// <div>
// <h2 className="font-display text-2xl font-bold text-church-royal-blue">{user?.name}</h2>
// <p className="text-gray-500 capitalize">{user?.role} • {user?.phone}</p>
// </div>
// </div>

// <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// <div>
// <label className="church-label">Full Name *</label>
// <input {...register('name', { required: true })} className="church-input" />
// </div>
// <div>
// <label className="church-label">Email</label>
// <input {...register('email')} type="email" className="church-input" />
// </div>
// <div>
// <label className="church-label">Date of Birth</label>
// <input {...register('dob')} type="date" className="church-input" />
// </div>
// <div>
// <label className="church-label">Gender</label>
// <select {...register('gender')} className="church-select">
// <option value="">Select</option>
// <option value="male">Male</option>
// <option value="female">Female</option>
// <option value="other">Other</option>
// </select>
// </div>
// <div>
// <label className="church-label">Preferred Language</label>
// <select {...register('preferredLanguage')} className="church-select">
// <option value="en">English</option>
// <option value="ta">தமிழ் (Tamil)</option>
// </select>
// </div>
// <div>
// <label className="church-label">Sub-Station</label>
// <select {...register('subStation')} className="church-select">
// <option value="">Select Sub-station</option>
// {SUB_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
// </select>
// </div>
// <div className="md:col-span-2">
// <label className="church-label">Family Name</label>
// <input {...register('familyName')} className="church-input" placeholder="e.g. Joseph Family" />
// </div>
// <div className="md:col-span-2">
// <label className="church-label">Home Address</label>
// <textarea {...register('address')} rows={3} className="church-input resize-none" />
// </div>
// </div>
// </motion.div>

// {/* Family Members Section */}
// <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="church-card p-8">
// <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
// <div>
// <h3 className="font-display text-xl font-bold text-church-royal-blue">Family Members</h3>
// <p className="text-gray-500 text-sm mt-1">Manage details for other members in your family</p>
// </div>
// <button
// type="button"
// onClick={() => append({ name: '', role: '' })}
// className="btn-gold py-2 px-4 text-sm"
// >
// <FiPlus /> Add Member
// </button>
// </div>

// <div className="mb-8">
// <label className="church-label">Your Role in Family</label>
// <select {...register('familyRole')} className="church-select max-w-md">
// <option value="">Select your role</option>
// {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
// </select>
// {watchedFamilyRole === 'Other' && (
// <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 max-w-md">
// <input {...register('familyRoleOther', { required: true })} className="church-input" placeholder="Please specify your role" />
// </motion.div>
// )}
// </div>

// <div className="space-y-4">
// {fields.map((item, index) => (
// <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-gray-50 p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
// <div className="md:col-span-6">
// <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Member Name</label>
// <input {...register(`familyMembers.${index}.name`, { required: true })} className="church-input py-2.5" placeholder="Full Name" />
// </div>
// <div className="md:col-span-5">
// <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Role</label>
// <select {...register(`familyMembers.${index}.role`, { required: true })} className="church-select py-2.5">
// <option value="">Select Role</option>
// {FAMILY_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
// </select>
// {watchedMembers[index]?.role === 'Other' && (
// <input {...register(`familyMembers.${index}.roleOther`, { required: true })} className="church-input mt-2 py-2 text-sm" placeholder="Specify role" />
// )}
// </div>
// <div className="md:col-span-1 pb-1">
// <button type="button" onClick={() => remove(index)} className="w-full flex justify-center text-red-500 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-xl transition-colors">
// <FiTrash2 className="text-xl" />
// </button>
// </div>
// </div>
// ))}
// {fields.length === 0 && (
// <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
// <p className="text-gray-500">No other family members listed yet.</p>
// {/* <button type="button" onClick={() => append({ name: '', role: '' })} className="text-church-gold font-bold text-sm mt-2 hover:underline">
// + Click here to add a member
// </button> */}
// </div>
// )}
// </div>
// </motion.div>

// <div className="flex justify-end">
// <button type="submit" disabled={isSubmitting} className="btn-gold px-12 py-4 text-lg shadow-gold-lg">
// <FiSave className="text-xl" /> {isSubmitting ? 'Saving Changes...' : 'Save All Changes'}
// </button>
// </div>
// </form>
// </div>
// </div>
// );
// }
