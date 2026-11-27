import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Address } from '@/types/address'
import styles from './index.module.scss'

const AddressListPage: React.FC = () => {
  const router = useRouter()
  const selectMode = router.params.select === '1'
  const [list, setList] = useState<Address[]>([])

  const loadList = async () => {
    try {
      const data: any = await callFunction('address', { action: 'list' })
      setList(data || [])
    } catch (err) {
      console.error('[AddressList] load error:', err)
    }
  }

  useDidShow(() => {
    loadList()
  })

  const handleAdd = () => {
    Taro.navigateTo({ url: '/pages/address-edit/index' })
  }

  const handleEdit = (id: string) => {
    Taro.navigateTo({ url: `/pages/address-edit/index?id=${id}` })
  }

  const handleSelect = (addr: Address) => {
    if (selectMode) {
      const pages = Taro.getCurrentPages()
      const prevPage = pages[pages.length - 2]
      if (prevPage) {
        prevPage.setData?.({ selectedAddressId: addr._id })
      }
      Taro.navigateBack()
    } else {
      handleEdit(addr._id)
    }
  }

  return (
    <View className={styles.page}>
      {list.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>📍</Text>
          <Text className={styles.emptyText}>还没有收货地址，添加一个吧</Text>
        </View>
      ) : (
        <View className={styles.list}>
          {list.map((addr) => (
            <View key={addr._id} className={styles.addressCard} onClick={() => handleSelect(addr)}>
              <View className={styles.addressTop}>
                <Text className={styles.name}>{addr.name}</Text>
                <Text className={styles.phone}>{addr.phone}</Text>
                {addr.is_default && <Text className={styles.defaultTag}>默认</Text>}
              </View>
              <Text className={styles.addressDetail}>
                {addr.province} {addr.city} {addr.district} {addr.detail}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.bottomBar}>
        <View className={styles.addBtn} onClick={handleAdd}>
          + 新增收货地址
        </View>
      </View>
    </View>
  )
}

export default AddressListPage
