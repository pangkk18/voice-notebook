<template>
	<view class="home-container">
		<!-- Idle View -->
		<view v-if="!isRecording" class="content-wrapper">
			<view class="streak-chip">
				<i class="iconfont icon-fire fire-icon"></i>
				<text>连续{{ streak }}天记录</text>
			</view>

			<text class="greeting">{{ greeting }}</text>
			<text class="subtitle">{{ subtitle }}</text>

			<view class="recording-area">
				<view class="record-button" :class="{ 'is-disabled': isDailyLimitReached }" @click="handleRecordClick">
					<i class="iconfont icon-mic record-icon"></i>
				</view>
				<text class="record-prompt">{{ tapToStartMessage }}</text>
				<text class="record-quota">{{ todayQuotaMessage }}</text>
				<view class="waveform">
					<view class="wave" v-for="w in staticWaves" :key="w.index" :style="{height: `${w.height}px`}">
					</view>
				</view>
			</view>
		</view>

		<!-- Recording View -->
		<view v-else class="recording-container">
			<view class="recording-status">
				<view class="red-dot"></view>
				<text>RECORDING...</text>
			</view>
			<text class="timer">{{ elapsedTime }}</text>
			<view class="waveform-active">
				<view class="wave-active" v-for="(amplitude, i) in waveAmplitudes" :key="i" :style="{ height: `${amplitude}px` }"></view>
			</view>
			<text class="recording-instruction">轻触下方按钮停止并保存您的录音</text>

			<view class="controls-wrapper">
				<view class="control-button" @click="handleFlagClick">
					<i class="iconfont icon-flag control-icon"></i>
				</view>
				<view class="stop-button" @click="handleStopClick">
					<i class="iconfont icon-stop stop-icon"></i>
				</view>
				<view class="control-button" @click="handlePauseClick">
					<i class="iconfont icon-pause control-icon"></i>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { callCloudFunction } from '../../utils/cloudbase';

// --- State ---
const isRecordedToday = ref(false);
const todayRecordCount = ref(0);
const isRecording = ref(false);
const streak = ref(5);
const elapsedTime = ref('00:00');
let timerInterval = null;
let seconds = 0;
let recorderManager = null;
let isStoppingRecording = false;
const MIN_WAVE_AMP = 5;
const DAILY_RECORD_LIMIT = 3;
const MAX_RECORD_SECONDS = 20 * 60;
const MAX_RECORD_DURATION_MS = MAX_RECORD_SECONDS * 1000;
const waveAmplitudes = ref(new Array(30).fill(MIN_WAVE_AMP));
const WAV_SAMPLE_RATE = 16000
const WAV_CHANNELS = 1
const WAV_BITS = 16
let cachedOpenId = null
const pendingRecordingInfo = ref(null)

const staticWaves = [
	{index: 0, height: 20},
	{index: 1, height: 40},
	{index: 2, height: 30},
	{index: 3, height: 60},
	{index: 4, height: 30},
	{index: 5, height: 40},
	{index: 6, height: 20}
]

// --- Computed Properties ---
const greeting = computed(() => {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) {
		return '早上好';
	} else if (hour >= 12 && hour < 18) {
		return '下午好';
	} else {
		return '晚上好';
	}
});
const subtitle = ref("准备好了么，开始今天的打卡?");
const isDailyLimitReached = computed(() => todayRecordCount.value >= DAILY_RECORD_LIMIT);
const tapToStartMessage = computed(() => {
	return isDailyLimitReached.value ? '今日录制次数已用完' : '轻点开始录制';
});
const todayQuotaMessage = computed(() => {
	const count = Math.min(todayRecordCount.value, DAILY_RECORD_LIMIT);
	return `今日已录制 ${count}/${DAILY_RECORD_LIMIT} 条 · 单条最长20分钟`;
});


// --- Methods ---
const startTimer = () => {
	seconds = 0;
	elapsedTime.value = '00:00';
	timerInterval = setInterval(() => {
		seconds++;
		const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
		const secs = (seconds % 60).toString().padStart(2, '0');
		elapsedTime.value = `${mins}:${secs}`;
		if (seconds >= MAX_RECORD_SECONDS) {
			stopRecording({ reachedTimeLimit: true });
		}
	}, 1000);
};

const stopTimer = () => {
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
};

const handleRecordClick = () => {
	if (isDailyLimitReached.value) {
		uni.showToast({
			title: '今天最多录制3条',
			icon: 'none'
		});
		return;
	}

	isStoppingRecording = false;
	isRecording.value = true;
	startTimer();
	uni.setNavigationBarTitle({
		title: '正在录音'
	});
	if (recorderManager) {
		recorderManager.start({
			duration: MAX_RECORD_DURATION_MS,
			sampleRate: 16000,
			numberOfChannels: 1,
			// Use PCM so onFrameRecorded provides raw audio frames
			format: 'PCM',
			// 16000 samples/sec * 16-bit * 1 channel / 8 = 32000 bytes/sec
			// frameSize is in KB; 1KB ~ 30ms at 32KB/s (more responsive)
			frameSize: 1
		});
	}
};

function stopRecording(options = {}) {
	if (isStoppingRecording) return;
	isStoppingRecording = true;

	isRecording.value = false;
	isRecordedToday.value = true;
	todayRecordCount.value = Math.min(todayRecordCount.value + 1, DAILY_RECORD_LIMIT);
	pendingRecordingInfo.value = {
		duration: elapsedTime.value,
		title: `录音 ${formatFileTime(new Date())}`,
		date: formatDisplayTime(new Date())
	}
	stopTimer();
	if (options.reachedTimeLimit) {
		uni.showToast({
			title: '已达到20分钟上限，录音已自动结束',
			icon: 'none',
			duration: 2600
		});
	}
	if (recorderManager) {
		recorderManager.stop();
	}
	uni.setNavigationBarTitle({
		title: '首页'
	});
}

const handleStopClick = () => {
	stopRecording();
};

const handlePauseClick = () => {
	uni.showToast({ title: '已暂停', icon: 'none' });
	if (recorderManager) {
		recorderManager.pause()
	}
};

const handleFlagClick = () => {
	uni.showToast({ title: '已标记', icon: 'none' });
	// TODO: Implement flag logic
};

function normalizeDate(raw) {
	if (!raw) return null
	if (raw instanceof Date) return raw
	if (typeof raw === 'string' || typeof raw === 'number') {
		const date = new Date(raw)
		return Number.isNaN(date.getTime()) ? null : date
	}
	if (typeof raw === 'object') {
		if (raw.$date) {
			const date = new Date(raw.$date)
			return Number.isNaN(date.getTime()) ? null : date
		}
		if (raw._seconds) {
			return new Date(raw._seconds * 1000)
		}
		if (raw.seconds) {
			return new Date(raw.seconds * 1000)
		}
	}
	return null
}

function toLocalDateKey(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function calculateStreakFromDates(dateKeys) {
	if (!dateKeys.length) return 0

	const today = new Date()
	today.setHours(0, 0, 0, 0)

	let cursor = new Date(today)
	let streakCount = 0

	while (dateKeys.has(toLocalDateKey(cursor))) {
		streakCount += 1
		cursor.setDate(cursor.getDate() - 1)
	}

	return streakCount
}

function updateHomeSummary(records = []) {
	const uniqueDateKeys = new Set()
	let nextTodayRecordCount = 0

	records.forEach((item) => {
		const createdAt = normalizeDate(item?.create_time)
		if (!createdAt) return
		const dateKey = toLocalDateKey(createdAt)
		uniqueDateKeys.add(dateKey)
		if (dateKey === toLocalDateKey(new Date())) {
			nextTodayRecordCount += 1
		}
	})

	const todayKey = toLocalDateKey(new Date())
	todayRecordCount.value = nextTodayRecordCount
	isRecordedToday.value = todayRecordCount.value > 0
	streak.value = calculateStreakFromDates(uniqueDateKeys)

	if (isDailyLimitReached.value) {
		subtitle.value = '今天的3条录音已完成，明天再继续记录。'
	} else if (isRecordedToday.value) {
		subtitle.value = streak.value > 1 ? `你已经连续打卡 ${streak.value} 天，继续保持。` : '今天已经完成打卡，明天继续保持。'
	} else if (streak.value > 0) {
		subtitle.value = `你已经连续打卡 ${streak.value} 天，今天也别中断。`
	} else {
		subtitle.value = '准备好了么，开始今天的打卡?'
	}
}

async function loadHomeSummary() {
	try {
		const result = await callCloudFunction({
			name: 'getNotebookList',
			data: { limit: 365 }
		})

		if (!result?.success) {
			throw new Error(result?.error || 'getNotebookList failed')
		}

		const records = Array.isArray(result.data) ? result.data : []
		updateHomeSummary(records)
	} catch (error) {
		console.error('Load home summary failed:', error)
	}
}

function getRMS(frameBuffer) {
  // Some frames may have odd byteLength; use DataView for safe int16 reads
  const byteLength = frameBuffer.byteLength - (frameBuffer.byteLength % 2)
  if (byteLength <= 0) return 0
  const view = new DataView(frameBuffer, 0, byteLength)
  let sumSquares = 0
  const sampleCount = byteLength / 2

  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true) / 32768 // little-endian
    sumSquares += sample * sample
  }

  return Math.sqrt(sumSquares / sampleCount)
}

function writeString(view, offset, str) {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i))
	}
}

function formatDisplayTime(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hour = String(date.getHours()).padStart(2, '0')
	const minute = String(date.getMinutes()).padStart(2, '0')
	return `${year}年${month}月${day}日 · ${hour}:${minute}`
}

function formatFileTime(date) {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hour = String(date.getHours()).padStart(2, '0')
	const minute = String(date.getMinutes()).padStart(2, '0')
	return `${year}-${month}-${day} ${hour}:${minute}`
}

function openPlayerPage(meta, filePath, tempFilePath, cloudFileID, previewM4aFileID = '', fullM4aFileID = '') {
	if (!meta) return
	const params = [
		`title=${encodeURIComponent(meta.title)}`,
		`date=${encodeURIComponent(meta.date)}`,
		`duration=${encodeURIComponent(meta.duration)}`,
		`localFilePath=${encodeURIComponent(filePath || '')}`,
		`tempFilePath=${encodeURIComponent(tempFilePath || '')}`,
		`cloudFileID=${encodeURIComponent(cloudFileID || '')}`,
		`previewM4aFileID=${encodeURIComponent(previewM4aFileID || '')}`,
		`fullM4aFileID=${encodeURIComponent(fullM4aFileID || '')}`
	].join('&')
	uni.navigateTo({
		url: `/pages/player/player?${params}`
	})
}

function parseDurationToSeconds(durationText) {
	const [mins, secs] = String(durationText || '00:00').split(':').map((item) => Number(item))
	if (!Number.isFinite(mins) || !Number.isFinite(secs)) return 0
	return mins * 60 + secs
}

async function saveRecordingToNotebook(meta, tempPath, audioType) {
	if (!meta || !tempPath) {
		throw new Error('录音元数据不完整')
	}
	const payload = {
		name: meta.title || '未命名录音',
		duration: parseDurationToSeconds(meta.duration),
		temp_path: tempPath,
		type: audioType || 'audio/wav',
	}
	const result = await callCloudFunction({
		name: 'createNotebookRecord',
		data: payload
	})
	if (!result?.success || !result?.id) {
		throw new Error(result?.error || 'createNotebookRecord failed')
	}
	return result.id
}

async function updateNotebookUploadInfo(recordId, fileID, cloudPath) {
	if (!recordId || !fileID || !cloudPath) {
		throw new Error('更新上传信息参数不完整')
	}
	const result = await callCloudFunction({
		name: 'updateNotebookUpload',
		data: {
			id: recordId,
			fileID,
			cloudPath
		}
	})
	if (!result?.success) {
		throw new Error(result?.error || 'updateNotebookUpload failed')
	}
	return true
}

function createWavHeader(dataSize) {
	const buffer = new ArrayBuffer(44)
	const view = new DataView(buffer)
	const byteRate = WAV_SAMPLE_RATE * WAV_CHANNELS * (WAV_BITS / 8)
	const blockAlign = WAV_CHANNELS * (WAV_BITS / 8)

	writeString(view, 0, 'RIFF')
	view.setUint32(4, 36 + dataSize, true)
	writeString(view, 8, 'WAVE')
	writeString(view, 12, 'fmt ')
	view.setUint32(16, 16, true) // PCM chunk size
	view.setUint16(20, 1, true) // audio format (1 = PCM)
	view.setUint16(22, WAV_CHANNELS, true)
	view.setUint32(24, WAV_SAMPLE_RATE, true)
	view.setUint32(28, byteRate, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, WAV_BITS, true)
	writeString(view, 36, 'data')
	view.setUint32(40, dataSize, true)

	return buffer
}

function ensureDir(dirPath) {
	const fs = wx.getFileSystemManager()
	return new Promise((resolve) => {
		fs.mkdir({
			dirPath,
			recursive: true,
			success: () => resolve(true),
			fail: () => resolve(false)
		})
	})
}

function savePcmAsWav(tempFilePath) {
	const fs = wx.getFileSystemManager()
	const userDir = `${wx.env.USER_DATA_PATH}/recordings`
	const fileName = `recording_${Date.now()}.wav`
	const wavPath = `${userDir}/${fileName}`

	return ensureDir(userDir).then(() => new Promise((resolve, reject) => {
		fs.readFile({
			filePath: tempFilePath,
			success: (res) => {
				const pcmBuffer = res.data
				const dataSize = pcmBuffer.byteLength - (pcmBuffer.byteLength % 2)
				const header = createWavHeader(dataSize)
				const wavBuffer = new Uint8Array(44 + dataSize)
				wavBuffer.set(new Uint8Array(header), 0)
				wavBuffer.set(new Uint8Array(pcmBuffer, 0, dataSize), 44)
				fs.writeFile({
					filePath: wavPath,
					data: wavBuffer.buffer,
					encoding: 'binary',
					success: () => resolve(wavPath),
					fail: (err) => reject(err)
				})
			},
			fail: (err) => reject(err)
		})
	}))
}

async function getOpenId() {
	if (cachedOpenId) return cachedOpenId
	const res = await callCloudFunction({ name: 'getOpenId', data: {} })
	if (!res || !res.success || !res.openid) {
		throw new Error(res?.error || 'OPENID not found')
	}
	cachedOpenId = res.openid
	return cachedOpenId
}

async function uploadRecordingToCloud(wavPath) {
	if (!wx?.cloud?.uploadFile) {
		throw new Error('wx.cloud 未初始化')
	}
	const openid = await getOpenId()
	const fileName = wavPath.split('/').pop() || `recording_${Date.now()}.wav`
	const cloudPath = `${openid}/original/${fileName}`

	const { fileID } = await wx.cloud.uploadFile({
		cloudPath,
		filePath: wavPath
	})

	return { cloudPath, fileID }
}


// Track peak RMS for simple auto-gain
let rmsPeak = 0
let lastAmp = 10

// --- Lifecycle Hooks ---
onMounted(() => {
	recorderManager = uni.getRecorderManager();

	recorderManager.onStart(() => {
		console.log('Recorder started');
	});

	recorderManager.onStop((res) => {
		console.log('Recorder stopped:', res);
		if (isRecording.value) {
			const stoppedAtLimit = seconds >= MAX_RECORD_SECONDS ||
				Number(res?.duration || 0) >= MAX_RECORD_DURATION_MS - 1000
			stopTimer()
			isRecording.value = false
			uni.setNavigationBarTitle({
				title: '首页'
			})
			if (!pendingRecordingInfo.value) {
				pendingRecordingInfo.value = {
					duration: stoppedAtLimit ? '20:00' : elapsedTime.value,
					title: `录音 ${formatFileTime(new Date())}`,
					date: formatDisplayTime(new Date())
				}
			}
			if (stoppedAtLimit) {
				todayRecordCount.value = Math.min(todayRecordCount.value + 1, DAILY_RECORD_LIMIT)
				isRecordedToday.value = true
				uni.showToast({
					title: '已达到20分钟上限，录音已自动结束',
					icon: 'none',
					duration: 2600
				})
			}
		}
		isStoppingRecording = false
		// Reset waveform on stop
		waveAmplitudes.value = new Array(30).fill(12);
		rmsPeak = 0
		lastAmp = 10
		// The recorded file is available at res.tempFilePath
		if (res.tempFilePath) {
			savePcmAsWav(res.tempFilePath).then((wavPath) => {
				console.log('WAV saved:', wavPath)
				openPlayerPage(pendingRecordingInfo.value, wavPath, res.tempFilePath)
				const snapshot = pendingRecordingInfo.value
				saveRecordingToNotebook(snapshot, wavPath, 'audio/wav').then((recordId) => {
					console.log('Notebook record saved:', recordId)
					pendingRecordingInfo.value = null
					loadHomeSummary()
					uploadRecordingToCloud(wavPath).then((uploadRes) => {
						console.log('Uploaded:', uploadRes)
						updateNotebookUploadInfo(recordId, uploadRes.fileID, uploadRes.cloudPath).then(() => {
							console.log('Notebook upload fields updated:', recordId)
						}).catch((err) => {
							console.error('Update notebook upload info failed:', err)
							uni.showToast({
								title: '上传成功但回写失败',
								icon: 'none'
							})
						})
					}).catch((err) => {
						console.error('Upload failed:', err)
						uni.showToast({
							title: '上传失败',
							icon: 'none'
						})
					})
				}).catch((err) => {
					console.error('Save notebook data failed:', err)
					pendingRecordingInfo.value = null
					loadHomeSummary()
					uni.showToast({
						title: '录音信息保存失败',
						icon: 'none'
					})
				})
			}).catch((err) => {
				console.error('Save WAV failed:', err)
				openPlayerPage(pendingRecordingInfo.value, '', res.tempFilePath)
				pendingRecordingInfo.value = null
				loadHomeSummary()
				uni.showToast({
					title: '保存失败',
					icon: 'none'
				})
			})
		} else {
			openPlayerPage(pendingRecordingInfo.value, '', '')
			pendingRecordingInfo.value = null
			loadHomeSummary()
			uni.showToast({
				title: '保存失败',
				icon: 'none'
			})
		}
	});

	recorderManager.onFrameRecorded((res) => {
		if (res.isLastFrame) {
			return;
		}
		const { frameBuffer } = res;
		if (frameBuffer.byteLength > 0) {
			const rms = getRMS(frameBuffer)
			// Fixed gain + noise gate for stable, responsive visuals
			const gain = 3.5
			// const gated = rms < 0.002 ? 0 : rms
			const gated = rms < 0.02 ? 0 : rms
			const normalized = Math.min(1, gated * gain)
			// Non-linear boost for small signals, then map to MIN_WAVE_AMP – 140
			const target = Math.max(MIN_WAVE_AMP, Math.min(140, Math.pow(normalized, 0.6) * 140))
			// Faster attack and release for snappier response
			const alpha = target > lastAmp ? 0.8 : 0.35
			lastAmp = lastAmp + (target - lastAmp) * alpha
			const newAmplitudes = [...waveAmplitudes.value]
			newAmplitudes.shift()
			newAmplitudes.push(Math.round(lastAmp))
			waveAmplitudes.value = newAmplitudes
		}
	});

	recorderManager.onError((err) => {
		console.error('Recorder error:', err);
		uni.showToast({
			title: '录音失败，请重试',
			icon: 'none'
		});
		isRecording.value = false;
		isStoppingRecording = false;
		stopTimer();
	});
});

onShow(() => {
	loadHomeSummary()
})

onUnmounted(() => {
	stopTimer();
	// Stop recording if the component is unmounted to avoid leaks
	if (isRecording.value && recorderManager) {
		recorderManager.stop();
	}
});

</script>

<style lang="scss">
	@use "@/styles/notebook-theme.scss" as *;

	.home-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background:
			linear-gradient(180deg, $vn-bg 0%, $vn-bg-alt 42%, $vn-bg-soft 100%);
		padding: 0 24px;
		box-sizing: border-box;
		align-items: center;
		color: $vn-text;
	}

	// --- Idle State Styles ---
	.content-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: 20px;
		width: 100%;
	}

	.streak-chip {
		display: flex;
		align-items: center;
		background-color: $vn-primary-soft;
		border: 1px solid $vn-border-strong;
		border-radius: 20px;
		padding: 6px 12px;
		font-size: 14px;
		color: $vn-primary;

		.fire-icon {
			width: 16px;
			height: 16px;
			color: $vn-primary;
			margin-right: 5px;
		}
	}

	.greeting {
		font-size: 32px;
		font-weight: bold;
		color: $vn-text;
		margin-top: 24px;
	}

	.subtitle {
		font-size: 16px;
		color: $vn-text-muted;
		margin-top: 8px;
	}

	.recording-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 240px;
		height: 360px;
		background-color: $vn-surface;
		border: 10px solid rgba(196, 106, 45, 0.14);
		border-radius: 130px;
		margin-top: 40px;
		cursor: pointer;
		box-shadow: $vn-shadow;
	}

	.record-button {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: $vn-primary;
		box-shadow: 0 10px 30px $vn-primary-glow;
		transition: all 0.3s ease;

		.record-icon {
			font-size: 70px;
			color: #fff;
			line-height: 1;
		}

		&.is-recorded {
			background-color: $vn-secondary;
			box-shadow: 0 5px 15px rgba(122, 142, 118, 0.3);
		}

		&.is-disabled {
			background-color: $vn-text-soft;
			box-shadow: none;
		}
	}
	
	.record-prompt {
		font-size: 16px;
		color: $vn-text-muted;
		margin-top: 44px;
		letter-spacing: 1px;
	}

	.record-quota {
		font-size: 12px;
		color: $vn-text-soft;
		margin-top: 8px;
	}

	.waveform {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		margin-top: 20px;
		height: 30px;
		.wave {
			width: 4px;
			height: 10px;
			background-color: rgba(196, 106, 45, 0.26);
			margin: 0 2px;
			border-radius: 2px;
		}
	}

	// --- Recording State Styles ---
	.recording-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-around;
		height: 100%;
		width: 100%;
		padding: 40px 0;
		box-sizing: border-box;
	}

	.recording-status {
		display: flex;
		align-items: center;
		color: $vn-primary;
		font-size: 16px;
		.red-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background-color: $vn-primary;
			margin-right: 8px;
			animation: pulse 1.5s infinite;
		}
	}
	
	.timer {
		font-size: 64px;
		color: $vn-text;
		font-family: 'Courier New', Courier, monospace;
	}
	
	.waveform-active {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 140px;
		.wave-active {
			width: 3px;
			height: 12px;
			background-color: rgba(196, 106, 45, 0.7);
			margin: 0 2px;
			border-radius: 2px;
			transition: height 0.1s ease-out;
		}
	}
	
	.recording-instruction {
		font-size: 14px;
		color: $vn-text-muted;
	}

	.controls-wrapper {
		display: flex;
		justify-content: space-around;
		align-items: center;
		width: 100%;
	}

	.stop-button {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background-color: $vn-primary;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 5px 20px $vn-primary-glow;
		.stop-icon {
			font-size: 35px;
			color: #fff;
		}
	}
	
	.control-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: $vn-surface-strong;
		border: 1px solid $vn-border;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: $vn-shadow;
		.control-icon {
			font-size: 28px;
			color: $vn-text;
		}
	}


	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>

