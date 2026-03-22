---
description: This document provides a project-focused overview of the Voice Notebook (录音打卡小程序), a uni-app based WeChat mini-program for daily recording check-ins. It explains the real business flow, current architecture, CloudBase integration points, and development constraints inherited from the original CloudBase demo.
globs:
  - "src/**"
  - "cloudfunctions/**"
  - "package.json"
---

# Voice Notebook (录音打卡小程序)

## 1. Project Overview

This repository started from Tencent CloudBase's official **uni-app mini-program demo**, but it has been refactored into a **Voice Notebook / 录音打卡小程序**. The current product focus is no longer a generic demo or AI sample. It is an audio-first personal mini-program for:

- starting a daily recording check-in
- uploading and storing voice notes
- viewing a personal recording list
- opening detail and playback pages for past records
- using CloudBase capabilities for login, database, file storage, and cloud functions

The frontend is built with **uni-app + Vue 3 + TypeScript**, and the backend relies on **Tencent CloudBase**. The project still keeps the original CloudBase-oriented engineering conventions, toolchain, and rule files, so when editing the app, agents should preserve that framework while replacing old demo wording with Voice Notebook business language.

### Key Technologies

- **Frontend:** [uni-app](https://uniapp.dcloud.io/) (with Vue 3)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend:** [Tencent CloudBase](https://cloud.tencent.com/product/tcb)
- **Build Tool:** [Vite](https://vitejs.dev/)

### Architecture

- **`src/pages`**: Current product pages.
  - **`index`**: daily check-in homepage
  - **`recording`**: in-progress recording state
  - **`complete`**: recording completion and follow-up actions
  - **`list`**: personal recording history
  - **`detail`**: record detail page
  - **`player`**: playback page
  - **`profile`**: user center
  - **`login`**: login-related UI retained from the CloudBase demo and adapted for this project
- **`src/utils/cloudbase.ts`**: CloudBase initialization, environment configuration, auth helpers, and cloud function calling entry point
- **`src/pages.json`**: page routing and tab bar definition for the current mini-program
- **`src/manifest.json`**: uni-app application configuration
- **`cloudfunctions`**: backend functions used by the recording flow
  - **`createNotebookRecord`**: create a new recording record
  - **`updateNotebookUpload`**: write upload result back to the record and trigger audio conversion
  - **`getNotebookList`**: fetch current user's recordings
  - **`getHlsPlayableManifest`**: return a playable signed HLS manifest for streaming
  - **`convertAudioToMp3`**: process uploaded audio
  - **`getOpenId` / `initUser` / `hello`**: helper or legacy demo-support functions that may still exist in the codebase
- **`cloudbaserc.json`**: CloudBase framework configuration for H5 build output and cloud function deployment
- **`package.json`**: dependencies and scripts for local development, platform builds, and type checking

## 2. Current Product Semantics

When working on this repository, always describe it as a **recording check-in mini-program**, not as a generic AI template.

### Recommended terminology

- Use **录音打卡**, **录音笔记**, or **Voice Notebook**
- Use **record**, **recording**, **notebook record**, **playback**, **upload**, **check-in**
- Treat the `notebook` collection as the recording record collection for the current user

### Terminology to avoid by default

- generic "AI project"
- generic "CloudBase sample app"
- unrelated template business descriptions copied from the original demo
- "录音打开" unless quoting an old string that still exists in code or metadata

## 3. Building and Running the Project

The project uses `npm` for dependency management and running scripts.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.x or newer recommended)
- [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### Installation

```bash
npm install
```

### Running in Development Mode

The primary target platform is the WeChat Mini-program (`mp-weixin`).

1.  **Run the development script:**
    ```bash
    npm run dev:mp-weixin
    ```
2.  **Open in WeChat Developer Tools:**
    *   Open the WeChat Developer Tools.
    *   Choose "Import Project".
    *   Select the `dist/dev/mp-weixin` directory from the project root.
    *   Fill in your AppID and a project name.

The project will now be running in the developer tools and will automatically recompile when you make changes to the source code.

### Building for Production

To create a production-ready build for the WeChat Mini-program:

```bash
npm run build:mp-weixin
```

This will generate the optimized and minified project files in the `dist/build/mp-weixin` directory. This directory can be used to upload and release the mini-program.

### Other Platforms

The `package.json` file contains scripts for building and running on other platforms supported by uni-app (e.g., H5, Alipay Mini-program). For example, to run the H5 version:

```bash
npm run dev:h5
```

### Type Checking

To run the TypeScript compiler and check for any type errors without generating JavaScript files:

```bash
npm run type-check
```

## 4. Development Conventions

### Backend Integration

- CloudBase access is centralized in `src/utils/cloudbase.ts`. This includes SDK initialization, environment configuration, authentication helpers, and cloud function invocation.
- The current environment ID is already configured in `src/utils/cloudbase.ts` and `cloudbaserc.json`. If the environment changes, update both places consistently.
- Mini-program-compatible login flows should take priority over generic web-only auth examples. Some auth helpers remain because they were inherited from the original CloudBase demo, but product descriptions should still reflect the current mini-program use case.

### State Management

- The project mainly uses Vue 3 Composition API patterns inside pages and components. Keep new code aligned with the existing uni-app page structure instead of introducing unnecessary architectural layers.

### Coding Style

- The project follows standard Vue 3 and TypeScript best practices.
- Keep modifications pragmatic: preserve the current framework, CloudBase integration style, and page-based organization.
- When updating docs or prompts for AI agents, prefer project-specific language over generic demo language.
- Use of the Composition API is preferred for new components.
