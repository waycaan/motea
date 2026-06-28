# motea

> 念念不忘，必有回响。

一个基于 [Notea](https://github.com/notea-org/notea) 重构的现代笔记应用，沿用原版优雅的 UI 设计，采用 [Lexical](https://lexical.dev) 编辑器 + PostgreSQL 存储，~~支持一键部署到 Vercel~~。
## 基本界面
![1.png](/doc/1.png)
![2.png](/doc/2.png)
---
### PWA界面
![pwa.png](/doc/pwa.png)
---
[旧版本演示视频](https://www.bilibili.com/video/BV1KcTLzWENe/?vd_source=441079f1b64b3a1b4c28abe897343608)
---
## 新功能更新
[新功能查看](https://www.bilibili.com/video/BV1xJTG6YEjt?t=28.9)
---
## 新玩法（chrome的拆分视图）
![seperated.png](/doc/seperated.png)
---
## 特性

- **Lexical 编辑器** — 所见即所得，支持 `/` 快捷命令和浮动工具栏
- **PostgreSQL 存储** — 替代 S3，更稳定、更易部署
- **手动保存** — Ctrl+S 保存，告别自动保存的不确定性
- **笔记管理** — 归档、收藏、大纲、批量操作
- **版本历史** — 原版未提供的功能，支持笔记版本回溯与恢复
- **Markdown 兼容** — 支持标准 Markdown 语法，兼容 Typora 编辑体验
- **图片链接** — 采用 Markdown 图片链接，可配合图床使用（推荐 [Mazine](https://github.com/waycaan/mazine)）

## 致谢

本项目基于 [Notea](https://github.com/notea-org/notea) 重构，UI 设计沿用原版风格。感谢原作者 [qingwei-li](https://github.com/qingwei-li) 和[notea团队](https://github.com/notea-org/notea)开源贡献，是他们创造了这个优雅的项目。

## 部署
### 仓库代码暂未更新，docker版本已更新完成，docker自带内建postgresql,开箱即用。
原因是打算后续将motea修改为worker page来部署，部分代码可能需要进行更适配serverless的部署方式进行优化修改。所以只更新了docker版本的镜像。

~~### Vercel + Neon（推荐）~~

~~1. Fork 本项目~~
~~2. 在 [Vercel](https://vercel.com) 导入项目~~
~~3. 添加环境变量：~~

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串（[教程](/doc/neon.md)） |
| `PASSWORD` | 登录密码 |
| `PRELOAD_NOTES_COUNT` | 预加载笔记数（默认 10） |

~~4. 点击 Deploy，约 2 分钟完成~~

> ~~建议使用 Neon 的 **Washington, D.C. (East)** 区域，与 Vercel 主机同区延迟最低。~~

### Docker 推荐

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
---
改动很大，docker-compose.yml可以直接部署，vercel版本尚未测试，有点想直接改为page来部署（待定），补充了一大堆功能增强，修复了一大堆TS错误，基本上是最终版本。
有1个bug未修
1. lexical初始化时，使用中文输入会出现想打恭喜发财，会变成gong`xi`fa`cai，删除后再次输入即可。（这个情况只会出现在刚打开应用时出现，其他情况测试都没有问题），貌似不是IME的问题。影响不大。
