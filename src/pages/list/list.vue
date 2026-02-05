<template>
	<view class="list-container">
		<scroll-view class="scroll-view" :scroll-y="true">
			<view v-if="isLoading" class="skeleton-wrapper">
				<view class="skeleton-item" v-for="i in 5" :key="i"></view>
			</view>
			<view v-else-if="groupedRecordings.length === 0" class="empty-state">
				<image class="empty-icon" src="/static/icons/empty.svg" mode="aspectFit" />
				<text class="empty-text">还没有任何录音，开始你的第一次记录吧。</text>
			</view>
			<view v-else v-for="group in groupedRecordings" :key="group.date">
				<view class="date-header">
					<text class="date-header-text">{{ group.date }}</text>
				</view>
				<view class="recording-list">
					<view class="recording-item" v-for="item in group.recordings" :key="item.id" @click="goToDetail(item)">
						<view class="label">
							<i class="iconfont icon-mic"></i>
						</view>
						<view class="item-info">
							<text class="item-title">{{ item.title }}</text>
							<text class="item-meta">{{ item.duration }} • {{ item.createdAt }}</text>
						</view>
						<view class="item-play-button">
							<i class="iconfont icon-play play-icon"></i>
						</view>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { callCloudFunction } from '../../utils/cloudbase';

const isLoading = ref(true);
const recordings = ref([]);

const groupedRecordings = computed(() => {
	const groups = {};
	recordings.value.forEach(rec => {
		const dateKey = formatDateForGrouping(rec.date);
		if (!groups[dateKey]) {
			groups[dateKey] = { date: dateKey, recordings: [] };
		}
		groups[dateKey].recordings.push(rec);
	});
	return Object.values(groups);
});

const formatDateForGrouping = (dateString) => {
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const inputDate = new Date(dateString);

	if (inputDate.toDateString() === today.toDateString()) return '今天';
	if (inputDate.toDateString() === yesterday.toDateString()) return '昨天';
	
	return `${inputDate.getFullYear()}年${inputDate.getMonth() + 1}月${inputDate.getDate()}日`;
}

const goToDetail = (item) => {
	if (!item) return;
	const dateText = item.date && item.createdAt ? `${item.date} ${item.createdAt}` : (item.date || item.createdAt || '');
	const params = [
		`title=${encodeURIComponent(item.title || '')}`,
		`date=${encodeURIComponent(dateText)}`,
		`duration=${encodeURIComponent(item.duration || '')}`,
		`localFilePath=${encodeURIComponent(item.tempPath || '')}`,
		`tempFilePath=${encodeURIComponent(item.tempPath || '')}`
	].join('&');
	uni.navigateTo({
		url: `/pages/player/player?${params}`
	});
};

const normalizeDate = (raw) => {
	if (!raw) return new Date();
	if (raw instanceof Date) return raw;
	if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw);
	if (typeof raw === 'object') {
		if (raw.$date) return new Date(raw.$date);
		if (raw._seconds) return new Date(raw._seconds * 1000);
		if (raw.seconds) return new Date(raw.seconds * 1000);
	}
	return new Date();
};

const formatDateForItem = (date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const formatTimeForItem = (date) => {
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${hour}:${minute}`;
};

const formatDuration = (seconds) => {
	const total = Number(seconds) || 0;
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const loadRecordings = async () => {
	isLoading.value = true;
	try {
		const result = await callCloudFunction({
			name: 'getNotebookList',
			data: { limit: 200 }
		});
		if (!result?.success) {
			throw new Error(result?.error || 'getNotebookList failed');
		}
		const list = Array.isArray(result.data) ? result.data : [];
		recordings.value = list.map((item) => {
			const createdAt = normalizeDate(item.create_time);
			return {
				id: item._id || item.id,
				title: item.name || '未命名录音',
				duration: formatDuration(item.duration),
				date: formatDateForItem(createdAt),
				createdAt: formatTimeForItem(createdAt),
				tempPath: item.temp_path || '',
				fileID: item.fileID || '',
				cloudPath: item.cloudPath || ''
			};
		});
	} catch (error) {
		console.error('Load notebook list failed:', error);
		uni.showToast({
			title: '获取录音列表失败',
			icon: 'none'
		});
		recordings.value = [];
	} finally {
		isLoading.value = false;
	}
};

onShow(() => {
	loadRecordings();
});

</script>

<style lang="scss">
.list-container {
	height: 100%;
}

.scroll-view {
	height: 100%;
	padding: 0 $uni-spacing-row-lg;
	box-sizing: border-box;
}

.date-header {
	padding: $uni-spacing-col-lg 0 $uni-spacing-col-base 0;
}

.date-header-text {
	font-size: $ds-font-size-h2;
	font-weight: 600;
	color: $uni-text-color;
}

.recording-list {
	background-color: $uni-bg-color;
	border-radius: $uni-border-radius-base;
	overflow: hidden;
}

.recording-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: $uni-spacing-col-base $uni-spacing-row-base;
	border-bottom: 1px solid $uni-border-color;
	transition: background-color 0.2s;

	&:last-child {
		border-bottom: none;
	}
    
    &:active {
        background-color: $uni-bg-color-hover;
    }
	.label{
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background-color: $notebook-light-color;
		display: flex;
		align-items: center;
		justify-content: center;
		.iconfont {
			font-size: 24px;
			color: $notebook-primary-color;
		}
	}
	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 0rpx 14rpx;
		box-sizing: border-box;
	}

	.item-title {
		font-size: 14px;
		color: #000000;
		font-weight: 500;
		margin-bottom: $uni-spacing-col-sm;
	}

	.item-meta {
		font-size: 12px;
		color: #999999;
	}

	.item-play-button {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background-color: $notebook-primary-color;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: $uni-spacing-row-base;
		.play-icon {
			font-size: 24px;
			color: #ffffff;
		}
	}

}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding-top: 20vh;

	.empty-icon {
		width: 100px;
		height: 100px;
		margin-bottom: $uni-spacing-col-lg;
	}

	.empty-text {
		font-size: $uni-font-size-base;
		color: $uni-text-color-grey;
	}
}

.skeleton-wrapper {
	padding-top: $uni-spacing-col-lg;
	.skeleton-item {
		height: 80px;
		background-color: $uni-bg-color;
		border-radius: $uni-border-radius-base;
		margin-bottom: $uni-spacing-col-base;
		opacity: 0.5;
	}
}
</style>
