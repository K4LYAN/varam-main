"use strict";

/** Admin dashboard figures and the customer list. */
const { query, queryRaw } = require("../db/pool");
const { ORDER_STATUSES, LOW_STOCK_AT } = require("../config/defaults");

const DAYS = 14;

/** IST calendar date (YYYY-MM-DD) `daysAgo` days before now. */
const istDate = (daysAgo) => new Date(Date.now() + 5.5 * 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);

async function dashboardStats() {
  // created_at ranges (not DATE(created_at) = …) so the created_at indexes can be used.
  // The pool runs with time_zone +05:30, so CURDATE() is the IST calendar day.
  const [[totals], statusRows, lowStock, [customers], recent, daily, top] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total_amount END), 0) AS revenue,
              COALESCE(SUM(status <> 'Cancelled'), 0) AS orders,
              COALESCE(SUM(status <> 'Cancelled' AND created_at >= CURDATE()), 0) AS today_orders,
              COALESCE(SUM(CASE WHEN status <> 'Cancelled' AND created_at >= CURDATE() THEN total_amount END), 0) AS today_revenue
       FROM orders`,
    ),
    query("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
    query(
      `SELECT v.id, v.size_label, v.sku, v.stock_qty, p.name, p.id AS product_id
       FROM product_variants v JOIN products p ON p.id = v.product_id AND p.is_active = 1
       WHERE v.stock_qty <= ? ORDER BY v.stock_qty, p.name LIMIT 50`,
      [LOW_STOCK_AT],
    ),
    query("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
    query("SELECT order_number, customer_name, total_amount, status, fulfillment_type, created_at FROM orders ORDER BY id DESC LIMIT 8"),
    query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS v
       FROM orders WHERE status <> 'Cancelled' AND created_at >= CURDATE() - INTERVAL ${DAYS - 1} DAY
       GROUP BY d ORDER BY d`,
    ),
    query(
      `SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status <> 'Cancelled'
       GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 5`,
    ),
  ]);

  const byDay = new Map(daily.map((r) => [r.d, r]));
  const salesByDay = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = istDate(i);
    const r = byDay.get(d);
    salesByDay.push({ date: d, orders: r ? Number(r.n) : 0, revenue: r ? Number(r.v) : 0 });
  }
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(statusRows.find((r) => r.status === s)?.n || 0)]));

  return {
    salesByDay,
    topProducts: top.map((t) => ({ name: t.name, quantity: Number(t.qty), revenue: Number(t.revenue) })),
    statusCounts,
    totalRevenue: Number(totals.revenue),
    totalOrders: Number(totals.orders),
    todayOrders: Number(totals.today_orders),
    todayRevenue: Number(totals.today_revenue),
    pendingOrders: statusCounts.Pending,
    lowStock: lowStock.map((r) => ({ variantId: r.id, productId: r.product_id, name: r.name, sizeLabel: r.size_label, sku: r.sku, stockQty: r.stock_qty })),
    totalCustomers: Number(customers.n),
    recentOrders: recent.map((o) => ({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      totalAmount: Number(o.total_amount),
      status: o.status,
      fulfillmentType: o.fulfillment_type,
      createdAt: o.created_at,
    })),
  };
}

/** Registered customers with order count and lifetime spend (one grouped query). */
async function customers(q) {
  const params = [];
  let filter = "";
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    filter = "AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
    params.push(like, like, like);
  }
  const rows = await queryRaw(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at,
            COUNT(o.id) AS orders,
            COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total_amount END), 0) AS spent,
            MAX(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     WHERE u.role = 'customer' ${filter}
     GROUP BY u.id, u.name, u.email, u.phone, u.created_at
     ORDER BY spent DESC, u.id DESC LIMIT 500`,
    params,
  );
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    joinedAt: c.created_at,
    orders: Number(c.orders),
    spent: Number(c.spent),
    lastOrderAt: c.last_order,
  }));
}

module.exports = { dashboardStats, customers };
