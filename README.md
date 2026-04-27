# 录音打卡小程序

这是一个基于 UniApp 和腾讯云开发（CloudBase）开发的录音打卡小程序，项目最初来源于 CloudBase 官方 `uniapp` 小程序 demo，现已改造成围绕“录音打卡 / 录音笔记”场景的业务项目。

## 项目定位

- 目标：微信小程序为主，主要是验证腾讯CloudBase一些基础能力
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
- `convertAudioToMp3`：处理音频转码

## 开发说明

- CloudBase 初始化集中在 `src/utils/cloudbase.ts`
- 前端环境配置通过 `.env.local` 读取，CloudBase Framework 配置通过 `cloudbaserc.template.json` 生成本地 `cloudbaserc.json`
- 项目保留了原始 CloudBase demo 的工具链、规则文件和约束，但后续文档、提示词、Agent 描述应统一使用“录音打卡小程序”语义，而不是泛化 demo / AI 项目语义

## 开源使用前需替换的配置

为了便于其他开发者直接复用，本仓库文档与公开配置文件统一使用占位符环境 ID：

- CloudBase 环境 ID：`<your-cloudbase-env-id>`

克隆项目后，推荐先复制环境变量模板：

```bash
cp .env.example .env.local
```

然后至少需要检查并替换以下位置：

- `.env.local`
- `cloudbaserc.template.json`（通常无需直接改）

如果你要接入自己的 CloudBase 环境，请将上述占位符改成你自己的环境 ID。

当前前端默认从 `import.meta.env.VITE_CLOUDBASE_ENV_ID` 读取环境 ID，因此开源使用时优先修改 `.env.local`；通常不需要再改 `src/utils/cloudbase.ts`。

修改完 `.env.local` 后，再执行：

```bash
npm run generate:cloudbaserc
```

这会基于 `cloudbaserc.template.json` 生成本地使用的 `cloudbaserc.json`。该文件已加入 `.gitignore`，不会进入版本管理。

## 个人页云端配额统计配置

个人信息页中的“云端空间配额”由云函数 `getUserProfile` 实时统计，统计口径为当前用户目录下的录音与转码产物总占用。该能力依赖云函数环境变量。

### 需要配置的环境变量

在 CloudBase 控制台中进入云函数 `getUserProfile`，添加以下环境变量：

- `CLOUDBASE_SECRETID`：腾讯云 API 密钥中的 `SecretId`
- `CLOUDBASE_SECRETKEY`：腾讯云 API 密钥中的 `SecretKey`
- `CLOUDBASE_ENV_ID`：CloudBase 环境 ID，例如 `<your-cloudbase-env-id>`

### 获取 SecretId / SecretKey

1. 打开腾讯云 API 密钥控制台：<https://console.cloud.tencent.com/cam/capi>
2. 在“API 密钥管理”中查看或新建一对密钥
3. 复制得到：
   - `SecretId`
   - `SecretKey`

建议为本项目单独创建一对密钥，不要复用其他生产系统正在使用的密钥。

### 在 CloudBase 控制台中设置环境变量

1. 打开 CloudBase 控制台云函数页：`https://tcb.cloud.tencent.com/dev?envId=<your-cloudbase-env-id>#/scf`
2. 进入函数 `getUserProfile`
3. 打开“函数配置”或“环境变量”
4. 新增并保存：
   - `CLOUDBASE_SECRETID`
   - `CLOUDBASE_SECRETKEY`
   - `CLOUDBASE_ENV_ID`
5. 重新部署 `getUserProfile` 云函数代码

### 安全说明

- 这些密钥只能配置在云函数环境变量中，不能放到前端代码里
- 如果密钥曾在聊天记录、截图或公开仓库中暴露，请立即删除并重建
- 推荐在验证完成后定期轮换密钥

## 常用命令

```bash
npm install
npm run dev:mp-weixin
npm run build:mp-weixin
npm run type-check
```

## 许可证

MIT License
