# 📸 Photo-Collection
## 基于 React + TS 的高性能摄影作品集解决方案

React 18 · Vite · TypeScript · Tailwind CSS · S3 Storage

## 🚀 核心亮点
- 极致视觉控制：采用响应式 Masonry (瀑布流) 布局，每一张大片都能获得最完美的展示空间。

- 专业 EXIF 洞察：深度解析图片元数据，自动提取相机型号、焦距、光圈及 ISO 等专业摄影参数。

- 沉浸式交互：支持全屏灯箱模式、平滑的暗色切换动画，提供媲美原生应用的浏览体验。

- 云原生存储：原生支持 S3 协议（AWS、Cloudflare R2、MinIO），让你的作品集轻松托管，不再受本地存储限制。

## 本地开发

### 1. 克隆并安装依赖

```bash
git clone https://github.com/muzihuaner/photo-collection.git
cd photo-collection
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写 S3 相关配置：

```
S3_BUCKET_NAME=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_IMAGE_BASE_URL=
S3_IMAGE_DIR=
```
备注：
S3_BUCKET_NAME 为 S3 存储桶名称，
S3_REGION 为 S3 区域，
S3_ACCESS_KEY_ID 为访问密钥 ID，
S3_SECRET_ACCESS_KEY 为密密钥，
S3_ENDPOINT 为 S3 端点，
S3_FORCE_PATH_STYLE 为是否强制路径样式，
S3_IMAGE_BASE_URL 为图片基础 URL，
S3_IMAGE_DIR 为图片目录。

如暂未配置，默认使用 mock 数据进行演示。

### 3. 启动开发环境

```bash
npm run dev
```

默认会同时启动 Vite 前端和 `server.ts`，访问 `http://localhost:3000` 预览效果。

## 可用脚本

| 命令 | 描述 |
| --- | --- |
| `npm run dev` | 启动本地开发（含 API） |
| `npm run build` | 产出生产构建（生成 `dist/`） |
| `npm run preview` | 本地预览打包结果 |


## Docker Compose 部署

1. **准备环境变量**：复制 `.env.example` 为 `.env`，填写 S3 与静态资源相关配置。
2. **构建并启动**：执行 `docker compose up -d --build`，Compose 会使用 `Dockerfile` 进行构建。
3. **访问服务**：浏览器打开 `http://localhost:3000`，即可访问容器内运行的应用。
4. **停止服务**：运行 `docker compose down` 以停止并清理容器。

## 许可证

本项目基于 MIT License，如仓库中已包含 `LICENSE` 文件请参阅其内容。
