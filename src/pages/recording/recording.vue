<template>
  <view class="placeholder-container">
    <text class="placeholder-text">录制中...</text>
    <view class="waveform-placeholder"></view>
    <button @click="goBack">完成（模拟）</button>
  </view>
</template>

<script setup>
const goBack = () => {
  uni.navigateTo({
		url: '/pages/complete/complete'
	});
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
  margin-bottom: 40px;
}
.waveform-placeholder {
    width: 100%;
    height: 100px;
    background-color: #e0e0e0;
    border-radius: 12px;
    margin-bottom: 40px;
}
</style>