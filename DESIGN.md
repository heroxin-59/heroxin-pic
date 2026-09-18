---
name: 阿鑫相册
description: 天空口袋 — 亮蓝雾底上的私人口袋相册；相册页为时间脊日记
colors:
  beacon-blue: "#2f7dff"
  beacon-blue-hover: "#5c9aff"
  beacon-blue-active: "#1a68e8"
  beacon-soft: "#d6ebff"
  day-chip: "#7ec8ff"
  spine-teal: "#2a6fad"
  spine-teal-soft: "#d6ebff"
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
  display:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  headline:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
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
  toolbar: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
  spine-section: "52px"
  spine-well-gap: "14px"
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
  album-spine:
    backgroundColor: "transparent"
    textColor: "{colors.spine-teal}"
    width: "80px"
  album-filter-toolbar:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.toolbar}"
    padding: "6px 8px"
  album-tile:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.md}"
---

# Design System: 阿鑫相册

## Overview

**Creative North Star: "天空口袋"**

阿鑫相册的界面像装进口袋的一片晴空：亮天蓝雾托起照片，信标蓝只出现在可点与选中处。气质是实用、冷静、轻盈；深度是轻触觉——静止浅阴影，悬停或浮层再抬起。

相册签名表面为**时间脊日记**：左栏日期脊、右栏两列白井大图，淡蓝轨线贯穿滚动；壳层不造「卡片套卡片」的舞台。照片与按日归档仍是主角。

**Key Characteristics:**
- 亮天蓝雾底（`#e8f4ff`）而非中性灰后台
- 信标蓝（`#2f7dff`）专属于动作与选中
- 天脊蓝（`#2a6fad` / `#d6ebff`）专属于日记时间脊，与雾底同色系
- 相册页无舞台卡片；薄粘性筛选条
- 轻触觉阴影；系统中文无衬线
- 桌面顶栏 / 手机底栏同一套色语

## Colors

蓝亮通透：雾底承载，信标指路，天脊记日，白井托图。

### Primary
- **信标蓝** (#2f7dff): 主按钮、活动导航、焦点环、多选勾选。稀缺使用。
- **信标浅蓝** (#5c9aff / #d6ebff): hover 与 soft 底。
- **日 chip 蓝** (#7ec8ff): 统计 chip、轻计数标记。

### Secondary
- **天脊蓝** (#2a6fad): 时间脊日号、轨线节点、地点图标色。与雾底同色系，不与信标互换角色。
- **天脊软底** (#d6ebff): 节点光晕与轨线过渡。

### Neutral
- **天空雾底** (#e8f4ff / #cfe8ff): 页面渐变背景。
- **白面 / 雾白静面** (#ffffff / #f0f7ff): 内容与缩略图井底。
- **墨青字** (#1a2b3d / #4a5d73 / #7a8fa3): 主/次/弱文字。
- **软边** (#cfe0f2): 分隔与描边。

### Named Rules
**The Beacon-Only Rule.** 信标蓝只出现在可点或明确选中态；装饰性色块用雾底或 chip，不用主色铺满。

**The Spine-Is-Diary Rule.** 天脊蓝只服务时间脊（日号、轨、节点）；动作与焦点仍归信标蓝。

**The Photo-Leads Rule.** 任何屏上饱和色面积不得超过照片内容的视觉权重。

## Typography

**Display Font:** Segoe UI / PingFang SC / Microsoft YaHei（系统栈）
**Body Font:** 同上

**Character:** 工作用无衬线，清晰可扫读；不做展示衬线或技术等宽装腔。

### Hierarchy
- **Display** (700, `clamp(1.75rem, 5vw, 2.25rem)`): 相册 masthead「相册」。
- **Title** (700, ~1.05rem): 顶栏品牌「阿鑫相册」。
- **Headline / Spine day** (700, 22px 手机 / 26px 桌面, 天脊蓝): 脊上日记日号。
- **Body** (400, 14px): 说明与列表正文。
- **Label** (600, 10–12px): 脊年号、底栏、chip、文件名 caption。

### Named Rules
**The One-Family Rule.** 全站一族无衬线，靠字重与尺度分层，不加第二展示字体。

**The Diary Hierarchy Rule.** 脊上年份弱、日号强、月份次；地点与计数用 muted/secondary，不与日号抢权。

## Layout

主栏在相册/上传页加宽至约 1120–1280px；内边距收紧以让照片占满。手机隐藏顶栏、固定底栏。

**相册页（`/images`）签名结构：**
1. 单行 masthead：大标题「相册」+ 统计 chip + 刷新（无副文案）
2. 内容区透明直铺雾底——**无**半透明白井 stage、无描边、无阴影舞台壳
3. 薄粘性筛选条（日/月/年 · 媒体 · 跳转）；`backdrop-filter` 轻模糊
4. 时间脊瀑布：左脊 80px（桌面）/ 60px（手机）+ 14px 井缝；井内固定 **两列**大图；日与日之间 52px 断层如翻页

上传、文件、预览、404 可继续使用白面 stage；**仅相册页**拒绝舞台卡片。

### Named Rules
**The No-Stage-Card Rule.** `/images` 不包一层白卡片舞台；照片井直接坐在雾底上。

**The Thin-Filter Rule.** 筛选是粘顶薄条，不是第二块内容卡。

## Elevation & Depth

平铺为常态；`--app-shadow` 极浅带蓝；浮层 / hover 用 `--app-shadow-lift`。缩略图悬停轻抬 2px。不用彩色光晕或重投影。时间脊靠轨线与节点建立纵向深度，不靠卡片堆叠。

### Shadow Vocabulary
- **Rest** (`0 1px 4px rgba(47, 125, 255, 0.08)`): 缩略图井、顶栏、静置控件、筛选条。
- **Lift** (`0 8px 24px rgba(15, 55, 120, 0.12)`): 批量操作条、明显抬起。

### Named Rules
**The Light-Tactile Rule.** 阴影只响应状态（hover / 浮层），不为装饰常驻加重。

## Shapes

圆角 8px（控件）/ 10px（筛选条）/ 12px（时间脊缩略图井）；统计与日 chip 全圆角胶囊。节点为正圆 10px。避免硬直角与过大胶囊按钮（除 chip）。

## Components

### Buttons
- **Shape:** 8px
- **Primary:** 信标蓝底 + 白字；hover 用 hover 蓝
- **Ghost / text:** 次要操作；活动态用 soft 底

### Chips
- **Stats / day chip:** `#7ec8ff` 浅混白底，墨青字；用于 masthead 统计等轻标记，不替代脊上日号

### Cards / Containers
- 上传/文件等页：白底、软边、rest 阴影
- **相册页：** 无外层卡片；仅缩略图井自身为圆角白/雾白面

### Inputs / Fields
- Element Plus 控件，边框与主色挂钩主题 token；focus 用信标蓝

### Navigation
- **Desktop:** 顶栏模糊白/雾，活动链接触 soft + 信标字色
- **Mobile:** 底栏三入口；活动项信标蓝

### Signature: Diary spine（时间脊）
左栏日记标签 + 淡蓝轨 + 空心粘性节点；右侧两列照片井。日粒度排成紧凑块：**大日号**与旁挂 **月 / 年** 并排，其下地点最多两行省略，张数用浅 chip（如 `1 张`）。折叠时节点降饱和。

### Signature: Album tile caption
文件名叠在井底：白字 10px + `linear-gradient(transparent, rgba(15, 40, 70, 0.55))`，系统级 caption 遮罩，不另造标签条。

### Signature: Thin sticky filter bar
半透明白混雾底、软边、rest 阴影、`blur(10px)`；手机横向可滚、更紧 padding。

## Do's and Don'ts

### Do:
- **Do** 用雾底 `#e8f4ff` 作为默认页面大气，而不是灰 `#f5f7fa`。
- **Do** 把信标蓝留给导航选中、主按钮、焦点与多选确认。
- **Do** 相册按日用左脊 + 右井：脊宽 88/68，井内两列，日间约 52px 断层。
- **Do** 脊日号旁挂月/年成块；地点单列省略，张数用 chip 文案。
- **Do** 筛选保持薄粘性条；masthead 保持一行标题 + 统计。
- **Do** 保持轻触觉：静置浅影，抬起再用 lift。

### Don't:
- **Don't** 用信标蓝做大面积装饰底或渐变字。
- **Don't** 用全宽日期横幅 / 大日期标题条替代左脊（拒绝 banner-style day headers）。
- **Don't** 在 `/images` 再套一层白舞台卡或 card-in-card 壳。
- **Don't** 把天脊蓝挪作主按钮或导航选中色（那是信标的活）。
- **Don't** 再引入青绿等与雾底脱节的第二日记色。
- **Don't** 让壳层压过照片的视觉比例。
