# 📱 DIY-Free-AI-Bridge · iOS 一键 AI 助手
> 利用「快捷指令」+ Cloudflare Worker，把任意大模型整合成类似 Apple Intelligence 的系统级体验。

## 目录
1. [项目介绍](docs/intro.md)
2. [Cloudflare Worker 使用说明](docs/cloudflare-worker/overview.md)
3. [iOS 快捷指令使用说明](docs/ios-shortcut/usage.md)

## 快速开始
```bash
git clone https://github.com/<your-id>/DIY-Free-AI-Bridge.git
cd DIY-Free-AI-Bridge
npm install
npx wrangler deploy
```
部署成功后，在 **快捷指令** 中填入 Worker Endpoint 与 API Key 即可。
