-- Dashboard stats RPC — single call replaces 13 parallel Express queries
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;

  select jsonb_build_object(
    'totalOrders', (select count(*) from orders),
    'todayOrders', (select count(*) from orders where created_at >= current_date),
    'pendingOrders', (select count(*) from orders where order_status = 'new'),
    'paidOrders', (select count(*) from orders where payment_status = 'paid'),
    'awaitingShipment', (select count(*) from orders where order_status in ('confirmed','processing','packed','ready_to_ship')),
    'shippedOrders', (select count(*) from orders where order_status in ('shipped','in_transit','out_for_delivery')),
    'deliveredOrders', (select count(*) from orders where order_status = 'delivered'),
    'cancelledOrders', (select count(*) from orders where order_status = 'cancelled'),
    'totalRevenue', coalesce((select sum(total) from orders where payment_status = 'paid'), 0),
    'totalProducts', (select count(*) from products),
    'lowStockProducts', (select count(*) from products where stock < 10 and stock > 0),
    'totalCustomers', (select count(*) from profiles where role = 'customer')
  ) into v_stats;

  return v_stats;
end;
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;
