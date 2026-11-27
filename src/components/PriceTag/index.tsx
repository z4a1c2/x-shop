import React from 'react'
import { Text } from '@tarojs/components'
import styles from './index.module.scss'

interface PriceTagProps {
  price: number // 单位：分
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const PriceTag: React.FC<PriceTagProps> = ({ price, size = 'md', className }) => {
  const yuan = (price / 100).toFixed(2)
  return (
    <Text className={`${styles[size]} ${className || ''}`}>
      <Text className={styles.symbol}>¥</Text>
      <Text className={styles.value}>{yuan}</Text>
    </Text>
  )
}

export default PriceTag
