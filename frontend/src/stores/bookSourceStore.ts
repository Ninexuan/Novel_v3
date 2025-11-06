import { create } from 'zustand';
import type { BookSource } from '@/types';
import { bookSourceApi } from '@/services/api';

interface BookSourceStore {
  sources: BookSource[];
  loading: boolean;
  error: string | null;
  fetchSources: (enabledOnly?: boolean) => Promise<void>;
  addSource: (sourceJson: string) => Promise<void>;
  addSourceFromUrl: (url: string) => Promise<void>;
  updateSource: (id: number, data: Partial<BookSource>) => Promise<void>;
  deleteSource: (id: number) => Promise<void>;
}

export const useBookSourceStore = create<BookSourceStore>((set, get) => ({
  sources: [],
  loading: false,
  error: null,

  fetchSources: async (enabledOnly = false) => {
    set({ loading: true, error: null });
    try {
      const response = await bookSourceApi.getAll(enabledOnly);
      set({ sources: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addSource: async (sourceJson: string) => {
    set({ loading: true, error: null });
    try {
      await bookSourceApi.create({ source_json: sourceJson });
      await get().fetchSources();
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      throw error;
    }
  },

  addSourceFromUrl: async (url: string) => {
    set({ loading: true, error: null });
    try {
      await bookSourceApi.createFromUrl(url);
      await get().fetchSources();
    } catch (error: any) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      throw error;
    }
  },

  updateSource: async (id: number, data: Partial<BookSource>) => {
    set({ loading: true, error: null });
    try {
      await bookSourceApi.update(id, data);
      await get().fetchSources();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteSource: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await bookSourceApi.delete(id);
      await get().fetchSources();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));

