// 订单相关类型

export const OrderStatus = {
  PENDING_PAYMENT: 10, // 待付款
  PENDING_SHIPMENT: 20, // 待发货
  PENDING_RECEIPT: 30, // 待收货
  COMPLETED: 40, // 已完成
  CANCELLED: 50, // 已取消
  CLOSED: 60, // 已关闭
} as const

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus]

export const OrderStatusText: Record<OrderStatusValue, string> = {
  10: '待付款',
  20: '待发货',
  30: '待收货',
  40: '已完成',
  50: '已取消',
  60: '已关闭',
}

export interface OrderItem {
  product_id: string
  sku_id: string
  name: string
  spec_text: string
  image: string
  price: number // 分
  quantity: number
}

export interface OrderAddress {
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
}

export interface Order {
  _id: string
  _openid?: string
  order_no: string
  status: OrderStatusValue
  items: OrderItem[]
  total_amount: number // 商品总额（分）
  freight: number // 运费（分）
  discount_amount: number // 优惠金额（分）
  pay_amount: number // 实付金额（分）
  coupon_id?: string
  points_used: number
  /** 幂等键，防止重复下单 */
  client_order_id?: string
  address: OrderAddress
  remark?: string
  expire_at: number
  pay_at?: number
  deliver_at?: number
  finish_at?: number
  cancel_at?: number
  close_at?: number
  shipment?: {
    logistics_company: string
    logistics_no: string
    traces: Array<{
      time: number
      description: string
    }>
  }
  // 退款信息（仅一个进行中的退款）
  refund?: {
    _id: string
    type: 'only_refund' | 'refund_return'
    reason: string
    amount: number
    status: number
    reject_reason?: string
    return_company?: string
    return_no?: string
    return_at?: number
    approved_at?: number
    completed_at?: number
    created_at: number
  }
  created_at?: number
  updated_at?: number
}

export interface CreateOrderPayload {
  items: Array<{
    product_id: string
    sku_id: string
    name: string
    spec_text: string
    image: string
    price: number
    quantity: number
  }>
  address_id: string
  coupon_id?: string
  points_used?: number
  remark?: string
  from_cart_ids?: string[]
  /** 幂等键，防止重复下单 */
  client_order_id?: string
}
