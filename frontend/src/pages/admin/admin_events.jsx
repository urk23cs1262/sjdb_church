import AdminCRUD from '../../components/admin/admin_crud';
import AdminRegistrations from './admin_registrations';

export default function AdminEvents() {
  return (
    <div className="w-full flex flex-col pb-10">
      <AdminCRUD resource="events" title="Events" fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'time', label: 'Time', placeholder: '6:00 AM' },
        { name: 'venue', label: 'Venue' },
        { name: 'organizer', label: 'Organizer' },
        { name: 'category', label: 'Category', type: 'select', options: ['feast','mass','meeting','youth','choir','catechism','community','other'] },
        { name: 'isFeatured', label: 'Featured Event', type: 'checkbox' },
        { name: 'registrationRequired', label: 'Requires Registration', type: 'checkbox' },
      ]} />
      <div className="mt-8 border-t border-gray-200 pt-8 w-full">
         <AdminRegistrations />
      </div>
    </div>
  );
}
