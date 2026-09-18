const express = require('express');
const router = express.Router();
const { getClientForUser } = require('../db/supabase');

router.get('/', async (req, res) => {
  const sb = getClientForUser(req.session.user.accessToken);

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: paidOrders },
    { count: shippedOrders },
    { count: deliveredOrders },
    { count: cancelledOrders },
    { count: totalProducts },
    { count: totalCustomers },
    { data: revenueData },
    { data: recentOrders },
    { data: lowStockProducts },
    { count: todayOrders },
    { count: awaitingShipment }
  ] = await Promise.all([
    sb.from('orders').select('*', { count: 'exact', head: true }),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'new'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'paid'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'shipped'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'delivered'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'cancelled'),
    sb.from('products').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    sb.from('orders').select('total').eq('payment_status', 'paid'),
    sb.from('orders').select('id, order_number, customer_name, total, payment_status, order_status, created_at')
      .order('created_at', { ascending: false }).limit(10),
    sb.from('products').select('id, name, sku, stock').lt('stock', 10).order('stock', { ascending: true }),
    sb.from('orders').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]),
    sb.from('orders').select('*', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .in('order_status', ['confirmed', 'processing', 'packed', 'ready_to_ship'])
  ]);

  const totalRevenue = (revenueData || []).reduce((sum, o) => sum + o.total, 0);

  res.json({
    stats: {
      totalOrders: totalOrders || 0,
      todayOrders: todayOrders || 0,
      pendingOrders: pendingOrders || 0,
      paidOrders: paidOrders || 0,
      awaitingShipment: awaitingShipment || 0,
      shippedOrders: shippedOrders || 0,
      deliveredOrders: deliveredOrders || 0,
      cancelledOrders: cancelledOrders || 0,
      totalRevenue,
      totalProducts: totalProducts || 0,
      lowStockProducts: lowStockProducts?.length || 0,
      totalCustomers: totalCustomers || 0
    },
    recentOrders: recentOrders || [],
    lowStockProducts: lowStockProducts || []
  });
});

module.exports = router;
