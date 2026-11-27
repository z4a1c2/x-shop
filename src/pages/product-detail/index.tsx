import React, { useEffect, useState } from 'react'
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { useCartStore } from '@/store/cart'
import { Product, ProductSku } from '@/types/product'
import SkuSelector from '@/components/SkuSelector'
import styles from './index.module.scss'

const ProductDetailPage: React.FC = () => {
  const router = useRouter()
  const productId = router.params.id || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null)
  const [showSkuModal, setShowSkuModal] = useState(false)
  const [quantity, setQuantity] = useState(1)

  const addItem = useCartStore((s) => s.addItem)
  const cartCount = useCartStore((s) => s.getTotalCount())

  useEffect(() => {
    loadDetail()
  }, [productId])

  const loadDetail = async () => {
    try {
      const result: any = await callFunction('product', { action: 'detail', categoryId: productId })
      if (result) {
        setProduct(result)
        if (result.skus && result.skus.length > 0) {
          setSelectedSku(result.skus[0])
        }
      }
    } catch (err) {
      console.error('[ProductDetail] load error:', err)
    }
  }

  const handleSkuSelect = (sku: ProductSku) => {
    setSelectedSku(sku)
  }

  const openSkuModal = () => {
    setShowSkuModal(true)
  }

  const closeSkuModal = () => {
    setShowSkuModal(false)
  }

  const handleAddToCart = () => {
    if (!product || !selectedSku) {
      Taro.showToast({ title: '请选择规格', icon: 'none' })
      return
    }
    addItem(selectedSku._id, product._id, quantity, {
      _id: product._id,
      name: product.name,
      cover: product.cover,
    }, selectedSku)
    Taro.showToast({ title: '已加入购物车', icon: 'success' })
    setShowSkuModal(false)
  }

  const handleBuyNow = () => {
    if (!product || !selectedSku) {
      Taro.showToast({ title: '请选择规格', icon: 'none' })
      return
    }
    addItem(selectedSku._id, product._id, quantity, {
      _id: product._id,
      name: product.name,
      cover: product.cover,
    }, selectedSku)
    setShowSkuModal(false)
    // 跳转到确认订单页（直接购买模式）
    const cartStore = useCartStore.getState()
    // 获取刚添加的 cart item id
    const lastItem = cartStore.items[cartStore.items.length - 1]
    if (lastItem) {
      Taro.navigateTo({ url: `/pages/order-confirm/index?cartIds=${lastItem._id}` })
    } else {
      Taro.switchTab({ url: '/pages/cart/index' })
    }
  }

  const handleGoCart = () => {
    Taro.switchTab({ url: '/pages/cart/index' })
  }

  const currentPrice = selectedSku ? selectedSku.price : product?.price_min || 0

  return (
    <View className={styles.page}>
      {product ? (
        <>
          {/* 商品图轮播 */}
          <View className={styles.swiperWrap}>
            <Swiper className={styles.swiperItem} indicatorDots autoplay interval={4000} circular>
              {(product.images || [product.cover]).map((img, i) => (
                <SwiperItem key={i}>
                  <Image className={styles.mainImage} src={img} mode='aspectFill' />
                </SwiperItem>
              ))}
            </Swiper>
          </View>

          {/* 价格区 */}
          <View className={styles.priceCard}>
            <View className={styles.priceRow}>
              <Text className={styles.priceCurrent}>
                <Text className={styles.priceCurrentSymbol}>¥</Text>
                {(currentPrice / 100).toFixed(2)}
              </Text>
              {product.price_max > product.price_min && (
                <Text className={styles.priceOrigin}>
                  ¥{(product.price_max / 100).toFixed(2)}
                </Text>
              )}
            </View>
            <Text className={styles.salesTag}>已售 {product.sales}</Text>
          </View>

          {/* 商品信息 */}
          <View className={styles.infoCard}>
            <Text className={styles.name}>{product.name}</Text>
            {product.subtitle && <Text className={styles.subtitle}>{product.subtitle}</Text>}
          </View>

          {/* 规格入口 */}
          <View className={styles.specCard} onClick={openSkuModal}>
            <View className={styles.specHeader}>
              <Text className={styles.specTitle}>选择规格</Text>
              <Text className={styles.specSelected}>
                {selectedSku
                  ? Object.entries(selectedSku.specs).map(([k, v]) => `${k}:${v}`).join(' / ')
                  : '请选择'}
              </Text>
            </View>
          </View>

          {/* 商品详情 */}
          {product.detail && (
            <View className={styles.detailCard}>
              <Text className={styles.detailTitle}>商品详情</Text>
              <View className={styles.detailHtml}>{product.detail}</View>
            </View>
          )}

          {/* 底部操作栏 */}
          <View className={styles.bottomBar}>
            <View className={styles.iconBtn} onClick={handleGoCart}>
              <Text>🛒</Text>
              <Text className={styles.iconBtnText}>购物车</Text>
            </View>
            <View className={styles.actionBtns}>
              <View className={styles.btnCart} onClick={openSkuModal}>
                加入购物车
              </View>
              <View className={styles.btnBuy} onClick={() => { setQuantity(1); openSkuModal() }}>
                立即购买
              </View>
            </View>
          </View>

          {/* SKU 选择弹窗 */}
          {showSkuModal && product.skus && (
            <View className={styles.modalMask} onClick={closeSkuModal}>
              <View className={styles.modalBody} onClick={(e: any) => e.stopPropagation?.()}>
                <View className={styles.modalHeader}>
                  <Image
                    className={styles.modalImage}
                    src={selectedSku?.image || product.cover}
                    mode='aspectFill'
                  />
                  <View>
                    <Text className={styles.modalPrice}>
                      ¥{(selectedSku?.price || 0) / 100}
                    </Text>
                    <Text className={styles.modalStock}>
                      库存 {selectedSku?.stock ?? 0} 件
                    </Text>
                  </View>
                </View>

                <SkuSelector
                  skus={product.skus}
                  selectedSkuId={selectedSku?._id}
                  onSelect={handleSkuSelect}
                />

                <View className={styles.modalFooter}>
                  <View className={styles.btnCart} onClick={handleAddToCart}>
                    加入购物车
                  </View>
                  <View className={styles.btnBuy} onClick={handleBuyNow}>
                    立即购买
                  </View>
                </View>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={{ padding: '120rpx', textAlign: 'center', color: '#86909c' }}>
          加载中...
        </View>
      )}
    </View>
  )
}

export default ProductDetailPage
