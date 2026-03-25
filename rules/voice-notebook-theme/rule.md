# Voice Notebook Theme Rule

## Purpose

这是一份录音打卡小程序的项目级主题规则。用于统一 `index`、`list`、`player`、`profile`、`complete` 等主流程页面的主体色、卡片层次和强调色，避免每个页面各自使用不同的红、灰、白体系。

## Aesthetic Direction

- Direction: `Editorial / archive desk`
- Feel: 纸质档案、温暖米色、铜棕操作焦点、鼠尾草绿辅助信息
- Constraint: 只统一主题色与表面材质，不随意改动既有布局结构

## Core Palette

- Page background: `#F4EFE6`
- Soft background: `#FFF9F1`
- Alt background: `#EFE4D2`
- Surface card: `rgba(255, 252, 247, 0.92)`
- Primary action: `#C46A2D`
- Primary soft: `rgba(196, 106, 45, 0.12)`
- Secondary accent: `#7A8E76`
- Main text: `#1F1A17`
- Muted text: `rgba(31, 26, 23, 0.58)`
- Border: `rgba(31, 26, 23, 0.08)`
- Danger: `#B94B3D`

## Usage Rules

1. 页面底色统一使用暖米色体系，不使用冷白或纯灰作为主背景。
2. 主按钮、播放按钮、关键 CTA 统一使用铜棕色 `#C46A2D`。
3. 状态徽标、辅助标签、次要强调可使用鼠尾草绿 `#7A8E76`。
4. 卡片统一使用浅暖白表面和轻边框，不使用强对比冷灰阴影。
5. 删除、危险操作允许使用 `#B94B3D`，但不能反客为主成为页面主色。
6. 录音类页面可保留“正在录音”的警示语义，但录音中的主视觉仍应服从整套暖色主题。

## Implementation

- Shared SCSS variables file: `src/styles/notebook-theme.scss`
- 页面样式优先从共享变量读取，不直接散落新的十六进制颜色

## Anti-Patterns

- 不要把鲜红色继续作为所有页面的主按钮底色
- 不要在不同页面混用冷白、浅蓝灰、粉红底作为主要卡片底色
- 不要为单个页面单独发明新的主色体系
