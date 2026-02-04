<template>
  <view class="player-page">
    <view class="meta">
      <text class="title">{{ recordTitle }}</text>
      <text class="subtitle">{{ recordDate }}</text>
    </view>

    <view class="waveform">
      <view
        v-for="(bar, index) in bars"
        :key="index"
        class="bar"
        :class="bar.active ? 'bar-active' : 'bar-idle'"
        :style="{ height: bar.h + 'rpx' }"
      />
    </view>

    <text class="time">{{ formatTime(current) }}</text>

    <view class="progress">
      <text class="time-sm">{{ formatTime(current) }}</text>
      <slider
        class="slider"
        :min="0"
        :max="duration"
        :value="current"
        activeColor="#E94B4B"
        backgroundColor="#E4E6EB"
        block-size="16"
        @change="onSliderChange"
      />
      <text class="time-sm">{{ formatTime(duration) }}</text>
    </view>

    <view class="actions">
      <view class="action">
        <view class="pill">
          <image class="icon-sm" src="/static/icons/share.svg" mode="aspectFit" />
        </view>
        <text class="action-text">分享</text>
      </view>
      <view class="action">
        <view class="pill">
          <image class="icon-sm" src="/static/icons/edit.svg" mode="aspectFit" />
        </view>
        <text class="action-text">重命名</text>
      </view>
      <view class="action">
        <view class="pill danger">
          <image class="icon-sm" src="/static/icons/trash.svg" mode="aspectFit" />
        </view>
        <text class="action-text danger-text">删除</text>
      </view>
    </view>

    <view class="transport">
      <view class="chip" @click="seekBy(-10)">
        <text class="chip-text">-10s</text>
      </view>
      <view class="play-btn" @click="togglePlay">
        <image
          class="play-icon"
          :src="playing ? '/static/icons/pause.svg' : '/static/icons/play.svg'"
          mode="aspectFit"
        />
      </view>
      <view class="chip" @click="seekBy(10)">
        <text class="chip-text">+10s</text>
      </view>
    </view>

    <view class="bottom-fade" />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';

const playing = ref(false);
const duration = ref(155);
const current = ref(0);
const recordTitle = ref('未命名录音');
const recordDate = ref('未记录时间');
const localFilePath = ref('');
const tempFilePath = ref('');
let audioContext = null;

const bars = ref([
  { h: 40, active: false },
  { h: 56, active: false },
  { h: 74, active: false },
  { h: 92, active: false },
  { h: 110, active: false },
  { h: 132, active: true },
  { h: 156, active: true },
  { h: 170, active: true },
  { h: 156, active: true },
  { h: 132, active: true },
  { h: 110, active: false },
  { h: 92, active: false },
  { h: 74, active: false },
  { h: 56, active: false },
  { h: 40, active: false }
]);

const goBack = () => {
  uni.navigateBack();
};

const togglePlay = () => {
  if (!audioContext) {
    const playablePath = localFilePath.value || tempFilePath.value;
    if (!playablePath) {
      uni.showToast({ title: '没有可播放的音频', icon: 'none' });
      return;
    }
    initAudio(playablePath);
  }
  if (playing.value) {
    audioContext.pause();
  } else {
    audioContext.play();
  }
};

const onSliderChange = (event) => {
  const next = Number(event.detail.value) || 0;
  current.value = next;
  if (audioContext) {
    audioContext.seek(next);
  }
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
};

const decodeParam = (value) => {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value));
  } catch (error) {
    return String(value);
  }
};

const parseDuration = (rawDuration) => {
  const [m, s] = String(rawDuration).split(':').map((item) => Number(item));
  if (Number.isFinite(m) && Number.isFinite(s)) {
    return Math.max(m * 60 + s, 1);
  }
  return 1;
};

const seekBy = (delta) => {
  const next = Math.max(0, Math.min(current.value + delta, duration.value));
  current.value = next;
  if (audioContext) {
    audioContext.seek(next);
  }
};

const initAudio = (src) => {
  if (audioContext) {
    audioContext.destroy();
  }
  audioContext = uni.createInnerAudioContext();
  audioContext.src = src;
  audioContext.autoplay = false;

  audioContext.onPlay(() => {
    playing.value = true;
  });
  audioContext.onPause(() => {
    playing.value = false;
  });
  audioContext.onStop(() => {
    playing.value = false;
  });
  audioContext.onEnded(() => {
    playing.value = false;
    current.value = duration.value;
  });
  audioContext.onTimeUpdate(() => {
    current.value = Math.floor(audioContext.currentTime || 0);
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
  });
  audioContext.onCanplay(() => {
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
  });
  audioContext.onError(() => {
    uni.showToast({ title: '音频播放失败', icon: 'none' });
    playing.value = false;
  });
};

onLoad((options) => {
  if (options?.title) {
    recordTitle.value = decodeParam(options.title);
  }
  if (options?.date) {
    recordDate.value = decodeParam(options.date);
  }
  if (options?.duration) {
    duration.value = parseDuration(decodeParam(options.duration));
  }
  if (options?.localFilePath) {
    localFilePath.value = decodeParam(options.localFilePath);
  }
  if (options?.tempFilePath) {
    tempFilePath.value = decodeParam(options.tempFilePath);
  }

  const playablePath = localFilePath.value || tempFilePath.value;
  if (playablePath) {
    initAudio(playablePath);
  }
});

onUnload(() => {
  if (audioContext) {
    audioContext.destroy();
    audioContext = null;
  }
});
</script>

<style lang="scss" scoped>
.player-page {
  position: relative;
  min-height: 100vh;
  padding: 28rpx 34rpx 160rpx;
  background: linear-gradient(160deg, #f8f3ee 0%, #f4f6f9 45%, #ffffff 100%);
  color: #1d1c1a;
  font-family: 'Noto Sans SC', 'Source Han Sans SC', sans-serif;
  overflow: hidden;
}

.player-page::before {
  content: '';
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 420rpx;
  height: 420rpx;
  background: radial-gradient(circle, rgba(233, 75, 75, 0.12) 0%, rgba(233, 75, 75, 0) 60%);
  z-index: 0;
}

.meta {
  position: relative;
  display: flex;
  flex-direction: column;
  z-index: 1;
  margin-top: 22rpx;
  width: 100%;
}

.title {
  font-family: 'DM Serif Display', 'Source Han Serif SC', serif;
  font-size: 42rpx;
  font-weight: 500;
  line-height: 1.2;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 24rpx;
  color: #8a8f98;
}

.waveform {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 10rpx;
  margin: 40rpx 0 12rpx 12rpx;
  transform: translateX(16rpx);
}

.bar {
  width: 12rpx;
  border-radius: 12rpx;
  transition: height 0.3s ease;
}

.bar-idle {
  background: #cfd5df;
}

.bar-active {
  background: #e94b4b;
}

.time {
  position: relative;
  display: flex;
  width: 100%;
  z-index: 1;
  font-size: 60rpx;
  font-weight: 700;
  margin: 8rpx 0 20rpx 6rpx;
  letter-spacing: 4rpx;
}

.progress {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 80rpx 1fr 80rpx;
  gap: 16rpx;
  align-items: center;
  margin: 0 6rpx 26rpx;
}

.time-sm {
  font-size: 22rpx;
  color: #9aa0aa;
}

.slider {
  margin: 0;
}

.actions {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin: 8rpx 0 34rpx;
}

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.pill {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  background: #f1f2f6;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14rpx 30rpx rgba(27, 27, 27, 0.08);
}

.pill.danger {
  background: rgba(233, 75, 75, 0.12);
}

.icon-sm {
  width: 30rpx;
  height: 30rpx;
}

.action-text {
  font-size: 22rpx;
  color: #6d717a;
}

.danger-text {
  color: #e94b4b;
}

.transport {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8rpx 24rpx 0 6rpx;
}

.chip {
  width: 90rpx;
  height: 90rpx;
  border-radius: 45rpx;
  background: #f6f7fb;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #e1e4ec;
}

.chip-text {
  font-size: 20rpx;
  color: #7d828b;
  letter-spacing: 2rpx;
}

.play-btn {
  width: 140rpx;
  height: 140rpx;
  border-radius: 70rpx;
  background: #e94b4b;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 24rpx 48rpx rgba(233, 75, 75, 0.35);
}

.play-icon {
  width: 44rpx;
  height: 44rpx;
}

.bottom-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: linear-gradient(0deg, #ffffff 0%, rgba(255, 255, 255, 0) 100%);
}
</style>
