import AdminCRUD from '../../components/admin/admin_crud';
export default function AdminAnnouncements() {
  return <AdminCRUD resource="announcements" title="Announcements" fields={[
    { name: 'title', label: 'Title', required: true },
    { name: 'content', label: 'Content', type: 'textarea', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['general','feast','funeral','marriage','emergency','meeting'], defaultValue: 'general' },
    { name: 'priority', label: 'Priority', type: 'select', options: ['low','medium','high','urgent'], defaultValue: 'medium' },
    { name: 'expiresAt', label: 'Expires At', type: 'date' },
    { name: 'isPublished', label: 'Published', type: 'checkbox', defaultValue: true },
  ]} />;
}
