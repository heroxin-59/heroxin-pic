---
name: 阿鑫相册
description: 天空口袋 — 亮蓝雾底上的私人口袋相册
colors:
  beacon-blue: "#2f7dff"
  beacon-blue-hover: "#5c9aff"
  beacon-blue-active: "#1a68e8"
  beacon-soft: "#d6ebff"
  day-chip: "#7ec8ff"
  sky-fog: "#e8f4ff"
  sky-fog-deep: "#cfe8ff"
  surface-white: "#ffffff"
  surface-muted: "#f0f7ff"
  border-soft: "#cfe0f2"
  ink: "#1a2b3d"
  ink-secondary: "#4a5d73"
  ink-muted: "#7a8fa3"
  success: "#3db86b"
  warning: "#e6a23c"
  danger: "#f56c6c"
typography:
  title:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  headline:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.beacon-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.beacon-blue-hover}"
    textColor: "{colors.surface-white}"
  nav-active:
    backgroundColor: "{colors.beacon-soft}"
    textColor: "{colors.beacon-blue}"
    rounded: "{rounded.sm}"
  day-chip:
    backgroundColor: "{colors.day-chip}"
    textColor: "{colors.ink}"
    rounded: "999px"
    padding: "2px 8px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# Design System: 阿鑫相册

## Overview

**Creative North Star: "天空口袋"**

阿鑫相册的界面像装进口袋的一片晴空：亮天蓝雾托起白卡片与照片，信标蓝只出现在可点与选中处。气质是实用、冷静、轻盈；深度是轻触觉——静止浅阴影，悬停或浮层再抬起。

照片与按日归档是主角。壳层（顶栏、底栏、卡片）退后，不为装饰消耗饱和色。

**Key Characteristics:**
- 亮天蓝雾底（`#e8f4ff`）而非中性灰后台
- 信标蓝（`#2f7dff`）专属于动作与选中
- 日 chip（`#7ec8ff`）标记日期组计数
- 轻触觉阴影；系统中文无衬线
- 桌面顶栏 / 手机底栏同一套色语

## Colors

蓝亮通透：雾底承载，信标指路，白面托图。

### Primary
- **信标蓝** (#2f7dff): 主按钮、活动导航、焦点环、多选勾选。稀缺使用。
- **信标浅蓝** (#5c9aff / #d6ebff): hover 与 soft 底。
- **日 chip 蓝** (#7ec8ff): 相册日期组计数等轻标记。

### Neutral
- **天空雾底** (#e8f4ff / #cfe8ff): 页面渐变背景。
- **白卡片** (#ffffff) / **雾白静面** (#f0f7ff): 内容表面。
- **墨青字** (#1a2b3d / #4a5d73 / #7a8fa3): 主/次/弱文字。
- **软边** (#cfe0f2): 分隔与描边。

### Named Rules
**The Beacon-Only Rule.** 信标蓝只出现在可点或明确选中态；装饰性色块用雾底或 chip，不用主色铺满。

**The Photo-Leads Rule.** 任何屏上饱和色面积不得超过照片内容的视觉权重。

## Typography

**Display Font:** Segoe UI / PingFang SC / Microsoft YaHei（系统栈）
**Body Font:** 同上

**Character:** 工作用无衬线，清晰可扫读；不做展示衬线或技术等宽装腔。

### Hierarchy
- **Title** (700, ~1.05rem): 顶栏品牌「阿鑫相册」。
- **Headline** (700, 18–20px): 相册日期标题。
- **Body** (400, 14px): 说明与列表正文。
- **Label** (600, 11–12px): 底栏标签、chip、提示。

### Named Rules
**The One-Family Rule.** 全站一族无衬线，靠字重与尺度分层，不加第二展示字体。

## Layout

主栏在相册/上传页加宽至约 1120–1280px；内边距收紧以让照片占满。手机隐藏顶栏、固定底栏。

**相册页结构（签名表面）：**
1. 顶部大标题 masthead（「相册」+ 一句说明 + 统计 chip + 刷新）
2. 半透明白井 stage 托起内容（非 Element 卡片壳）
3. 粘性筛选坞（日/月/年 · 媒体 · 跳转）
4. 按日瀑布：大日期标题、组间 36px 断层、圆角缩略图轻抬

上传、文件、预览、404 复用同一 masthead + stage 语法；文件/预览的筛选坞与工具条在 stage 内。

## Elevation & Depth

平铺为常态；`--app-shadow` 极浅带蓝；浮层 / hover 用 `--app-shadow-lift`。不用彩色光晕或重投影。

### Shadow Vocabulary
- **Rest** (`0 1px 4px rgba(47, 125, 255, 0.08)`): 卡片、顶栏、静置控件。
- **Lift** (`0 8px 24px rgba(15, 55, 120, 0.12)`): 批量操作条、明显抬起。

### Named Rules
**The Light-Tactile Rule.** 阴影只响应状态（hover / 浮层），不为装饰常驻加重。

## Shapes

圆角 8px（控件）/ 12px（卡片与面板）；日 chip 全圆角胶囊。虚线上传区 12px。避免硬直角与过大胶囊按钮（除 chip）。

## Components

### Buttons
- **Shape:** 8px
- **Primary:** 信标蓝底 + 白字；hover 用 hover 蓝
- **Ghost / text:** 次要操作；活动态用 soft 底

### Chips
- **Day chip:** `#7ec8ff` 浅混白底，墨青字，标记日期组计数

### Cards / Containers
- 白底、软边、rest 阴影；相册页卡片托起瀑布流

### Inputs / Fields
- Element Plus 控件，边框与主色挂钩主题 token；focus 用信标蓝

### Navigation
- **Desktop:** 顶栏模糊白/雾，活动链接触 soft + 信标字色
- **Mobile:** 底栏三入口；活动项信标蓝

### Signature: Album day header
日期大标题 + 地点行 + 日 chip 计数；折叠箭头弱色；多选时组操作靠右

## Do's and Don'ts

### Do:
- **Do** 用雾底 `#e8f4ff` 作为默认页面大气，而不是灰 `#f5f7fa`。
- **Do** 把信标蓝留给导航选中、主按钮、焦点与多选确认。
- **Do** 保持轻触觉：静置浅影，抬起再用 lift。

### Don't:
- **Don't** 用信标蓝做大面积装饰底或渐变字。
- **Don't** 引入第二套强调色（紫霓虹、暖橙主色）抢信标。
- **Don't** 让壳层卡片压过照片的视觉比例。
