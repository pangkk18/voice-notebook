<template>
	<view class="home-container">
		<!-- Idle View -->
		<view v-if="!isRecording" class="content-wrapper">
			<view class="streak-chip">
				<image class="fire-icon" src="/static/icons/fire.svg" />
				<text>{{ streak }} days streak</text>
			</view>

			<text class="greeting">{{ greeting }}</text>
			<text class="subtitle">{{ subtitle }}</text>

			<view class="recording-area">
				<view class="record-button" @click="handleRecordClick">
					<image class="record-icon" src="/static/icons/mic.svg" />
				</view>
				<text class="record-prompt">{{ tapToStartMessage }}</text>
				<view class="waveform">
					<view class="wave" v-for="i in 5" :key="i"></view>
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
					<image class="control-icon" src="/static/icons/flag.svg" />
				</view>
				<view class="stop-button" @click="handleStopClick">
					<image class="stop-icon" src="/static/icons/stop.svg" />
				</view>
				<view class="control-button" @click="handlePauseClick">
					<image class="control-icon" src="/static/icons/pause.svg" />
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// --- State ---
const isRecordedToday = ref(false);
const isRecording = ref(false);
const streak = ref(5);
const elapsedTime = ref('00:00');
let timerInterval = null;
let seconds = 0;
let recorderManager = null;
const MIN_WAVE_AMP = 5;
const waveAmplitudes = ref(new Array(30).fill(MIN_WAVE_AMP));
const WAV_SAMPLE_RATE = 16000
const WAV_CHANNELS = 1
const WAV_BITS = 16


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
const tapToStartMessage = computed(() => {
	return isRecordedToday.value ? '今日已打卡' : '轻点开始录制';
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
	}, 1000);
};

const stopTimer = () => {
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}
};

const handleRecordClick = () => {
	isRecording.value = true;
	startTimer();
	uni.setNavigationBarTitle({
		title: '正在录音'
	});
	if (recorderManager) {
		recorderManager.start({
			duration: 600000, // 10 minutes
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

const handleStopClick = () => {
	isRecording.value = false;
	isRecordedToday.value = true;
	stopTimer();
	if (recorderManager) {
		recorderManager.stop();
	}
	uni.setNavigationBarTitle({
		title: '首页'
	});
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
		// Reset waveform on stop
		waveAmplitudes.value = new Array(30).fill(12);
		rmsPeak = 0
		lastAmp = 10
		// The recorded file is available at res.tempFilePath
		if (res.tempFilePath) {
			savePcmAsWav(res.tempFilePath).then((wavPath) => {
				console.log('WAV saved:', wavPath)
				uni.showToast({
					title: '录音已保存',
					icon: 'success'
				})
			}).catch((err) => {
				console.error('Save WAV failed:', err)
				uni.showToast({
					title: '保存失败',
					icon: 'none'
				})
			})
		} else {
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
			const gated = rms < 0.002 ? 0 : rms
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
		stopTimer();
	});
});

onUnmounted(() => {
	stopTimer();
	// Stop recording if the component is unmounted to avoid leaks
	if (isRecording.value && recorderManager) {
		recorderManager.stop();
	}
});

</script>

<style lang="scss">
	.home-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #F8F8F8;
		padding: 0 24px;
		box-sizing: border-box;
		align-items: center;
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
		background-color: #FFECEB;
		border-radius: 20px;
		padding: 6px 12px;
		font-size: 14px;
		color: #FF3B30;

		.fire-icon {
			width: 16px;
			height: 16px;
			margin-right: 5px;
		}
	}

	.greeting {
		font-size: 32px;
		font-weight: bold;
		color: #000;
		margin-top: 24px;
	}

	.subtitle {
		font-size: 16px;
		color: #8E8E93;
		margin-top: 8px;
	}

	.recording-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 240px;
		height: 360px;
		background-color: #FFF;
		border: 10px solid #FFECEB;
		border-radius: 130px;
		margin-top: 40px;
		cursor: pointer;
	}

	.record-button {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #FF3B30;
		box-shadow: 0 10px 30px rgba(255, 59, 48, 0.3);
		transition: all 0.3s ease;

		.record-icon {
			width: 70px;
			height: 70px;
		}

		&.is-recorded {
			background-color: #4CD964; // Green for completed
			box-shadow: 0 5px 15px rgba(76, 217, 100, 0.3);
		}
	}
	
	.record-prompt {
		font-size: 12px;
		color: #8E8E93;
		margin-top: 24px;
		letter-spacing: 1px;
	}

	.waveform {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 20px;
		height: 30px;
		.wave {
			width: 4px;
			height: 10px;
			background-color: #FFCBDC;
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
		color: #FF3B30;
		font-size: 16px;
		.red-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background-color: #FF3B30;
			margin-right: 8px;
			animation: pulse 1.5s infinite;
		}
	}
	
	.timer {
		font-size: 64px;
		color: #000;
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
			background-color: #FF8FAB;
			margin: 0 2px;
			border-radius: 2px;
			transition: height 0.1s ease-out;
		}
	}
	
	.recording-instruction {
		font-size: 14px;
		color: #8E8E93;
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
		background-color: #FF3B30;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 5px 20px rgba(255, 59, 48, 0.3);
		.stop-icon {
			width: 35px;
			height: 35px;
		}
	}
	
	.control-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
		.control-icon {
			width: 28px;
			height: 28px;
		}
	}


	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>

