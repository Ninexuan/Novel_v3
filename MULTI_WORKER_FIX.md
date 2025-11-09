# 多Worker环境下载状态同步问题修复

## 🐛 问题描述

在云服务器上，下载任务"时有时无"，几秒钟显示，几秒钟又消失。而本地环境没有这个问题。

## 🔍 根本原因

### 问题场景

云服务器使用了**多个worker进程**运行FastAPI（例如使用gunicorn + uvicorn workers），而下载状态原本只存储在**内存字典**中：

```python
# 原来的实现
class DownloadService:
    active_downloads: Dict[int, dict] = {}  # 只在内存中
```

### 为什么会"时有时无"？

1. **Worker 1** 处理下载请求，在自己的内存中存储下载状态
2. **Worker 2** 处理获取下载进度的请求，但它的内存中**没有**这个下载状态
3. **Worker 3** 处理下一次请求，又能看到状态（如果恰好是Worker 1处理）
4. 结果：下载进度"时有时无"（取决于哪个worker处理请求）

### 为什么本地没问题？

本地开发环境通常使用**单个worker**：
```bash
uvicorn app.main:app --reload  # 默认单worker
```

云服务器可能使用：
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker  # 4个worker
```

## ✅ 解决方案

### 方案：数据库 + 内存混合存储

修改 `DownloadService` 使其同时使用：
1. **数据库**：作为跨worker的共享存储
2. **内存**：作为快速缓存（可选）

### 实现细节

#### 1. 修改 `download_service.py`

```python
@staticmethod
async def get_download_progress(db: AsyncSession, book_id: int) -> Optional[dict]:
    """Get download progress from database and memory"""
    # 1. 先检查内存（最新状态）
    if book_id in DownloadService.active_downloads:
        return DownloadService.active_downloads[book_id]
    
    # 2. 再检查数据库（跨worker共享）
    book = await LibraryService.get_book_by_id(db, book_id)
    if not book:
        return None
    
    # 返回数据库中的状态
    if book.is_downloaded:
        return {'status': 'completed', ...}
    elif book.download_progress > 0:
        return {'status': 'downloading', ...}
    else:
        return {'status': 'not_started', ...}
```

#### 2. 修改 `get_all_active_downloads`

```python
@staticmethod
async def get_all_active_downloads(db: AsyncSession) -> Dict[int, dict]:
    """Get all active downloads from database"""
    # 查询数据库中正在下载的书籍
    stmt = select(LibraryBook).where(
        LibraryBook.download_progress > 0,
        LibraryBook.is_downloaded == False
    )
    result = await db.execute(stmt)
    books = result.scalars().all()
    
    downloads = {}
    for book in books:
        # 优先使用内存状态（更新更及时）
        if book.id in DownloadService.active_downloads:
            downloads[book.id] = DownloadService.active_downloads[book.id]
        else:
            # 使用数据库状态
            downloads[book.id] = {
                'total_chapters': book.total_chapters,
                'downloaded_chapters': book.downloaded_chapters,
                'progress': book.download_progress,
                'status': 'downloading',
                ...
            }
    
    return downloads
```

#### 3. 修改 `is_downloading`

```python
@staticmethod
async def is_downloading(db: AsyncSession, book_id: int) -> bool:
    """Check if downloading (checks both memory and database)"""
    # 先检查内存
    if book_id in DownloadService.active_downloads:
        return DownloadService.active_downloads[book_id].get('status') == 'downloading'
    
    # 再检查数据库
    book = await LibraryService.get_book_by_id(db, book_id)
    return book and book.download_progress > 0 and not book.is_downloaded
```

#### 4. 更新API调用

```python
# 修改前
if DownloadService.is_downloading(book_id):  # ❌ 只检查内存

# 修改后
if await DownloadService.is_downloading(db, book_id):  # ✅ 检查数据库
```

## 🎯 工作原理

### 下载流程

1. **开始下载**（Worker 1）
   - 在内存中标记：`active_downloads[book_id] = {...}`
   - 在数据库中更新：`download_progress = 0`

2. **下载进行中**（Worker 1）
   - 每10章更新数据库：`download_progress = 50`
   - 实时更新内存状态

3. **查询进度**（可能是Worker 2）
   - 先查内存：如果Worker 2没有这个状态
   - 再查数据库：✅ 找到了！`download_progress = 50`
   - 返回正确的进度

4. **下载完成**（Worker 1）
   - 更新数据库：`is_downloaded = True`
   - 清理内存状态

### 优势

✅ **跨Worker共享**：所有worker都能看到下载状态  
✅ **实时性**：内存缓存提供最新状态  
✅ **持久化**：服务器重启后状态不丢失  
✅ **兼容性**：单worker和多worker环境都能正常工作  

## 🚀 部署步骤

### 1. 更新代码

```bash
# 在本地
git pull  # 或者手动更新文件

# 上传到服务器
scp backend/app/services/download_service.py admin@8.138.179.252:/home/admin/Novel_v3/backend/app/services/
scp backend/app/api/library.py admin@8.138.179.252:/home/admin/Novel_v3/backend/app/api/
```

### 2. 重启后端服务

```bash
# SSH到服务器
ssh admin@8.138.179.252

# 重启后端
cd /home/admin/Novel_v3/backend
pkill -f uvicorn
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > backend.log 2>&1 &

# 或者如果使用systemd
sudo systemctl restart novel-backend
```

### 3. 验证修复

1. 开始下载一本书
2. 刷新页面多次（会被不同worker处理）
3. 确认下载进度始终显示，不会消失

## 📊 数据库字段说明

`library_books` 表中的相关字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `download_progress` | Integer | 下载进度 0-100 |
| `total_chapters` | Integer | 总章节数 |
| `downloaded_chapters` | Integer | 已下载章节数 |
| `is_downloaded` | Boolean | 是否下载完成 |

这些字段在下载过程中会被定期更新（每10章），确保跨worker的状态同步。

## 🔧 如何检查是否使用多Worker

### 在服务器上执行：

```bash
# 查看uvicorn进程数量
ps aux | grep uvicorn

# 如果看到多个进程，说明使用了多worker
# 例如：
# admin    1234  ... uvicorn
# admin    1235  ... uvicorn
# admin    1236  ... uvicorn
# admin    1237  ... uvicorn
```

### 查看systemd配置（如果使用）

```bash
cat /etc/systemd/system/novel-backend.service

# 查找类似这样的配置：
# ExecStart=gunicorn -w 4 -k uvicorn.workers.UvicornWorker ...
#                     ^^^^
#                     这里的数字就是worker数量
```

## 📝 注意事项

1. **数据库更新频率**：当前每10章更新一次数据库，可根据需要调整
2. **内存状态清理**：下载完成后，内存状态会保留直到服务重启
3. **并发安全**：SQLAlchemy的AsyncSession已处理并发问题
4. **性能影响**：增加了数据库查询，但影响很小（有索引）

## 🎉 预期效果

修复后：
- ✅ 下载进度始终可见，不会"时有时无"
- ✅ 多个用户同时下载不同书籍，互不影响
- ✅ 刷新页面或切换页面，进度保持一致
- ✅ 服务器重启后，未完成的下载状态仍然可见

