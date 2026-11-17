import { supabase } from './supabase';

// Bucket yang menyimpan file per-user di folder `<userId>/`.
const USER_FILE_BUCKETS = ['avatars', 'profile-photos'] as const;
const PAGE_SIZE = 100;
const MAX_FOLDER_DEPTH = 3;

async function listFilePaths(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const paths: string[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const fullPath = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        // Subfolder: storage API mengembalikannya tanpa id.
        if (depth < MAX_FOLDER_DEPTH) {
          paths.push(...(await listFilePaths(bucket, fullPath, depth + 1)));
        }
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < PAGE_SIZE) break;
  }

  return paths;
}

/**
 * Menghapus semua file milik user dari Storage lewat Storage API.
 * Harus dipanggil SEBELUM rpc('delete_user_account'), selagi sesi masih valid.
 * Melempar error jika ada file yang gagal dihapus agar akun tidak terhapus
 * sementara file publiknya tertinggal.
 */
export async function deleteUserStorageFiles(userId: string): Promise<void> {
  for (const bucket of USER_FILE_BUCKETS) {
    const paths = await listFilePaths(bucket, userId);
    for (let i = 0; i < paths.length; i += PAGE_SIZE) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + PAGE_SIZE));
      if (error) throw error;
    }
  }
}
