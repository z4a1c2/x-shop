export interface Coupon {
  _id: string
  name: string
  amount: number // 分
  threshold: number // 满多少可用（分），0 为无门槛
  description: string
  expire_at: number
  status: 'available' | 'used' | 'expired'
  received?: boolean
  user_coupon_id?: string
}
