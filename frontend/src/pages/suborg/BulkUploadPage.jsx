import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bulkUpload, downloadTemplate } from '../../api/attendees';
import { getSubDashboard } from '../../api/sub';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const BulkUploadPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [eventData, setEventData] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const { user } = useAuth();

  // Fetch assigned event and data via sub-dashboard API
  useEffect(() => {
    const fetchEventData = async () => {
      const lastId = localStorage.getItem('lastSelectedEventId');
      if (!lastId) return;
      
      try {
        const response = await getSubDashboard({ eventId: lastId });
        const data = response.data?.data;
        if (data?.event) {
          setEventData(data);
          setEvents([data.event]); // Single assigned event for sub-org
          setCategoryId(data.categories?.[0]?.id || '');
        }
      } catch (err) {
        console.error('Failed to load event data:', err);
      }
    };

    fetchEventData();

    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setSelectedEvent(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      getSubDashboard({ eventId: newId })
        .then((res) => {
          const data = res.data?.data;
          setEventData(data);
          setEvents(data.event ? [data.event] : []);
          setCategoryId(data.categories?.[0]?.id || '');
        })
        .catch((err) => {
          console.error('Failed to load event data:', err);
        });
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const availableCategories = useMemo(() => {
    if (!eventData?.categories) return [];
    return eventData.categories;
  }, [eventData]);

  const handleDownload = async () => {
    try {
      const response = await downloadTemplate();
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'attendee_template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedEvent || !categoryId) {
      toast.error('Select an event, category, and Excel file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', selectedEvent);
      formData.append('categoryId', categoryId);

      const response = await bulkUpload(formData);
      setResult(response.data?.data || null);
      toast.success(response.data?.message || 'Bulk upload complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  to="/suborg/dashboard"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-teal-600 hover:text-teal-700"
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
                <span className="text-slate-300">·</span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Bulk Upload
                </p>
              </div>
              <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Bulk upload attendees
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Upload an Excel sheet to create attendee records for your
                assigned event and category.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Step 1 */}
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
              Step 1
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-slate-900">
              Prepare the Excel file
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Use the template so column names match the importer. Rows with
              missing required values are skipped and reported.
            </p>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Expected columns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Full Name',
                  'Email',
                  'Phone',
                  'National ID',
                  'Passport Number',
                  'Date of Birth',
                  'Nationality',
                  'Notes',
                ].map((column) => (
                  <span
                    key={column}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              className="mt-5 border-teal-200 text-teal-700 hover:bg-teal-50"
              onClick={handleDownload}
            >
              <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" />
              Download template
            </Button>
          </Card>

          {/* Step 2 */}
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
              Step 2
            </p>
            <h2 className="mt-1.5 text-lg font-bold text-slate-900">
              Upload completed sheet
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Event
                </span>
                <select
                  value={selectedEvent}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedEvent(value);
                    localStorage.setItem('lastSelectedEventId', value);
                    const selected = events.find((item) => item._id === value);
                    if (selected?.categories) {
                      const myZones = (
                        user?.assignedZones ||
                        user?.responsibilities?.zoneIds ||
                        []
                      ).map(String);
                      const available = selected.categories.filter((cat) => {
                        const catZones = (cat.allowedZones || []).map(String);
                        return (
                          catZones.length === 0 ||
                          catZones.some((z) => myZones.includes(z))
                        );
                      });
                      setCategoryId(available?.[0]?.id || '');
                    } else {
                      setCategoryId('');
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  {events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Category
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Select a category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {availableCategories.length === 0 && selectedEvent && (
                  <p className="text-xs text-rose-500">
                    No categories available for your assigned zones.
                  </p>
                )}
              </label>
            </div>

            <div className="mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Excel file
              </span>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center transition hover:border-teal-300 hover:bg-teal-50/40">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <DocumentIcon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {file?.name || 'Choose an Excel file'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Supported: .xlsx, .xls
                </p>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="bg-teal-600 hover:bg-teal-500 text-white"
                onClick={handleUpload}
                disabled={uploading}
              >
                <ArrowUpTrayIcon className="mr-1.5 h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload and create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Clear file
              </Button>
            </div>
          </Card>
        </div>

        {/* Results */}
        {result && (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Upload results
                </h2>
                <p className="text-sm text-slate-500">
                  Review created rows and any errors.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-center min-w-[88px]">
                  <p className="text-2xl font-bold text-teal-600">
                    {result.created || 0}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                    Created
                  </p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-center min-w-[88px]">
                  <p className="text-2xl font-bold text-rose-600">
                    {result.errors?.length || 0}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                    Errors
                  </p>
                </div>
              </div>
            </div>

            {result.errors?.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-rose-100">
                <div className="grid grid-cols-[100px_1fr] bg-rose-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  <span>Row</span>
                  <span>Issue</span>
                </div>
                {result.errors.map((error, index) => (
                  <div
                    key={`${error.row}-${index}`}
                    className="grid grid-cols-[100px_1fr] border-t border-rose-50 px-4 py-2.5 text-sm text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">
                      {error.row}
                    </span>
                    <span>{error.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3.5">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-teal-600" />
                <p className="text-sm text-teal-800">
                  No row-level errors. Your attendee list imported cleanly.
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BulkUploadPage;