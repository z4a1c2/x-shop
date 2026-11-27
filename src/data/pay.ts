import { Order, OrderStatus } from '@/types/order'

/**
 * pay 云函数 mock
 * action: 'mockPay' —— 模拟支付成功，将订单状态流转为待发货
 */
const g = global as any

// 扣减积分（写入 points_log，与 order mock 保持一致的存储）
function deductPoints(delta: number, reason: string) {
  if (!g._pointsLogStore) g._pointsLogStore = {}
  if (!g._pointsLogStore['demo-user']) g._pointsLogStore['demo-user'] = []
  const logs = g._pointsLogStore['demo-user']
  logs.unshift({
    _id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    delta,
    reason,
    balance: (logs[0]?.balance || 100) + delta,
    created_at: Date.now(),
  })
}

export default function payMock(data: any = {}) {
  const action = data.action || ''

  switch (action) {
    case 'mockPay': {
      const orderId = data.orderId
      const orderList: Order[] = g._orderStore?.['demo-user'] || []
      const order = orderList.find((o: Order) => o._id === orderId)

      if (!order) {
        return Promise.resolve({ code: -1, message: '订单不存在', data: null })
      }
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        return Promise.resolve({ code: -1, message: '订单状态不允许支付', data: null })
      }

      // 扣减用户使用的积分（下单时已锁定，支付成功后正式扣减）
      if (order.points_used && order.points_used > 0) {
        deductPoints(-order.points_used, `订单支付扣减积分（${order.order_no}）`)
      }

      // 流转到待发货
      order.status = OrderStatus.PENDING_SHIPMENT
      order.pay_at = Date.now()
      order.updated_at = Date.now()

      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    default:
      return Promise.resolve({ code: -1, message: '未知操作', data: null })
  }
}
