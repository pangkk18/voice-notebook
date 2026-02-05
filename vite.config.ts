import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  base: './',
  // optimizeDeps: {
  //   exclude: ['@cloudbase/adapter-uni-app'],  // 排除 @cloudbase/adapter-uni-app 依赖
  // },
  server: {
    host: '0.0.0.0',  // 使用IP地址代替localhost
    proxy: {
      '/__auth': {
        target: 'https://envId-appid.tcloudbaseapp.com/',
        changeOrigin: true,
      }
    },
    allowedHosts: true
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/_variables.scss" as *;`
      }
    },
    // CSS代码分割优化
    devSourcemap: true
  }
});
