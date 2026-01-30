<template>
	<view class="profile-container">
		<view class="user-card-wrapper">
			<view v-if="!user" class="user-card not-logged-in" @click="goToLogin">
				<view class="avatar-placeholder"></view>
				<text class="login-prompt">点击登录</text>
			</view>
			<view v-else class="user-card">
				<image class="avatar" :src="user.avatarUrl" mode="aspectFill" />
				<text class="nickname">{{ user.nickName }}</text>
			</view>
		</view>

		<view class="storage-card">
			<view class="storage-info">
				<text class="storage-title">已用空间</text>
				<text class="storage-text">{{ storage.used }} / {{ storage.total }}</text>
			</view>
			<view class="progress-bar">
				<view class="progress" :style="{ width: storage.percentage + '%' }"></view>
			</view>
		</view>

		<view class="menu-list">
			<view class="menu-item">
				<text class="menu-item-text">导出全部录音</text>
				<image class="menu-item-arrow" src="/static/icons/arrow-right.svg" />
			</view>
			<view class="menu-item">
				<text class="menu-item-text">关于我们</text>
				<image class="menu-item-arrow" src="/static/icons/arrow-right.svg" />
			</view>
			<view class="menu-item" v-if="user" @click="logout">
				<text class="menu-item-text logout-text">退出登录</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue';

const user = ref(null);
// const user = ref({
// 	nickName: 'Gemini',
// 	avatarUrl: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png' // Replace with a real avatar
// });

const storage = ref({
	used: '256MB',
	total: '1GB',
	percentage: 25.6
});

const goToLogin = () => {
	uni.navigateTo({
		url: '/pages/login/login'
	});
};

const logout = () => {
	uni.showModal({
		title: '提示',
		content: '确定要退出登录吗？',
		success: (res) => {
			if (res.confirm) {
				user.value = null;
				uni.showToast({ title: '已退出', icon: 'none' });
			}
		}
	});
};
</script>

<style lang="scss">
.profile-container {
	padding: $uni-spacing-col-lg $uni-spacing-row-lg;
}

.user-card-wrapper {
	margin-bottom: $uni-spacing-col-lg;
}

.user-card {
	display: flex;
	align-items: center;
	padding: $uni-spacing-col-lg;
	background-color: $uni-bg-color;
	border-radius: $uni-border-radius-base;

	.avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		margin-right: $uni-spacing-row-base;
	}

	.nickname {
		font-size: $ds-font-size-h2;
		font-weight: 600;
		color: $uni-text-color;
	}

	&.not-logged-in {
		.avatar-placeholder {
			width: 64px;
			height: 64px;
			border-radius: 50%;
			background-color: $uni-bg-color-grey;
			margin-right: $uni-spacing-row-base;
		}
		.login-prompt {
			font-size: $ds-font-size-h2;
			font-weight: 600;
			color: $uni-text-color-grey;
		}
	}
}

.storage-card {
	padding: $uni-spacing-col-base $uni-spacing-row-lg;
	background-color: $uni-bg-color;
	border-radius: $uni-border-radius-base;
	margin-bottom: $uni-spacing-col-lg;

	.storage-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: $uni-spacing-col-sm;
	}

	.storage-title {
		font-size: $uni-font-size-base;
		color: $uni-text-color;
	}

	.storage-text {
		font-size: $uni-font-size-sm;
		color: $uni-text-color-grey;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: $uni-bg-color-grey;
		border-radius: 4px;
		overflow: hidden;

		.progress {
			height: 100%;
			background-color: $uni-color-primary;
			border-radius: 4px;
		}
	}
}

.menu-list {
	background-color: $uni-bg-color;
	border-radius: $uni-border-radius-base;
	overflow: hidden;

	.menu-item {
		display: flex;
		align-items: center;
		padding: $uni-spacing-col-base $uni-spacing-row-lg;
		border-bottom: 1px solid $uni-border-color;
        transition: background-color 0.2s;

		&:last-child {
			border-bottom: none;
		}
        
        &:active {
            background-color: $uni-bg-color-hover;
        }

		.menu-item-text {
			flex: 1;
			font-size: $uni-font-size-lg;
			color: $uni-text-color;
		}

		.logout-text {
			color: $uni-color-primary;
			text-align: center;
		}

		.menu-item-arrow {
			width: 20px;
			height: 20px;
		}
	}
}
</style>
