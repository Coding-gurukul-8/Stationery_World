import AdminLayout from "../../components/AdminLayout";
import "./Dashboard.css";
import adminPfp from "../../assets/admin-avatar.jpg";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";


const Dashboard = () => {
  const admin = {
    name: "Admin Name",
    email: "admin@stationeryworld.com",
    uid: "ADM-10234",
    role: "Super Admin",
    photo: adminPfp, // Placeholder photo path
  };

  const salesData = [
  { day: "1", revenue: 420 },
  { day: "2", revenue: 510 },
  { day: "3", revenue: 460 },
  { day: "4", revenue: 600 },
  { day: "5", revenue: 720 },
  { day: "6", revenue: 680 },
  { day: "7", revenue: 750 },
  { day: "8", revenue: 810 },
  { day: "9", revenue: 790 },
  { day: "10", revenue: 860 },
  { day: "11", revenue: 900 },
  { day: "12", revenue: 880 },
  { day: "13", revenue: 940 },
  { day: "14", revenue: 1020 },
  { day: "15", revenue: 1100 },
  { day: "16", revenue: 980 },
  { day: "17", revenue: 1050 },
  { day: "18", revenue: 1120 },
  { day: "19", revenue: 1080 },
  { day: "20", revenue: 1150 },
  { day: "21", revenue: 1200 },
  { day: "22", revenue: 1180 },
  { day: "23", revenue: 1250 },
  { day: "24", revenue: 1300 },
  { day: "25", revenue: 1280 },
  { day: "26", revenue: 1350 },
  { day: "27", revenue: 1400 },
  { day: "28", revenue: 1380 },
  { day: "29", revenue: 1450 },
  { day: "30", revenue: 1500 },
];


const categoryData = [
  { name: "Books", value: 40 },
  { name: "Pens", value: 25 },
  { name: "Art Supplies", value: 20 },
  { name: "Others", value: 15 },
  { name: "Books", value: 40 },
  { name: "Pens", value: 25 },
  { name: "Art Supplies", value: 20 },
  { name: "Others", value: 15 },
];

const COLORS = [
  "#1f2937", // dark gray
  "#2563eb", // blue
  "#374151", // slate
  "#1d4ed8", // deep blue
  "#4b5563", // cool gray
  "#0f766e", // teal
  "#047857", // emerald
  "#15803d", // green
  "#7c3aed", // violet
  "#6d28d9", // deep violet
  "#9333ea", // purple
  "#9d174d", // wine
];


const COLORS1 = [
  "#4f46e5", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ec4899", // pink
  "#84cc16", // lime
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // blue-violet
  "#10b981", // emerald
  "#eab308", // yellow
  "#8b5cf6", // violet
  "#fb7185", // rose
  "#38bdf8", // sky
  "#c084fc", // light purple
  "#f472b6", // light pink
  "#4ade80", // soft green
  "#facc15", // soft yellow
];



  return (
    <div className="admin-dashboard animate-in">
      
      <section className="admin-profile">
        <div className="profile-left">
          <img src={admin.photo} alt="Admin" />
        </div>

        <div className="profile-right">
          <h2>{admin.name}</h2>
          <p>{admin.email}</p>
          <p><strong>UID:</strong> {admin.uid}</p>
          <p><strong>Role:</strong> {admin.role}</p>
        </div>
      </section>

      <section className="quick-stats">
        <div className="stat-card">Orders: 120</div>
        <div className="stat-card">Revenue: ₹48,000</div>
        <div className="stat-card">Products: 86</div>
      </section>

      <div className="dashboard-charts">
  {/* BAR CHART */}
  <div className="chart-card">
    <h3>Monthly Revenue</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={salesData}>
        
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />

        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
           {salesData.map((_, index) => (
        <Cell
          key={`cell-${index}`}
          fill={COLORS[index % COLORS.length]}
        />
      ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* PIE CHART */}
  <div className="chart-card">
    <h3>Sales by Category</h3>
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={categoryData}
          dataKey="value"
          nameKey="name"
          outerRadius={100}
          label
        >
          {categoryData.map((_, index) => (
            <Cell key={index} fill={COLORS1[index]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>

    </div>
  );
};


export default Dashboard;
