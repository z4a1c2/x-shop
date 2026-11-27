import React, { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Order, OrderStatus, OrderStatusText, OrderStatusValue } from '@/types/order'
import { RefundStatus, RefundStatusText } from '@/types/refund'
import styles from './index.module.scss'

const tabs: { key: OrderStatusValue | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: OrderStatus.PENDING_PAYMENT, label: '待付款' },
  { key: OrderStatus.PENDING_SHIPMENT, label: '待发货' },
  { key: OrderStatus.PENDING_RECEIPT, label: '待收货' },
  { key: OrderStatus.COMPLETED, label: '已完成' },
]

const OrderListPage: React.FC = () => {
  const router = useRouter()
  const initialStatus = parseInt(router.params.status || '', 10) || 0
  const [activeTab, setActiveTab] = useState<OrderStatusValue | 'all'>(
    (initialStatus as OrderStatusValue) || 'all'
  )
  const [orders, setOrders] = useState<Order[]>([])

  const loadOrders = async () => {
    try {
      const data: any = await callFunction('order', {
        action: 'list',
        status: activeTab === 'all' ? undefined : activeTab,
      })
      setOrders(data || [])
    } catch (err) {
      console.error('[OrderList] load error:', err)
    }
  }

  useDidShow(() => {
    loadOrders()
  })

  useEffect(() => {
    loadOrders()
  }, [activeTab])

  const handleTabChange = (key: OrderStatusValue | 'all') => {
    setActiveTab(key)
  }

  const handleViewDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
  }

  const handleCancel = async (id: string) => {
    Taro.showModal({
      title: '提示',
      content: '确认取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('order', { action: 'cancel', id })
            Taro.showToast({ title: '已取消', icon: 'success' })
            loadOrders()
          } catch (err: any) {
            Taro.showToast({ title: err.message || '取消失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handlePay = (id: string) => {
    Taro.redirectTo({ url: `/pages/pay-result/index?orderId=${id}` })
  }

  const handleShip = async (id: string) => {
    try {
      await callFunction('order', { action: 'ship', id })
      Taro.showToast({ title: '已发货', icon: 'success' })
      loadOrders()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }

  const handleConfirmReceipt = async (id: string) => {
    Taro.showModal({
      title: '提示',
      content: '确认已收到商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('order', { action: 'confirmReceipt', id })
            Taro.showToast({ title: '已确认收货', icon: 'success' })
            loadOrders()
          } catch (err: any) {
            Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      },
    })
  }

  return (
    <View className={styles.page}>
      {/* Tab 切换 */}
      <View className={styles.tabs}>
        {tabs.map((tab) => (
          <View
            key={String(tab.key)}
            className={`${styles.tabItem} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      {orders.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>📦</Text>
          <Text className={styles.emptyText}>暂无相关订单</Text>
        </View>
      ) : (
        <View className={styles.orderList}>
          {orders.map((order) => (
            <View
              key={order._id}
              className={styles.orderCard}
              onClick={() => handleViewDetail(order._id)}
            >
              <View className={styles.orderHeader}>
                <Text className={styles.orderNo}>订单号：{order.order_no}</Text>
                <View className={styles.orderStatusWrap}>
                  {order.refund && order.refund.status !== RefundStatus.SUCCESS && order.refund.status !== RefundStatus.REJECTED && (
                    <Text className={styles.refundTag}>
                      {RefundStatusText[order.refund.status]}
                    </Text>
                  )}
                  <Text className={styles.orderStatus}>{OrderStatusText[order.status]}</Text>
                </View>
              </View>
              <View className={styles.orderBody}>
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
              <View className={styles.orderFooter}>
                <Text className={styles.orderTotalLabel}>
                  共{order.items.length}件，实付：
                </Text>
                <Text className={styles.orderTotal}>¥{(order.pay_amount / 100).toFixed(2)}</Text>
                <View className={styles.orderActions}>
                  {order.status === OrderStatus.PENDING_PAYMENT && (
                    <>
                      <View
                        className={styles.actionBtn}
                        onClick={(e: any) => { e.stopPropagation?.(); handleCancel(order._id) }}
                      >
                        取消订单
                      </View>
                      <View
                        className={`${styles.actionBtn} ${styles.primary}`}
                        onClick={(e: any) => { e.stopPropagation?.(); handlePay(order._id) }}
                      >
                        去支付
                      </View>
                    </>
                  )}
                  {order.status === OrderStatus.PENDING_SHIPMENT && (
                    <View
                      className={`${styles.actionBtn} ${styles.primary}`}
                      onClick={(e: any) => { e.stopPropagation?.(); handleShip(order._id) }}
                    >
                      模拟发货
                    </View>
                  )}
                  {order.status === OrderStatus.PENDING_RECEIPT && (
                    <View
                      className={`${styles.actionBtn} ${styles.primary}`}
                      onClick={(e: any) => { e.stopPropagation?.(); handleConfirmReceipt(order._id) }}
                    >
                      确认收货
                    </View>
                  )}
                  {order.status === OrderStatus.COMPLETED && (
                    <View
                      className={`${styles.actionBtn} ${styles.ghost}`}
                      onClick={(e: any) => { e.stopPropagation?.(); /* 评价 */ Taro.showToast({ title: '评价功能开发中', icon: 'none' }) }}
                    >
                      去评价
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default OrderListPage
