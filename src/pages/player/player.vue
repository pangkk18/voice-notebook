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
          <i class="iconfont icon-share icon-sm"></i>
        </view>
        <text class="action-text">分享</text>
      </view>
      <view class="action">
        <view class="pill">
          <i class="iconfont icon-edit1 icon-sm"></i>
        </view>
        <text class="action-text">重命名</text>
      </view>
      <view class="action">
        <view class="pill danger">
          <i class="iconfont icon-delete icon-sm"></i>
        </view>
        <text class="action-text danger-text">删除</text>
      </view>
    </view>

    <view class="transport">
      <view class="chip" @click="seekBy(-10)">
        <text class="chip-text">-10s</text>
      </view>
      <view class="play-btn" @click="togglePlay">
        <i class="iconfont play-icon" :class="{'icon-pause': playing, 'icon-play': !playing}"></i>
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
import { callCloudFunction } from '../../utils/cloudbase';

const playing = ref(false);
const duration = ref(155);
const current = ref(0);
const recordTitle = ref('未命名录音');
const recordDate = ref('未记录时间');
const localFilePath = ref('');
const tempFilePath = ref('');
const recordId = ref('');
const cloudFileID = ref('');
const cloudMp3FileID = ref('');
const cloudM3u8FileID = ref('');
const conversionStatus = ref('');
const currentSourceKind = ref('');
const localFallbackTried = ref(false);
const signedManifestLocalPath = ref('');
const muteHintShown = ref(false);
let audioContext = null;
let playbackStallTimer = null;
let waveformTimer = null;
let waveformTick = 0;

const BAR_COUNT = 15;
const BASE_WAVE_BARS = [18, 26, 20, 34, 22, 28, 24, 30, 22, 34, 20, 26, 18, 24, 20];

const bars = ref(BASE_WAVE_BARS.map((h) => ({ h, active: false })));

const goBack = () => {
  uni.navigateBack();
};

const togglePlay = async () => {
  if (!audioContext) {
    await initPreferredSource();
    if (!audioContext) return;
  }
  if (playing.value) {
    audioContext.pause();
  } else {
    audioContext.play();
  }
};

const isConversionCompleted = () => {
  return conversionStatus.value === 'completed' && Boolean(cloudM3u8FileID.value);
};

const onSliderChange = (event) => {
  const next = Number(event.detail.value) || 0;
  current.value = next;
  if (audioContext) {
    audioContext.seek(next);
  }
  updateWaveformProgress();
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
  updateWaveformProgress();
};

const updateWaveformProgress = () => {
  const total = Math.max(duration.value, 1);
  const ratio = Math.min(Math.max(current.value / total, 0), 1);
  const activeCount = Math.round(ratio * BAR_COUNT);
  bars.value = bars.value.map((bar, idx) => ({
    ...bar,
    active: idx < activeCount
  }));
};

const startWaveformAnimation = () => {
  stopWaveformAnimation();
  waveformTimer = setInterval(() => {
    if (!playing.value) return;
    waveformTick += 1;
    const now = Number(audioContext?.currentTime || 0);
    bars.value = BASE_WAVE_BARS.map((base, idx) => {
      const p1 = Math.abs(Math.sin(now * 4 + idx * 0.62 + waveformTick * 0.12));
      const p2 = Math.abs(Math.cos(now * 2.2 - idx * 0.41 + waveformTick * 0.08));
      const amp = 0.55 * p1 + 0.45 * p2;
      const h = Math.round(base + amp * 48);
      return { h, active: bars.value[idx]?.active || false };
    });
    updateWaveformProgress();
  }, 120);
};

const stopWaveformAnimation = () => {
  if (waveformTimer) {
    clearInterval(waveformTimer);
    waveformTimer = null;
  }
};

const isLocalFileUsable = async (filePath) => {
  if (!filePath) return false;
  if (!wx?.getFileSystemManager) return true;
  const fs = wx.getFileSystemManager();
  return new Promise((resolve) => {
    fs.access({
      path: filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
};

// 从云端加载文件
const loadCloudFile = async (inputFileID, autoPlay = false) => {
  const fileID = inputFileID || cloudM3u8FileID.value || cloudMp3FileID.value || cloudFileID.value;
  if (!fileID) {
    return false;
  }

  try {
    // 获取云存储文件的临时 URL
    if (!wx?.cloud?.getTempFileURL) {
      uni.showToast({ title: '云存储不可用', icon: 'none' });
      return false;
    }

    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    if (result.fileList && result.fileList.length > 0) {
      const tempURL = result.fileList[0].tempFileURL;
      if (tempURL) {
        initAudio(tempURL);
        currentSourceKind.value = 'cloud';
        if (autoPlay && audioContext) {
          setTimeout(() => {
            audioContext && audioContext.play();
          }, 60);
        }
        return true;
      } else {
        uni.showToast({ title: '获取播放地址失败', icon: 'none' });
        return false;
      }
    } else {
      uni.showToast({ title: '获取播放地址失败', icon: 'none' });
      return false;
    }
  } catch (err) {
    console.error('Load cloud file failed:', err);
    uni.showToast({ title: '加载音频失败', icon: 'none' });
    return false;
  }
};

const refreshRecordStatus = async () => {
  if (!recordId.value) return;
  try {
    const result = await callCloudFunction({
      name: 'getNotebookList',
      data: { limit: 200 }
    });
    if (!result?.success || !Array.isArray(result.data)) return;
    const latest = result.data.find((item) => item?._id === recordId.value);
    if (!latest) return;

    conversionStatus.value = latest.conversion_status || '';
    cloudM3u8FileID.value = latest.m3u8FileID || cloudM3u8FileID.value;
    cloudMp3FileID.value = latest.mp3FileID || cloudMp3FileID.value;
    cloudFileID.value = latest.fileID || cloudFileID.value;
    if (!tempFilePath.value && latest.temp_path) {
      tempFilePath.value = latest.temp_path;
    }
  } catch (error) {
    console.warn('refreshRecordStatus failed:', error);
  }
};

const initPreferredSource = async () => {
  localFallbackTried.value = false;
  await refreshRecordStatus();

  // 转换完成后优先 m3u8
  if (isConversionCompleted()) {
    const ok = await loadSignedManifestAndPlay();
    if (ok) return;
  }

  // 未转换完成优先本地临时 wav
  const localPlayablePath = localFilePath.value || tempFilePath.value;
  if (localPlayablePath && await isLocalFileUsable(localPlayablePath)) {
    initAudio(localPlayablePath);
    currentSourceKind.value = 'local';
    return;
  }

  // 本地不可用时兜底云端文件
  const fallbackID = cloudMp3FileID.value || cloudFileID.value || cloudM3u8FileID.value;
  const ok = await loadCloudFile(fallbackID);
  if (!ok) {
    uni.showToast({ title: '没有可播放的音频', icon: 'none' });
  }
};

const loadSignedManifestAndPlay = async () => {
  if (!recordId.value) return false;
  try {
    const result = await callCloudFunction({
      name: 'getHlsPlayableManifest',
      data: {
        recordId: recordId.value,
        maxAge: 3600
      }
    });
    if (!result?.success || !result?.signedManifest) {
      return false;
    }

    const localPath = await writeSignedManifestToLocal(result.signedManifest);
    if (!localPath) return false;
    signedManifestLocalPath.value = localPath;
    initAudio(localPath);
    currentSourceKind.value = 'hls-manifest';
    return true;
  } catch (error) {
    console.warn('loadSignedManifestAndPlay failed:', error);
    return false;
  }
};

const writeSignedManifestToLocal = async (manifestText) => {
  if (!manifestText || typeof manifestText !== 'string') return '';
  if (!wx?.getFileSystemManager || !wx?.env?.USER_DATA_PATH) return '';

  const fs = wx.getFileSystemManager();
  const fileName = `hls_${recordId.value || Date.now()}_${Date.now()}.m3u8`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

  return new Promise((resolve) => {
    fs.writeFile({
      filePath,
      data: manifestText,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: (err) => {
        console.warn('writeSignedManifestToLocal failed:', err);
        resolve('');
      }
    });
  });
};

const initAudio = (src) => {
  clearPlaybackStallTimer();
  stopWaveformAnimation();
  waveformTick = 0;
  if (audioContext) {
    audioContext.destroy();
  }
  audioContext = uni.createInnerAudioContext();
  audioContext.src = src;
  audioContext.autoplay = false;
  // iOS: allow playback even when mute switch is on.
  audioContext.obeyMuteSwitch = false;

  audioContext.onPlay(() => {
    playing.value = true;
    schedulePlaybackStallHint();
    startWaveformAnimation();
  });
  audioContext.onPause(() => {
    playing.value = false;
    clearPlaybackStallTimer();
    stopWaveformAnimation();
  });
  audioContext.onStop(() => {
    playing.value = false;
    clearPlaybackStallTimer();
    stopWaveformAnimation();
  });
  audioContext.onEnded(() => {
    playing.value = false;
    current.value = duration.value;
    clearPlaybackStallTimer();
    stopWaveformAnimation();
    updateWaveformProgress();
  });
  audioContext.onTimeUpdate(() => {
    current.value = Math.floor(audioContext.currentTime || 0);
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
    updateWaveformProgress();
    if ((audioContext.currentTime || 0) > 0.2) {
      clearPlaybackStallTimer();
      muteHintShown.value = false;
    }
  });
  audioContext.onCanplay(() => {
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
  });
  audioContext.onError(() => {
    if ((currentSourceKind.value === 'local' || currentSourceKind.value === 'hls-manifest') && !localFallbackTried.value) {
      localFallbackTried.value = true;
      const fallbackID = cloudMp3FileID.value || cloudFileID.value || cloudM3u8FileID.value;
      loadCloudFile(fallbackID, true);
      return;
    }
    uni.showToast({ title: '音频播放失败', icon: 'none' });
    playing.value = false;
    clearPlaybackStallTimer();
    stopWaveformAnimation();
  });
};

const schedulePlaybackStallHint = () => {
  clearPlaybackStallTimer();
  playbackStallTimer = setTimeout(() => {
    if (!audioContext || !playing.value) return;
    // Started playing but still no progress, often caused by mute/very low volume.
    const t = Number(audioContext.currentTime || 0);
    if (t < 0.2 && !muteHintShown.value) {
      muteHintShown.value = true;
      uni.showToast({
        title: '若无声音，请关闭静音并调高媒体音量',
        icon: 'none',
        duration: 2200
      });
    }
  }, 1500);
};

const clearPlaybackStallTimer = () => {
  if (playbackStallTimer) {
    clearTimeout(playbackStallTimer);
    playbackStallTimer = null;
  }
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
  if (options?.recordId) {
    recordId.value = decodeParam(options.recordId);
  }
  if (options?.conversionStatus) {
    conversionStatus.value = decodeParam(options.conversionStatus);
  }
  // 支持从云端文件播放
  if (options?.cloudFileID) {
    cloudFileID.value = decodeParam(options.cloudFileID);
  }
  if (options?.cloudMp3FileID) {
    cloudMp3FileID.value = decodeParam(options.cloudMp3FileID);
  }
  if (options?.cloudM3u8FileID) {
    cloudM3u8FileID.value = decodeParam(options.cloudM3u8FileID);
  }

  initPreferredSource();
});

onUnload(() => {
  clearPlaybackStallTimer();
  stopWaveformAnimation();
  if (audioContext) {
    audioContext.destroy();
    audioContext = null;
  }
  if (signedManifestLocalPath.value && wx?.getFileSystemManager) {
    try {
      wx.getFileSystemManager().unlink({
        filePath: signedManifestLocalPath.value,
        fail: () => {}
      });
    } catch (error) {
      console.warn('cleanup signed manifest failed:', error);
    }
  }
});
</script>

<style lang="scss" scoped>
@import "@/styles/notebook-theme.scss";

.player-page {
  position: relative;
  min-height: 100vh;
  padding: 28rpx 34rpx 160rpx;
  background: linear-gradient(160deg, $vn-bg 0%, $vn-bg-alt 42%, $vn-bg-soft 100%);
  color: $vn-text;
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
  background: radial-gradient(circle, rgba(196, 106, 45, 0.16) 0%, rgba(196, 106, 45, 0) 60%);
  z-index: 0;
}

.meta {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
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
  color: $vn-text-muted;
}

.waveform {
  position: relative;
  width: 100%;
  height: 240rpx;
  z-index: 1;
  display: flex;
  justify-content: center;
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
  background: rgba(122, 142, 118, 0.22);
}

.bar-active {
  background: $vn-primary;
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
  color: $vn-text-muted;
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
  background: $vn-surface;
  border: 1rpx solid $vn-border;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $vn-shadow;
}

.pill.danger {
  background: $vn-danger-soft;
}

.icon-sm {
  font-size: 30rpx;
  color: $vn-text-muted;
}

.action-text {
  font-size: 22rpx;
  color: $vn-text-muted;
}

.danger-text {
  color: $vn-danger;
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
  background: $vn-surface;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid $vn-border;
}

.chip-text {
  font-size: 20rpx;
  color: $vn-text-muted;
  letter-spacing: 2rpx;
}

.play-btn {
  width: 140rpx;
  height: 140rpx;
  border-radius: 70rpx;
  background: $vn-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 24rpx 48rpx $vn-primary-glow;
}

.play-icon {
  font-size: 88rpx;
  color: #ffffff;
}

.bottom-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120rpx;
  background: linear-gradient(0deg, $vn-bg-soft 0%, rgba(255, 249, 241, 0) 100%);
}
</style>
