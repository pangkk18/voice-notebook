<template>
  <view class="placeholder-container">
    <text class="placeholder-text">录音详情页</text>
    <button @click="goBack">返回列表</button>
  </view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';

onLoad((options) => {
  console.log('Opened detail for ID:', options.id);
})

const goBack = () => {
  uni.navigateBack();
}
</script>

<style lang="scss">
.placeholder-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
}
.placeholder-text {
  font-size: 24px;
  color: $uni-text-color;
  margin-bottom: 20px;
}
</style>