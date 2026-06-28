# motea

> 念念不忘，必有回响。

一个基于 [Notea](https://github.com/notea-org/notea) 重构的现代笔记应用，沿用原版优雅的 UI 设计，采用 [Lexical](https://lexical.dev) 编辑器 + PostgreSQL 存储，支持一键部署到 Vercel。

[演示视频](https://www.bilibili.com/video/BV1KcTLzWENe/?vd_source=441079f1b64b3a1b4c28abe897343608)

## 特性

- **Lexical 编辑器** — 所见即所得，支持 `/` 快捷命令和浮动工具栏
- **PostgreSQL 存储** — 替代 S3，更稳定、更易部署
- **手动保存** — Ctrl+S 保存，告别自动保存的不确定性
- **笔记管理** — 归档、收藏、大纲、批量操作
- **版本历史** — 原版未提供的功能，支持笔记版本回溯与恢复
- **Markdown 兼容** — 支持标准 Markdown 语法，兼容 Typora 编辑体验
- **图片链接** — 采用 Markdown 图片链接，可配合图床使用（推荐 [Mazine](https://github.com/waycaan/mazine)）

## 致谢

本项目基于 [Notea](https://github.com/notea-org/notea) 重构，UI 设计沿用原版风格。感谢原作者 [qingwei-li](https://github.com/qingwei-li) 和[notea团队]([https://github.com/qingwei-li](https://github.com/notea-org/notea)开源贡献，是他们创造了这个优雅的项目。

## 部署

### Vercel + Neon（推荐）

1. Fork 本项目
2. 在 [Vercel](https://vercel.com) 导入项目
3. 添加环境变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串（[教程](/doc/neon.md)） |
| `PASSWORD` | 登录密码 |
| `PRELOAD_NOTES_COUNT` | 预加载笔记数（默认 10） |

4. 点击 Deploy，约 2 分钟完成

> 建议使用 Neon 的 **Washington, D.C. (East)** 区域，与 Vercel 主机同区延迟最低。

### Docker

```bash
# 下载 docker-compose.yml，修改以下参数：
# PASSWORD=你的密码
# COOKIE_SECURE=false（局域网）
# BASE_URL=http://localhost:3000

docker-compose up -d
```

如有 SSL 证书，需设置 `COOKIE_SECURE=true`。

## 技术栈

- **前端：** Next.js + React + Tailwind CSS
- **编辑器：** [Lexical](https://lexical.dev)
- **数据库：** PostgreSQL（支持 Neon、Supabase、自建）
- **部署：** Vercel / Docker

## 协议

[Apache License 2.0](LICENSE)

基于 [Notea](https://github.com/notea-org/notea) 重构，感谢原作者 qingwei-li 及 notea团队 的开源贡献。
