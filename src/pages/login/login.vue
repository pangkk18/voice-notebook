<template>
  <view class="placeholder-container">
    <text class="placeholder-text">登录页</text>
    <button @click="goBack">登录（模拟）</button>
  </view>
</template>

<script setup>
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