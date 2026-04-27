<template>
	<view class="profile-container">
		<view class="profile-hero">
			<view
				class="user-card"
				:class="{ 'user-card--guest': !hasAuthorizedProfile }"
				@click="openProfileEditor"
			>
				<view class="identity-copy">
					<text class="eyebrow">VOICE NOTEBOOK DOSSIER</text>
					<text class="card-title">
						{{ hasAuthorizedProfile ? user?.nickName || '微信用户' : '点击同步微信资料' }}
					</text>
					<text class="card-desc">
						{{
							hasAuthorizedProfile
								? '头像与昵称已同步到云端，可跨设备继续查看录音记录。'
								: '首次授权后会保存头像昵称到后端，仅用于个人信息展示与录音归属识别。'
						}}
					</text>
				</view>
				<view class="identity-side">
					<view class="status-badge" :class="{ 'status-badge--ready': hasAuthorizedProfile }">
						{{ hasAuthorizedProfile ? '已同步' : '未授权' }}
					</view>
					<image
						v-if="hasAuthorizedProfile && user?.avatarUrl"
						class="avatar"
						:src="user.avatarUrl"
						mode="aspectFill"
					/>
					<view v-else class="avatar-placeholder">
						<i class="iconfont icon-user"></i>
					</view>
				</view>
			</view>
			<view class="hero-note">
				<text class="hero-note__label">当前身份</text>
				<text class="hero-note__value">{{ hasAuthorizedProfile ? '微信资料已绑定' : '等待微信资料授权' }}</text>
			</view>
		</view>

		<view class="storage-card">
			<view class="storage-head">
				<view>
					<text class="section-label">录音容量</text>
					<text class="storage-title">云端空间配额</text>
				</view>
				<text class="storage-text">{{ storageUsedText }} / {{ storageTotalText }}</text>
			</view>
			<view class="progress-bar">
				<view class="progress" :style="{ width: `${storagePercentage}%` }"></view>
			</view>
			<text class="storage-caption">容量优先展示缓存结果，进入页面后会在后台静默刷新。</text>
			<text v-if="storageRefreshing" class="storage-refresh-hint">正在后台刷新容量...</text>
		</view>

		<view class="menu-list">
			<view class="menu-item" @click="openProfileEditor">
				<view>
					<text class="menu-item-text">{{ hasAuthorizedProfile ? '重新填写头像昵称' : '完善微信资料' }}</text>
					<text class="menu-item-subtext">头像使用微信原生选择器，昵称使用小程序原生昵称输入能力。</text>
				</view>
				<image class="menu-item-arrow" src="/static/icons/arrow-right.svg" />
			</view>
			<view class="menu-item" @click="openAboutPanel">
				<view>
					<text class="menu-item-text">关于我们</text>
					<text class="menu-item-subtext">查看项目状态、使用说明与后续策略。</text>
				</view>
				<image class="menu-item-arrow" src="/static/icons/arrow-right.svg" />
			</view>
		</view>

		<view v-if="showAbout" class="about-mask" @click="closeAboutPanel">
			<view class="about-panel" @click.stop>
				<text class="about-panel__eyebrow">ABOUT VOICE NOTEBOOK</text>
				<view class="about-panel__hero">
					<text class="about-panel__title">关于我们</text>
					<text class="about-panel__lead">
						录音打卡小程序当前是一个非商业项目，尚未进入实际运营阶段，主要用于产品打样、技术验证与学习交流。
					</text>
				</view>

				<view class="about-grid">
					<view class="about-note about-note--accent">
						<text class="about-note__label">当前状态</text>
						<text class="about-note__text">
							现阶段更偏向个人实验与经验沉淀，不承诺长期稳定运营，也不会按商业产品标准提供持续服务。
						</text>
					</view>
					<view class="about-note">
						<text class="about-note__label">学习交流</text>
						<text class="about-note__text">
							项目保留录音、列表、播放与资料同步等完整链路，更多是为了验证小程序与 CloudBase 的组合能力。
						</text>
					</view>
					<view class="about-note about-note--full">
						<text class="about-note__label">后续策略</text>
						<text class="about-note__text">
							后续会根据实际使用量、云存储与转码等服务成本的稳定情况，逐步评估是否需要做配额、功能开放范围或资源策略上的调整。
						</text>
					</view>
				</view>

				<button class="about-panel__button" @click="closeAboutPanel">我知道了</button>
			</view>
		</view>

		<view v-if="showEditor" class="profile-editor-mask" @click="closeProfileEditor">
			<view class="profile-editor" @click.stop>
				<text class="editor-eyebrow">PROFILE EDITOR</text>
				<text class="editor-title">完善你的个人资料</text>
				<text class="editor-desc">微信已不再稳定返回头像昵称，这里改为使用小程序原生资料填写能力。</text>

				<button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
					<image v-if="draftAvatarUrl" class="avatar-picker__image" :src="draftAvatarUrl" mode="aspectFill" />
					<view v-else class="avatar-picker__placeholder">
						<i class="iconfont icon-user"></i>
					</view>
					<text class="avatar-picker__text">点击选择头像</text>
				</button>

				<input
					v-model="draftNickName"
					class="nickname-input"
					type="nickname"
					placeholder="请输入昵称"
					placeholder-class="nickname-input__placeholder"
				/>

				<view class="editor-actions">
					<button class="editor-btn editor-btn--ghost" @click="closeProfileEditor">取消</button>
					<button class="editor-btn editor-btn--primary" :disabled="authorizing" @click="submitProfile">
						{{ authorizing ? '保存中...' : '保存资料' }}
					</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
	getUserProfile as fetchUserProfile,
	refreshUserStorageUsage,
	upsertUserProfile,
	type NotebookUserProfile
} from '@/utils/cloudbase';

const user = ref<NotebookUserProfile | null>(null);
const loading = ref(false);
const authorizing = ref(false);
const showEditor = ref(false);
const showAbout = ref(false);
const draftAvatarUrl = ref('');
const draftNickName = ref('');
const storageRefreshing = ref(false);

const hasAuthorizedProfile = computed(() => {
	return Boolean(user.value?.nickName && user.value?.avatarUrl);
});

const storageUsedText = computed(() => formatBytes(user.value?.usedSpace ?? 0));
const storageTotalText = computed(() => formatBytes(user.value?.totalSpace ?? 0));
const storagePercentage = computed(() => {
	const total = user.value?.totalSpace ?? 0;
	const used = user.value?.usedSpace ?? 0;

	if (!total) {
		return 0;
	}

	return Math.min(100, Number(((used / total) * 100).toFixed(1)));
});

onShow(() => {
	loadUserProfile();
});

async function loadUserProfile() {
	if (loading.value) {
		return;
	}

	loading.value = true;

	try {
		const result = await fetchUserProfile();
		if (!result?.success || !result.user) {
			throw new Error(result?.error || '获取用户资料失败');
		}

		user.value = result.user;
		void refreshStorageUsageInBackground();
	} catch (error) {
		console.error('加载用户资料失败:', error);
		uni.showToast({
			title: '读取资料失败',
			icon: 'none'
		});
	} finally {
		loading.value = false;
	}
}

async function refreshStorageUsageInBackground() {
	if (storageRefreshing.value) {
		return;
	}

	storageRefreshing.value = true;

	try {
		const result = await refreshUserStorageUsage();
		if (!result?.success || !user.value) {
			return;
		}

		user.value = {
			...user.value,
			usedSpace: result.usedSpace ?? user.value.usedSpace ?? 0,
			totalSpace: result.totalSpace ?? user.value.totalSpace ?? 0
		};
	} catch (error) {
		console.warn('后台刷新容量失败:', error);
	} finally {
		storageRefreshing.value = false;
	}
}

function openProfileEditor() {
	draftAvatarUrl.value = user.value?.avatarUrl || '';
	draftNickName.value = user.value?.nickName || '';
	showEditor.value = true;
}

function closeProfileEditor() {
	if (authorizing.value) {
		return;
	}

	showEditor.value = false;
}

function openAboutPanel() {
	showAbout.value = true;
}

function closeAboutPanel() {
	showAbout.value = false;
}

function handleChooseAvatar(event: any) {
	const avatarUrl = event?.detail?.avatarUrl;

	if (!avatarUrl) {
		return;
	}

	draftAvatarUrl.value = avatarUrl;
}

async function submitProfile() {
	if (authorizing.value) {
		return;
	}

	if (!draftAvatarUrl.value) {
		uni.showToast({
			title: '请先选择头像',
			icon: 'none'
		});
		return;
	}

	if (!draftNickName.value.trim()) {
		uni.showToast({
			title: '请先填写昵称',
			icon: 'none'
		});
		return;
	}

	authorizing.value = true;

	try {
		const uploadedAvatar = await uploadAvatarIfNeeded(draftAvatarUrl.value);
		const result = await upsertUserProfile({
			avatarUrl: uploadedAvatar.avatarUrl,
			avatarFileID: uploadedAvatar.avatarFileID,
			nickName: draftNickName.value.trim()
		});

		if (!result?.success || !result.user) {
			throw new Error(result?.error || '保存用户资料失败');
		}

		user.value = result.user;
		showEditor.value = false;

		uni.showToast({
			title: '资料已保存',
			icon: 'none'
		});
	} catch (error) {
		console.error('保存用户资料失败:', error);
		uni.showToast({
			title: '保存失败，请重试',
			icon: 'none'
		});
	} finally {
		authorizing.value = false;
	}
}

async function uploadAvatarIfNeeded(avatarUrl: string) {
	const nextAvatarUrl = String(avatarUrl || '').trim();
	if (!nextAvatarUrl) {
		throw new Error('avatarUrl is required');
	}

	if (!nextAvatarUrl.startsWith('wxfile://')) {
		return {
			avatarUrl: nextAvatarUrl,
			avatarFileID: user.value?.avatarFileID || ''
		};
	}

	if (!wx?.cloud?.uploadFile) {
		throw new Error('wx.cloud.uploadFile not available');
	}

	const extensionMatch = nextAvatarUrl.match(/\.([a-zA-Z0-9]+)$/);
	const extension = extensionMatch?.[1] || 'jpg';
	const cloudPath = `profile-avatar/avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
	const uploadRes = await wx.cloud.uploadFile({
		cloudPath,
		filePath: nextAvatarUrl
	});

	return {
		avatarUrl: uploadRes.fileID || '',
		avatarFileID: uploadRes.fileID || ''
	};
}

function showPending(label: string) {
	uni.showToast({
		title: `${label}功能开发中`,
		icon: 'none'
	});
}

function formatBytes(bytes: number) {
	if (!bytes) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** exponent;
	const precision = exponent === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

	return `${value.toFixed(precision)} ${units[exponent]}`;
}
</script>

<style lang="scss">
@use "@/styles/notebook-theme.scss" as *;

.profile-container {
	min-height: 100vh;
	padding: 28rpx 28rpx 48rpx;
	background:
		linear-gradient(180deg, $vn-bg 0%, $vn-bg-alt 38%, $vn-bg-soft 100%);
	color: $vn-text;
}

.profile-hero {
	margin-bottom: 28rpx;
}

.user-card {
	display: flex;
	justify-content: space-between;
	gap: 24rpx;
	padding: 34rpx 30rpx;
	border: 2rpx solid $vn-border;
	border-radius: 30rpx;
	background:
		linear-gradient(135deg, rgba(255, 251, 245, 0.96) 0%, rgba(232, 216, 193, 0.92) 100%);
	box-shadow: $vn-shadow;

	&--guest {
		background:
			linear-gradient(135deg, rgba(255, 248, 238, 0.96) 0%, rgba(226, 212, 195, 0.88) 100%);
	}
}

.identity-copy {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.eyebrow {
	margin-bottom: 14rpx;
	font-size: 20rpx;
	letter-spacing: 4rpx;
	color: $vn-secondary;
}

.card-title {
	font-family: Georgia, 'Times New Roman', serif;
	font-size: 42rpx;
	line-height: 1.2;
	color: $vn-text;
}

.card-desc {
	margin-top: 16rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: $vn-text-muted;
}

.identity-side {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	justify-content: space-between;
}

.status-badge {
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: $vn-primary-soft;
	color: $vn-primary;
	font-size: 20rpx;
	letter-spacing: 2rpx;

	&--ready {
		background: rgba(122, 142, 118, 0.16);
		color: #56684f;
	}
}

.avatar,
.avatar-placeholder {
	width: 116rpx;
	height: 116rpx;
	border-radius: 28rpx;
}

.avatar {
	border: 2rpx solid $vn-border;
}

.avatar-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(31, 26, 23, 0.08);
	color: $vn-primary;

	.iconfont {
		font-size: 66rpx;
	}
}

.hero-note {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 18rpx;
	padding: 0 10rpx;
}

.hero-note__label,
.hero-note__value {
	font-size: 22rpx;
	color: $vn-text-muted;
}

.storage-card,
.menu-list,
.about-panel {
	border-radius: 28rpx;
	border: 2rpx solid $vn-border;
	background: $vn-surface;
	box-shadow: $vn-shadow;
}

.storage-card {
	margin-bottom: 28rpx;
	padding: 28rpx;
}

.storage-head {
	display: flex;
	justify-content: space-between;
	gap: 20rpx;
	align-items: flex-start;
	margin-bottom: 20rpx;
}

.section-label {
	display: block;
	margin-bottom: 10rpx;
	font-size: 20rpx;
	letter-spacing: 3rpx;
	color: $vn-secondary;
}

.storage-title {
	font-family: Georgia, 'Times New Roman', serif;
	font-size: 34rpx;
	color: $vn-text;
}

.storage-text {
	font-family: ui-monospace, 'SFMono-Regular', 'Cascadia Code', monospace;
	font-size: 24rpx;
	color: $vn-text;
}

.progress-bar {
	width: 100%;
	height: 16rpx;
	border-radius: 999rpx;
	background: rgba(31, 26, 23, 0.08);
	overflow: hidden;
}

.progress {
	height: 100%;
	border-radius: inherit;
	background: linear-gradient(90deg, $vn-primary 0%, $vn-secondary 100%);
}

.storage-caption {
	display: block;
	margin-top: 16rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: $vn-text-muted;
}

.storage-refresh-hint {
	display: block;
	margin-top: 10rpx;
	font-size: 20rpx;
	color: $vn-text-soft;
}

.menu-list {
	overflow: hidden;
}

.menu-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
	padding: 28rpx;
	border-bottom: 2rpx solid $vn-border;

	&:last-child {
		border-bottom: none;
	}

	&:active {
		background: rgba(216, 199, 176, 0.24);
	}
}

.menu-item-text {
	display: block;
	font-size: 30rpx;
	color: $vn-text;
}

.menu-item-subtext {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	line-height: 1.6;
	color: $vn-text-muted;
}

.menu-item-arrow {
	flex-shrink: 0;
	width: 28rpx;
	height: 28rpx;
	opacity: 0.7;
}

.about-mask {
	position: fixed;
	inset: 0;
	z-index: 18;
	display: flex;
	align-items: flex-end;
	padding: 24rpx;
	background: rgba(31, 26, 23, 0.42);
}

.about-panel {
	width: 100%;
	padding: 28rpx 28rpx calc(34rpx + env(safe-area-inset-bottom));
	background:
		linear-gradient(180deg, rgba(253, 251, 247, 0.98) 0%, rgba(247, 241, 232, 0.98) 100%);
	box-shadow: 0 -16rpx 48rpx rgba(31, 26, 23, 0.12);
}

.about-panel__eyebrow {
	display: block;
	margin-bottom: 12rpx;
	font-size: 20rpx;
	letter-spacing: 4rpx;
	color: $vn-secondary;
}

.about-panel__hero {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 12rpx;
	margin-bottom: 24rpx;
}

.about-panel__title {
	display: inline-block;
	padding-right: 24rpx;
	font-family: Georgia, 'Times New Roman', serif;
	font-size: 42rpx;
	line-height: 1.1;
	color: $vn-text;
	border-bottom: 2rpx solid rgba(140, 90, 60, 0.28);
}

.about-panel__lead {
	width: 88%;
	margin-left: 22rpx;
	font-size: 25rpx;
	line-height: 1.8;
	color: $vn-text-muted;
}

.about-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx;
}

.about-note {
	padding: 22rpx;
	border: 2rpx solid rgba(35, 49, 43, 0.08);
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.52);

	&--accent {
		background: rgba(216, 195, 165, 0.26);
		transform: translateY(10rpx);
	}

	&--full {
		grid-column: 1 / -1;
		margin-left: 28rpx;
		background: rgba(140, 90, 60, 0.08);
	}
}

.about-note__label {
	display: block;
	margin-bottom: 10rpx;
	font-size: 20rpx;
	letter-spacing: 3rpx;
	color: $vn-secondary;
}

.about-note__text {
	display: block;
	font-size: 24rpx;
	line-height: 1.8;
	color: $vn-text;
}

.about-panel__button {
	height: 90rpx;
	margin-top: 24rpx;
	border-radius: 22rpx;
	background: $vn-primary;
	color: $vn-bg-soft;
	font-size: 28rpx;
}

.about-panel__button::after {
	border: none;
}

.profile-editor-mask {
	position: fixed;
	inset: 0;
	z-index: 20;
	display: flex;
	align-items: flex-end;
	background: rgba(31, 26, 23, 0.42);
}

.profile-editor {
	width: 100%;
	padding: 34rpx 28rpx calc(40rpx + env(safe-area-inset-bottom));
	border-radius: 32rpx 32rpx 0 0;
	background: $vn-bg-soft;
	box-shadow: 0 -16rpx 48rpx rgba(31, 26, 23, 0.12);
}

.editor-eyebrow {
	display: block;
	margin-bottom: 12rpx;
	font-size: 20rpx;
	letter-spacing: 4rpx;
	color: $vn-secondary;
}

.editor-title {
	display: block;
	font-family: Georgia, 'Times New Roman', serif;
	font-size: 40rpx;
	color: $vn-text;
}

.editor-desc {
	display: block;
	margin-top: 14rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: $vn-text-muted;
}

.avatar-picker {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	margin-top: 28rpx;
	padding: 28rpx 24rpx;
	border: 2rpx dashed rgba(196, 106, 45, 0.38);
	border-radius: 28rpx;
	background: rgba(244, 239, 230, 0.72);
}

.avatar-picker::after,
.editor-btn::after {
	border: none;
}

.avatar-picker__image,
.avatar-picker__placeholder {
	width: 132rpx;
	height: 132rpx;
	border-radius: 32rpx;
}

.avatar-picker__placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(31, 26, 23, 0.08);
	color: $vn-primary;

	.iconfont {
		font-size: 72rpx;
	}
}

.avatar-picker__text {
	font-size: 24rpx;
	color: $vn-text;
}

.nickname-input {
	height: 96rpx;
	margin-top: 24rpx;
	padding: 0 24rpx;
	border: 2rpx solid rgba(31, 26, 23, 0.1);
	border-radius: 24rpx;
	background: $vn-surface-strong;
	font-size: 28rpx;
	color: $vn-text;
}

.nickname-input__placeholder {
	color: $vn-text-soft;
}

.editor-actions {
	display: flex;
	gap: 18rpx;
	margin-top: 28rpx;
}

.editor-btn {
	flex: 1;
	height: 92rpx;
	border-radius: 24rpx;
	font-size: 28rpx;
}

.editor-btn--ghost {
	background: rgba(31, 26, 23, 0.06);
	color: $vn-text;
}

.editor-btn--primary {
	background: $vn-primary;
	color: $vn-bg-soft;
}

.editor-btn--primary[disabled] {
	opacity: 0.6;
}
</style>
