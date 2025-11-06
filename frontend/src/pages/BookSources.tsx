import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Eye, Link as LinkIcon, FileText, Loader2, Download } from 'lucide-react';
import { useBookSourceStore } from '@/stores/bookSourceStore';
import { bookSourceApi } from '@/services/api';
import type { BookSourceDetail, BookSourceImportResult } from '@/types';

export default function BookSources() {
  const { sources, loading, fetchSources, deleteSource } = useBookSourceStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewSource, setViewSource] = useState<BookSourceDetail | null>(null);
  const [editSource, setEditSource] = useState<BookSourceDetail | null>(null);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleDelete = async (id: number) => {
    if (confirm('确定要删除这个书源吗？')) {
      await deleteSource(id);
    }
  };

  const handleView = async (id: number) => {
    try {
      const response = await bookSourceApi.getById(id);
      setViewSource(response.data);
    } catch (error) {
      console.error('Failed to fetch source details:', error);
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await bookSourceApi.getById(id);
      setEditSource(response.data);
    } catch (error) {
      console.error('Failed to fetch source details:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">书源管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            管理你的 Legado 书源，添加、编辑或删除书源
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          添加书源
        </button>
      </div>

      {/* Sources List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">还没有添加任何书源</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            添加第一个书源
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => (
            <div key={source.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {source.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        source.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {source.enabled ? '已启用' : '已禁用'}
                    </span>
                    {source.source_group && (
                      <span className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                        {source.source_group}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{source.url}</p>
                  {source.source_comment && (
                    <p className="text-sm text-gray-500 dark:text-gray-500">{source.source_comment}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(source.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="查看详情"
                  >
                    <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleEdit(source.id)}
                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <AddSourceModal onClose={() => setShowAddModal(false)} />
      )}

      {/* View Source Modal */}
      {viewSource && (
        <ViewSourceModal source={viewSource} onClose={() => setViewSource(null)} />
      )}

      {/* Edit Source Modal */}
      {editSource && (
        <EditSourceModal
          source={editSource}
          onClose={() => setEditSource(null)}
          onSuccess={() => {
            setEditSource(null);
            fetchSources();
          }}
        />
      )}
    </div>
  );
}

// Add Source Modal Component
function AddSourceModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<'json' | 'url' | 'import'>('json');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BookSourceImportResult | null>(null);
  const { addSource, addSourceFromUrl, fetchSources } = useBookSourceStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImportResult(null);
    try {
      if (method === 'json') {
        await addSource(input);
        onClose();
      } else if (method === 'url') {
        await addSourceFromUrl(input);
        onClose();
      } else if (method === 'import') {
        // Batch import from subscription URL
        const response = await bookSourceApi.importFromUrl(input);
        setImportResult(response.data);
        await fetchSources(); // Refresh the list
      }
    } catch (error: any) {
      // 提取错误信息
      let errorMessage = '操作失败';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">添加书源</h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMethod('json')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
              method === 'json' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            JSON文本
          </button>
          <button
            onClick={() => setMethod('url')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
              method === 'url' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <LinkIcon className="w-5 h-5" />
            单个链接
          </button>
          <button
            onClick={() => setMethod('import')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
              method === 'import' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <Download className="w-5 h-5" />
            批量导入
          </button>
        </div>

        {!importResult ? (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">❌ 导入失败</h4>
                <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap font-sans">
                  {error}
                </pre>
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                method === 'json'
                  ? '粘贴书源JSON...'
                  : method === 'url'
                  ? '输入单个书源URL...'
                  : '输入书源订阅URL（如：https://www.yckceo.com/yuedu/shuyuans/json/id/981.json）'
              }
              className="input min-h-[200px] mb-4 font-mono text-sm"
              required
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                取消
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : method === 'import' ? '批量导入' : '添加'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
                导入完成！
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {importResult.total}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">总数</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResult.success}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">成功</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {importResult.failed}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">失败</div>
                </div>
              </div>
            </div>

            {importResult.imported_sources.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  成功导入的书源 (前10个):
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.imported_sources.slice(0, 10).map((source) => (
                    <div key={source.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{source.name}</div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs">{source.url}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.failed_sources.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                  失败的书源 (前5个):
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {importResult.failed_sources.slice(0, 5).map((source, idx) => (
                    <div key={idx} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{source.name}</div>
                      <div className="text-red-600 dark:text-red-400 text-xs">{source.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn btn-primary">
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// View Source Modal Component
function ViewSourceModal({ source, onClose }: { source: BookSourceDetail; onClose: () => void }) {
  const formatted = JSON.stringify(JSON.parse(source.source_json), null, 2);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[80vh] flex flex-col p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{source.name}</h2>
        <pre className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm">
          {formatted}
        </pre>
        <button onClick={onClose} className="btn btn-secondary mt-4">
          关闭
        </button>
      </div>
    </div>
  );
}

// Edit Source Modal Component
function EditSourceModal({
  source,
  onClose,
  onSuccess
}: {
  source: BookSourceDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sourceJson, setSourceJson] = useState(() => {
    return JSON.stringify(JSON.parse(source.source_json), null, 2);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 验证JSON格式
      const parsedJson = JSON.parse(sourceJson);

      // 更新书源
      await bookSourceApi.update(source.id, {
        source_json: sourceJson,
        name: parsedJson.bookSourceName || source.name,
        url: parsedJson.bookSourceUrl || source.url,
        enabled: parsedJson.enabled !== undefined ? parsedJson.enabled : source.enabled,
        source_group: parsedJson.bookSourceGroup || source.source_group,
        source_comment: parsedJson.bookSourceComment || source.source_comment,
      });

      onSuccess();
    } catch (err: any) {
      let errorMessage = '更新失败';
      if (err instanceof SyntaxError) {
        errorMessage = 'JSON格式错误: ' + err.message;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-[95vw] h-[95vh] flex flex-col p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          编辑书源: {source.name}
        </h2>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">❌ 错误</h4>
              <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap font-sans">
                {error}
              </pre>
            </div>
          )}

          <div className="flex-1 min-h-0 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              书源JSON配置
            </label>
            <textarea
              value={sourceJson}
              onChange={(e) => setSourceJson(e.target.value)}
              className="input font-mono text-sm w-full h-full resize-none"
              placeholder="粘贴书源JSON..."
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

