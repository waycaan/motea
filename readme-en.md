# motea

> What You Seek is Seeking You

A modern note-taking app rebuilt from [Notea](https://github.com/notea-org/notea), keeping the original elegant UI design. Powered by [Lexical](https://lexical.dev) editor and PostgreSQL. Deploy to Vercel in minutes.

[Demo Video](https://www.bilibili.com/video/BV1KcTLzWENe/?vd_source=441079f1b64b3a1b4c28abe897343608)

## Features

- **Lexical Editor** — WYSIWYG editing with `/` slash commands and floating toolbar
- **PostgreSQL Storage** — Replaces S3 for better stability and easier deployment
- **Manual Save** — Ctrl+S to save, no more unpredictable auto-saves
- **Note Management** — Archive, favorites, outline, batch operations
- **Version History** — Not available in original Notea, supports version rollback and restore
- **Markdown Compatible** — Standard Markdown syntax with a Typora-like experience
- **Image Links** — Uses Markdown image links, works with any image hosting (try [Mazine](https://github.com/waycaan/mazine))

## Credits

Based on [Notea](https://github.com/notea-org/notea) with the original UI design preserved. Thanks to [qingwei-li](https://github.com/qingwei-li) for creating this elegant project.

## Deployment

### Vercel + Neon (Recommended)

1. Fork this repository
2. Import on [Vercel](https://vercel.com)
3. Add environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string ([guide](/doc/neon.md)) |
| `PASSWORD` | Login password |
| `PRELOAD_NOTES_COUNT` | Notes to preload (default: 10) |

4. Click Deploy — ready in ~2 minutes

> Use Neon's **Washington, D.C. (East)** region for lowest latency with Vercel.

### Docker

```bash
# Download docker-compose.yml, set these:
# PASSWORD=your-password
# COOKIE_SECURE=false (for LAN)
# BASE_URL=http://localhost:3000

docker-compose up -d
```

For SSL, set `COOKIE_SECURE=true`.

## Tech Stack

- **Frontend:** Next.js + React + Tailwind CSS
- **Editor:** [Lexical](https://lexical.dev)
- **Database:** PostgreSQL (Neon, Supabase, or self-hosted)
- **Deploy:** Vercel / Docker

## License

[Apache License 2.0](LICENSE)

Based on [Notea](https://github.com/notea-org/notea) by qingwei-li. Thanks for the open-source contribution.
