import React, { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Order, OrderStatus, OrderStatusText } from '@/types/order'
import { RefundStatus, RefundStatusText } from '@/types/refund'
import styles from './index.module.scss'

// 仅开发环境展示商家模拟操作（模拟发货、同意/拒绝退款等），买家端生产环境隐藏
const SHOW_MERCHANT_ACTIONS = process.env.NODE_ENV === 'development'

const OrderDetailPage: React.FC = () => {
  const router = useRouter()
  const orderId = router.params.id || ''
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    loadDetail()
  }, [orderId])

  const loadDetail = async () => {
    try {
      const data: any = await callFunction('order', { action: 'detail', id: orderId })
      setOrder(data || null)
    } catch (err) {
      console.error('[OrderDetail] load error:', err)
    }
  }

  const handlePay = () => {
    Taro.redirectTo({ url: `/pages/pay-result/index?orderId=${orderId}` })
  }

  const handleCancel = () => {
    Taro.showModal({
      title: '提示',
      content: '确认取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('order', { action: 'cancel', id: orderId })
            Taro.showToast({ title: '已取消', icon: 'success' })
            loadDetail()
          } catch (err: any) {
            Taro.showToast({ title: err.message || '取消失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleMockShip = () => {
    Taro.showModal({
      title: '提示',
      content: '模拟商家发货？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newOrder: any = await callFunction('order', { action: 'ship', id: orderId })
            setOrder(newOrder)
            Taro.showToast({ title: '已发货', icon: 'success' })
          } catch (err: any) {
            Taro.showToast({ title: err.message || '发货失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleConfirmReceipt = () => {
    Taro.showModal({
      title: '提示',
      content: '确认已收到商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newOrder: any = await callFunction('order', { action: 'confirmReceipt', id: orderId })
            setOrder(newOrder)
            Taro.showToast({ title: '已确认收货', icon: 'success' })
          } catch (err: any) {
            Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleApplyRefund = () => {
    Taro.navigateTo({ url: `/pages/refund-apply/index?orderId=${orderId}` })
  }

  // ========== 退款操作（商家模拟） ==========
  const handleAgreeRefund = async () => {
    try {
      const newOrder: any = await callFunction('order', { action: 'agreeRefund', id: orderId })
      setOrder(newOrder)
      Taro.showToast({ title: '已同意', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }

  const handleRejectRefund = async () => {
    Taro.showModal({
      title: '拒绝退款',
      content: '确定要拒绝该退款申请吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newOrder: any = await callFunction('order', {
              action: 'rejectRefund',
              id: orderId,
              reason: '商品已完好发货，不支持退款',
            })
            setOrder(newOrder)
            Taro.showToast({ title: '已拒绝', icon: 'success' })
          } catch (err: any) {
            Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleBuyerShipBack = async () => {
    try {
      const newOrder: any = await callFunction('order', { action: 'buyerShipBack', id: orderId })
      setOrder(newOrder)
      Taro.showToast({ title: '已寄回', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }

  const handleCompleteRefund = async () => {
    Taro.showModal({
      title: '确认收货',
      content: '确认已收到退货商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newOrder: any = await callFunction('order', { action: 'completeRefund', id: orderId })
            setOrder(newOrder)
            Taro.showToast({ title: '退款完成', icon: 'success' })
          } catch (err: any) {
            Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  if (!order) {
    return <View style={{ padding: '120rpx', textAlign: 'center', color: '#86909c' }}>加载中...</View>
  }

  const refund = order.refund

  // 退款卡片中模拟操作按钮（仅在退款进行中时显示）
  const renderRefundActions = () => {
    if (!refund) return null

    if (refund.status === RefundStatus.PENDING) {
      if (!SHOW_MERCHANT_ACTIONS) return null
      return (
        <View className={styles.refundActions}>
          <View className={styles.refundBtn} onClick={handleRejectRefund}>
            拒绝退款
          </View>
          <View className={`${styles.refundBtn} ${styles.refundPrimary}`} onClick={handleAgreeRefund}>
            同意退款
          </View>
        </View>
      )
    }

    if (refund.status === RefundStatus.WAIT_RETURN && refund.type === 'refund_return') {
      return (
        <View className={styles.refundActions}>
          <View className={`${styles.refundBtn} ${styles.refundPrimary}`} onClick={handleBuyerShipBack}>
            填写退货物流
          </View>
        </View>
      )
    }

    if (refund.status === RefundStatus.WAIT_RECEIPT) {
      if (!SHOW_MERCHANT_ACTIONS) return null
      return (
        <View className={styles.refundActions}>
          <View className={`${styles.refundBtn} ${styles.refundPrimary}`} onClick={handleCompleteRefund}>
            商家确认收货（模拟）
          </View>
        </View>
      )
    }

    return null
  }

  return (
    <View className={styles.page}>
      {/* 状态 Banner */}
      <View className={styles.statusBanner}>
        <Text className={styles.statusTitle}>{OrderStatusText[order.status]}</Text>
        <Text className={styles.statusDesc}>
          {order.status === OrderStatus.PENDING_PAYMENT && '请尽快完成支付，超时订单将自动关闭'}
          {order.status === OrderStatus.PENDING_SHIPMENT && '您的订单正在备货中，请耐心等待'}
          {order.status === OrderStatus.PENDING_RECEIPT && '商品已发出，请注意查收'}
          {order.status === OrderStatus.COMPLETED && '感谢您的购买，期待再次光临'}
          {order.status === OrderStatus.CANCELLED && '订单已取消'}
          {order.status === OrderStatus.CLOSED && '订单已关闭'}
        </Text>
      </View>

      {/* 退款状态卡片（如有） */}
      {refund && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>售后服务</Text>
          <View className={styles.refundInfo}>
            <View className={styles.refundRow}>
              <Text className={styles.refundLabel}>退款类型</Text>
              <Text className={styles.refundValue}>
                {refund.type === 'only_refund' ? '仅退款' : '退货退款'}
              </Text>
            </View>
            <View className={styles.refundRow}>
              <Text className={styles.refundLabel}>退款状态</Text>
              <Text className={`${styles.refundValue} ${styles.refundStatus}`}>
                {RefundStatusText[refund.status]}
              </Text>
            </View>
            <View className={styles.refundRow}>
              <Text className={styles.refundLabel}>退款金额</Text>
              <Text className={styles.refundAmount}>¥{(refund.amount / 100).toFixed(2)}</Text>
            </View>
            <View className={styles.refundRow}>
              <Text className={styles.refundLabel}>退款原因</Text>
              <Text className={styles.refundText}>{refund.reason}</Text>
            </View>
            {refund.reject_reason && (
              <View className={styles.refundRow}>
                <Text className={styles.refundLabel}>拒绝原因</Text>
                <Text className={styles.refundReject}>{refund.reject_reason}</Text>
              </View>
            )}
            {refund.return_no && (
              <View className={styles.refundRow}>
                <Text className={styles.refundLabel}>退货物流</Text>
                <Text className={styles.refundText}>
                  {refund.return_company} · {refund.return_no}
                </Text>
              </View>
            )}
            {refund.completed_at && (
              <View className={styles.refundRow}>
                <Text className={styles.refundLabel}>完成时间</Text>
                <Text className={styles.refundText}>
                  {new Date(refund.completed_at).toLocaleString()}
                </Text>
              </View>
            )}
            <View className={styles.refundRow}>
              <Text className={styles.refundLabel}>申请时间</Text>
              <Text className={styles.refundText}>
                {new Date(refund.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
          {renderRefundActions()}
        </View>
      )}

      {/* 物流信息（待收货/已完成时显示） */}
      {order.shipment && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>物流信息</Text>
          <View className={styles.shipInfo}>
            {order.shipment.logistics_company} · {order.shipment.logistics_no}
          </View>
          <View>
            {order.shipment.traces.map((trace, idx) => (
              <View key={idx} className={styles.traceItem}>
                <View
                  className={`${styles.traceDot} ${idx === 0 ? styles.traceDotActive : ''}`}
                />
                <View className={styles.traceContent}>
                  <Text className={idx === 0 ? styles.traceTextActive : styles.traceText}>
                    {trace.description}
                  </Text>
                  <Text className={styles.traceTime}>
                    {new Date(trace.time).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 收货地址 */}
      <View className={styles.section}>
        <View className={styles.addrInfo}>
          <View className={styles.addrRow}>
            <Text className={styles.addrName}>{order.address.name}</Text>
            <Text className={styles.addrPhone}>{order.address.phone}</Text>
          </View>
          <Text className={styles.addrDetail}>
            {order.address.province} {order.address.city} {order.address.district} {order.address.detail}
          </Text>
        </View>
      </View>

      {/* 商品清单 */}
      <View className={styles.section}>
        <View className={styles.itemList}>
          {order.items.map((item, idx) => (
            <View key={idx} className={styles.itemRow}>
              <Image className={styles.itemImage} src={item.image} mode='aspectFill' />
              <View className={styles.itemInfo}>
                <Text className={styles.itemName}>{item.name}</Text>
                <Text className={styles.itemSpec}>{item.spec_text}</Text>
                <View className={styles.itemBottom}>
                  <Text className={styles.itemPrice}>¥{(item.price / 100).toFixed(2)}</Text>
                  <Text className={styles.itemQty}>x{item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 金额明细 */}
      <View className={styles.section}>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>商品金额</Text>
          <Text className={styles.amountValue}>¥{(order.total_amount / 100).toFixed(2)}</Text>
        </View>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>运费</Text>
          <Text className={styles.amountValue}>¥{(order.freight / 100).toFixed(2)}</Text>
        </View>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>优惠</Text>
          <Text className={`${styles.amountValue} ${styles.amountDiscount}`}>
            -¥{(order.discount_amount / 100).toFixed(2)}
          </Text>
        </View>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>实付款</Text>
          <Text className={styles.payAmount}>¥{(order.pay_amount / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* 订单信息 */}
      <View className={styles.section}>
        <View className={styles.orderInfo}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>订单编号</Text>
            <Text className={styles.infoValue}>{order.order_no}</Text>
          </View>
          {order.remark && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>买家留言</Text>
              <Text className={styles.infoValue}>{order.remark}</Text>
            </View>
          )}
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>下单时间</Text>
            <Text className={styles.infoValue}>
              {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
            </Text>
          </View>
          {order.pay_at && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>支付时间</Text>
              <Text className={styles.infoValue}>
                {new Date(order.pay_at).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        {/* 申请售后入口（待发货/待收货/已完成 且无退款进行中） */}
        {!refund && (order.status === OrderStatus.PENDING_SHIPMENT ||
          order.status === OrderStatus.PENDING_RECEIPT ||
          order.status === OrderStatus.COMPLETED) && (
          <View className={styles.actionBtn} onClick={handleApplyRefund}>
            申请售后
          </View>
        )}

        {order.status === OrderStatus.PENDING_PAYMENT && (
          <>
            <View className={styles.actionBtn} onClick={handleCancel}>
              取消订单
            </View>
            <View className={`${styles.actionBtn} ${styles.primary}`} onClick={handlePay}>
              立即付款
            </View>
          </>
        )}
        {order.status === OrderStatus.PENDING_SHIPMENT && !refund && SHOW_MERCHANT_ACTIONS && (
          <View className={`${styles.actionBtn} ${styles.primary}`} onClick={handleMockShip}>
            模拟发货
          </View>
        )}
        {order.status === OrderStatus.PENDING_RECEIPT && !refund && (
          <View className={`${styles.actionBtn} ${styles.primary}`} onClick={handleConfirmReceipt}>
            确认收货
          </View>
        )}
        {(order.status === OrderStatus.COMPLETED ||
          order.status === OrderStatus.CANCELLED ||
          order.status === OrderStatus.CLOSED) && (
          <View
            className={`${styles.actionBtn} ${styles.ghost}`}
            onClick={() => Taro.switchTab({ url: '/pages/home/index' })}
          >
            再次购买
          </View>
        )}
      </View>
    </View>
  )
}

export default OrderDetailPage
