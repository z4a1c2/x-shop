import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import styles from './index.module.scss'

interface Coupon {
  _id: string
  name: string
  amount: number // 分
  threshold: number // 满多少可用（分），0 为无门槛
  description: string
  expire_at: number
  status: 'available' | 'used' | 'expired' // available 可领/可用, used 已使用, expired 已过期
  received?: boolean
  user_coupon_id?: string // 领取后生成的用户券 id
}

const DEFAULT_COUPONS: Coupon[] = [
  {
    _id: 'c1',
    name: '新人满 199 减 20',
    amount: 2000,
    threshold: 19900,
    description: '全场商品可用',
    expire_at: Date.now() + 30 * 24 * 3600 * 1000,
    status: 'available',
  },
  {
    _id: 'c2',
    name: '满 99 减 10',
    amount: 1000,
    threshold: 9900,
    description: '服装品类专享',
    expire_at: Date.now() + 15 * 24 * 3600 * 1000,
    status: 'available',
  },
  {
    _id: 'c3',
    name: '无门槛 5 元券',
    amount: 500,
    threshold: 0,
    description: '限首次下单使用',
    expire_at: Date.now() + 7 * 24 * 3600 * 1000,
    status: 'available',
  },
]

const CouponPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available')
  const [coupons, setCoupons] = useState<Coupon[]>(DEFAULT_COUPONS)

  const loadCoupons = async () => {
    try {
      const data: any = await callFunction('coupon', { action: 'list', type: activeTab })
      setCoupons(data || DEFAULT_COUPONS)
    } catch (err) {
      setCoupons(DEFAULT_COUPONS)
    }
  }

  useDidShow(() => {
    loadCoupons()
  })

  useEffect(() => {
    loadCoupons()
  }, [activeTab])

  const handleReceive = async (coupon: Coupon) => {
    try {
      await callFunction('coupon', { action: 'receive', coupon_id: coupon._id })
      Taro.showToast({ title: '领取成功', icon: 'success' })
      loadCoupons()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '领取失败', icon: 'none' })
    }
  }

  const handleUse = (coupon: Coupon) => {
    Taro.showToast({ title: '去下单使用', icon: 'none' })
  }

  const filteredCoupons = coupons.filter((c) => {
    if (activeTab === 'available') return c.status === 'available' && !c.received
    if (activeTab === 'used') return c.received
    if (activeTab === 'expired') return c.status === 'expired'
    return true
  })

  return (
    <View className={styles.page}>
      {/* Tab 切换 */}
      <View className={styles.tabs}>
        {(['available', 'used', 'expired'] as const).map((tab) => (
          <View
            key={tab}
            className={`${styles.tabItem} ${activeTab === tab ? styles.active : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'available' ? '可领取' : tab === 'used' ? '已领取' : '已过期'}
          </View>
        ))}
      </View>

      {/* 优惠券列表 */}
      {filteredCoupons.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>🎟️</Text>
          <Text className={styles.emptyText}>
            {activeTab === 'available' ? '暂无优惠券可领取' : '暂无优惠券'}
          </Text>
        </View>
      ) : (
        <View className={styles.couponList}>
          {filteredCoupons.map((coupon) => (
            <View key={coupon._id} className={`${styles.couponCard} ${coupon.received ? styles.disabled : ''}`}>
              <View className={styles.couponLeft}>
                <Text className={styles.amount}>¥{(coupon.amount / 100).toFixed(0)}</Text>
                <Text className={styles.unit}>券</Text>
                {coupon.threshold > 0 && (
                  <Text className={styles.threshold}>满 {(coupon.threshold / 100).toFixed(0)} 可用</Text>
                )}
              </View>
              <View className={styles.couponRight}>
                <Text className={styles.couponTitle}>{coupon.name}</Text>
                <Text className={styles.couponDesc}>{coupon.description}</Text>
                <Text className={styles.couponExpire}>
                  有效期至 {new Date(coupon.expire_at).toLocaleDateString()}
                </Text>
                {activeTab === 'available' && !coupon.received && (
                  <View className={styles.receiveBtn} onClick={() => handleReceive(coupon)}>
                    立即领取
                  </View>
                )}
                {activeTab === 'used' && (
                  <View className={styles.receiveBtn} onClick={() => handleUse(coupon)}>
                    去使用
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default CouponPage
