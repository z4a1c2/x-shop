import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Order, OrderStatusText } from '@/types/order'
import styles from './index.module.scss'

const PayResultPage: React.FC = () => {
  const router = useRouter()
  const orderId = router.params.orderId || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [paying, setPaying] = useState(true)

  useEffect(() => {
    // 模拟支付流程：H5 预览环境自动"支付成功"
    const timer = setTimeout(async () => {
      try {
        if (orderId) {
          const result: any = await callFunction('pay', { action: 'mockPay', orderId })
          if (result && result._id) {
            setOrder(result)
          }
        }
      } catch (err) {
        console.error('[PayResult] mock pay error:', err)
      } finally {
        setPaying(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [orderId])

  const handleViewOrder = () => {
    Taro.redirectTo({ url: `/pages/order-detail/index?id=${orderId}` })
  }

  const handleBackHome = () => {
    Taro.switchTab({ url: '/pages/home/index' })
  }

  if (paying) {
    return (
      <View className={styles.page}>
        <Text className={styles.statusIcon}>⏳</Text>
        <Text className={styles.statusTitle}>支付中...</Text>
        <Text className={styles.statusDesc}>请稍候</Text>
      </View>
    )
  }

  const isSuccess = order && order.status >= 20

  return (
    <View className={styles.page}>
      <Text className={styles.statusIcon}>{isSuccess ? '✅' : '❌'}</Text>
      <Text className={styles.statusTitle}>{isSuccess ? '支付成功' : '支付失败'}</Text>
      <Text className={styles.statusDesc}>
        {isSuccess ? '感谢您的购买，商品将尽快发货' : '支付未完成，请重新下单'}
      </Text>

      {order && (
        <View className={styles.orderInfo}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>订单编号</Text>
            <Text className={styles.infoValue}>{order.order_no}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>订单状态</Text>
            <Text className={styles.infoValue}>{OrderStatusText[order.status]}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>实付金额</Text>
            <Text className={styles.amount}>¥{(order.pay_amount / 100).toFixed(2)}</Text>
          </View>
        </View>
      )}

      <View className={styles.btnGroup}>
        <View className={`${styles.btn} ${styles.ghost}`} onClick={handleBackHome}>
          继续购物
        </View>
        <View className={`${styles.btn} ${styles.primary}`} onClick={handleViewOrder}>
          查看订单
        </View>
      </View>
    </View>
  )
}

export default PayResultPage
