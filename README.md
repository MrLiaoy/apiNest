<div align="center">

# apiNest

**轻量级本地 API 调试工具 · REST + SOAP**

秒开 · 数据全本地 · 目录式存储 · 无账号无云端

[简体中文](#中文) | [English](README.en.md)

</div>

---

<a id="中文"></a>

## 为什么做这个

**apinest** 是一个轻量、秒开的本地 API 调试工具：安装包只有十几 MB、所有数据存在你自己的磁盘上，原生支持 REST 与 SOAP。没有账号体系、没有云端、没有遥测——就是纯粹的"发请求、看响应、管请求"。

> 当前状态：v1.0.0，作者自用打磨中。Windows 10/11 完整支持（Win7 尽力兼容）。

## 特性

### 请求调试
- **REST**：全部常用方法、Query 参数与 URL 双向同步、Headers（自动生成行标注）、Body（JSON / form-data 含多文件 / urlencoded / raw）、认证（Bearer / Basic / API Key，注入 Header 或 Query）
- **SOAP**：填写 WSDL 地址一键解析出操作与参数模板，报文在完整可编辑的 XML 编辑器中（list / 嵌套随意改）；SOAPAction 自动推导；也可以不解析直接粘贴报文发送
- **并发请求**：慢请求后台继续跑，随时切换页签；页签上显示加载动画与完成气泡（绿勾 / 红叹号）

### 数据存储（核心差异）
```
我的集合/                        ← 一个集合 = 一个目录
  apix.collection.json           ← 骨架：目录树结构（只有名称与 id，几 KB）
  requests/<请求id>.json          ← 每个请求一个文件
  history/<请求id>.json           ← 每个请求的历史单独存放，滚动保存
```
- 秒开：骨架文件极小，请求内容并行加载
- 秒存：改哪个请求只写哪个文件
- 集合可整目录拷贝、进 Git、发给别人

### 历史记录
- **按请求**记录发送历史（含请求快照与响应体摘要），点击展开查看完整请求/响应详情
- 单请求最大条数可配置（10~1000），滚动淘汰
- 换 URL 不丢历史——历史挂在请求上，不挂在 URL 上

### 其他
- **多标签**：同时打开多个请求，会话恢复
- **导入 / 导出**：主流集合格式（Collection v2.1 及兼容格式，支持 zip），目录结构完整保留；cURL 导入与复制（Linux / Windows cmd 两种风格）
- **多语言**：内置中文 / English，支持上传自定义语言包
- **主题**：亮色 / 暗色 / 跟随系统
- **快捷键**：`Ctrl+Enter` 发送 · `Ctrl+S` 保存 · `Ctrl+W` 关标签 · `Ctrl+T` 新建
- 无环境变量体系——URL 直接写完整地址，简单直接（刻意为之）

## 功能说明

**操作逻辑**（几分钟上手）：
1. 启动即有默认工作区，「文件」菜单可新建 / 打开集合（一个集合 = 一个文件夹）
2. 左侧树里新建请求（REST 或 SOAP），填 URL、参数、Body、认证——URL 与参数双向同步
3. `Ctrl+Enter` 或点「发送」，响应区查看 JSON / XML 高亮结果
4. 每次发送自动记入该请求的历史（🕐 历史页签可展开完整详情）；改动自动保存，重启自动恢复

**特色功能**：
- **目录式存储**：一个请求一个文件，集合就是普通文件夹，可进 Git、可拷贝分享
- **按请求分文件的历史**：换 URL 不丢历史，条数上限可配置，滚动保存
- **SOAP 完整支持**：WSDL 地址一键解析生成报文模板，也可不解析直接粘贴报文发送
- **并发请求**：慢请求后台继续跑，页签上有加载动画与完成气泡（绿勾 / 红叹号）
- **cURL 互操作**：粘贴 cURL 导入 / 复制为 Linux、Windows 两种 cURL
- **导入导出**：支持 Postman v2.1 / Apifox 兼容格式（含 zip）
- **多语言**：内置中文 / English，可上传自定义语言包；明暗主题、界面大小可调

> Mac 版本还在优化中。

## 界面

<!-- 发布前截图存到 docs/screenshot.png 后取消下行注释 -->
<!-- ![screenshot](docs/screenshot.png) -->

## 开发

```bash
# 环境要求：Node 18+、Rust（MSVC 工具链）、Windows 10/11
npm install
npm run tauri dev      # 开发
npm run tauri build    # 打包 NSIS 安装包
```

技术栈：Tauri 2 · React 19 + TypeScript · Tailwind CSS · Rust（reqwest / quick-xml / zip）

## 语言包贡献

内置中文与 English。添加新语言：

1. 设置 → 语言 → 「打开语言目录」，参考其中的 `template.json` 样例
2. 复制翻译后改名为语言代码（如 `fr.json`），头部 `__name` 填显示名
3. 设置 → 「上传语言配置…」选择该文件，立即生效

或直接把文件放进 `%APPDATA%/<app>/locales/` 后重启。

## 数据安全提示

认证信息明文存储于本地文件——请勿将包含敏感凭据的集合文件提交到公共仓库。

## License

[MIT](LICENSE)
