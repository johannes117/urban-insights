export const mockData = {
  monthlyRevenue: [
    { month: 'Jan', revenue: 3800 },
    { month: 'Feb', revenue: 3200 },
    { month: 'Mar', revenue: 4500 },
    { month: 'Apr', revenue: 4800 },
    { month: 'May', revenue: 6200 },
    { month: 'Jun', revenue: 5900 },
    { month: 'Jul', revenue: 7100 },
    { month: 'Aug', revenue: 6800 },
    { month: 'Sep', revenue: 7500 },
    { month: 'Oct', revenue: 8200 },
    { month: 'Nov', revenue: 9100 },
    { month: 'Dec', revenue: 10500 },
  ],

  quarterlyGrowth: [
    { quarter: 'Q1', growth: 12.5 },
    { quarter: 'Q2', growth: 18.3 },
    { quarter: 'Q3', growth: 15.7 },
    { quarter: 'Q4', growth: 22.1 },
  ],

  topProducts: [
    { name: 'Analytics Pro', sales: 15420, revenue: 462600 },
    { name: 'Dashboard Suite', sales: 12300, revenue: 369000 },
    { name: 'Data Insights', sales: 9850, revenue: 295500 },
    { name: 'Report Builder', sales: 7200, revenue: 216000 },
    { name: 'Chart Wizard', sales: 5100, revenue: 153000 },
  ],

  userMetrics: {
    totalUsers: 125000,
    activeUsers: 84200,
    newUsersThisMonth: 3420,
    growthRate: 12.5,
    churnRate: 2.1,
  },

  salesByRegion: [
    { region: 'North America', sales: 425000 },
    { region: 'Europe', sales: 380000 },
    { region: 'Asia Pacific', sales: 290000 },
    { region: 'Latin America', sales: 145000 },
    { region: 'Middle East', sales: 85000 },
  ],

  recentOrders: [
    { id: 'ORD-001', customer: 'Acme Corp', amount: 12500, status: 'Completed' },
    { id: 'ORD-002', customer: 'TechStart Inc', amount: 8900, status: 'Processing' },
    { id: 'ORD-003', customer: 'Global Systems', amount: 23400, status: 'Completed' },
    { id: 'ORD-004', customer: 'DataFlow Ltd', amount: 5600, status: 'Pending' },
    { id: 'ORD-005', customer: 'CloudNine', amount: 18200, status: 'Completed' },
  ],

  websiteTraffic: [
    { day: 'Mon', visitors: 12500 },
    { day: 'Tue', visitors: 14200 },
    { day: 'Wed', visitors: 13800 },
    { day: 'Thu', visitors: 15600 },
    { day: 'Fri', visitors: 11900 },
    { day: 'Sat', visitors: 8200 },
    { day: 'Sun', visitors: 7500 },
  ],

  categoryBreakdown: [
    { category: 'Enterprise', value: 45 },
    { category: 'SMB', value: 30 },
    { category: 'Startup', value: 15 },
    { category: 'Individual', value: 10 },
  ],
}

export type MockData = typeof mockData
export type MockDataKey = keyof MockData
