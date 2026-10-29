import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEventForEdit, updateEvent } from '../../api/events';
import { getUsers } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import EventForm from '../../components/events/EventForm';
import toast from 'react-hot-toast';

const EventEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin: authIsAdmin } = useAuth();
  const [event, setEvent] = useState(null);
  const [organisers, setOrganisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Validate ID format
  const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

  useEffect(() => {
    if (!id || !isValidObjectId(id)) {
      toast.error('Invalid event ID');
      navigate(authIsAdmin ? '/admin/events' : '/organiser/events');
      return;
    }

    Promise.all([
      getEventForEdit(id),
      getUsers({ role: 'main_organiser' })
    ])
      .then(([eventRes, usersRes]) => {
        setEvent(eventRes.data.data.event);
        setOrganisers(usersRes.data.data.users);
      })
      .catch(err => {
        console.error('Load error:', err);
        toast.error(err.response?.data?.message || 'Failed to load event');
        navigate(authIsAdmin ? '/admin/events' : '/organiser/events');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, authIsAdmin]);

  const handleSubmit = async (formData) => {
    if (!id || !isValidObjectId(id)) {
      toast.error('Invalid event ID');
      return;
    }

    setUpdating(true);
    try {
      const updateData = { ...formData };
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.slug;
      delete updateData.__v;
      delete updateData.coverImageFile;
      if (!updateData.mainOrganiser) {
        delete updateData.mainOrganiser;
      }

      if (updateData.mainOrganiser?._id) {
        updateData.mainOrganiser = updateData.mainOrganiser._id;
      }

      // Handle file upload
      if (formData.coverImageFile) {
        const formDataToSend = new FormData();
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== null && updateData[key] !== undefined) {
            if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key])) {
              formDataToSend.append(key, JSON.stringify(updateData[key]));
            } else {
              formDataToSend.append(key, updateData[key]);
            }
          }
        });
        formDataToSend.append('coverImage', formData.coverImageFile);

        await updateEvent(id, formDataToSend);
      } else {
        await updateEvent(id, updateData);
      }

      toast.success('Event updated successfully');
      navigate(authIsAdmin ? '/admin/events' : '/organiser/events');
    } catch (err) {
      console.error('Update Error:', err.response?.data);
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </DashboardLayout>
  );

  if (!event) return (
    <DashboardLayout>
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">Event not found (ID: {id})</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-teal-600 hover:underline">Go Back</button>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
            <p className="text-gray-500 text-sm">{event.name}</p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>

        <EventForm 
          initialData={event} 
          organisers={authIsAdmin ? organisers : []}
          isAdmin={authIsAdmin}
          onSubmit={handleSubmit} 
          onCancel={() => navigate(-1)} 
          loading={updating}
        />
      </div>
    </DashboardLayout>
  );
};

export default EventEditPage;
