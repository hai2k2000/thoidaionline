"use client";
import type { LibraryItem } from '@/lib/projectLibrary';
import OfficeFilePreview from '@/components/OfficeFilePreview';

export default function OfficePreview({ projectId, item }: { projectId: string; item: LibraryItem }) {
  return <OfficeFilePreview key={item.id} url={`/api/projects/${projectId}/library/file/${item.id}?disposition=attachment`} fileName={item.file_name || item.title} mimeType={item.mime_type} sizeBytes={item.size_bytes} />;
}
