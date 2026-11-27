import React, { useEffect, useState } from 'react'
import { View, Text, Input, Textarea, Switch } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Address } from '@/types/address'
import styles from './index.module.scss'

const emptyForm: Omit<Address, '_id'> = {
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  is_default: false,
}

const AddressEditPage: React.FC = () => {
  const router = useRouter()
  const addrId = router.params.id || ''
  const [form, setForm] = useState<Omit<Address, '_id'>>(emptyForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (addrId) loadDetail()
  }, [addrId])

  const loadDetail = async () => {
    try {
      const data: any = await callFunction('address', { action: 'detail', id: addrId })
      if (data) {
        const { _id, ...rest } = data
        setForm(rest)
      }
    } catch (err) {
      console.error('[AddressEdit] load error:', err)
    }
  }

  const updateField = (field: keyof Omit<Address, '_id'>, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return Taro.showToast({ title: '请输入姓名', icon: 'none' })
    if (!form.phone.trim()) return Taro.showToast({ title: '请输入手机号', icon: 'none' })
    if (!/^1\d{10}$/.test(form.phone.trim())) return Taro.showToast({ title: '手机号格式错误', icon: 'none' })
    if (!form.province || !form.city || !form.district) return Taro.showToast({ title: '请选择省市区', icon: 'none' })
    if (!form.detail.trim()) return Taro.showToast({ title: '请输入详细地址', icon: 'none' })

    setLoading(true)
    try {
      await callFunction('address', {
        action: 'save',
        id: addrId || undefined,
        ...form,
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!addrId) return
    Taro.showModal({
      title: '提示',
      content: '确认删除该地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await callFunction('address', { action: 'remove', id: addrId })
            Taro.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 800)
          } catch (err: any) {
            Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  return (
    <View className={styles.page}>
      <View className={styles.formItem}>
        <Text className={styles.label}>收货人</Text>
        <Input
          className={styles.input}
          value={form.name}
          placeholder='请输入姓名'
          onInput={(e: any) => updateField('name', e.detail.value)}
        />
      </View>

      <View className={styles.formItem}>
        <Text className={styles.label}>手机号</Text>
        <Input
          className={styles.input}
          value={form.phone}
          type='number'
          placeholder='请输入手机号'
          maxlength={11}
          onInput={(e: any) => updateField('phone', e.detail.value)}
        />
      </View>

      <View className={styles.formItem}>
        <Text className={styles.label}>所在地区</Text>
        <Input
          className={styles.input}
          value={[form.province, form.city, form.district].filter(Boolean).join(' ')}
          placeholder='省 / 市 / 区'
          disabled
        />
        <View className={styles.row}>
          <Input
            className={styles.input}
            value={form.province}
            placeholder='省'
            onInput={(e: any) => updateField('province', e.detail.value)}
          />
          <Input
            className={styles.input}
            value={form.city}
            placeholder='市'
            onInput={(e: any) => updateField('city', e.detail.value)}
          />
          <Input
            className={styles.input}
            value={form.district}
            placeholder='区'
            onInput={(e: any) => updateField('district', e.detail.value)}
          />
        </View>
      </View>

      <View className={styles.formItem}>
        <Text className={styles.label}>详细地址</Text>
        <Textarea
          className={styles.textarea}
          value={form.detail}
          placeholder='街道、门牌号等'
          onInput={(e: any) => updateField('detail', e.detail.value)}
        />
      </View>

      <View className={styles.switchRow}>
        <Text className={styles.switchLabel}>设为默认地址</Text>
        <Switch
          checked={form.is_default}
          onChange={(e: any) => updateField('is_default', e.detail.value)}
        />
      </View>

      <View className={styles.bottomBar}>
        {addrId && (
          <View className={styles.btnDelete} onClick={handleDelete}>
            删除
          </View>
        )}
        <View className={styles.btnSave} onClick={handleSave}>
          {loading ? '保存中...' : '保存地址'}
        </View>
      </View>
    </View>
  )
}

export default AddressEditPage
