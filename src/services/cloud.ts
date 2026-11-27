import Taro from '@tarojs/taro'

const isWeapp = process.env.TARO_ENV === 'weapp'

export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  if (!isWeapp) {
    const mockModule = await import(`../data/${name}`)
    const result = await mockModule.default(data)
    // Mock 层返回 { code, message, data } 格式，真实云函数同样返回此格式
    // 统一在此解包
    if (result && typeof result === 'object' && 'code' in result && 'data' in result) {
      if ((result as any).code !== 0) {
        throw new Error((result as any).message || '请求失败')
      }
      return (result as any).data as T
    }
    return result as T
  }
  const res = await Taro.cloud.callFunction({ name, data })
  const result = res.result as { code: number; message: string; data: T }
  if (result.code !== 0) {
    console.error(`[Cloud] ${name} failed:`, result.message)
    throw new Error(result.message || '请求失败')
  }
  return result.data
}

export function getDatabase() {
  if (!isWeapp) {
    return null
  }
  return Taro.cloud.database()
}
