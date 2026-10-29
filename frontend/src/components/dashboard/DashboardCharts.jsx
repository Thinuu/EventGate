import React from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card, { CardHeader } from '../ui/Card';

const DashboardCharts = ({ entryTrend, zoneOccupancy }) => (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
    <Card>
      <CardHeader title="Entry Trend" subtitle="Successful check-ins per hour" />
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={entryTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748B" />
            <YAxis allowDecimals={false} stroke="#64748B" />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0F172A" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <Card>
      <CardHeader title="Zone Occupancy" subtitle="Net zone presence from entry and exit scans" />
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={zoneOccupancy}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="zoneName" tick={{ fontSize: 12 }} stroke="#64748B" />
            <YAxis allowDecimals={false} stroke="#64748B" />
            <Tooltip />
            <Bar dataKey="occupancy" fill="#2563EB" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  </div>
);

export default DashboardCharts;
