// 退款类型定义

export const RefundStatus = {
  PENDING: 10,        // 待处理
  WAIT_RETURN: 20,    // 待退货
  WAIT_RECEIPT: 30,   // 待收货
  SUCCESS: 40,        // 退款成功
  REJECTED: 50,       // 已拒绝
} as const

export type RefundStatusValue = (typeof RefundStatus)[keyof typeof RefundStatus]

export const RefundStatusText: Record<RefundStatusValue, string> = {
  10: '待处理',
  20: '待退货',
  30: '待收货',
  40: '退款成功',
  50: '已拒绝',
}

export const RefundType = {
  ONLY_REFUND: 'only_refund',     // 仅退款
  REFUND_RETURN: 'refund_return', // 退货退款
} as const

export type RefundTypeValue = (typeof RefundType)[keyof typeof RefundType]

export interface Refund {
  _id: string
  order_id: string
  type: RefundTypeValue
  reason: string
  amount: number          // 分
  status: RefundStatusValue
  // 退货物流
  return_company?: string
  return_no?: string
  return_at?: number
  // 处理记录
  reject_reason?: string
  approved_at?: number
  completed_at?: number
  created_at: number
  updated_at: number
}

// 根据订单状态判断可申请的退款类型
export function getRefundTypeForOrder(orderStatus: number): RefundTypeValue | null {
  // 订单待发货(20) → 仅退款
  if (orderStatus === 20) return RefundType.ONLY_REFUND
  // 订单待收货(30)或已完成(40) → 退货退款
  if (orderStatus === 30 || orderStatus === 40) return RefundType.REFUND_RETURN
  return null
}

// 退款状态是否可操作
export function canOperateRefund(status: RefundStatusValue): boolean {
  return status === RefundStatus.PENDING || status === RefundStatus.WAIT_RETURN
}
