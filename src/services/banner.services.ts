import { File } from 'expo-file-system';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import { Platform } from 'react-native';

const BUCKET = 'project-banners';

export type UploadBannerInput = {
  projectId: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

function bannerExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

export async function uploadProjectBanner(input: UploadBannerInput): Promise<string> {
  const ext = bannerExtension(input.fileName, input.mimeType);
  const storagePath = `${input.projectId}/banner.${ext}`;
  let bytes: ArrayBuffer;

  if (Platform.OS === 'web') {
    const response = await fetch(input.uri);
    const blob = await response.blob();
    bytes = await blob.arrayBuffer();
  } else {
    bytes = await new File(input.uri).arrayBuffer();
  }
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: input.mimeType, upsert: true });

  if (uploadError) throw normalizeError(uploadError);

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      banner_storage_path: storagePath,
      banner_mime_type: input.mimeType,
    })
    .eq('id', input.projectId);

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw normalizeError(updateError);
  }

  return storagePath;
}

export async function getBannerSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw normalizeError(error);
  if (!data?.signedUrl) throw normalizeError(new Error('Could not generate banner URL'));
  return data.signedUrl;
}
