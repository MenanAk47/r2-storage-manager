<div align="center">

# ⚡ Cloudflare R2 Storage Manager

**A lightweight, beginner-friendly, desktop-class web file manager for Cloudflare R2 (S3-compatible) object storage with zero egress bandwidth fees.**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2%20Object%20Storage-F38020.svg?style=flat-square&logo=cloudflare)](https://www.cloudflare.com/developer-platform/r2/)
[![Express.js](https://img.shields.io/badge/Express-5.x-000000.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[Quick Start](#-30-second-quick-start) • [1-Click Cloud Deploy](#-1-click-cloud-deploy) • [Beginner Setup Guide](#-step-by-step-guide-for-beginners) • [Environment (.env) Guide](#-environment-variables--configuration-guide) • [Docker Deployment](#-docker--docker-compose-deployment) • [Troubleshooting](#-troubleshooting--common-setup-questions)

</div>

---

## 📖 Overview

**Cloudflare R2 Storage Manager** is a sleek, zero-maintenance web dashboard that gives you a complete Google Drive / Dropbox / macOS Finder-like interface over your Cloudflare R2 object storage buckets. 

Unlike Amazon AWS S3, Cloudflare R2 has **zero egress bandwidth fees**, making it the premier choice for hosting media, project backups, assets, distributions, and documents.

> [!TIP]
> **Free Cloud Storage**: Cloudflare provides **10 GB of storage** and **10 million operations free** every month with zero egress charges.

* **No database required**: Everything runs statelessly in a single lightweight container with zero database migrations.
* **Beginner-friendly**: Built-in connection diagnostics, automated session security, and friendly in-app troubleshooting.
* **Desktop-class experience**: Drag-and-drop uploads, live media preview (zoom/rotate/pan), range-seeking video/audio, directory navigation, and instant ZIP downloads.

---

## ⚡ 30-Second Quick Start

### Option 1: Run with Docker Compose (Recommended)
```bash
# 1. Clone the repository
git clone https://github.com/your-username/r2-storage-manager.git
cd r2-storage-manager

# 2. Create your .env file and fill in your Cloudflare credentials
cp .env.example .env

# 3. Start the container
docker compose up -d
```
Open **`http://localhost:3000`** in your browser!

---

### Option 2: Run with Node.js
```bash
# 1. Clone & install
git clone https://github.com/your-username/r2-storage-manager.git
cd r2-storage-manager
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Start the app
npm start
```
Open **`http://localhost:3000`** in your browser!

---

## 🚀 1-Click Cloud Deploy

Deploy your own private R2 File Manager in 60 seconds with no server setup:

| Platform | 1-Click Deploy |
| :--- | :--- |
| **Railway** | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template) |
| **Render** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy) |

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 📁 **Virtual Folder Tree** | S3 prefix/delimiter navigation, clickable breadcrumbs, instant subfolder creation, and recursive folder deletion. |
| 🚀 **Multi-File & Folder Uploads** | Viewport-wide drag-and-drop, full folder tree uploads (`webkitdirectory`), upload queue drawer, and real-time progress. |
| 👁️ **Universal Media Previews** | Image lightbox (zoom/rotate/pan), HTML5 Video/Audio streaming with HTTP 206 Range seeking, PDF viewer, and syntax-styled code viewer with 1-click copy. |
| 🔗 **Presigned URL Generator** | Generate secure, temporary direct download links (15m, 1h, 24h, 7d) without making your private bucket public. |
| 📦 **Instant ZIP Batch Downloads** | Stream selected files or entire folder directories as a `.zip` archive on the fly using memory streams without consuming server disk space. |
| 🔍 **Search & Category Filters** | Instant bucket-wide search (`/` or `Ctrl+K`), live sorting by Name/Size/Date/Type, and category filter chips (Images, Videos, Audio, Documents, Archives, Code). |
| 🎛️ **Dual View Modes** | Switch seamlessly between rich **Grid Cards** with thumbnail previews and a dense **Table View** with sortable columns and batch checkboxes. |
| 🛡️ **Zero-Config Security** | Timing-safe authentication, brute-force rate limiting, automatic dynamic session secrets, and reverse proxy trust. |
| 🩺 **Smart Diagnostic Helper** | Interactive in-app troubleshooting banner that detects wrong credentials and guides you with exact solutions. |

---

## 🔰 Step-by-Step Guide for Beginners

If you are new to Cloudflare R2 and cloud storage, follow this simple walkthrough to set up your free R2 bucket and get your credentials in less than 5 minutes.

### Step 1: Create a Cloudflare Account & Enable R2
1. Go to [Cloudflare.com](https://dash.cloudflare.com/) and create a free account (or log in).
2. On the left sidebar navigation, click on **R2 Object Storage**.
3. If this is your first time using R2, click **Enable R2**.

### Step 2: Find Your Cloudflare Account ID
1. In the Cloudflare Dashboard, look at the right sidebar of the **Account Home** or look at the URL in your browser:
   ```text
   https://dash.cloudflare.com/<your_account_id>/r2/overview
   ```
2. The 32-character alphanumeric string in the URL is your **Cloudflare Account ID**.

### Step 3: Create an R2 Bucket
1. In the R2 dashboard, click the blue **"Create bucket"** button.
2. Enter a **Bucket name** (e.g., `my-storage-bucket` or `assets`).
3. Click **Create bucket**.

### Step 4: Create R2 API Credentials (Access Key & Secret)
1. On the R2 Overview page, look at the right-hand menu and click **"Manage R2 API Tokens"**.
2. Click **"Create API token"**.
3. Configure the token:
   - **Token name**: `R2 Storage Manager`
   - **Permissions**: Select **"Object Read & Write"** (or Admin Read & Write).
   - **Specify bucket(s)**: Select **"All buckets"** or choose your specific bucket.
4. Click **"Create API Token"** at the bottom.
5. Copy your **Access Key ID** and **Secret Access Key**.

> [!IMPORTANT]
> **Token Type**: Make sure you generate your keys under **R2 > Manage R2 API Tokens**, which creates S3-compatible Access Keys. Do not use Global User API keys.

---

## ⚙️ Environment Variables & Configuration Guide

The application uses an `.env` file located in the project root to store your credentials and configuration. 

### 1. How to Create and Edit Your `.env` File

* **Linux / macOS / WSL (Terminal)**:
  ```bash
  cp .env.example .env
  nano .env
  ```
* **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  notepad .env
  ```
* **Docker / Docker Compose**:
  Place the `.env` file in the same directory as `docker-compose.yml`, or pass variables directly via container environment settings.

---

### 2. Complete Annotated `.env` Example

```env
# ==============================================================================
# Cloudflare R2 Storage Manager - Configuration
# ==============================================================================

# Port to run the web server on (Default: 3000)
PORT=3000

# ------------------------------------------------------------------------------
# 1. Cloudflare R2 Credentials (REQUIRED)
# ------------------------------------------------------------------------------
# Your 32-character Cloudflare Account ID (from dashboard URL or sidebar)
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here

# S3-compatible Access Key ID generated under R2 -> Manage R2 API Tokens
R2_ACCESS_KEY_ID=your_r2_access_key_id_here

# S3-compatible Secret Access Key generated under R2 -> Manage R2 API Tokens
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here

# The exact name of the Cloudflare R2 bucket you created
R2_BUCKET_NAME=your_r2_bucket_name

# ------------------------------------------------------------------------------
# 2. Security & Login (RECOMMENDED)
# ------------------------------------------------------------------------------
# Master password required to log into the web dashboard (Default: 'admin')
DASHBOARD_PASSWORD=your_secure_password_here

# Optional: 32+ character random string for signing login session cookies.
# (If left empty, a secure random key is generated automatically on server startup)
SESSION_SECRET=

# ------------------------------------------------------------------------------
# 3. Optional Settings
# ------------------------------------------------------------------------------
# Optional: Set to 'eu' or 'fedramp' if your bucket has a jurisdiction constraint.
# Leave blank for default global buckets.
R2_JURISDICTION=

# Optional: Custom domain or public r2.dev URL for generating direct CDN links.
# Example: https://cdn.yourdomain.com or https://pub-xxxxxx.r2.dev
# Leave blank if your bucket is private.
R2_PUBLIC_URL=
```

---

### 3. Detailed Environment Variables Breakdown

| Variable | Required? | Default | Description & Where to Find It |
| :--- | :---: | :---: | :--- |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** | — | Found in your Cloudflare Dashboard URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview`. |
| `R2_ACCESS_KEY_ID` | **Yes** | — | S3-compatible Access Key generated under **Cloudflare R2 > Manage R2 API Tokens > Create API Token**. |
| `R2_SECRET_ACCESS_KEY` | **Yes** | — | S3-compatible Secret Access Key generated alongside the Access Key ID. *(Note: Cloudflare shows this only once upon creation)*. |
| `R2_BUCKET_NAME` | **Yes** | — | The exact name of your bucket created in Cloudflare R2. *(Case-sensitive)*. |
| `DASHBOARD_PASSWORD` | No | `admin` | The password required to authenticate at `/login.html`. Change this for production use! |
| `SESSION_SECRET` | No | *Auto-generated* | Secret key used to sign HMAC HTTP-only authentication cookies. Automatically generated if left blank. |
| `R2_PUBLIC_URL` | No | — | Your bucket's public domain (e.g. `https://cdn.example.com` or `https://pub-xxxxxx.r2.dev`) for direct public link generation. |
| `R2_JURISDICTION` | No | — | Jurisdiction constraint if your bucket was created with geographic restriction (`eu` or `fedramp`). |
| `PORT` | No | `3000` | Port number the internal Node.js Express server listens on. |

---

### 4. Setting Environment Variables on Cloud Platforms

* **Railway / Render / Fly.io / Heroku**:
  Go to your app's **Settings** or **Environment** tab in the cloud provider's web console and add the key-value pairs (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `DASHBOARD_PASSWORD`).
* **Unraid / TrueNAS / Synology / Portainer**:
  In the container configuration screen, add the environment variables under the **Environment Variables / Config** section.

---

## 🐳 Docker & Docker Compose Deployment

### Using Docker Compose (Simplest)
```yaml
# docker-compose.yml
services:
  r2-storage-manager:
    image: ghcr.io/your-org/r2-storage-manager:latest
    container_name: r2-storage-manager
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD:-admin}
      - SESSION_SECRET=${SESSION_SECRET:-}
      - R2_PUBLIC_URL=${R2_PUBLIC_URL:-}
```

### Synology NAS / Unraid / TrueNAS / Portainer
* **Port**: Map container port `3000` to your host port (e.g. `3000:3000`).
* **Environment Variables**: Add `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `DASHBOARD_PASSWORD`.
* **Restart Policy**: Set to `Unless Stopped`.

---

## ❓ Troubleshooting & Common Setup Questions

### 1. "Invalid Access Key ID" or "Signature Does Not Match"
* **Fix**: Ensure you copied the **S3 Access Key ID** and **S3 Secret Access Key** from the R2 API Tokens page, NOT the Cloudflare global user API token.

### 2. "Bucket Not Found"
* **Fix**: Check that `R2_BUCKET_NAME` in your `.env` exactly matches the bucket name created in Cloudflare (bucket names are case-sensitive).

### 3. "Access Denied / 403 Forbidden"
* **Fix**: Ensure your R2 API token was created with **"Object Read & Write"** permissions and is permitted to access the target bucket.

### 4. "Too many login attempts"
* **Fix**: The built-in rate limiter protects against brute force attacks. Wait 15 minutes or restart the server to reset the rate limiter.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` or `Ctrl + K` / `Cmd + K` | Focus quick search bar |
| `Ctrl + A` / `Cmd + A` | Select all files in current view |
| `Escape` | Close active modal, inspector drawer, or clear selection |
| `Delete` | Trigger batch delete confirmation for selected items |

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Built with ❤️ for the Cloudflare & self-hosting open-source community.</sub>
</div>
