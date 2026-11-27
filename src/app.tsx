import React, { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { useDidShow, useDidHide } from '@tarojs/taro';
import './app.scss';

function App(props) {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      // 云开发初始化（环境 ID 在部署时设置）
      Taro.cloud.init({ env: '', traceUser: true });
    }
  }, []);

  useDidShow(() => {});
  useDidHide(() => {});

  return props.children;
}

export default App;
