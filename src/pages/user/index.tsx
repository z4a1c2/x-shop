import React, { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import styles from './index.module.scss'

interface UserInfo {
  nickname: string
  avatar: string
  level: string
  points: number
  coupon_count: number
}

const DEFAULT_USER: UserInfo = {
  nickname: '未登录',
  avatar: '',
  level: '普通会员',
  points: 0,
  coupon_count: 0,
}

const UserPage: React.FC = () => {
  const [user, setUser] = useState<UserInfo>(DEFAULT_USER)

  const loadUser = async () => {
    try {
      const data: any = await callFunction('user', { action: 'info' })
      if (data) setUser(data)
    } catch (err) {
      // H5 预览环境使用默认 mock
      setUser(DEFAULT_USER)
    }
  }

  useDidShow(() => {
    loadUser()
  })

  useEffect(() => {
    loadUser()
  }, [])

  const menuItems = [
    { icon: '📦', title: '我的订单', path: '/pages/order-list/index' },
    { icon: '📍', title: '收货地址', path: '/pages/address-list/index' },
    { icon: '🎟️', title: '优惠券', path: '/pages/coupon-list/index' },
    { icon: '⭐', title: '积分中心', path: '/pages/member/index' },
    { icon: '❤️', title: '我的收藏', path: '' },
    { icon: '⚙️', title: '设置', path: '' },
  ]

  return (
    <View className={styles.page}>
      {/* 用户信息 Header */}
      <View className={styles.userHeader}>
        <View className={styles.avatar}>
          {user.avatar ? (
            <Image src={user.avatar} className={styles.avatarImg} />
          ) : (
            <Text className={styles.avatarIcon}>👤</Text>
          )}
        </View>
        <View className={styles.userInfo}>
          <Text className={styles.nickname}>{user.nickname}</Text>
          <Text className={styles.level}>{user.level}</Text>
        </View>
        <View className={styles.loginBtn} onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
          登录
        </View>
      </View>

      {/* 数据概览 */}
      <View className={styles.statsCard}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{user.points}</Text>
          <Text className={styles.statLabel}>积分</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{user.coupon_count}</Text>
          <Text className={styles.statLabel}>优惠券</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>0</Text>
          <Text className={styles.statLabel}>收藏</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>0</Text>
          <Text className={styles.statLabel}>足迹</Text>
        </View>
      </View>

      {/* 订单快捷入口 */}
      <View className={styles.section}>
        <View className={styles.sectionTitle}>我的订单</View>
        <View className={styles.orderTabs}>
          <View className={styles.orderTab} onClick={() => Taro.navigateTo({ url: '/pages/order-list/index?status=10' })}>
            <Text className={styles.orderIcon}>💰</Text>
            <Text className={styles.orderLabel}>待付款</Text>
          </View>
          <View className={styles.orderTab} onClick={() => Taro.navigateTo({ url: '/pages/order-list/index?status=20' })}>
            <Text className={styles.orderIcon}>📋</Text>
            <Text className={styles.orderLabel}>待发货</Text>
          </View>
          <View className={styles.orderTab} onClick={() => Taro.navigateTo({ url: '/pages/order-list/index?status=30' })}>
            <Text className={styles.orderIcon}>🚚</Text>
            <Text className={styles.orderLabel}>待收货</Text>
          </View>
          <View className={styles.orderTab} onClick={() => Taro.navigateTo({ url: '/pages/order-list/index?status=40' })}>
            <Text className={styles.orderIcon}>✅</Text>
            <Text className={styles.orderLabel}>已完成</Text>
          </View>
        </View>
      </View>

      {/* 菜单列表 */}
      <View className={styles.section}>
        <View className={styles.menuList}>
          {menuItems.map((item) => (
            <View
              key={item.title}
              className={styles.menuItem}
              onClick={() => {
                if (item.path) Taro.navigateTo({ url: item.path })
                else Taro.showToast({ title: '功能开发中', icon: 'none' })
              }}
            >
              <Text className={styles.menuIcon}>{item.icon}</Text>
              <Text className={styles.menuTitle}>{item.title}</Text>
              <Text className={styles.menuArrow}>›</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default UserPage
