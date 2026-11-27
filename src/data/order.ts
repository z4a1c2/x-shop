import { Order, OrderStatus, OrderStatusValue, CreateOrderPayload } from '@/types/order'
import { RefundStatus, RefundTypeValue, getRefundTypeForOrder } from '@/types/refund'

/**
 * order 云函数 mock
 * action: 'list' | 'detail' | 'create' | 'cancel' | 'ship' | 'confirmReceipt'
 *          | 'applyRefund' | 'agreeRefund' | 'rejectRefund' | 'buyerShipBack' | 'completeRefund'
 *          | 'points'
 */
const g = global as any
if (!g._orderStore) g._orderStore = {}
if (!g._pointsLogStore) g._pointsLogStore = {}
const store: Record<string, Order[]> = g._orderStore

const openid = 'demo-user'

// 初始化积分日志
function addPointsLog(delta: number, reason: string) {
  if (!g._pointsLogStore[openid]) g._pointsLogStore[openid] = []
  g._pointsLogStore[openid].unshift({
    _id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    delta,
    reason,
    balance: (g._pointsLogStore[openid][0]?.balance || 100) + delta,
    created_at: Date.now(),
  })
}

// 确保有初始积分
if (!g._pointsLogStore[openid]) {
  g._pointsLogStore[openid] = [
    {
      _id: 'init',
      delta: 100,
      reason: '新用户注册赠送',
      balance: 100,
      created_at: Date.now() - 7 * 86400 * 1000,
    },
  ]
}

const genOrderNo = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(Date.now()).slice(-4)}`
}

// 优惠券模板（与 coupon mock 保持一致）
const COUPON_TEMPLATES = [
  { _id: 'c1', name: '新人满 199 减 20', amount: 2000, threshold: 19900, expire_at: Date.now() + 30 * 24 * 3600 * 1000 },
  { _id: 'c2', name: '满 99 减 10', amount: 1000, threshold: 9900, expire_at: Date.now() + 15 * 24 * 3600 * 1000 },
  { _id: 'c3', name: '无门槛 5 元券', amount: 500, threshold: 0, expire_at: Date.now() + 7 * 24 * 3600 * 1000 },
]

interface UserCoupon {
  _id: string
  coupon_id: string
  status: 'unused' | 'used'
  received_at?: number
  used_at?: number
}

interface OrderActionPayload extends Partial<CreateOrderPayload> {
  action?: string
  id?: string
  status?: OrderStatusValue
  amount?: number
  reason?: string
  company?: string
  no?: string
  logistics_company?: string
  logistics_no?: string
}

// 当前用户可用积分
function getUserPoints() {
  const list = g._pointsLogStore[openid] || []
  return list.reduce((sum: number, item: { delta: number }) => sum + item.delta, 0)
}

// 标记优惠券已使用（下单时锁定）
function markCouponUsed(couponId?: string) {
  if (!couponId) return
  const userCoupons: UserCoupon[] = g._userCouponStore?.[openid] || []
  const uc = userCoupons.find((u) => u.coupon_id === couponId && u.status === 'unused')
  if (uc) {
    uc.status = 'used'
    uc.used_at = Date.now()
  }
}

// 恢复优惠券为未使用（取消/退款/关闭时）
function restoreCoupon(couponId?: string) {
  if (!couponId) return
  const userCoupons: UserCoupon[] = g._userCouponStore?.[openid] || []
  const uc = userCoupons.find((u) => u.coupon_id === couponId && u.status === 'used')
  if (uc) {
    uc.status = 'unused'
    delete uc.used_at
  }
}

// 模拟定时触发器：关闭已超时的待付款订单（归还优惠券）
// H5 无真实定时器，读取订单时惰性扫描，保持与 order-timeout 云函数行为一致
function sweepExpiredOrders() {
  const list = store[openid] || []
  const now = Date.now()
  list.forEach((o: Order) => {
    if (o.status === OrderStatus.PENDING_PAYMENT && o.expire_at && o.expire_at < now) {
      if (o.coupon_id) restoreCoupon(o.coupon_id)
      o.status = OrderStatus.CLOSED
      o.updated_at = now
      o.close_at = now
    }
  })
}

export default function orderMock(data: OrderActionPayload = {}) {
  const action = data.action || 'list'
  const openid = 'demo-user'

  if (!store[openid]) store[openid] = []
  const list = store[openid]

  switch (action) {
    case 'list': {
      sweepExpiredOrders()
      const status = data.status as OrderStatusValue | undefined
      const list = store[openid] || []
      const result = status ? list.filter((o: Order) => o.status === status) : list
      return Promise.resolve({ code: 0, message: 'success', data: [...result].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)) })
    }

    case 'detail': {
      sweepExpiredOrders()
      const list = store[openid] || []
      const order = list.find((o: Order) => o._id === data.id)
      return Promise.resolve({ code: 0, message: 'success', data: order || null })
    }

    case 'create': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const payload = data as CreateOrderPayload

      // 幂等性检查
      if (payload.client_order_id) {
        const existOrder = list.find((o: Order) => o.client_order_id === payload.client_order_id)
        if (existOrder) {
          return Promise.resolve({ code: 0, message: 'success (idempotent)', data: existOrder })
        }
      }

      // 计算金额
      const totalAmount = payload.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      const freight = totalAmount >= 9900 ? 0 : 600

      // 优惠券校验
      let discountAmount = 0
      const couponId = payload.coupon_id || ''
      if (couponId) {
        const tmpl = COUPON_TEMPLATES.find((t) => t._id === couponId)
        if (!tmpl) {
          return Promise.resolve({ code: -1, message: '优惠券不存在', data: null })
        }
        const userCoupons: UserCoupon[] = g._userCouponStore?.[openid] || []
        const uc = userCoupons.find((u) => u.coupon_id === couponId && u.status === 'unused')
        if (!uc) {
          return Promise.resolve({ code: -1, message: '优惠券不可用', data: null })
        }
        if (tmpl.expire_at < Date.now()) {
          return Promise.resolve({ code: -1, message: '优惠券已过期', data: null })
        }
        if (totalAmount < tmpl.threshold) {
          return Promise.resolve({ code: -1, message: `未满 ${tmpl.threshold / 100} 元，无法使用该优惠券`, data: null })
        }
        discountAmount = tmpl.amount
      }

      // 积分抵扣校验（100 积分 = 1 元，即 1 积分 = 1 分）
      let pointsUsed = payload.points_used || 0
      if (pointsUsed < 0) pointsUsed = 0
      const balance = getUserPoints()
      if (pointsUsed > balance) {
        return Promise.resolve({ code: -1, message: '积分不足', data: null })
      }
      const maxDeduction = Math.max(0, totalAmount + freight - discountAmount)
      if (pointsUsed > maxDeduction) pointsUsed = maxDeduction

      const payAmount = Math.max(0, totalAmount + freight - discountAmount - pointsUsed)

      // 锁定优惠券（下单即占用，取消/退款时归还）
      markCouponUsed(couponId)

      // 获取地址快照
      const addrList = g._addressStore?.['demo-user'] || []
      const addr = addrList.find((a: any) => a._id === payload.address_id) || addrList[0] || {
        name: '张三', phone: '13800138000',
        province: '浙江省', city: '杭州市', district: '西湖区', detail: '文三路 100 号',
      }

      const order: Order = {
        _id: `order-${Date.now()}`,
        order_no: genOrderNo(),
        status: OrderStatus.PENDING_PAYMENT,
        items: payload.items.map((i) => ({
          product_id: i.product_id,
          sku_id: i.sku_id,
          name: i.name,
          spec_text: i.spec_text,
          image: i.image,
          price: i.price,
          quantity: i.quantity,
        })),
        total_amount: totalAmount,
        freight,
        discount_amount: discountAmount,
        pay_amount: payAmount,
        coupon_id: couponId,
        points_used: pointsUsed,
        address: {
          name: addr.name, phone: addr.phone,
          province: addr.province, city: addr.city,
          district: addr.district, detail: addr.detail,
        },
        remark: payload.remark,
        expire_at: Date.now() + 30 * 60 * 1000, // 30 分钟
        created_at: Date.now(),
        updated_at: Date.now(),
        client_order_id: payload.client_order_id || '',
      }

      list.unshift(order)
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'cancel': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (order) {
        if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.PENDING_SHIPMENT) {
          return Promise.resolve({ code: -1, message: '当前状态不可取消', data: null })
        }
        const wasPaid = order.status === OrderStatus.PENDING_SHIPMENT
        // 归还优惠券
        if (order.coupon_id) restoreCoupon(order.coupon_id)
        // 退还已扣积分（待发货表示已支付，积分已扣）
        if (wasPaid && order.points_used > 0) {
          addPointsLog(order.points_used, `取消订单退回积分（${order.order_no}）`)
        }
        order.status = OrderStatus.CANCELLED
        order.cancel_at = Date.now()
        order.updated_at = Date.now()
      }
      return Promise.resolve({ code: 0, message: 'success', data: order || null })
    }

    case 'ship': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order) return Promise.resolve({ code: -1, message: '订单不存在', data: null })
      if (order.status !== OrderStatus.PENDING_SHIPMENT) {
        return Promise.resolve({ code: -1, message: '当前状态不可发货', data: null })
      }
      const company = data.logistics_company || '顺丰速运'
      const no = data.logistics_no || `SF${Date.now()}`
      const now = Date.now()
      order.status = OrderStatus.PENDING_RECEIPT
      order.deliver_at = now
      order.shipment = {
        logistics_company: company,
        logistics_no: no,
        traces: [
          { time: now - 3600 * 1000, description: '包裹已到达【杭州下沙中转场】' },
          { time: now - 1800 * 1000, description: '包裹已从【杭州下沙中转场】发出' },
          { time: now, description: `${company}已揽收，快递单号：${no}` },
        ],
      }
      order.updated_at = now
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'confirmReceipt': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order) return Promise.resolve({ code: -1, message: '订单不存在', data: null })
      if (order.status !== OrderStatus.PENDING_RECEIPT) {
        return Promise.resolve({ code: -1, message: '当前状态不可确认收货', data: null })
      }
      order.status = OrderStatus.COMPLETED
      order.finish_at = Date.now()
      order.updated_at = Date.now()
      // 追加物流轨迹
      if (order.shipment) {
        order.shipment.traces = [
          { time: Date.now(), description: '买家已确认收货，交易完成' },
          ...order.shipment.traces,
        ]
      }
      // 发放积分（按实付金额 1:1）
      const pointsEarned = Math.floor(order.pay_amount / 100)
      if (pointsEarned > 0) {
        addPointsLog(pointsEarned, `订单完成返积分（${order.order_no}）`)
      }
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    // ============ 退款相关 ============

    case 'applyRefund': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order) return Promise.resolve({ code: -1, message: '订单不存在', data: null })

      // 已有退款进行中不允许重复申请
      if (order.refund && order.refund.status !== RefundStatus.REJECTED && order.refund.status !== RefundStatus.SUCCESS) {
        return Promise.resolve({ code: -1, message: '已有进行中的退款申请', data: null })
      }

      const refundType: RefundTypeValue | null = getRefundTypeForOrder(order.status)
      if (!refundType) {
        return Promise.resolve({ code: -1, message: '当前订单状态不可申请退款', data: null })
      }

      const amount = Math.min(data.amount || order.pay_amount, order.pay_amount)
      const now = Date.now()

      order.refund = {
        _id: `refund-${Date.now()}`,
        type: refundType,
        reason: data.reason || '用户申请退款',
        amount,
        status: RefundStatus.PENDING,
        created_at: now,
      }
      order.updated_at = now
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'agreeRefund': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order || !order.refund) return Promise.resolve({ code: -1, message: '退款不存在', data: null })
      if (order.refund.status !== RefundStatus.PENDING) {
        return Promise.resolve({ code: -1, message: '当前退款状态不可审核', data: null })
      }
      order.refund.status = order.refund.type === 'only_refund' ? RefundStatus.SUCCESS : RefundStatus.WAIT_RETURN
      order.refund.approved_at = Date.now()
      order.updated_at = Date.now()

      // 仅退款直接完成：积分退回 + 归还优惠券 + 订单置为已取消
      if (order.refund.type === 'only_refund') {
        const pointsToReturn = order.points_used
        if (pointsToReturn > 0) {
          addPointsLog(pointsToReturn, `退款退回积分（${order.order_no}）`)
        }
        if (order.coupon_id) restoreCoupon(order.coupon_id)
        order.refund.status = RefundStatus.SUCCESS
        order.refund.completed_at = Date.now()
        order.status = OrderStatus.CANCELLED
        order.cancel_at = Date.now()
      }
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'rejectRefund': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order || !order.refund) return Promise.resolve({ code: -1, message: '退款不存在', data: null })
      if (order.refund.status !== RefundStatus.PENDING) {
        return Promise.resolve({ code: -1, message: '当前退款状态不可拒绝', data: null })
      }
      order.refund.status = RefundStatus.REJECTED
      order.refund.reject_reason = data.reason || '商家拒绝退款'
      order.updated_at = Date.now()
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'buyerShipBack': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order || !order.refund) return Promise.resolve({ code: -1, message: '退款不存在', data: null })
      if (order.refund.status !== RefundStatus.WAIT_RETURN) {
        return Promise.resolve({ code: -1, message: '当前退款状态不可寄回', data: null })
      }
      order.refund.status = RefundStatus.WAIT_RECEIPT
      order.refund.return_company = data.company || '顺丰速运'
      order.refund.return_no = data.no || `SF${Date.now()}`
      order.refund.return_at = Date.now()
      order.updated_at = Date.now()
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'completeRefund': {
      if (!store[openid]) store[openid] = []
      const list = store[openid]
      const order = list.find((o: Order) => o._id === data.id)
      if (!order || !order.refund) return Promise.resolve({ code: -1, message: '退款不存在', data: null })
      if (order.refund.status !== RefundStatus.WAIT_RECEIPT) {
        return Promise.resolve({ code: -1, message: '当前退款状态不可确认收货', data: null })
      }
      order.refund.status = RefundStatus.SUCCESS
      order.refund.completed_at = Date.now()
      // 退回积分
      const pointsToReturn = order.points_used
      if (pointsToReturn > 0) {
        addPointsLog(pointsToReturn, `退货退款退回积分（${order.order_no}）`)
      }
      // 归还优惠券
      if (order.coupon_id) restoreCoupon(order.coupon_id)
      // 订单置为已取消
      order.status = OrderStatus.CANCELLED
      order.cancel_at = Date.now()
      order.updated_at = Date.now()
      return Promise.resolve({ code: 0, message: 'success', data: order })
    }

    case 'points': {
      const pointsList = g._pointsLogStore[openid] || []
      if (data.action === 'list') {
        return Promise.resolve({ code: 0, message: 'success', data: pointsList })
      }
      // 查询当前总积分
      const total = pointsList.reduce((sum: number, item: { delta: number }) => sum + item.delta, 0)
      return Promise.resolve({ code: 0, message: 'success', data: { total, logs: pointsList } })
    }

    default:
      return Promise.resolve({ code: -1, message: '未知操作', data: null })
  }
}
