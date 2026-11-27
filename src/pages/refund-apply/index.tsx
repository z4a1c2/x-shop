import React, { useEffect, useState } from 'react'
import { View, Text, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Order } from '@/types/order'
import { getRefundTypeForOrder, RefundType } from '@/types/refund'
import styles from './index.module.scss'

const REFUND_REASONS = [
  '商品质量问题',
  '商品与描述不符',
  '商品损坏',
  '不想要了',
  '发错货',
  '其他原因',
]

const RefundApplyPage: React.FC = () => {
  const router = useRouter()
  const orderId = router.params.orderId || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [reasonIndex, setReasonIndex] = useState(0)
  const [remark, setRemark] = useState('')

  useEffect(() => {
    loadOrder()
  }, [orderId])

  const loadOrder = async () => {
    try {
      const data: any = await callFunction('order', { action: 'detail', id: orderId })
      setOrder(data)
    } catch (err) {
      Taro.showToast({ title: '订单不存在', icon: 'none' })
    }
  }

  const getRefundType = () => {
    if (!order) return null
    return getRefundTypeForOrder(order.status)
  }

  const handleSubmit = async () => {
    if (!order) return
    const refundType = getRefundType()
    if (!refundType) {
      Taro.showToast({ title: '当前状态不可退款', icon: 'none' })
      return
    }

    Taro.showModal({
      title: '确认申请退款？',
      content: `退款金额：¥${(order.pay_amount / 100).toFixed(2)}`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('order', {
              action: 'applyRefund',
              id: order._id,
              reason: REFUND_REASONS[reasonIndex] + (remark ? ` - ${remark}` : ''),
            })
            Taro.showToast({ title: '申请成功', icon: 'success' })
            setTimeout(() => {
              Taro.redirectTo({ url: `/pages/order-detail/index?id=${order._id}` })
            }, 1500)
          } catch (err: any) {
            Taro.showToast({ title: err.message || '申请失败', icon: 'none' })
          }
        }
      },
    })
  }

  if (!order) {
    return <View className={styles.loading}>加载中...</View>
  }

  const refundType = getRefundType()

  return (
    <View className={styles.page}>
      {/* 订单商品预览 */}
      <View className={styles.orderCard}>
        <View className={styles.orderNo}>订单号：{order.order_no}</View>
        {order.items.map((item) => (
          <View key={item.sku_id} className={styles.item}>
            <View className={styles.itemImg}>{item.name.charAt(0)}</View>
            <View className={styles.itemInfo}>
              <Text className={styles.itemName}>{item.name}</Text>
              <Text className={styles.itemSpec}>{item.spec_text}</Text>
            </View>
            <View className={styles.itemPrice}>
              <Text className={styles.price}>¥{(item.price / 100).toFixed(2)}</Text>
              <Text className={styles.qty}>x{item.quantity}</Text>
            </View>
          </View>
        ))}
        <View className={styles.totalRow}>
          <Text>退款金额</Text>
          <Text className={styles.totalPrice}>¥{(order.pay_amount / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* 退款类型 */}
      <View className={styles.typeCard}>
        <Text className={styles.cardTitle}>退款类型</Text>
        <View className={styles.typeTag}>
          {refundType === RefundType.ONLY_REFUND ? '仅退款' : '退货退款'}
        </View>
        <Text className={styles.typeDesc}>
          {refundType === RefundType.ONLY_REFUND
            ? '未发货订单，仅退款'
            : '已发货订单，需寄回商品'}
        </Text>
      </View>

      {/* 退款原因 */}
      <View className={styles.reasonCard}>
        <Text className={styles.cardTitle}>退款原因</Text>
        <View className={styles.reasonList}>
          {REFUND_REASONS.map((reason, idx) => (
            <View
              key={reason}
              className={`${styles.reasonItem} ${reasonIndex === idx ? styles.active : ''}`}
              onClick={() => setReasonIndex(idx)}
            >
              <View className={`${styles.radio} ${reasonIndex === idx ? styles.radioActive : ''}`} />
              <Text>{reason}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 补充说明 */}
      <View className={styles.remarkCard}>
        <Text className={styles.cardTitle}>补充说明（选填）</Text>
        <Textarea
          className={styles.textarea}
          value={remark}
          placeholder='请详细描述问题，方便商家处理'
          maxlength={200}
          onInput={(e: any) => setRemark(e.detail.value)}
        />
      </View>

      {/* 提交按钮 */}
      <View className={styles.footer}>
        <View className={styles.submitBtn} onClick={handleSubmit}>
          提交申请
        </View>
      </View>
    </View>
  )
}

export default RefundApplyPage
