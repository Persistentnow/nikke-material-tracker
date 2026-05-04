# 贡献指南

感谢您考虑为NIKKE材料记录工具做出贡献！以下是一些指导原则，帮助您参与项目开发。

## 📋 行为准则

请尊重所有参与者，保持友好和建设性的交流。

## 🐛 报告问题

如果您发现了bug或者有新功能建议，请通过GitHub Issues提交：

1. **Bug报告**
   - 使用清晰的标题描述问题
   - 提供详细的复现步骤
   - 包含相关的截图或错误信息
   - 说明您的浏览器和操作系统环境

2. **功能建议**
   - 清晰描述您希望添加的功能
   - 解释这个功能如何帮助用户
   - 如果可能，提供设计思路或示例

## 🔧 开发流程

### 1. 环境设置

```bash
# 克隆项目
git clone https://github.com/yourusername/nikke-material-tracker.git
cd nikke-material-tracker

# 直接打开index.html即可开始开发
```

### 2. 创建分支

```bash
# 从main分支创建新分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 3. 代码规范

- 使用ES6+语法
- 保持代码简洁明了
- 添加必要的注释
- 遵循现有的代码风格

### 4. 提交更改

```bash
# 添加更改的文件
git add .

# 提交更改
git commit -m "feat: 添加新功能描述"

# 推送到GitHub
git push origin feature/your-feature-name
```

### 5. 创建Pull Request

1. 前往GitHub仓库页面
2. 点击"Compare & pull request"按钮
3. 填写详细的描述，说明您的更改内容
4. 等待代码审查

## 📝 代码审查流程

1. 维护者会审查您的代码
2. 可能会要求您进行一些修改
3. 审查通过后，您的代码将被合并到main分支

## 🚀 发布流程

- 代码合并到main分支后会自动部署到GitHub Pages
- 重要更新会更新版本号
- 发布新版本时会更新CHANGELOG.md

## 📖 文档贡献

除了代码贡献，您也可以帮助改进文档：

- 更新README.md
- 添加使用教程或示例
- 改进错误提示信息

## 🙏 致谢

再次感谢您的贡献！您的参与将使这个工具变得更好。