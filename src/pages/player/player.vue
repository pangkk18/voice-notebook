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

    <view v-if="showOwnerActions" class="actions">
      <view class="action">
        <view class="pill" @click="openShareDialog">
          <i class="iconfont icon-share icon-sm"></i>
        </view>
        <text class="action-text" @click="openShareDialog">分享</text>
      </view>
      <view class="action">
        <view class="pill" @click="openRenameDialog">
          <i class="iconfont icon-edit1 icon-sm"></i>
        </view>
        <text class="action-text" @click="openRenameDialog">重命名</text>
      </view>
      <view class="action">
        <view class="pill danger" @click="confirmDeleteRecord">
          <i class="iconfont icon-delete icon-sm"></i>
        </view>
        <text class="action-text danger-text" @click="confirmDeleteRecord">删除</text>
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

    <view v-if="renameDialogVisible" class="rename-mask" @click="closeRenameDialog">
      <view class="rename-dialog" @click.stop>
        <view class="rename-head">
          <text class="rename-title">重命名录音</text>
          <text class="rename-subtitle">新的标题会同步更新当前页面与云端记录。</text>
        </view>
        <view class="rename-input-wrap">
          <input
            class="rename-input"
            :value="renameDraft"
            maxlength="30"
            placeholder="请输入新的录音名称"
            placeholder-class="rename-placeholder"
            :focus="renameInputFocus"
            @input="onRenameInput"
            @confirm="confirmRename"
          />
          <view
            v-if="renameDraft"
            class="rename-clear"
            @click="clearRenameDraft"
          >
            <text class="rename-clear-text">×</text>
          </view>
        </view>
        <view class="rename-actions">
          <view class="rename-btn ghost" @click="closeRenameDialog">
            <text class="rename-btn-text ghost-text">取消</text>
          </view>
          <view class="rename-btn solid" :class="{ 'btn-disabled': renaming }" @click="confirmRename">
            <text class="rename-btn-text solid-text">{{ renaming ? '保存中...' : '确认' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="shareDialogVisible" class="rename-mask" @click="closeShareDialog">
      <view class="share-dialog" @click.stop>
        <view class="rename-head">
          <text class="rename-title">分享录音</text>
          <text class="rename-subtitle">把这条录音发送给朋友，或分享到朋友圈的专属播放页。</text>
        </view>
        <view class="share-list">
          <button
            class="share-entry share-friend"
            open-type="share"
            @click="closeShareDialog"
          >
            <text class="share-entry-title">发送给朋友</text>
            <text class="share-entry-subtitle">通过微信会话打开同款播放页</text>
          </button>
          <view class="share-entry share-timeline" @click="handleShareTimeline">
            <text class="share-entry-title">分享到朋友圈</text>
            <text class="share-entry-subtitle">点击右上角“...”后选择分享到朋友圈</text>
          </view>
        </view>
        <view class="share-close-row">
          <view class="rename-btn ghost" @click="closeShareDialog">
            <text class="rename-btn-text ghost-text">关闭</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
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
const previewM4aFileID = ref('');
const fullM4aFileID = ref('');
const conversionStatus = ref('');
const currentSourceKind = ref('');
const muteHintShown = ref(false);
const loadingSource = ref(false);
const hasUserInitiatedPlay = ref(false);
const renameDialogVisible = ref(false);
const renameDraft = ref('');
const renameInputFocus = ref(false);
const renaming = ref(false);
const deleting = ref(false);
const showOwnerActions = ref(false);
const shareToken = ref('');
const shareDialogVisible = ref(false);
const sharePreparing = ref(false);
let audioContext = null;
let playbackStallTimer = null;
let waveformTimer = null;
let waveformTick = 0;
let waitingRecoveryTimer = null;
let playbackSessionId = 0;
let sourceCandidates = [];
let activeSourceIndex = -1;
let pendingAutoPlay = false;
let pendingSeekTime = 0;
let lastTimeUpdateAt = 0;
const sourceRetryCounts = new Map();
const tempUrlCache = new Map();

const BAR_COUNT = 15;
const BASE_WAVE_BARS = [18, 26, 20, 34, 22, 28, 24, 30, 22, 34, 20, 26, 18, 24, 20];

const bars = ref(BASE_WAVE_BARS.map((h) => ({ h, active: false })));

const goBack = () => {
  uni.navigateBack();
};

const openRenameDialog = () => {
  renameDraft.value = recordTitle.value || '';
  renameDialogVisible.value = true;
  renameInputFocus.value = false;
  setTimeout(() => {
    renameInputFocus.value = true;
  }, 30);
};

const closeRenameDialog = () => {
  if (renaming.value) return;
  renameInputFocus.value = false;
  renameDialogVisible.value = false;
};

const onRenameInput = (event) => {
  renameDraft.value = String(event?.detail?.value || '');
};

const clearRenameDraft = () => {
  renameDraft.value = '';
  renameInputFocus.value = false;
  setTimeout(() => {
    renameInputFocus.value = true;
  }, 30);
};

const confirmRename = async () => {
  const nextName = String(renameDraft.value || '').trim();
  if (!nextName) {
    uni.showToast({
      title: '请输入新的录音名称',
      icon: 'none'
    });
    return;
  }
  if (!recordId.value) {
    uni.showToast({
      title: '缺少录音记录 ID',
      icon: 'none'
    });
    return;
  }
  if (nextName === recordTitle.value) {
    closeRenameDialog();
    return;
  }

  renaming.value = true;
  try {
    const result = await callCloudFunction({
      name: 'updateNotebookName',
      data: {
        id: recordId.value,
        name: nextName
      }
    });
    if (!result?.success) {
      throw new Error(result?.error || 'updateNotebookName failed');
    }
    recordTitle.value = nextName;
    renaming.value = false;
    closeRenameDialog();
    uni.showToast({
      title: '重命名成功',
      icon: 'success'
    });
  } catch (error) {
    console.error('Rename notebook failed:', error);
    uni.showToast({
      title: '重命名失败',
      icon: 'none'
    });
  } finally {
    renaming.value = false;
  }
};

const formatRecordDate = (raw) => {
  if (!raw) return '未记录时间';
  const date = raw instanceof Date
    ? raw
    : typeof raw === 'object' && raw
      ? (raw.$date ? new Date(raw.$date) : raw._seconds ? new Date(raw._seconds * 1000) : raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw))
      : new Date(raw);
  if (Number.isNaN(date.getTime())) return '未记录时间';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 · ${hour}:${minute}`;
};

const buildSharePath = () => {
  if (!shareToken.value) return '/pages/player/player';
  return `/pages/player/player?shareToken=${encodeURIComponent(shareToken.value)}`;
};

const getShareTitle = () => {
  const title = recordTitle.value || '录音打卡';
  return `${title} | 录音打卡`;
};

const ensureShareToken = async () => {
  if (shareToken.value) return shareToken.value;
  if (!recordId.value) {
    throw new Error('recordId is required');
  }
  const result = await callCloudFunction({
    name: 'ensureNotebookShareToken',
    data: {
      id: recordId.value
    }
  });
  if (!result?.success || !result?.shareToken) {
    throw new Error(result?.error || 'ensureNotebookShareToken failed');
  }
  shareToken.value = result.shareToken;
  return shareToken.value;
};

const closeShareDialog = () => {
  if (sharePreparing.value) return;
  shareDialogVisible.value = false;
};

const openShareDialog = async () => {
  if (!showOwnerActions.value || sharePreparing.value) return;
  sharePreparing.value = true;
  try {
    await ensureShareToken();
    shareDialogVisible.value = true;
  } catch (error) {
    console.error('Prepare share failed:', error);
    uni.showToast({
      title: '分享准备失败',
      icon: 'none'
    });
  } finally {
    sharePreparing.value = false;
  }
};

const handleShareTimeline = async () => {
  try {
    await ensureShareToken();
    closeShareDialog();
    if (wx?.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    uni.showModal({
      title: '分享到朋友圈',
      content: '请点击右上角“...”菜单，选择“分享到朋友圈”。',
      showCancel: false,
      confirmText: '知道了'
    });
  } catch (error) {
    console.error('Prepare timeline share failed:', error);
    uni.showToast({
      title: '分享准备失败',
      icon: 'none'
    });
  }
};

const deleteLocalFiles = async () => {
  if (!wx?.getFileSystemManager) return;
  const fs = wx.getFileSystemManager();
  const uniquePaths = Array.from(new Set([localFilePath.value, tempFilePath.value].filter(Boolean)));

  await Promise.all(uniquePaths.map((filePath) => new Promise((resolve) => {
    fs.unlink({
      filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  })));
};

const confirmDeleteRecord = () => {
  if (!showOwnerActions.value) return;
  if (deleting.value) return;
  uni.showModal({
    title: '删除录音',
    content: `确认删除“${recordTitle.value || '未命名录音'}”吗？删除后将无法恢复。`,
    confirmText: '删除',
    confirmColor: '#D85F4F',
    cancelText: '取消',
    success: async (res) => {
      if (!res.confirm) return;
      if (!recordId.value) {
        uni.showToast({
          title: '缺少录音记录 ID',
          icon: 'none'
        });
        return;
      }

      deleting.value = true;
      uni.showLoading({
        title: '删除中...',
        mask: true
      });

      try {
        const result = await callCloudFunction({
          name: 'deleteNotebookRecord',
          data: {
            id: recordId.value
          }
        });

        if (!result?.success) {
          throw new Error(result?.error || 'deleteNotebookRecord failed');
        }

        resetActiveMedia();
        await deleteLocalFiles();

        uni.hideLoading();
        uni.showToast({
          title: '删除成功',
          icon: 'success'
        });

        setTimeout(() => {
          uni.navigateBack();
        }, 240);
      } catch (error) {
        console.error('Delete notebook failed:', error);
        uni.hideLoading();
        uni.showToast({
          title: '删除失败',
          icon: 'none'
        });
      } finally {
        deleting.value = false;
      }
    }
  });
};

const togglePlay = async () => {
  hasUserInitiatedPlay.value = true;
  if (!audioContext) {
    pendingAutoPlay = true;
    await initPreferredSource({ autoPlay: true });
    return;
  }
  if (playing.value) {
    pauseActiveMedia();
  } else {
    playActiveMedia();
  }
};

const isConversionCompleted = () => {
  return conversionStatus.value === 'completed';
};

const onSliderChange = (event) => {
  const next = Number(event.detail.value) || 0;
  current.value = next;
  seekActiveMedia(next);
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
  seekActiveMedia(next);
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
    const now = getActiveCurrentTime();
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

const getFileExtensionFromId = (fileID = '') => {
  const cleanID = String(fileID).split('?')[0];
  const match = cleanID.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || 'mp3';
};

const getSourceKey = (candidate = {}) => {
  if (candidate.kind === 'local') return `local:${candidate.path}`;
  if (candidate.kind === 'remote-file') return `remote:${candidate.fileID}`;
  return `${candidate.kind || 'unknown'}:${candidate.path || candidate.fileID || ''}`;
};

const showPlaybackLoading = (title = '音频加载中...') => {
  if (loadingSource.value) return;
  loadingSource.value = true;
  uni.showLoading({
    title,
    mask: true
  });
};

const hidePlaybackLoading = () => {
  if (!loadingSource.value) return;
  loadingSource.value = false;
  uni.hideLoading();
};

const clearWaitingRecoveryTimer = () => {
  if (waitingRecoveryTimer) {
    clearTimeout(waitingRecoveryTimer);
    waitingRecoveryTimer = null;
  }
};

const scheduleWaitingRecovery = (reason = 'waiting') => {
  clearWaitingRecoveryTimer();
  waitingRecoveryTimer = setTimeout(() => {
    if (!audioContext) return;
    const now = Date.now();
    if (playing.value && now - lastTimeUpdateAt < 3500) return;
    recoverPlayback(reason);
  }, 6500);
};

const getCloudTempURL = async (fileID) => {
  if (!fileID || !wx?.cloud?.getTempFileURL) {
    return '';
  }
  const cached = tempUrlCache.get(fileID);
  if (cached) {
    return cached;
  }
  const result = await wx.cloud.getTempFileURL({
    fileList: [{ fileID, maxAge: 3600 }]
  });
  const tempURL = result?.fileList?.[0]?.tempFileURL || '';
  if (tempURL) {
    tempUrlCache.set(fileID, tempURL);
  }
  return tempURL;
};

const clearSourceRetryState = () => {
  sourceRetryCounts.clear();
};

const resetPlaybackPendingState = () => {
  pendingAutoPlay = false;
  pendingSeekTime = 0;
};

const logResolvedSourceType = (candidate) => {
  let sourceType = '未知';
  if (candidate?.kind === 'local') {
    sourceType = '本地';
  } else if (candidate?.kind === 'remote-file') {
    sourceType = candidate?.sourceType || '远端音频';
  }

  console.log('[player] resolved source type:', sourceType, {
    kind: candidate?.kind || '',
    sourceType: candidate?.sourceType || '',
    path: candidate?.path || '',
    fileID: candidate?.fileID || ''
  });
};

const getActiveCurrentTime = () => {
  return Number(audioContext?.currentTime || current.value || 0);
};

const pauseActiveMedia = () => {
  if (audioContext) {
    audioContext.pause();
  }
};

const playActiveMedia = () => {
  if (audioContext) {
    audioContext.play();
  }
};

const seekActiveMedia = (time) => {
  if (!Number.isFinite(time) || time < 0) return;
  if (audioContext) {
    audioContext.seek(time);
  }
};

const resetActiveMedia = () => {
  clearPlaybackStallTimer();
  clearWaitingRecoveryTimer();
  stopWaveformAnimation();
  waveformTick = 0;
  playing.value = false;
  if (audioContext) {
    audioContext.destroy();
    audioContext = null;
  }
};

const initRemoteSource = async (candidate) => {
  const tempURL = await getCloudTempURL(candidate.fileID);
  if (!tempURL) return false;
  initAudio(tempURL);
  currentSourceKind.value = candidate.sourceType || 'remote';
  return true;
};

const refreshRecordStatus = async () => {
  if (!recordId.value && !shareToken.value) return;
  try {
    const result = await callCloudFunction({
      name: 'getPlayableAudioSource',
      data: {
        recordId: recordId.value,
        shareToken: shareToken.value
      }
    });
    const latest = result?.data;
    if (!result?.success || !latest) return;

    recordId.value = latest.id || recordId.value;
    shareToken.value = latest.shareToken || shareToken.value;
    showOwnerActions.value = !!latest.isOwner;
    if (latest.name) {
      recordTitle.value = latest.name;
    }
    if (latest.create_time) {
      recordDate.value = formatRecordDate(latest.create_time);
    }
    if (Number.isFinite(Number(latest.duration)) && Number(latest.duration) > 0) {
      duration.value = Math.max(Math.floor(Number(latest.duration)), 1);
    }
    conversionStatus.value = latest.conversion_status || '';
    previewM4aFileID.value = latest.previewM4aFileID || previewM4aFileID.value;
    fullM4aFileID.value = latest.fullM4aFileID || fullM4aFileID.value;
    cloudFileID.value = latest.fileID || cloudFileID.value;
    if (!tempFilePath.value && latest.temp_path) {
      tempFilePath.value = latest.temp_path;
    }
    if (!localFilePath.value && latest.temp_path) {
      localFilePath.value = latest.temp_path;
    }
  } catch (error) {
    console.warn('refreshRecordStatus failed:', error);
  }
};

const buildSourceCandidates = async () => {
  await refreshRecordStatus();
  const candidates = [];
  const seen = new Set();

  const pushCandidate = async (candidate) => {
    const key = getSourceKey(candidate);
    if (!key || seen.has(key)) return;
    if (candidate.kind === 'local' && !(await isLocalFileUsable(candidate.path))) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  };

  await pushCandidate({
    kind: 'local',
    path: localFilePath.value
  });
  await pushCandidate({
    kind: 'local',
    path: tempFilePath.value
  });

  if (isConversionCompleted() && previewM4aFileID.value) {
    await pushCandidate({
      kind: 'remote-file',
      fileID: previewM4aFileID.value,
      sourceType: 'Preview M4A'
    });
  }

  if (isConversionCompleted() && fullM4aFileID.value) {
    await pushCandidate({
      kind: 'remote-file',
      fileID: fullM4aFileID.value,
      sourceType: 'Full M4A'
    });
  }

  if (cloudFileID.value && getFileExtensionFromId(cloudFileID.value) === 'wav') {
    await pushCandidate({
      kind: 'remote-file',
      fileID: cloudFileID.value,
      sourceType: '远端 WAV'
    });
  }

  return candidates;
};

const activateSourceCandidate = async (candidate, options = {}) => {
  const { autoPlay = false, seekTime = 0 } = options;
  pendingAutoPlay = autoPlay;
  pendingSeekTime = seekTime;
  const key = getSourceKey(candidate);

  try {
    if (candidate.kind === 'local') {
      initAudio(candidate.path);
      currentSourceKind.value = 'local';
      return true;
    }

    if (candidate.kind === 'remote-file') {
      return initRemoteSource(candidate);
    }
  } catch (error) {
    console.warn(`activateSourceCandidate failed: ${key}`, error);
  }

  return false;
};

const initPreferredSource = async (options = {}) => {
  const { autoPlay = false, seekTime = 0, startIndex = 0 } = options;
  if (startIndex === 0) {
    clearSourceRetryState();
  }
  if (autoPlay) {
    showPlaybackLoading('正在准备播放...');
  }
  sourceCandidates = await buildSourceCandidates();

  for (let index = startIndex; index < sourceCandidates.length; index += 1) {
    const ok = await activateSourceCandidate(sourceCandidates[index], { autoPlay, seekTime });
    if (ok) {
      activeSourceIndex = index;
      logResolvedSourceType(sourceCandidates[index]);
      if (autoPlay) {
        hidePlaybackLoading();
      }
      return true;
    }
  }

  activeSourceIndex = -1;
  if (autoPlay) {
    hidePlaybackLoading();
  }
  if (autoPlay || hasUserInitiatedPlay.value) {
    uni.showToast({ title: '没有可播放的音频', icon: 'none' });
  }
  return false;
};

const recoverPlayback = async (reason = 'error') => {
  if (!hasUserInitiatedPlay.value) {
    return;
  }
  const resumeAt = Math.floor(getActiveCurrentTime());
  const activeCandidate = sourceCandidates[activeSourceIndex];
  const sourceKey = getSourceKey(activeCandidate);
  const usedRetryCount = sourceRetryCounts.get(sourceKey) || 0;

  clearPlaybackStallTimer();
  clearWaitingRecoveryTimer();
  stopWaveformAnimation();
  playing.value = false;
  showPlaybackLoading('网络较慢，正在重试...');

  if (activeCandidate && usedRetryCount < 1) {
    sourceRetryCounts.set(sourceKey, usedRetryCount + 1);
    const ok = await activateSourceCandidate(activeCandidate, { autoPlay: true, seekTime: resumeAt });
    if (ok) {
      hidePlaybackLoading();
      uni.showToast({
        title: reason === 'waiting' ? '已重新加载音频' : '正在重试播放',
        icon: 'none'
      });
      return;
    }
  }

  const nextIndex = activeSourceIndex + 1;
  if (nextIndex < sourceCandidates.length) {
    const ok = await initPreferredSource({ autoPlay: true, seekTime: resumeAt, startIndex: nextIndex });
    if (ok) {
      uni.showToast({
        title: '已切换备用音源',
        icon: 'none'
      });
      return;
    }
  }

  hidePlaybackLoading();
  uni.showToast({
    title: '音频播放失败，请稍后重试',
    icon: 'none'
  });
};

const initAudio = (src) => {
  resetActiveMedia();
  const sessionId = ++playbackSessionId;
  audioContext = uni.createInnerAudioContext();
  audioContext.src = src;
  audioContext.autoplay = false;
  // iOS: allow playback even when mute switch is on.
  audioContext.obeyMuteSwitch = false;

  audioContext.onPlay(() => {
    if (sessionId !== playbackSessionId) return;
    playing.value = true;
    hasUserInitiatedPlay.value = true;
    lastTimeUpdateAt = Date.now();
    hidePlaybackLoading();
    schedulePlaybackStallHint();
    startWaveformAnimation();
  });
  audioContext.onPause(() => {
    if (sessionId !== playbackSessionId) return;
    playing.value = false;
    clearPlaybackStallTimer();
    clearWaitingRecoveryTimer();
    stopWaveformAnimation();
  });
  audioContext.onStop(() => {
    if (sessionId !== playbackSessionId) return;
    playing.value = false;
    clearPlaybackStallTimer();
    clearWaitingRecoveryTimer();
    stopWaveformAnimation();
  });
  audioContext.onEnded(() => {
    if (sessionId !== playbackSessionId) return;
    playing.value = false;
    current.value = duration.value;
    clearPlaybackStallTimer();
    clearWaitingRecoveryTimer();
    stopWaveformAnimation();
    updateWaveformProgress();
  });
  audioContext.onTimeUpdate(() => {
    if (sessionId !== playbackSessionId) return;
    lastTimeUpdateAt = Date.now();
    current.value = Math.floor(audioContext.currentTime || 0);
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
    hidePlaybackLoading();
    clearWaitingRecoveryTimer();
    updateWaveformProgress();
    if ((audioContext.currentTime || 0) > 0.2) {
      clearPlaybackStallTimer();
      muteHintShown.value = false;
    }
  });
  audioContext.onCanplay(() => {
    if (sessionId !== playbackSessionId) return;
    if (audioContext.duration && Number.isFinite(audioContext.duration)) {
      duration.value = Math.max(Math.floor(audioContext.duration), 1);
    }
    if (pendingSeekTime > 0) {
      audioContext.seek(pendingSeekTime);
      pendingSeekTime = 0;
    }
    if (pendingAutoPlay) {
      pendingAutoPlay = false;
      setTimeout(() => {
        if (sessionId !== playbackSessionId || !audioContext) return;
        audioContext.play();
      }, 80);
    }
  });
  audioContext.onWaiting(() => {
    if (sessionId !== playbackSessionId) return;
    if (!hasUserInitiatedPlay.value) {
      return;
    }
    showPlaybackLoading('网络较慢，正在缓冲...');
    scheduleWaitingRecovery('waiting');
  });
  audioContext.onError((error) => {
    if (sessionId !== playbackSessionId) return;
    recoverPlayback('error');
  });
};

const schedulePlaybackStallHint = () => {
  clearPlaybackStallTimer();
  playbackStallTimer = setTimeout(() => {
    if (!audioContext || !playing.value) return;
    // Started playing but still no progress, often caused by mute/very low volume.
    const t = getActiveCurrentTime();
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
  if (wx?.showShareMenu) {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    });
  }
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
    showOwnerActions.value = true;
  }
  if (options?.shareToken) {
    shareToken.value = decodeParam(options.shareToken);
    showOwnerActions.value = false;
    localFilePath.value = '';
    tempFilePath.value = '';
  }
  if (options?.conversionStatus) {
    conversionStatus.value = decodeParam(options.conversionStatus);
  }
  // 支持从云端文件播放
  if (options?.cloudFileID) {
    cloudFileID.value = decodeParam(options.cloudFileID);
  }
  if (options?.previewM4aFileID) {
    previewM4aFileID.value = decodeParam(options.previewM4aFileID);
  }
  if (options?.fullM4aFileID) {
    fullM4aFileID.value = decodeParam(options.fullM4aFileID);
  }

  initPreferredSource();
});

onShareAppMessage(() => {
  return {
    title: getShareTitle(),
    path: buildSharePath()
  };
});

onShareTimeline(() => {
  return {
    title: getShareTitle(),
    query: shareToken.value ? `shareToken=${encodeURIComponent(shareToken.value)}` : ''
  };
});

onUnload(() => {
  clearPlaybackStallTimer();
  clearWaitingRecoveryTimer();
  stopWaveformAnimation();
  hidePlaybackLoading();
  resetPlaybackPendingState();
  resetActiveMedia();
  renameInputFocus.value = false;
});
</script>

<style lang="scss" scoped>
@use "@/styles/notebook-theme.scss" as *;

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

.rename-mask {
  position: fixed;
  inset: 0;
  background: rgba(49, 37, 25, 0.28);
  backdrop-filter: blur(10rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36rpx;
  z-index: 20;
}

.rename-dialog {
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 30rpx 28rpx;
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(246, 240, 231, 0.98) 0%, rgba(234, 223, 204, 0.96) 100%);
  border: 1rpx solid rgba(196, 106, 45, 0.14);
  box-shadow: 0 28rpx 56rpx rgba(83, 57, 37, 0.18);
}

.share-dialog {
  width: 100%;
  max-width: 620rpx;
  padding: 34rpx 30rpx 28rpx;
  border-radius: 30rpx;
  background: linear-gradient(180deg, rgba(246, 240, 231, 0.98) 0%, rgba(234, 223, 204, 0.96) 100%);
  border: 1rpx solid rgba(196, 106, 45, 0.14);
  box-shadow: 0 28rpx 56rpx rgba(83, 57, 37, 0.18);
}

.rename-head {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 22rpx;
}

.rename-title {
  font-family: 'DM Serif Display', 'Source Han Serif SC', serif;
  font-size: 38rpx;
  color: $vn-text;
}

.rename-subtitle {
  font-size: 22rpx;
  color: $vn-text-muted;
  line-height: 1.6;
}

.rename-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 26rpx;
}

.rename-input {
  width: 100%;
  height: 96rpx;
  padding: 0 68rpx 0 26rpx;
  box-sizing: border-box;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.74);
  border: 1rpx solid rgba(122, 142, 118, 0.24);
  color: $vn-text;
  font-size: 30rpx;
}

.rename-placeholder {
  color: $vn-text-muted;
}

.rename-clear {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(122, 142, 118, 0.14);
  border: 1rpx solid rgba(122, 142, 118, 0.24);
  z-index: 1;
}

.rename-clear-text {
  font-size: 26rpx;
  line-height: 1;
  color: #7a8e76;
}

.rename-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.share-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 26rpx;
}

.share-entry {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
  padding: 24rpx 26rpx;
  border-radius: 24rpx;
  box-sizing: border-box;
  border: 1rpx solid rgba(196, 106, 45, 0.16);
}

button.share-entry {
  margin: 0;
  line-height: 1.4;
  background: transparent;
}

button.share-entry::after {
  border: none;
}

.share-friend {
  background: linear-gradient(135deg, rgba(196, 106, 45, 0.16) 0%, rgba(196, 106, 45, 0.08) 100%);
}

.share-timeline {
  background: rgba(255, 255, 255, 0.52);
}

.share-entry-title {
  font-size: 30rpx;
  color: $vn-text;
  font-weight: 600;
}

.share-entry-subtitle {
  font-size: 22rpx;
  color: $vn-text-muted;
  line-height: 1.5;
  text-align: left;
}

.share-close-row {
  display: flex;
}

.share-close-row .rename-btn {
  width: 100%;
}

.rename-btn {
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rename-btn.ghost {
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(122, 142, 118, 0.18);
}

.rename-btn.solid {
  background: $vn-primary;
  box-shadow: 0 12rpx 28rpx $vn-primary-glow;
}

.rename-btn.btn-disabled {
  opacity: 0.72;
}

.rename-btn-text {
  font-size: 28rpx;
  font-weight: 600;
}

.ghost-text {
  color: $vn-text-muted;
}

.solid-text {
  color: #ffffff;
}
</style>
