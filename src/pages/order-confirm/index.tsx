import React, { useEffect, useState } from 'react'
import { View, Text, Image, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { useCartStore } from '@/store/cart'
import { Address } from '@/types/address'
import { CreateOrderPayload } from '@/types/order'
import styles from './index.module.scss'

interface SelectedItem {
  product_id: string
  sku_id: string
  name: string
  spec_text: string
  image: string
  price: number
  quantity: number
  cart_item_id?: string
}

interface UsableCoupon {
  coupon_id: string
  user_coupon_id: string
  name: string
  amount: number // 分
  threshold: number // 分
  description: string
  expire_at: number
}

const OrderConfirmPage: React.FC = () => {
  const router = useRouter()
  const cartIds = decodeURIComponent(router.params.cartIds || '').split(',').filter(Boolean)
  const directSkuId = router.params.skuId || ''

  const cartItems = useCartStore((s) => s.items)
  const removeItems = useCartStore((s) => s.removeItems)

  const [items, setItems] = useState<SelectedItem[]>([])
  const [address, setAddress] = useState<Address | null>(null)
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 优惠券 / 积分
  const [coupons, setCoupons] = useState<UsableCoupon[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState('')
  const [showCouponList, setShowCouponList] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [pointsInput, setPointsInput] = useState('')

  // 初始化订单商品
  useEffect(() => {
    if (cartIds.length > 0) {
      const selected = cartItems
        .filter((i) => cartIds.includes(i._id) && i.checked)
        .map((i) => ({
          product_id: i.product_id,
          sku_id: i.sku_id,
          name: i.product?.name || '',
          spec_text: i.sku ? Object.entries(i.sku.specs).map(([k, v]) => `${k}:${v}`).join(' / ') : '',
          image: i.sku?.image || i.product?.cover || '',
          price: i.sku?.price || 0,
          quantity: i.quantity,
          cart_item_id: i._id,
        }))
      setItems(selected)
    } else if (directSkuId) {
      // 直接购买模式：实际项目中由详情页把商品信息作为参数传递
      setItems([])
    }
  }, [cartIds, directSkuId, cartItems])

  // 加载默认地址
  useEffect(() => {
    loadDefaultAddress()
    loadUserPoints()
  }, [])

  const loadDefaultAddress = async () => {
    try {
      const data: any = await callFunction('address', { action: 'default' })
      setAddress(data || null)
    } catch (err) {
      console.error('[OrderConfirm] load address error:', err)
    }
  }

  const loadUserPoints = async () => {
    try {
      const data: any = await callFunction('user', { action: 'info' })
      setUserPoints(data?.points || 0)
    } catch (err) {
      console.error('[OrderConfirm] load points error:', err)
    }
  }

  const handleChooseAddress = () => {
    Taro.navigateTo({ url: '/pages/address-list/index?select=1' })
  }

  // 当从地址页返回时，更新地址
  useEffect(() => {
    const handleShow = () => {
      loadDefaultAddress()
    }
    Taro.eventCenter.on('addressChanged', handleShow)
    return () => { Taro.eventCenter.off('addressChanged', handleShow) }
  }, [])

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const freight = totalAmount >= 9900 || totalAmount === 0 ? 0 : 600 // 满 99 包邮

  // 仅展示当前订单满足门槛的优惠券
  const usableCoupons = coupons.filter((c) => totalAmount >= c.threshold)
  const selectedCoupon = usableCoupons.find((c) => c.coupon_id === selectedCouponId)
  const couponDiscount = selectedCoupon ? selectedCoupon.amount : 0

  // 积分抵扣（100 积分 = 1 元，即 1 积分 = 1 分）
  const maxPoints = Math.max(0, Math.min(userPoints, totalAmount + freight - couponDiscount))
  const rawPoints = parseInt(pointsInput || '0', 10) || 0
  const pointsUsed = Math.min(Math.max(0, rawPoints), maxPoints)
  const pointsDiscount = pointsUsed

  const payAmount = Math.max(0, totalAmount + freight - couponDiscount - pointsDiscount)

  // 优惠券列表：门槛未达时禁用
  const selectCoupon = (couponId: string) => {
    setSelectedCouponId(couponId)
    setShowCouponList(false)
  }

  // 生成幂等键（时间戳 + 随机串）
  const genClientOrderId = () => {
    const ts = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    return `${ts}${rand}`
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      return Taro.showToast({ title: '请选择商品', icon: 'none' })
    }
    if (!address) {
      return Taro.showToast({ title: '请选择收货地址', icon: 'none' })
    }
    setSubmitting(true)
    try {
      const payload: CreateOrderPayload = {
        items,
        address_id: address._id,
        remark,
        coupon_id: selectedCouponId || undefined,
        points_used: pointsUsed,
        from_cart_ids: items.map((i) => i.cart_item_id).filter(Boolean) as string[],
        client_order_id: genClientOrderId(),
      }
      const result: any = await callFunction('order', { action: 'create', ...payload })

      // 清购物车中已结算的商品
      if (payload.from_cart_ids && payload.from_cart_ids.length > 0) {
        removeItems(payload.from_cart_ids)
      }

      Taro.redirectTo({ url: `/pages/pay-result/index?orderId=${result._id}` })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '下单失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      {/* 地址区域 */}
      <View className={styles.section}>
        <View className={styles.addressSection} onClick={handleChooseAddress}>
          {address ? (
            <View className={styles.addrInfo}>
              <View className={styles.addrRow}>
                <Text className={styles.addrName}>{address.name}</Text>
                <Text className={styles.addrPhone}>{address.phone}</Text>
              </View>
              <Text className={styles.addrDetail}>
                {address.province} {address.city} {address.district} {address.detail}
              </Text>
            </View>
          ) : (
            <Text className={styles.addrEmpty}>+ 添加收货地址</Text>
          )}
        </View>
      </View>

      {/* 商品列表 */}
      {items.length > 0 && (
        <View className={styles.section}>
          <View className={styles.itemList}>
            {items.map((item, idx) => (
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
        </View>
      )}

      {/* 优惠券 / 积分 */}
      <View className={styles.section}>
        <View className={styles.optionRow} onClick={() => setShowCouponList(!showCouponList)}>
          <Text className={styles.optionLabel}>优惠券</Text>
          <View className={styles.optionValueWrap}>
            <Text className={selectedCoupon ? styles.optionValueActive : styles.optionValue}>
              {selectedCoupon
                ? `-¥${(selectedCoupon.amount / 100).toFixed(2)}`
                : usableCoupons.length > 0
                  ? `${usableCoupons.length} 张可用`
                  : '暂无可用'}
            </Text>
            <Text className={styles.optionArrow}>{showCouponList ? '⌃' : '›'}</Text>
          </View>
        </View>

        {showCouponList && usableCoupons.length > 0 && (
          <View className={styles.couponOptions}>
            <View
              className={`${styles.couponOption} ${!selectedCouponId ? styles.couponOptionActive : ''}`}
              onClick={() => selectCoupon('')}
            >
              <Text className={styles.couponOptionName}>不使用优惠券</Text>
              {!selectedCouponId && <Text className={styles.couponOptionCheck}>✓</Text>}
            </View>
            {usableCoupons.map((c) => (
              <View
                key={c.coupon_id}
                className={`${styles.couponOption} ${selectedCouponId === c.coupon_id ? styles.couponOptionActive : ''}`}
                onClick={() => selectCoupon(c.coupon_id)}
              >
                <View className={styles.couponOptionInfo}>
                  <Text className={styles.couponOptionName}>{c.name}</Text>
                  <Text className={styles.couponOptionDesc}>
                    {c.threshold > 0 ? `满 ${(c.threshold / 100).toFixed(0)} 元可用` : '无门槛'}
                  </Text>
                </View>
                <Text className={styles.couponOptionAmount}>-¥{(c.amount / 100).toFixed(0)}</Text>
                {selectedCouponId === c.coupon_id && <Text className={styles.couponOptionCheck}>✓</Text>}
              </View>
            ))}
          </View>
        )}

        <View className={styles.optionRow}>
          <Text className={styles.optionLabel}>积分抵扣</Text>
          <View className={styles.pointsWrap}>
            <Text className={styles.pointsHint}>可用 {userPoints} 积分</Text>
            <Input
              className={styles.pointsInput}
              type='number'
              value={pointsInput}
              placeholder='0'
              disabled={maxPoints <= 0}
              onInput={(e: any) => setPointsInput(e.detail.value)}
            />
            {pointsDiscount > 0 && (
              <Text className={styles.optionValueActive}>-¥{(pointsDiscount / 100).toFixed(2)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* 金额明细 */}
      <View className={styles.section}>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>商品金额</Text>
          <Text className={styles.amountValue}>¥{(totalAmount / 100).toFixed(2)}</Text>
        </View>
        <View className={styles.amountRow}>
          <Text className={styles.amountLabel}>运费</Text>
          {freight === 0 ? (
            <Text className={styles.amountValue} style={{ color: '#00b42a' }}>免运费</Text>
          ) : (
            <Text className={styles.amountValue}>¥{(freight / 100).toFixed(2)}</Text>
          )}
        </View>
        {couponDiscount > 0 && (
          <View className={styles.amountRow}>
            <Text className={styles.amountLabel}>优惠券</Text>
            <Text className={styles.amountDiscount}>-¥{(couponDiscount / 100).toFixed(2)}</Text>
          </View>
        )}
        {pointsDiscount > 0 && (
          <View className={styles.amountRow}>
            <Text className={styles.amountLabel}>积分抵扣</Text>
            <Text className={styles.amountDiscount}>-¥{(pointsDiscount / 100).toFixed(2)}</Text>
          </View>
        )}
        {freight > 0 && <Text className={styles.freightNote}>满 99 元包邮，还差 ¥{((9900 - totalAmount) / 100).toFixed(2)}</Text>}
      </View>

      {/* 留言 */}
      <View className={styles.section}>
        <View className={styles.remarkRow}>
          <Text className={styles.amountLabel}>备注</Text>
          <Input
            className={styles.remarkInput}
            value={remark}
            placeholder='选填，建议与卖家协商一致'
            onInput={(e: any) => setRemark(e.detail.value)}
          />
        </View>
      </View>

      {/* 底部结算 */}
      <View className={styles.bottomBar}>
        <View className={styles.bottomLeft}>
          <Text className={styles.bottomLabel}>合计：</Text>
          <Text className={styles.bottomValue}>¥{(payAmount / 100).toFixed(2)}</Text>
        </View>
        <View className={styles.submitBtn} onClick={handleSubmit}>
          {submitting ? '提交中...' : '提交订单'}
        </View>
      </View>
    </View>
  )
}

export default OrderConfirmPage
