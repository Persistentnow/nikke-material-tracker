# NIKKE 游戏材料记录工具 - Code Wiki

## 目录
1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [核心功能模块](#核心功能模块)
5. [关键函数说明](#关键函数说明)
6. [数据结构](#数据结构)
7. [主题系统](#主题系统)
8. [运行方式](#运行方式)

---

## 项目概述

### 项目简介
这是一个专为 NIKKE 游戏玩家设计的材料记录和统计工具，用于跟踪定制模组及定制模组零件的获取情况。

### 主要功能
- **数据录入**：记录每日三次获取的定制模组数量和零件数量
- **阶段选择**：支持 5/6/7 阶段的不同数值预设
- **双倍产出**：支持双倍产出计算（仅对零件生效）
- **数据统计**：支持按天/按月统计视图切换
- **期望设置**：可自定义每日/每月期望产出值，支持智能计算
- **数据持久化**：使用 localStorage 本地存储
- **导入导出**：支持数据导入导出
- **主题切换**：支持深色/浅色主题

---

## 技术栈

| 技术 | 说明 |
|------|------|
| HTML5 | 页面结构 |
| CSS3 | 样式（使用 CSS 变量实现主题切换） |
| JavaScript ES6+ | 业务逻辑 |
| localStorage | 本地数据存储 |

---

## 项目结构

```
/workspace/
├── index.html           # 主页面文件
├── script.js            # JavaScript 业务逻辑
├── style.css            # 样式文件
├── README.md            # 项目说明文档
├── CHANGELOG.md         # 更新日志
├── CONTRIBUTING.md      # 贡献指南
└── CODE_WIKI.md         # 本文档
```

### 文件说明

#### [index.html](file:///workspace/index.html)
主页面文件，包含以下主要部分：
- **主题切换按钮**：位于右上角
- **数据录入区域**：日期选择、三次模组获取记录、零件记录
- **期望设置区域**：日/月期望设置、智能月度计算
- **数据统计区域**：总产出、期望、差值等统计数据
- **历史记录区域**：表格展示所有历史记录，支持排序和删除
- **导入导出按钮**：位于底部

#### [script.js](file:///workspace/script.js)
包含所有业务逻辑，详见下文"核心功能模块"。

#### [style.css](file:///workspace/style.css)
使用 CSS 变量实现深色/浅色主题切换，提供了现代化的 UI 设计。

---

## 核心功能模块

### 1. 主题系统

**相关代码位置**：[script.js#L1-L57](file:///workspace/script.js#L1-L57)

**功能说明**：
- 默认深色主题
- 支持切换到浅色主题
- 主题设置自动保存到 localStorage
- 使用 CSS 变量实现样式切换

**关键变量**：
```javascript
let currentTheme = 'dark'; // 默认深色主题
```

---

### 2. 数据管理模块

**相关代码位置**：[script.js#L561-L617](file:///workspace/script.js#L561-L617)

#### loadData()
加载本地存储的数据到内存中。
- 加载记录数据：`nikkeRecords`
- 加载期望设置：`nikkeExpect`
- 加载高级设置：`nikkeSettings`（双倍天数、普通天数、默认阶段）

#### save()
将内存中的数据保存到 localStorage。
- 保存记录和期望设置
- 保存高级设置

#### setupRealTimeSettingsSave()
设置实时保存功能，当高级设置变更时自动保存。

#### saveSettings()
单独保存高级设置。

---

### 3. 数据录入模块

**相关代码位置**：[script.js#L668-L720](file:///workspace/script.js#L668-L720)

**功能说明**：
- 表单提交处理
- 防止同日重复记录
- 计算总产出和差值
- 保存记录

**关键计算**：
- 零件换算：`parts / 100`
- 总产出：`totalModules + partsToMod`
- 差值：`totalModules - stageExpectation`（仅基于模组，不包含零件）

**阶段预设值**：

| 阶段 | 零件数量 | 普通日期望 | 双倍日期望 |
|------|----------|------------|------------|
| 5    | 81       | 1.66       | 3.32       |
| 6    | 105      | 2.15       | 4.31       |
| 7    | 111      | 2.28       | 4.56       |

---

### 4. 统计模块

**相关代码位置**：[script.js#L928-L1087](file:///workspace/script.js#L928-L1087)

#### updateStats()
更新统计数据显示。支持两种统计视图：
- **按天统计**：计算所有记录的总模组、总产出、期望和差值
- **按月统计**：按月份分组显示，包含月度详细统计卡片

---

### 5. 历史记录模块

**相关代码位置**：[script.js#L723-L833](file:///workspace/script.js#L723-L833)

#### renderTable()
渲染历史记录表格。
- 支持按日期或差值排序
- 重新计算每条记录的总产出和差值以确保准确性
- 显示删除按钮

#### del(id)
删除指定 ID 的记录。

---

### 6. 实时计算模块

**相关代码位置**：[script.js#L337-L401](file:///workspace/script.js#L337-L401)

#### setupRealTimeCalculation()
为输入元素添加实时计算事件监听器。

#### updateRealTimeCalculation()
在用户输入时实时更新总产出和差值预览。

---

### 7. 日期导航模块

**相关代码位置**：[script.js#L404-L425](file:///workspace/script.js#L404-L425)

#### setupDateNavigation()
设置日期前后导航按钮功能。

---

### 8. 导入导出模块

**相关代码位置**：[script.js#L428-L558](file:///workspace/script.js#L428-L558)

#### setupImportExport()
设置导入导出功能。

#### showNotification(message, type)
显示通知提示。

---

### 9. 期望设置模块

**相关代码位置**：[script.js#L247-L319](file:///workspace/script.js#L247-L319)

#### 智能月度计算
根据以下公式自动计算月期望：
```
月期望 = (普通日期望 × 普通天数) + (双倍日期望 × 双倍天数)
```

---

## 关键函数说明

### 全局变量

| 变量名 | 类型 | 说明 |
|--------|------|------|
| materialRecords | Array | 存储所有材料记录 |
| expectations | Object | 存储期望设置 `{ daily, monthly }` |
| currentStatsView | String | 当前统计视图：`'daily'` 或 `'monthly'` |
| currentSortBy | String | 当前排序方式：`'date'` 或 `'diff'` |

---

### 主要函数详解

#### 1. applyTheme(theme)
**位置**：[script.js#L40-L56](file:///workspace/script.js#L40-L56)

应用指定的主题。

**参数**：
- `theme`：`'dark'` 或 `'light'`

**功能**：
- 设置 `document.documentElement.setAttribute('data-theme', theme)`
- 更新主题切换按钮的图标和文本

---

#### 2. bindEvents()
**位置**：[script.js#L161-L333](file:///workspace/script.js#L161-L333)

绑定所有事件监听器。

**绑定的事件**：
- 保存期望设置按钮点击
- 按天/按月统计切换
- 期望类型切换
- 智能计算月期望按钮点击
- 排序按钮点击

---

#### 3. updateMonthlyStatsDisplay(monthlyData)
**位置**：[script.js#L836-L925](file:///workspace/script.js#L836-L925)

显示月度统计详细信息。

**参数**：
- `monthlyData`：按月份分组的数据对象

---

## 数据结构

### 1. 材料记录对象

```javascript
{
  id: number,              // 记录 ID（时间戳）
  date: string,            // 日期，格式：YYYY-MM-DD
  m1: number,              // 第一次获取的模组数
  m2: number,              // 第二次获取的模组数
  m3: number,              // 第三次获取的模组数
  parts: number,           // 零件数（已考虑双倍）
  stage: string,           // 阶段：'5' | '6' | '7'
  isDouble: boolean,       // 是否双倍产出
  totalModules: number,    // 模组总数：m1 + m2 + m3
  partsToMod: string,      // 零件换算模组数
  totalProduction: string, // 总产出（模组 + 零件换算）
  diff: string,            // 差值（模组总数 - 期望）
  stageExpectation: number // 该记录使用的期望产出
}
```

### 2. 期望设置对象

```javascript
{
  daily: number,   // 每日期望
  monthly: number  // 每月期望
}
```

### 3. 高级设置对象

```javascript
{
  doubleDays: number,  // 双倍天数
  normalDays: number,  // 普通天数
  stageType: string    // 默认阶段
}
```

---

## 主题系统

### CSS 变量说明

#### 深色主题（默认）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| --primary | #6366f1 | 主色调（靛蓝） |
| --accent | #f472b6 | 强调色（粉红） |
| --bg | #0f172a | 背景色 |
| --card | #1e293b | 卡片背景 |
| --text | #f8fafc | 文本色 |

#### 浅色主题

| 变量名 | 值 | 说明 |
|--------|-----|------|
| --primary | #4f46e5 | 主色调（靛蓝） |
| --accent | #ec4899 | 强调色（粉红） |
| --bg | #f8fafc | 背景色 |
| --card | #ffffff | 卡片背景 |
| --text | #1e293b | 文本色 |

### 切换方式

通过设置 `data-theme` 属性在 `:root` 元素上来切换主题：
```html
<html data-theme="dark">  <!-- 深色主题 -->
<html data-theme="light"> <!-- 浅色主题 -->
```

---

## 运行方式

### 本地运行

1. 克隆或下载项目到本地
2. 直接在浏览器中打开 [index.html](file:///workspace/index.html) 文件
3. 开始使用

### 部署到 GitHub Pages

项目已配置 GitHub Actions 自动部署，推送到 main 分支后会自动部署。

---

## 浏览器支持

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

---

## 版本历史

详见 [CHANGELOG.md](file:///workspace/CHANGELOG.md)

---

## 贡献指南

详见 [CONTRIBUTING.md](file:///workspace/CONTRIBUTING.md)

---

## 许可证

MIT License
