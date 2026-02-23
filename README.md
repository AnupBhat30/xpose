# Xpose

A repository exploration tool that extracts and displays the complete contents of public Git repositories or local ZIP files. Built with Next.js and FastAPI, it provides syntax-highlighted code browsing with efficient handling of large repository structures.

## Key Techniques

- **Virtual rendering** with [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) and [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) for performant scrolling through large codebases
- **Syntax highlighting** via [Prism.js](https://prismjs.com/) with support for 10+ languages
- **Async file operations** using [aiofiles](https://github.com/Tinche/aiofiles) for non-blocking I/O
- **CORS and compression middleware** with conditional [GZip](https://developer.mozilla.org/en-US/docs/Glossary/GZip_compression) encoding
- **Request correlation** through custom middleware that generates and propagates unique request IDs for tracing
- **Structured logging** with JSON-serialized events including performance metrics
- **Binary file detection** with heuristic sampling to distinguish text from binary content
- **URL validation and normalization** for Git repositories with allowlist-based host verification

## Technologies

- **Frontend:** [Next.js 14](https://nextjs.org/) with [React 18](https://react.dev/) and TypeScript 5, styled with [Tailwind CSS 3](https://tailwindcss.com/)
- **Syntax highlighting:** [Prism.js 1.30](https://prismjs.com/) with 10+ language supports
- **UI utilities:** [clsx](https://github.com/lukeed/clsx) for conditional className composition
- **Fonts:** [Inter](https://fonts.google.com/specimen/Inter) and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via [Google Fonts](https://fonts.google.com/) with font-display swap
- **Backend:** [FastAPI 0.125](https://fastapi.tiangolo.com/) with [Uvicorn](https://www.uvicorn.org/) ASGI and [Gunicorn](https://gunicorn.org/) production server
- **Async HTTP:** [httpx](https://www.python-httpx.org/) for async Git operations
- **Validation:** [Pydantic](https://docs.pydantic.dev/) BaseModel for request/response schemas
- **Token counting:** [tiktoken](https://github.com/openai/tiktoken) for estimating content size against context limits

## Project Structure

```
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Main repository explorer component
│   │   ├── layout.tsx        # Root layout with font setup
│   │   ├── error.tsx         # Error boundary wrapper
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   └── ErrorBoundary.tsx # Error fallback component
│   ├── next.config.js        # Next.js configuration
│   ├── tailwind.config.js    # Custom design tokens
│   └── tsconfig.json         # TypeScript strict mode
├── backend/
│   ├── main.py               # FastAPI application
│   ├── gunicorn.conf.py      # Production WSGI config
│   ├── requirements.txt       # Python dependencies
│   └── tests/
│       └── test_healthz.py   # Health check tests
└── .gitignore               # Git exclusions for Node/Python
```

**[frontend/app/](frontend/app)** - Next.js App Router pages with server/client boundary. The `page.tsx` implements virtual list rendering for efficient browsing of large repository structures with live syntax highlighting.

**[backend/](backend)** - FastAPI routes for repository extraction. Handles Git cloning with timeout protection, ZIP extraction with size limits, and file content retrieval with token counting for language models.
