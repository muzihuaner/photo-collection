# Photo-Collection

一个使用 React、Vite 与 TypeScript 构建的摄影作品集展示应用，支持瀑布流浏览、暗色模式、EXIF 详情查看、图片下载/分享，以及模态中的全屏沉浸式预览。

## 功能特性

- 📸 **作品瀑布流**：响应式 Masonry 布局，自动适配列数。
- 🌗 **暗色模式**：一键切换亮/暗主题，配合平滑动画。
- 🧾 **EXIF元数据**：展示相机、镜头、曝光、光圈、ISO 等信息。
- 🧰 **S3存储兼容**：支持AWS、MinIO等S3兼容存储。


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

如暂未配置，默认使用 mock 数据进行演示。

### 3. 启动开发环境

```bash
npm run dev
```

默认会同时启动 Vite 前端和 `server.ts`，访问 `http://localhost:3000` 预览效果。



## Docker Compose 部署

1. **准备环境变量**：复制 `.env.example` 为 `.env`，填写 S3 与静态资源相关配置。
2. **构建并启动**：执行 `docker compose up -d --build`，Compose 会使用 `Dockerfile` 进行构建。
3. **访问服务**：浏览器打开 `http://localhost:3000`，即可访问容器内运行的应用。
4. **停止服务**：运行 `docker compose down` 以停止并清理容器。


## 可用脚本

| 命令 | 描述 |
| --- | --- |
| `npm run dev` | 启动本地开发（含 API） |
| `npm run build` | 产出生产构建（生成 `dist/`） |
| `npm run preview` | 本地预览打包结果 |


## 贡献

欢迎提交 Issue 或 Pull Request 改进项目，如遇问题可通过 `/reportbug` 命令反馈。

## 许可证

本项目基于 MIT License，如仓库中已包含 `LICENSE` 文件请参阅其内容。
