import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import styles from './index.module.scss'

const LEVELS = [
  { name: '普通会员', min: 0, color: '#86909c' },
  { name: '银牌会员', min: 500, color: '#c9cdd4' },
  { name: '金牌会员', min: 2000, color: '#FFD700' },
  { name: '钻石会员', min: 5000, color: '#b9f2ff' },
]

const MemberPage: React.FC = () => {
  const [points, setPoints] = useState(100)
  const [levelIdx, setLevelIdx] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data: any = await callFunction('order', { action: 'points' })
      if (data) {
        const total = data.total || 0
        setPoints(total)
        let idx = 0
        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (total >= LEVELS[i].min) {
            idx = i
            break
          }
        }
        setLevelIdx(idx)
      }
    } catch (err) {
      console.error('[Member] load error:', err)
    }
  }

  const currentLevel = LEVELS[levelIdx]
  const nextLevel = LEVELS[levelIdx + 1]

  const progress = nextLevel
    ? Math.min(100, ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100

  return (
    <View className={styles.page}>
      {/* 会员卡 */}
      <View className={styles.memberCard}>
        <View className={styles.cardBg} />
        <View className={styles.cardContent}>
          <View className={styles.cardHeader}>
            <Text className={styles.levelTag}>{currentLevel.name}</Text>
            <Text className={styles.expireText}>永久有效</Text>
          </View>
          <View className={styles.cardBody}>
            <View className={styles.avatar}>👤</View>
            <View className={styles.userInfo}>
              <Text className={styles.nickname}>微信用户</Text>
              <Text className={styles.userId}>ID: demo-user</Text>
            </View>
          </View>
          <View className={styles.pointsRow}>
            <View className={styles.pointsItem}>
              <Text className={styles.pointsValue}>{points}</Text>
              <Text className={styles.pointsLabel}>当前积分</Text>
            </View>
            <View className={styles.pointsDivider} />
            <View className={styles.pointsItem}>
              <Text className={styles.pointsValue}>{currentLevel.name}</Text>
              <Text className={styles.pointsLabel}>当前等级</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 等级进度 */}
      <View className={styles.progressSection}>
        <View className={styles.progressHeader}>
          <Text className={styles.progressTitle}>
            升级进度 {nextLevel ? `距${nextLevel.name}` : '已达最高等级'}
          </Text>
          <Text className={styles.progressValue}>
            {nextLevel ? `${points} / ${nextLevel.min}` : '已满级'}
          </Text>
        </View>
        <View className={styles.progressBar}>
          <View className={styles.progressFill} style={{ width: `${progress}%` }} />
        </View>
        {nextLevel && (
          <View className={styles.progressTip}>
            再获得 {nextLevel.min - points} 积分即可升级为{nextLevel.name}
          </View>
        )}
      </View>

      {/* 功能菜单 */}
      <View className={styles.menuList}>
        <View className={styles.menuItem} onClick={() => Taro.navigateTo({ url: '/pages/points-log/index' })}>
          <Text className={styles.menuIcon}>📊</Text>
          <Text className={styles.menuTitle}>积分明细</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => Taro.navigateTo({ url: '/pages/coupon-list/index' })}>
          <Text className={styles.menuIcon}>🎟️</Text>
          <Text className={styles.menuTitle}>优惠券中心</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => Taro.showToast({ title: '即将上线', icon: 'none' })}>
          <Text className={styles.menuIcon}>🎁</Text>
          <Text className={styles.menuTitle}>积分兑换</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => Taro.showToast({ title: '即将上线', icon: 'none' })}>
          <Text className={styles.menuIcon}>👛</Text>
          <Text className={styles.menuTitle}>我的钱包</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      {/* 等级说明 */}
      <View className={styles.levelSection}>
        <Text className={styles.sectionTitle}>等级说明</Text>
        {LEVELS.map((lv, idx) => (
          <View key={lv.name} className={styles.levelRow}>
            <Text className={`${styles.levelName} ${idx <= levelIdx ? styles.levelCurrent : ''}`}>
              {idx <= levelIdx ? '✓ ' : ''}{lv.name}
            </Text>
            <Text className={styles.levelReq}>≥ {lv.min} 积分</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default MemberPage
