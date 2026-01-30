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
					<view class="recording-item" v-for="item in group.recordings" :key="item.id" @click="goToDetail(item.id)">
						<view class="item-info">
							<text class="item-title">{{ item.title }}</text>
							<text class="item-meta">{{ item.duration }} • {{ item.createdAt }}</text>
						</view>
						<view class="item-play-button">
							<image class="play-icon" src="/static/icons/play.svg" />
						</view>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue';

const isLoading = ref(true);
const recordings = ref([]);

// Mock data
const mockData = [
	{ id: 1, title: '关于项目的初步想法', duration: '02:35', date: '2026-01-21', createdAt: '14:30' },
	{ id: 2, title: '周会要点纪要', duration: '05:12', date: '2026-01-21', createdAt: '10:15' },
	{ id: 3, title: '一个值得记录的梦', duration: '01:48', date: '2026-01-20', createdAt: '08:55' },
	{ id: 4, title: '日语学习笔记', duration: '10:05', date: '2026-01-19', createdAt: '21:40' },
	{ id: 5, title: '新年计划复盘', duration: '03:30', date: '2026-01-19', createdAt: '11:20' },
];

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

const goToDetail = (id) => {
	uni.navigateTo({
		url: `/pages/detail/detail?id=${id}`
	});
};

// Simulate loading
setTimeout(() => {
	recordings.value = mockData;
	isLoading.value = false;
}, 1500);

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

	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.item-title {
		font-size: $uni-font-size-lg;
		color: $uni-text-color;
		font-weight: 500;
		margin-bottom: $uni-spacing-col-sm;
	}

	.item-meta {
		font-size: $uni-font-size-sm;
		color: $uni-text-color-grey;
	}

	.item-play-button {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background-color: $uni-bg-color-grey;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: $uni-spacing-row-base;
	}

	.play-icon {
		width: 24px;
		height: 24px;
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
