import { supabaseAdmin } from './supabase';

type HttpError = Error & { statusCode: number };

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function getBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw createHttpError(500, 'SUPABASE_STORAGE_BUCKET is not configured');
  }
  return bucket;
}

export async function getUploadUrl(path: string, mimeType: string) {
  void mimeType;

  const bucket = getBucketName();
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    throw createHttpError(500, error?.message ?? 'Failed to create signed upload URL');
  }

  return {
    uploadUrl: data.signedUrl,
    storagePath: path,
  };
}

export async function getDownloadUrl(storagePath: string) {
  const bucket = getBucketName();
  const expiresIn = 60;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw createHttpError(500, error?.message ?? 'Failed to create signed download URL');
  }

  return {
    downloadUrl: data.signedUrl,
    storagePath,
    expiresIn,
  };
}
