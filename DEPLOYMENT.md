# 生产环境部署指南

本文档详细说明如何将 Novel_v3 项目部署到云服务器（使用 Nginx）。

## 📋 部署架构

```
浏览器 → Nginx (80端口) → 后端 FastAPI (8000端口)
                        ↓
                   前端静态文件 (dist/)
```

- **前端**：Nginx 托管静态文件
- **后端**：FastAPI 运行在 127.0.0.1:8000
- **API 代理**：Nginx 将 `/api/*` 请求转发到后端

## 🚀 部署步骤

### 步骤 1：准备服务器环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y python3 python3-pip nginx git

# 安装 Node.js (如果需要在服务器上构建前端)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 步骤 2：上传代码到服务器

**方式一：使用 Git（推荐）**

```bash
# 在服务器上
cd ~
git clone https://github.com/your-username/Novel_v3.git
cd Novel_v3
```

**方式二：使用 SCP**

```bash
# 在本地电脑上
scp -r Novel_v3 root@your-server-ip:~/
```

### 步骤 3：部署后端

```bash
# 进入后端目录
cd ~/Novel_v3/backend

# 安装 Python 依赖
pip3 install -r requirements.txt

# 测试启动（确保没有错误）
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 如果测试成功，按 Ctrl+C 停止，然后后台运行
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &

# 查看日志
tail -f backend.log
```

### 步骤 4：构建前端

**方式一：在本地构建（推荐）**

```bash
# 在本地电脑上
cd Novel_v3/frontend
npm install
npm run build

# 上传构建产物到服务器
scp -r dist root@your-server-ip:~/Novel_v3/frontend/
```

**方式二：在服务器上构建**

```bash
# 在服务器上
cd ~/Novel_v3/frontend
npm install
npm run build
```

### 步骤 5：配置 Nginx

```bash
# 创建 Nginx 配置文件
sudo nano /etc/nginx/sites-available/novel
```

粘贴以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名或 IP

    # 前端静态文件
    location / {
        root /root/Novel_v3/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 添加缓存控制
        add_header Cache-Control "public, max-age=3600";
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 增加超时时间（用于下载等长时间操作）
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/novel /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 步骤 6：配置防火墙

```bash
# 开放 80 端口
sudo ufw allow 80

# 开放 443 端口（如果使用 HTTPS）
sudo ufw allow 443

# 启用防火墙
sudo ufw enable
```

### 步骤 7：验证部署

访问 `http://your-server-ip`，应该能看到前端页面。

测试功能：
1. ✅ 页面能正常加载
2. ✅ 能添加书源
3. ✅ 能搜索小说
4. ✅ 能查看书籍详情
5. ✅ 能阅读章节

## 🔧 常见问题

### 1. 前端页面显示，但 API 请求失败

**原因**：环境变量未正确配置

**解决**：
```bash
# 确保 frontend/.env.production 存在且内容为：
VITE_API_BASE_URL=/api/v1

# 重新构建前端
cd frontend
npm run build
```

### 2. Nginx 403 Forbidden

**原因**：文件权限问题

**解决**：
```bash
# 修改文件权限
sudo chmod -R 755 ~/Novel_v3/frontend/dist

# 或修改 Nginx 用户
sudo nano /etc/nginx/nginx.conf
# 将 user 改为 root 或当前用户
```

### 3. 后端无法访问

**原因**：后端服务未启动或端口被占用

**解决**：
```bash
# 检查后端是否运行
ps aux | grep uvicorn

# 检查端口占用
sudo netstat -tlnp | grep 8000

# 查看后端日志
tail -f ~/Novel_v3/backend/backend.log
```

### 4. 跨域问题

**原因**：后端 CORS 配置不正确

**解决**：检查 `backend/app/config.py` 中的 `CORS_ORIGINS` 配置

## 🔄 更新部署

当代码有更新时：

```bash
# 1. 拉取最新代码
cd ~/Novel_v3
git pull

# 2. 更新后端
cd backend
pip3 install -r requirements.txt
# 重启后端服务
pkill -f uvicorn
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &

# 3. 更新前端（在本地构建后上传，或在服务器上构建）
cd ../frontend
npm install
npm run build

# 4. 重启 Nginx
sudo systemctl restart nginx
```

## 📝 生产环境优化建议

1. **使用进程管理器**：使用 `systemd` 或 `supervisor` 管理后端进程
2. **配置 HTTPS**：使用 Let's Encrypt 免费证书
3. **数据库备份**：定期备份 `backend/novel.db` 和 `backend/downloads/`
4. **日志管理**：配置日志轮转，避免日志文件过大
5. **监控告警**：配置服务监控和告警

## 🔐 安全建议

1. 不要使用 root 用户运行服务
2. 配置防火墙，只开放必要端口
3. 定期更新系统和依赖包
4. 使用强密码和 SSH 密钥认证
5. 配置 fail2ban 防止暴力破解

