import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend, Cell 
} from 'recharts';
import { 
  FiSmartphone as FiPhoneIcon, 
  FiBarChart2 as FiBarIcon, 
  FiGlobe as FiGlobeIcon, 
  FiEye as FiEyeIcon, 
  FiUsers as FiUsersIcon, 
  FiInbox as FiInboxIcon, 
  FiCalendar as FiCalIcon, 
  FiMessageSquare as FiMsgIcon, 
  FiRefreshCw as FiRefreshIcon, 
  FiTrendingUp as FiTrendIcon 
} from 'react-icons/fi';
import { GiPrayer } from 'react-icons/gi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '3m', label: '3 Months' },
  { key: 'custom', label: 'Custom Range' },
];

const CHART_COLORS = {
  primary: '#1e3a8a', // Church Royal Blue
  secondary: '#d4a017', // Church Gold
  emerald: '#059669', // Emerald Green
  rose: '#e11d48', // Rose
  purple: '#7c3aed', // Purple
  amber: '#d97706', // Amber
  cyan: '#0284c7' // Sky Blue
};

// Clean Light Tooltip for Main Chart
const CustomVisitorTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md text-gray-900 p-3 sm:p-3.5 rounded-2xl shadow-xl border border-gray-200 text-xs min-w-[160px] sm:min-w-[180px] z-50">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
          <span className="font-extrabold text-church-royal-blue">{data.fullDate || label}</span>
          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-bold">
            {data.label || 'Day'}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block"></span> Visitors:
            </span>
            <span className="font-black text-gray-900">{Number(data.visitors || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Page Views:
            </span>
            <span className="font-black text-gray-900">{Number(data.pageViews || 0).toLocaleString()}</span>
          </div>
          {data.submissions !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px] text-gray-500">
              <span>Submissions:</span>
              <span className="font-bold text-emerald-600">{Number(data.submissions || 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Clean Light Tooltip for Sub-Charts
const GenericChartTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md text-gray-900 p-3 rounded-xl shadow-xl border border-gray-200 text-xs z-50">
        <p className="font-bold text-church-royal-blue mb-1">{label}</p>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="text-gray-600 capitalize">{entry.name || 'Count'}:</span>
            <span className="font-black text-gray-900">
              {Number(entry.value || 0).toLocaleString()} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminAnalyticsSection() {
  const [period, setPeriod] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Custom date range state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Main chart metric toggle ('both', 'visitors', 'views')
  const [mainChartMetric, setMainChartMetric] = useState('both');

  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      let url = `/analytics/stats?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await api.get(url);
      if (res.data && res.data.success) {
        setAnalyticsData(res.data);
        if (isManualRefresh) {
          toast.success('Analytics refreshed from database!');
        }
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      if (isManualRefresh) {
        toast.error('Could not refresh analytics');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
    // Live automatic sync every 10 seconds
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const handlePeriodChange = (newPeriod) => {
    if (newPeriod === 'custom') {
      setShowCustomModal(true);
    } else {
      setPeriod(newPeriod);
    }
  };

  const applyCustomRange = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both Start and End dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start Date must be before End Date');
      return;
    }
    setPeriod('custom');
    setShowCustomModal(false);
  };

  // Pure Database Values
  const summary = analyticsData?.summary || {
    totalVisitors: 0,
    totalPageViews: 0,
    activeUsers: 0,
    totalSubmissions: 0,
    totalRegisteredMembers: 0,
    avgPagesPerVisitor: '0'
  };

  const timeSeries = analyticsData?.timeSeries || [];
  const pageViewsByPage = analyticsData?.pageViewsByPage || [];
  const contactSubmissions = analyticsData?.contactSubmissionsBreakdown || [];
  const prayerRequests = analyticsData?.prayerRequestsBreakdown || [];
  const eventRegistrations = analyticsData?.eventRegistrations || [];
  const deviceBreakdown = analyticsData?.deviceBreakdown || [
    { name: 'Mobile', value: 0, count: 0 },
    { name: 'Desktop', value: 0, count: 0 },
    { name: 'Tablet', value: 0, count: 0 }
  ];

  // Calculate Peak Traffic Day from real DB data
  const peakDayObj = timeSeries.length > 0 
    ? [...timeSeries].filter(t => (t.visitors || 0) > 0).sort((a, b) => (b.visitors || 0) - (a.visitors || 0))[0]
    : null;

  const peakTrafficDay = peakDayObj ? (peakDayObj.fullDate || peakDayObj.label) : 'No data yet';
  const avgDailyViews = timeSeries.length > 0 
    ? (summary.totalPageViews / timeSeries.length).toFixed(1) 
    : '0';

  const totalTicketsCount = contactSubmissions.reduce((a, b) => a + (b.count || 0), 0);
  const totalPrayersCount = prayerRequests.reduce((a, b) => a + (b.count || 0), 0);
  const totalEventAttendees = eventRegistrations.reduce((a, b) => a + (b.registrations || 0), 0);

  return (
    <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 lg:p-7 shadow-xl border border-gray-100 mb-8 overflow-hidden">
      
      {/* 1. Header & Filters — Responsive Flex Wrapping */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-100 w-full min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-church-royal-blue/10 text-church-royal-blue flex items-center justify-center text-xl flex-shrink-0 shadow-xs">
              <FiBarIcon className="text-church-royal-blue" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base sm:text-lg lg:text-xl font-black text-church-royal-blue uppercase tracking-wide">
                  Website & Parish Analytics
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Database
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5 break-words">
                Real-time visitor activity, page impressions, prayer requests & member engagements.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls — Fully Responsive with Flex-Wrap */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
          {/* Period Filter Buttons */}
          <div className="flex flex-wrap items-center bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-2xs max-w-full">
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = period === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePeriodChange(opt.key)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-church-royal-blue text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  {opt.label}
                  {opt.key === 'custom' && period === 'custom' && (
                    <span className="ml-1 text-[10px] opacity-80 hidden sm:inline">
                      ({startDate.slice(5)} to {endDate.slice(5)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 flex-shrink-0"
            title="Refresh Analytics from Database"
          >
            <FiRefreshIcon className={`text-sm text-church-gold ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (Desktop: 4 cols, Tablet: 2 cols, Mobile: 1 col) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 my-6 w-full min-w-0">
        
        {/* Total Visitors */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900">Total Visitors</span>
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
              <FiGlobeIcon />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-2xl sm:text-3xl font-black font-display text-blue-950 tracking-tight truncate">
              {Number(summary.totalVisitors || 0).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-blue-700/80 mt-1 flex items-center gap-1 truncate">
              <FiTrendIcon className="text-blue-600 flex-shrink-0" />
              <span className="truncate">Unique sessions in {period === 'today' ? 'today' : period}</span>
            </p>
          </div>
        </div>

        {/* Page Views */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">Page Views</span>
            <div className="w-8 h-8 rounded-xl bg-church-gold text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
              <FiEyeIcon />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-2xl sm:text-3xl font-black font-display text-amber-950 tracking-tight">
              {Number(summary.totalPageViews || 0).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-amber-700/80 mt-1">
              {summary.avgPagesPerVisitor} views per visitor avg
            </p>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">Active Users</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
              <FiUsersIcon />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-2xl sm:text-3xl font-black font-display text-emerald-950 tracking-tight">
              {Number(summary.activeUsers || 0).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-700/80 mt-1">
              {summary.totalRegisteredMembers || 0} registered members
            </p>
          </div>
        </div>

        {/* Submissions */}
        <div className="bg-gradient-to-br from-rose-50 to-pink-50/70 border border-rose-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-900">Submissions</span>
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0">
              <FiInboxIcon />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-2xl sm:text-3xl font-black font-display text-rose-950 tracking-tight">
              {Number(summary.totalSubmissions || 0).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-rose-700/80 mt-1">
              Tickets, Prayers & Events
            </p>
          </div>
        </div>

      </div>

      {/* 3. Main Hero Chart: Website Visitors & Traffic Bar Chart */}
      <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 shadow-md border border-gray-200/90 mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-church-gold animate-pulse flex-shrink-0"></span>
              <h3 className="font-display text-sm sm:text-base lg:text-lg font-black tracking-wide text-church-royal-blue uppercase">
                Website Visitors
              </h3>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5 break-words">
              Visitor activity and page impression volume across recent days.
            </p>
          </div>

          {/* Metric View Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => setMainChartMetric('both')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mainChartMetric === 'both' ? 'bg-church-royal-blue text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Visitors
            </button>
            <button
              type="button"
              onClick={() => setMainChartMetric('visitors')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mainChartMetric === 'visitors' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Visitors Only
            </button>
            <button
              type="button"
              onClick={() => setMainChartMetric('views')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mainChartMetric === 'views' ? 'bg-church-gold text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Page Views Only
            </button>
          </div>
        </div>

        {/* Responsive Chart Container */}
        <div className="w-full max-w-full min-w-0 h-[280px] sm:h-[320px] overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={timeSeries}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false} 
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false} 
                allowDecimals={false}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
              />
              <Tooltip content={<CustomVisitorTooltip />} />
              <Legend 
                verticalAlign="top" 
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 'bold' }} 
              />
              {(mainChartMetric === 'both' || mainChartMetric === 'visitors') && (
                <Bar 
                  dataKey="visitors" 
                  name="Unique Visitors" 
                  fill="#1e3a8a" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40} 
                />
              )}
              {(mainChartMetric === 'both' || mainChartMetric === 'views') && (
                <Bar 
                  dataKey="pageViews" 
                  name="Page Views" 
                  fill="#d4a017" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40} 
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Footer Stats — Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-3 border-t border-gray-100 bg-gray-50/60 rounded-2xl p-3 text-center min-w-0">
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate block">Time Range</span>
            <p className="text-xs font-bold text-church-royal-blue mt-0.5 capitalize truncate">{period === '7d' ? 'Past 7 Days' : period}</p>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate block">Peak Traffic Day</span>
            <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">
              {peakTrafficDay}
            </p>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate block">Avg Daily Views</span>
            <p className="text-xs font-bold text-gray-900 mt-0.5 truncate">
              {avgDailyViews}
            </p>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider truncate block">Status</span>
            <p className="text-xs font-bold text-emerald-600 mt-0.5 flex items-center justify-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span> Synced & Active
            </p>
          </div>
        </div>
      </div>

      {/* 4. Secondary Clean Bar Charts Grid (Desktop: 2 cols, Tablet & Mobile: 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0">

        {/* Chart A: Page Views by Page */}
        <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 border border-gray-200/90 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2 gap-2">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                <FiEyeIcon className="text-church-gold text-lg flex-shrink-0" /> Page Views by Section
              </h3>
              <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">Top Pages</span>
            </div>
            <p className="text-xs text-gray-500 mb-4 break-words">
              Number of impressions received across individual church website pages.
            </p>

            <div className="w-full max-w-full min-w-0 h-[260px] sm:h-[280px] flex items-center justify-center overflow-hidden">
              {pageViewsByPage.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={pageViewsByPage}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                    <YAxis 
                      dataKey="page" 
                      type="category" 
                      stroke="#475569" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      width={85}
                    />
                    <Tooltip content={<GenericChartTooltip unit="views" />} />
                    <Bar dataKey="views" name="Impressions" fill="#1e3a8a" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {pageViewsByPage.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={[CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.emerald, CHART_COLORS.cyan, CHART_COLORS.purple, CHART_COLORS.amber][index % 6]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10">
                  <FiEyeIcon className="text-3xl text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-500">No page view records in this period</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Visits will appear here in real-time as users browse</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 pt-3 border-t border-gray-100 mt-2 gap-2">
            <span className="truncate">Primary Attraction: <strong className="text-church-royal-blue">{pageViewsByPage[0]?.page || 'No traffic yet'}</strong></span>
            <span className="flex-shrink-0">Total Sections: {pageViewsByPage.length}</span>
          </div>
        </div>

        {/* Chart B: Contact Submissions & Enquiries */}
        <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 border border-gray-200/90 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2 gap-2">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                <FiMsgIcon className="text-rose-500 text-lg flex-shrink-0" /> Contact Submissions
              </h3>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex-shrink-0">
                Helpdesk & Inquiries
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4 break-words">
              Submissions received from parishioners and public visitors by inquiry category.
            </p>

            <div className="w-full max-w-full min-w-0 h-[260px] sm:h-[280px] overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contactSubmissions}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<GenericChartTooltip unit="submissions" />} />
                  <Bar dataKey="count" name="Submissions" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {contactSubmissions.map((_, index) => (
                      <Cell 
                        key={`tkt-${index}`} 
                        fill={['#e11d48', '#f59e0b', '#0284c7', '#8b5cf6'][index % 4]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 pt-3 border-t border-gray-100 mt-2 gap-2">
            <span className="truncate">Actionable Items: <strong className="text-rose-600">{totalTicketsCount} Tickets</strong></span>
            <span className="text-church-royal-blue flex-shrink-0">Directly from Tickets DB</span>
          </div>
        </div>

        {/* Chart C: Prayer Requests Received */}
        <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 border border-gray-200/90 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2 gap-2">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                <GiPrayer className="text-church-gold text-xl flex-shrink-0" /> Prayer Requests Received
              </h3>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                Intentions
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4 break-words">
              Prayer requests and spiritual counseling intentions categorized by location.
            </p>

            <div className="w-full max-w-full min-w-0 h-[260px] sm:h-[280px] overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prayerRequests}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<GenericChartTooltip unit="requests" />} />
                  <Bar dataKey="count" name="Prayer Intentions" fill="#d4a017" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {prayerRequests.map((_, index) => (
                      <Cell 
                        key={`pray-${index}`} 
                        fill={['#d4a017', '#1e3a8a', '#7c3aed'][index % 3]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 pt-3 border-t border-gray-100 mt-2 gap-2">
            <span className="truncate">Total Petitions: <strong className="text-church-gold font-black">{totalPrayersCount}</strong></span>
            <span className="text-gray-400 flex-shrink-0">Public & Confessional</span>
          </div>
        </div>

        {/* Chart D: Event Registrations by Event */}
        <div className="w-full max-w-full min-w-0 bg-white rounded-3xl p-4 sm:p-6 border border-gray-200/90 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2 gap-2">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-church-royal-blue flex items-center gap-2 uppercase tracking-wide">
                <FiCalIcon className="text-emerald-600 text-lg flex-shrink-0" /> Event Registrations
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                Parish Events
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4 break-words">
              Registered participants for upcoming feasts, youth camps and parish programs.
            </p>

            <div className="w-full max-w-full min-w-0 h-[260px] sm:h-[280px] flex items-center justify-center overflow-hidden">
              {eventRegistrations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={eventRegistrations}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="event" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<GenericChartTooltip unit="attendees" />} />
                    <Bar dataKey="registrations" name="Registered" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {eventRegistrations.map((_, index) => (
                        <Cell 
                          key={`ev-${index}`} 
                          fill={['#059669', '#0284c7', '#d97706', '#7c3aed', '#e11d48'][index % 5]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10">
                  <FiCalIcon className="text-3xl text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-500">No event registrations recorded in this period</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Attendee numbers will appear here upon registrations</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 pt-3 border-t border-gray-100 mt-2 gap-2">
            <span className="truncate">Total Attendees: <strong className="text-emerald-700">{totalEventAttendees}</strong></span>
            <span className="text-gray-400 flex-shrink-0">Events & Masses</span>
          </div>
        </div>

      </div>

      {/* 5. Device & Platform Breakdown Bar Indicator — Fully Responsive Wrap */}
      <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gray-50 border border-gray-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-church-royal-blue text-white flex items-center justify-center text-base shadow-xs flex-shrink-0">
            <FiPhoneIcon />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900">Visitors Device Type</p>
            <p className="text-[11px] text-gray-500 break-words">Breakdown calculated strictly from actual visitor session records.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
          {deviceBreakdown.map((dev, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">{dev.name}:</span>
              <span className="text-xs font-black text-church-royal-blue bg-white border border-gray-200 px-2 py-0.5 rounded-lg shadow-2xs">
                {dev.value}% <span className="text-[10px] text-gray-400 font-normal">({dev.count || 0})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Date Range Modal */}
      <AnimatePresence>
        {showCustomModal && (
          <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowCustomModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-gray-100"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-church-royal-blue/10 text-church-royal-blue flex items-center justify-center text-sm font-bold">
                    <FiCalIcon />
                  </div>
                  <h3 className="font-display font-black text-church-royal-blue text-base">Select Custom Date Range</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  
                </button>
              </div>

              <div className="space-y-4 my-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Start Date (From)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-church-royal-blue/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    End Date (To)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-church-royal-blue/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCustomRange}
                  className="flex-1 py-2.5 bg-church-royal-blue hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  Apply Filter
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
