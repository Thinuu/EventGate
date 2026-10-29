import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import {
  getSubDashboard,
  createSubTicket,
  regenerateTicketCode,
} from '../../api/sub';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  KeyIcon,
  LockClosedIcon,
  LockOpenIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  TicketIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3 sm:p-5">
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
          {title}
        </p>
        <p className="mt-1 sm:mt-2 text-lg sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {Icon && (
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const getCurrency = (payload) =>
  payload?.event?.settings?.currency ||
  payload?.event?.currency ||
  payload?.settings?.currency ||
  payload?.currency ||
  localStorage.getItem('lastEventCurrency') ||
  'LKR';

const emptyForm = {
  name: '',
  price: '',
  capacity: '',
  allowedZones: [],
  isPrivate: false,
  isVisible: true,
  maxUsage: '',
  description: '',
};

const SubOrgTickets = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [showResult, setShowResult] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const load = (eventId) => {
    setLoading(true);
    getSubDashboard({ eventId })
      .then((response) => {
        const next = response.data?.data || null;
        setData(next);
        const currency = getCurrency(next);
        if (currency) {
          localStorage.setItem('lastEventCurrency', currency);
        }
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Failed to load data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(currentEventId);
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      load(newId);
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentEventId) return toast.error('Please select an event first.');
    if (formData.allowedZones.length === 0) {
      return toast.error('Please select at least one zone.');
    }

    setIsSubmitting(true);
    try {
      const response = await createSubTicket({
        ...formData,
        eventId: currentEventId,
      });

      if (response.data.success) {
        toast.success('Ticket category created!');
        if (response.data.data?.category?.accessCode) {
          setGeneratedCode(response.data.data.category.accessCode);
          setShowResult(true);
        }
        setIsModalOpen(false);
        setFormData(emptyForm);
        load(currentEventId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleZone = (zoneId) => {
    setFormData((prev) => ({
      ...prev,
      allowedZones: prev.allowedZones.includes(zoneId)
        ? prev.allowedZones.filter((id) => id !== zoneId)
        : [...prev.allowedZones, zoneId],
    }));
  };

  const handleRegenerateCode = async (categoryId) => {
    if (!currentEventId) return toast.error('Please select an event first.');
    try {
      const response = await regenerateTicketCode(categoryId, {
        eventId: currentEventId,
      });
      const nextCode = response.data?.data?.accessCode;
      if (!nextCode) {
        toast.error('A new access code was not returned.');
        return;
      }
      setGeneratedCode(nextCode);
      setShowResult(true);
      toast.success('Access code regenerated.');
      load(currentEventId);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to regenerate code.'
      );
    }
  };

  const currency = getCurrency(data);
  const categories = data?.categories || [];
  const zones = data?.zones || [];
  const totalSold = categories.reduce((s, c) => s + (c.sold || 0), 0);
  const privateCount = categories.filter((c) => c.isPrivate).length;

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-3 sm:gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/suborg/dashboard"
                    className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-teal-600 active:bg-teal-50 hover:text-teal-700 touch-manipulation"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <span className="text-slate-300">·</span>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Tickets
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
                  {data?.event?.name || 'Assigned Event'}
                </h1>
                <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                  Categories for your zones. Private tickets need an access code.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white shrink-0 touch-manipulation"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Create Ticket
              </Button>
            </div>
          </div>
        </Card>

        {/* Metrics — 3-col compact on mobile */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <MetricCard
            title="Categories"
            value={loading ? '—' : categories.length}
            subtitle="In scope"
            icon={TicketIcon}
          />
          <MetricCard
            title="Sold"
            value={loading ? '—' : totalSold}
            subtitle="All cats"
            icon={CheckCircleIcon}
          />
          <MetricCard
            title="Private"
            value={loading ? '—' : privateCount}
            subtitle="Coded"
            icon={LockClosedIcon}
          />
        </section>

        {/* Category cards */}
        <div className="grid gap-3 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const sold = category.sold || 0;
            const capacity = category.capacity || 0;
            const fillPct =
              capacity > 0
                ? Math.min(100, Math.round((sold / capacity) * 100))
                : 0;

            return (
              <Card
                key={category.id}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5 active:border-teal-200 hover:border-teal-200 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {category.name}
                      </h3>
                      {category.isPrivate ? (
                        <Badge color="amber">Private</Badge>
                      ) : (
                        <Badge color="green">Public</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-lg sm:text-xl font-bold text-teal-600 tabular-nums">
                      {currency} {Number(category.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border ${
                      category.isPrivate
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    {category.isPrivate ? (
                      <LockClosedIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <LockOpenIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                </div>

                <div className="mt-3 sm:mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-500">
                      Sold {sold} / {capacity || '∞'}
                    </span>
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {fillPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-all"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 border-t border-slate-100 pt-3 sm:pt-4">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 sm:mb-2">
                    Zones
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(category.allowedZones || []).map((zId) => (
                      <span
                        key={zId}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        {zones.find(
                          (z) => String(z._id || z.id) === String(zId)
                        )?.name || zId}
                      </span>
                    ))}
                    {(category.allowedZones || []).length === 0 && (
                      <span className="text-xs italic text-slate-400">
                        No zones
                      </span>
                    )}
                  </div>
                </div>

                {category.isPrivate && (
                  <div className="mt-3 sm:mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-3.5">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Access Code
                        </p>
                        <p className="mt-0.5 sm:mt-1 font-mono text-xs sm:text-sm font-bold tracking-wider text-teal-600 truncate">
                          {category.accessCode || 'Not available'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50 active:bg-teal-50 touch-manipulation"
                        onClick={() => handleRegenerateCode(category.id)}
                      >
                        <ArrowPathIcon className="mr-1 h-3.5 w-3.5" />
                        Regen
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {!loading && categories.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 sm:px-6 sm:py-16 text-center">
              <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <TicketIcon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-800">
                No ticket categories yet
              </p>
              <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500 leading-snug">
                Create a category for the zones assigned to your workspace.
              </p>
              <Button
                className="mt-4 sm:mt-5 w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white touch-manipulation"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusIcon className="mr-1.5 h-4 w-4" />
                Create first category
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Ticket Category"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4 sm:space-y-5">
          <label className="block space-y-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Category Name
            </span>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="e.g. VIP Backstage"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </label>

          <div className="grid gap-3 grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Price ({currency})
              </span>
              <input
                type="number"
                required
                min="0"
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Capacity
              </span>
              <input
                type="number"
                required
                min="0"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="100"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: e.target.value })
                }
              />
            </label>
          </div>

          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Assign to Zones
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {zones.map((zone) => {
                const zid = zone._id || zone.id;
                const selected = formData.allowedZones.includes(zid);
                return (
                  <button
                    key={zid}
                    type="button"
                    onClick={() => toggleZone(zid)}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all touch-manipulation ${
                      selected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 active:bg-teal-50'
                    }`}
                  >
                    {zone.name}
                  </button>
                );
              })}
              {zones.length === 0 && (
                <p className="text-xs italic text-slate-400">
                  No zones assigned to your workspace.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Private Access
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                  Require a code to unlock this ticket.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0 touch-manipulation">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={formData.isPrivate}
                  onChange={(e) =>
                    setFormData({ ...formData, isPrivate: e.target.checked })
                  }
                />
                <div className="peer h-7 w-12 rounded-full bg-slate-200 after:absolute after:start-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full" />
              </label>
            </div>
            {formData.isPrivate && (
              <div className="mt-3">
                <label className="block space-y-1.5">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Max Uses (optional)
                  </span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                    placeholder="Leave blank for unlimited"
                    value={formData.maxUsage}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUsage: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Visible to Public
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                  Show in the public event listing.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center shrink-0 touch-manipulation">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={formData.isVisible}
                  onChange={(e) =>
                    setFormData({ ...formData, isVisible: e.target.checked })
                  }
                />
                <div className="peer h-7 w-12 rounded-full bg-slate-200 after:absolute after:start-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full" />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 py-3 sm:py-2.5 touch-manipulation"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-[2] bg-teal-600 hover:bg-teal-500 active:bg-teal-700 py-3 sm:py-2.5 touch-manipulation"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Access code result */}
      <Modal
        open={showResult}
        onClose={() => setShowResult(false)}
        title="Access Code Created"
        size="sm"
      >
        <div className="space-y-4 sm:space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <KeyIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 leading-snug">
            Share this code only with people who should unlock this private
            ticket.
          </p>
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-teal-200 bg-teal-50/50 px-4 py-5 sm:py-6 transition active:bg-teal-50 active:scale-[0.98] touch-manipulation"
            onClick={() => {
              navigator.clipboard.writeText(generatedCode);
              toast.success('Code copied to clipboard!');
            }}
          >
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tap to copy
            </p>
            <p className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-slate-900 break-all">
              {generatedCode}
            </p>
          </button>
          <Button
            className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 py-3 sm:py-2.5 touch-manipulation"
            onClick={() => setShowResult(false)}
          >
            <CheckCircleIcon className="mr-1.5 h-4 w-4" />
            Done
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgTickets;