import React, { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import { useCartStore } from '@/store/cart'
import CartItemCard from '@/components/CartItem'
import styles from './index.module.scss'

const CartPage: React.FC = () => {
  const items = useCartStore((s) => s.items)
  const updateItem = useCartStore((s) => s.updateItem)
  const toggleAll = useCartStore((s) => s.toggleAll)
  const _removeItems = useCartStore((s) => s.removeItems)
  const getTotalPrice = useCartStore((s) => s.getTotalPrice())
  const _getTotalCount = useCartStore((s) => s.getTotalCount())

  const allChecked = items.length > 0 && items.every((i) => i.checked)
  const checkedCount = items.filter((i) => i.checked).reduce((s, i) => s + i.quantity, 0)

  // 从后端（mock）拉取购物车
  useDidShow(() => {
    loadFromServer()
  })

  useEffect(() => {
    loadFromServer()
  }, [])

  const loadFromServer = async () => {
    try {
      // 若有真实后端，此处调用云函数获取购物车列表
      // 此处仅演示：H5 下从 cart mock 同步
      if (items.length === 0) {
        // 保持空状态，等待首页加购
      }
    } catch (err) {
      console.error('[Cart] load error:', err)
    }
  }

  const handleToggle = (id: string) => {
    const item = items.find((i) => i._id === id)
    if (item) updateItem(id, { checked: !item.checked })
  }

  const handleChangeQuantity = (id: string, qty: number) => {
    updateItem(id, { quantity: qty })
  }

  const handleToggleAll = () => {
    toggleAll(!allChecked)
  }

  const handleSettle = () => {
    const checkedIds = items.filter((i) => i.checked).map((i) => i._id)
    if (checkedIds.length === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/order-confirm/index?cartIds=${checkedIds.join(',')}` })
  }

  return (
    <View className={styles.page}>
      {items.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>🛒</Text>
          <Text className={styles.emptyTitle}>购物车还是空的</Text>
          <Text className={styles.emptyDesc}>快去首页挑选心仪的商品吧</Text>
          <View className={styles.emptyBtn} onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
            去逛逛
          </View>
        </View>
      ) : (
        <>
          <View className={styles.list}>
            {items.map((item) => (
              <CartItemCard
                key={item._id}
                item={item}
                onToggle={handleToggle}
                onChangeQuantity={handleChangeQuantity}
              />
            ))}
          </View>

          {/* 底部结算栏 */}
          <View className={styles.bottomBar}>
            <View className={styles.selectAll} onClick={handleToggleAll}>
              <View className={classnames(styles.selectAllCircle, allChecked && styles.checked)}>
                {allChecked && <Text style={{ color: '#fff', fontSize: '24rpx' }}>✓</Text>}
              </View>
              <Text className={styles.selectAllText}>全选</Text>
            </View>

            <View className={styles.total}>
              <Text className={styles.totalLabel}>合计：</Text>
              <Text className={styles.totalPrice}>
                ¥{(getTotalPrice / 100).toFixed(2)}
              </Text>
            </View>

            <View
              className={classnames(styles.settleBtn, checkedCount === 0 && styles.disabled)}
              onClick={handleSettle}
            >
              结算({checkedCount})
            </View>
          </View>
        </>
      )}
    </View>
  )
}

export default CartPage
