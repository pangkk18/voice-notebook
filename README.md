# 录音打卡小程序

这是一个基于 UniApp 和腾讯云开发（CloudBase）开发的录音打卡小程序，项目最初来源于 CloudBase 官方 `uniapp` 小程序 demo，现已改造成围绕“录音打卡 / 录音笔记”场景的业务项目。

## 项目定位

- 目标平台：微信小程序为主，保留 uni-app 多端构建能力
- 核心能力：录音打卡、录音上传、录音列表、详情查看、音频播放
- 后端能力：CloudBase 鉴权、云函数、文档型数据库、云存储

## 当前主要页面

- `src/pages/index/index.vue`：今日打卡首页
- `src/pages/recording/recording.vue`：录制中
- `src/pages/complete/complete.vue`：录制完成
- `src/pages/list/list.vue`：我的录音列表
- `src/pages/detail/detail.vue`：录音详情
- `src/pages/player/player.vue`：音频播放
- `src/pages/profile/profile.vue`：个人中心
- `src/pages/login/login.vue`：登录页面

## 主要云函数

- `createNotebookRecord`：创建录音记录
- `updateNotebookUpload`：更新上传结果并触发转码
- `getNotebookList`：获取当前用户录音列表
- `getHlsPlayableManifest`：生成可播放的 HLS 清单
- `convertAudioToMp3`：处理音频转码

## 开发说明

- CloudBase 初始化集中在 `src/utils/cloudbase.ts`
- 当前环境配置同时存在于 `src/utils/cloudbase.ts` 和 `cloudbaserc.json`
- 项目保留了原始 CloudBase demo 的工具链、规则文件和约束，但后续文档、提示词、Agent 描述应统一使用“录音打卡小程序”语义，而不是泛化 demo / AI 项目语义

## 常用命令

```bash
npm install
npm run dev:mp-weixin
npm run build:mp-weixin
npm run type-check
```

## 许可证

MIT License
