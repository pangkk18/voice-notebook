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
@use "@/styles/notebook-theme.scss" as *;

.placeholder-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  background:
    linear-gradient(180deg, $vn-bg 0%, $vn-bg-alt 42%, $vn-bg-soft 100%);
}
.placeholder-text {
  font-size: 24px;
  color: $vn-text;
  margin-bottom: 20px;
  font-family: Georgia, 'Times New Roman', serif;
}

.placeholder-container button {
  min-width: 180rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: $vn-primary;
  color: $vn-bg-soft;
  box-shadow: $vn-shadow;
}

.placeholder-container button::after {
  border: none;
}
</style>
