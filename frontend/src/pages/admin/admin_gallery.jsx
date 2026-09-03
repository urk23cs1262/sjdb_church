import { useState } from 'react';
import toast from 'react-hot-toast';
import AdminCRUD from '../../components/admin/admin_crud';
import api from '../../services/api';

export default function AdminGallery() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDeleteAll = async (category) => {
    try {
      const catParam = category && category !== 'all' ? `?category=${category}` : '';
      const res = await api.delete(`/gallery/all${catParam}`);
      toast.success(res.data.message || 'All gallery items deleted permanently!');
      setRefreshKey(prev => prev + 1);
    } catch {
      toast.error('Failed to delete gallery items');
    }
  };

  return (
    <AdminCRUD
      key={refreshKey}
      resource="gallery"
      title="Gallery"
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'category', label: 'Category', type: 'select', options: ['church', 'feast', 'events', 'priests', 'community', 'other'] },
        { name: 'album', label: 'Album Name' },
        { name: 'isPublished', label: 'Published', type: 'checkbox' },
      ]}
      hasImage
      categories={['all', 'church', 'feast', 'events', 'priests', 'community', 'other']}
      onDeleteAll={handleDeleteAll}
    />
  );
}
