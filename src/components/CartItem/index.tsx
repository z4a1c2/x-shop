import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import PriceTag from '@/components/PriceTag'
import { CartItem } from '@/types/cart'
import styles from './index.module.scss'

interface CartItemCardProps {
  item: CartItem
  onToggle: (id: string) => void
  onChangeQuantity: (id: string, qty: number) => void
}

const CartItemCard: React.FC<CartItemCardProps> = ({ item, onToggle, onChangeQuantity }) => {
  const handleClick = () => {
    Taro.navigateTo({ url: `/pages/product-detail/index?id=${item.product_id}` })
  }

  const handleToggle = (e: any) => {
    e.stopPropagation?.()
    onToggle(item._id)
  }

  const handleMinus = () => {
    if (item.quantity > 1) onChangeQuantity(item._id, item.quantity - 1)
  }

  const handlePlus = () => {
    if (item.sku && item.quantity < item.sku.stock) onChangeQuantity(item._id, item.quantity + 1)
  }

  const specText = item.sku
    ? Object.entries(item.sku.specs)
        .map(([k, v]) => `${k}:${v}`)
        .join(' / ')
    : ''

  return (
    <View className={styles.wrapper}>
      <View className={styles.checkbox} onClick={handleToggle}>
        <View className={classnames(styles.circle, item.checked && styles.checked)}>
          {item.checked && <Text className={styles.checkIcon}>✓</Text>}
        </View>
      </View>

      <View className={styles.imageWrapper} onClick={handleClick}>
        <Image
          className={styles.image}
          src={item.sku?.image || item.product?.cover || ''}
          mode='aspectFill'
        />
      </View>

      <View className={styles.info}>
        <Text className={styles.name} onClick={handleClick}>{item.product?.name}</Text>
        <Text className={styles.spec}>{specText}</Text>
        <View className={styles.bottom}>
          {item.sku && <PriceTag price={item.sku.price} size='md' />}
          <View className={styles.qtyControl}>
            <View className={styles.qtyBtn} onClick={handleMinus}>-</View>
            <Text className={styles.qtyNum}>{item.quantity}</Text>
            <View className={styles.qtyBtn} onClick={handlePlus}>+</View>
          </View>
        </View>
      </View>
    </View>
  )
}

export default CartItemCard
