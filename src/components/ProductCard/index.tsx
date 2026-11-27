import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import PriceTag from '@/components/PriceTag'
import { Product } from '@/types/product'
import styles from './index.module.scss'

interface ProductCardProps {
  product: Product
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const handleClick = () => {
    Taro.navigateTo({ url: `/pages/product-detail/index?id=${product._id}` })
  }

  return (
    <View className={styles.card} onClick={handleClick}>
      <Image
        className={styles.image}
        src={product.cover}
        mode='aspectFill'
        lazyLoad
        onError={(e) => console.error('[ProductCard] image error:', e)}
      />
      <View className={styles.content}>
        <Text className={styles.name}>{product.name}</Text>
        {product.subtitle && <Text className={styles.subtitle}>{product.subtitle}</Text>}
        <View className={styles.bottom}>
          <PriceTag price={product.price_min} size='md' />
          <Text className={styles.sales}>已售 {product.sales}</Text>
        </View>
      </View>
    </View>
  )
}

export default ProductCard
