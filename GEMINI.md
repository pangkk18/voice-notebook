---
description: This document provides a comprehensive overview of the Voice Notebook (录音打开小程序) project, a mini-program for daily audio recording. It details the project's architecture, key technologies, development conventions, and instructions for building and running the application.
globs:
  - "src/**"
  - "cloudfunctions/**"
  - "package.json"
---

# Voice Notebook (录音打开小程序)

## 1. Project Overview

This is a voice recording mini-program built using the **uni-app** framework, which allows for cross-platform development (iOS, Android, H5, and various mini-programs) from a single Vue.js codebase. The backend is powered by **Tencent CloudBase**, providing serverless capabilities for authentication, database, and file storage.

The application is written in **TypeScript** and uses **Vite** as its build tool, ensuring a modern and efficient development experience.

### Key Technologies

- **Frontend:** [uni-app](https://uniapp.dcloud.io/) (with Vue 3)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend:** [Tencent CloudBase](https://cloud.tencent.com/product/tcb)
- **Build Tool:** [Vite](https://vitejs.dev/)

### Architecture

- **`src`**: The main directory for the uni-app frontend code.
  - **`src/pages`**: Contains the Vue components for each page of the application.
  - **`src/utils/cloudbase.ts`**: A crucial module responsible for initializing the CloudBase SDK and handling all backend interactions, including authentication and data operations.
  - **`src/manifest.json` & `src/pages.json`**: Standard uni-app configuration files for application settings and page routing.
- **`cloudfunctions`**: Holds the serverless cloud functions deployed to Tencent CloudBase. These functions contain backend logic that can be triggered by the frontend application.
- **`package.json`**: Defines project dependencies and scripts for development, building, and testing.

## 2. Building and Running the Project

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

## 3. Development Conventions

### Backend Integration

- All interactions with the Tencent CloudBase backend are centralized in `src/utils/cloudbase.ts`. This file initializes the SDK and exports helper functions for authentication (`login`, `logout`, etc.) and other CloudBase services.
- The CloudBase Environment ID is hardcoded in `src/utils/cloudbase.ts`. Ensure this is correctly configured for your environment.

### State Management

- The project uses standard Vue 3 reactivity and composition API for state management within components. For global state, it relies on uni-app's built-in `globalData` or simple store patterns.

### Coding Style

- The project follows standard Vue 3 and TypeScript best practices.
- Code is formatted according to the project's Prettier and ESLint configuration (if present).
- Use of the Composition API is preferred for new components.
