import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getUserDashboard } from '../api/userPortal';
import TicketCard from '../components/dashboard/TicketCard';
import EventCard from '../components/dashboard/EventCard';
import ActivityItem from '../components/dashboard/ActivityItem';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { getDashboardPathForRole } from '../config/roleNavigation';

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const roleDashboardPath = getDashboardPathForRole(user?.role);
  if (user?.role && roleDashboardPath !== '/dashboard') {
    return <Navigate to={roleDashboardPath} replace />;
  }

  useEffect(() => {
    getUserDashboard()
      .then((res) => {
        const payload = res.data?.data || {};
        setData({
          currentTickets: payload.tickets || [],
          previousOrders: [],
          assignedEvents: [],
          upcomingPublicEvents: (payload.upcomingEvents || [])
            .map((ticket) => ticket.event)
            .filter(Boolean),
          recentActivity: (payload.notifications || []).map((item) => ({
            id: item.id,
            title: item.type,
            description: item.message,
          })),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTicket = useMemo(() => {
    return data?.currentTickets?.[0] || null;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-[40px] bg-brand-dark p-8 lg:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-main/20 rounded-full blur-[100px]"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-brand-main">Personal Hub</p>
              <h1 className="mt-4 text-4xl lg:text-6xl font-black tracking-tight text-white leading-none">
                Welcome back, <br className="hidden lg:block"/>
                <span className="text-brand-main">{user?.name || 'User'}</span>
              </h1>
              <p className="mt-6 text-slate-400 font-medium text-lg">Your events, tickets, and activity in one premium space.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/events" className="btn-premium">Browse New Events</Link>
              <Link to="/attendee/dashboard" className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all backdrop-blur-sm">My Wallet</Link>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
             {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-[32px] bg-white border border-slate-100 shimmer-effect shadow-premium"></div>)}
          </div>
        )}

        {!loading && (
          <div className="mt-12 space-y-16">
            {data?.currentTickets?.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Active Tickets</h2>
                  <Link to="/attendee/dashboard" className="text-sm font-bold text-brand-main hover:underline">View All</Link>
                </div>
                <div className="grid grid-cols-1">
                  <div className="card-premium p-0 overflow-hidden transform hover:scale-[1.01]">
                     <TicketCard ticket={activeTicket} />
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-10 lg:grid-cols-[1.5fr,1fr]">
               {/* Left Column: Events & Orders */}
               <div className="space-y-12">
                  <section className="space-y-6">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Upcoming Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {data?.upcomingPublicEvents?.map((event) => <EventCard key={event._id} event={event} />)}
                      {(!data?.upcomingPublicEvents || data.upcomingPublicEvents.length === 0) && (
                        <div className="col-span-full rounded-[32px] border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
                          <p className="font-bold">No upcoming events found.</p>
                          <Link className="mt-2 inline-block text-brand-main underline" to="/events">Discover experiences</Link>
                        </div>
                      )}
                    </div>
                  </section>

                  {data?.previousOrders?.length > 0 && (
                    <section className="space-y-6">
                      <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Order History</h2>
                      <div className="grid gap-4">
                        {data.previousOrders.map((order) => (
                          <div key={order._id} className="card-premium flex items-center justify-between group">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order #{order.orderNumber}</p>
                              <h3 className="mt-1 text-xl font-black text-slate-900 group-hover:text-brand-main transition-colors">{order.event?.name}</h3>
                              <p className="text-sm font-bold text-slate-500 mt-1">{order.currency || order.event?.settings?.currency || 'LKR'} {Number(order.totalAmount || 0).toLocaleString()}</p>
                            </div>
                            <Link to={`/buyer/orders/${order._id}`} className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-main hover:text-white transition-all">
                               <ChevronRightIcon className="h-5 w-5" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
               </div>

               {/* Right Column: Activity */}
               <section className="space-y-6">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Recent Activity</h2>
                  <div className="card-premium space-y-4">
                    {data?.recentActivity?.map((item) => (
                      <div key={item.id} className="group cursor-default border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                         <ActivityItem item={item} />
                      </div>
                    ))}
                    {(!data?.recentActivity || data.recentActivity.length === 0) && (
                      <div className="py-10 text-center text-slate-400">
                        <p className="text-sm font-medium">Your activity stream is quiet.</p>
                      </div>
                    )}
                  </div>

                  {/* Quick Profile Card */}
                  <div className="card-premium bg-gradient-to-br from-brand-main to-brand-accent text-white border-0 shadow-brand-main/20 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mt-10 -mr-10"></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Account Quick-Link</p>
                    <h3 className="mt-3 text-2xl font-black">Manage Profile</h3>
                    <p className="mt-2 text-sm text-white/80 font-medium">Update your security settings and personal information.</p>
                    <Link to="/buyer/profile" className="mt-6 inline-block rounded-xl bg-white/20 px-5 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-white/30 transition-all backdrop-blur-md">
                      Go to Profile
                    </Link>
                  </div>
               </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
