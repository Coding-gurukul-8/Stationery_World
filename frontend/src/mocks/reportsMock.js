function sampleProducts() {
  return [
    { sku: "NB-001", name: "Notebook A", category: "Books", subcategory: "Notebooks", qtySold: 12, customers: ["Rahul", "Aman", "Neha"], orders: 5, unitPrice: 40, unitCost: 25 },
    { sku: "NB-002", name: "Register B", category: "Books", subcategory: "Registers", qtySold: 8, customers: ["Gita", "Manu"], orders: 4, unitPrice: 60, unitCost: 35 },
    { sku: "PN-101", name: "Blue Pen", category: "Pens", subcategory: "Ball", qtySold: 20, customers: ["12 customers"], orders: 12, unitPrice: 10, unitCost: 4 },
    { sku: "PN-102", name: "Gel Pen", category: "Pens", subcategory: "Gel", qtySold: 14, customers: ["Ravi", "Sam"], orders: 10, unitPrice: 15, unitCost: 6 },
    { sku: "ART-07", name: "Sketch Set", category: "Art Supplies", subcategory: "Sketching", qtySold: 6, customers: ["Sara", "Neel"], orders: 4, unitPrice: 150, unitCost: 80 },
    { sku: "MS-003", name: "Marker Pack", category: "Markers", subcategory: "Pack", qtySold: 10, customers: ["Pooja"], orders: 7, unitPrice: 50, unitCost: 20 },
    { sku: "GL-010", name: "Glue Stick", category: "Adhesives", subcategory: "Glue", qtySold: 18, customers: ["10 customers"], orders: 12, unitPrice: 12, unitCost: 5 },
    { sku: "STP-01", name: "Stapler", category: "Office Tools", subcategory: "Staplers", qtySold: 4, customers: ["Amit"], orders: 3, unitPrice: 200, unitCost: 120 },
    { sku: "PNC-01", name: "HB Pencil", category: "Pencils", subcategory: "Graphite", qtySold: 30, customers: ["Many"], orders: 20, unitPrice: 6, unitCost: 2 },
  ];
}

export function getDayMockData(dateStr) {
  const products = sampleProducts();

  const categoryMap = {};
  products.forEach((p) => {
    if (!categoryMap[p.category]) categoryMap[p.category] = { category: p.category, qty: 0 };
    categoryMap[p.category].qty += p.qtySold;
  });

  const categorySummary = Object.values(categoryMap);

  const revenue = products.reduce((s, p) => s + p.qtySold * p.unitPrice, 0);
  const cp = products.reduce((s, p) => s + p.qtySold * p.unitCost, 0);
  const profit = revenue - cp;

  const summary = {
    date: dateStr,
    revenue,
    cp,
    profit,
    orders: products.reduce((s, p) => s + p.orders, 0),
    uniqueCustomers: new Set(products.flatMap((p) => p.customers)).size,
  };

  return { date: dateStr, products, categorySummary, summary, timeline: [{ label: dateStr, revenue }] };
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getWeekMockData(weekStr) {
  // weekStr is like YYYY-Www or ISO week; we'll just generate 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toISOString().slice(0, 10);
    const dayProducts = sampleProducts().map((p) => ({ ...p, qtySold: Math.max(1, Math.floor(p.qtySold * (0.5 + Math.random()))) }));
    const revenue = dayProducts.reduce((s, p) => s + p.qtySold * p.unitPrice, 0);
    return { label, revenue, products: dayProducts };
  });

  // aggregate
  const products = [];
  const catMap = {};
  let revenue = 0;
  let cp = 0;
  let orders = 0;
  const customers = new Set();

  days.forEach((d) => {
    revenue += d.revenue;
    d.products.forEach((p) => {
      cp += p.qtySold * p.unitCost;
      orders += p.orders;
      p.customers.forEach((c) => customers.add(c));

      const key = p.sku;
      const existing = products.find((x) => x.sku === key);
      if (existing) {
        existing.qtySold += p.qtySold;
        existing.orders += p.orders;
      } else {
        products.push({ ...p });
      }

      if (!catMap[p.category]) catMap[p.category] = { category: p.category, qty: 0 };
      catMap[p.category].qty += p.qtySold;
    });
  });

  const summary = { revenue, cp, profit: revenue - cp, orders, uniqueCustomers: customers.size };
  const categorySummary = Object.values(catMap);
  const timeline = days.map((d) => ({ label: d.label, revenue: d.revenue }));

  return { week: weekStr, products, categorySummary, summary, timeline };
}

export function getMonthMockData(monthStr) {
  // monthStr is YYYY-MM-DD representing the month
  const date = new Date(monthStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayEntries = Array.from({ length: daysInMonth }, (_, i) => {
    const label = `${i + 1}`;
    const dayProducts = sampleProducts().map((p) => ({ ...p, qtySold: randomBetween(1, Math.max(1, p.qtySold)) }));
    const revenue = dayProducts.reduce((s, p) => s + p.qtySold * p.unitPrice, 0);
    return { label, revenue, products: dayProducts };
  });

  // aggregate
  const products = [];
  const catMap = {};
  let revenue = 0;
  let cp = 0;
  let orders = 0;
  const customers = new Set();

  dayEntries.forEach((d) => {
    revenue += d.revenue;
    d.products.forEach((p) => {
      cp += p.qtySold * p.unitCost;
      orders += p.orders;
      p.customers.forEach((c) => customers.add(c));

      const key = p.sku;
      const existing = products.find((x) => x.sku === key);
      if (existing) {
        existing.qtySold += p.qtySold;
        existing.orders += p.orders;
      } else {
        products.push({ ...p });
      }

      if (!catMap[p.category]) catMap[p.category] = { category: p.category, qty: 0 };
      catMap[p.category].qty += p.qtySold;
    });
  });

  const summary = { revenue, cp, profit: revenue - cp, orders, uniqueCustomers: customers.size };
  const categorySummary = Object.values(catMap);
  const timeline = dayEntries.map((d) => ({ label: d.label, revenue: d.revenue }));

  return { month: monthStr, products, categorySummary, summary, timeline };
}

export function getYearMockData(yearStr) {
  // yearStr like YYYY-01-01
  const year = Number(yearStr.slice(0, 4));
  const monthEntries = Array.from({ length: 12 }, (_, i) => {
    const label = new Date(year, i, 1).toLocaleString(undefined, { month: 'short' });
    const monthProducts = sampleProducts().map((p) => ({ ...p, qtySold: randomBetween(1, Math.max(1, p.qtySold * 8)) }));
    const revenue = monthProducts.reduce((s, p) => s + p.qtySold * p.unitPrice, 0);
    return { label, revenue, products: monthProducts };
  });

  const products = [];
  const catMap = {};
  let revenue = 0;
  let cp = 0;
  let orders = 0;
  const customers = new Set();

  monthEntries.forEach((d) => {
    revenue += d.revenue;
    d.products.forEach((p) => {
      cp += p.qtySold * p.unitCost;
      orders += p.orders;
      p.customers.forEach((c) => customers.add(c));

      const key = p.sku;
      const existing = products.find((x) => x.sku === key);
      if (existing) {
        existing.qtySold += p.qtySold;
        existing.orders += p.orders;
      } else {
        products.push({ ...p });
      }

      if (!catMap[p.category]) catMap[p.category] = { category: p.category, qty: 0 };
      catMap[p.category].qty += p.qtySold;
    });
  });

  const summary = { revenue, cp, profit: revenue - cp, orders, uniqueCustomers: customers.size };
  const categorySummary = Object.values(catMap);
  const timeline = monthEntries.map((d) => ({ label: d.label, revenue: d.revenue }));

  return { year: yearStr, products, categorySummary, summary, timeline };
}
