<template>
  <view class="placeholder-container">
    <text class="placeholder-text">录制完成</text>
    <button @click="goBack">保存（模拟）</button>
  </view>
</template>

<script setup>
const goBack = () => {
  uni.switchTab({
		url: '/pages/list/list'
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
  margin-bottom: 20px;
}
</style>