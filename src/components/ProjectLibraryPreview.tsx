"use client";
import type { LibraryItem } from '@/lib/projectLibrary';
import FilePreviewDialog from '@/components/FilePreviewDialog';

export default function ProjectLibraryPreview({ projectId, item, onClose, onPrevious, onNext, position }: { projectId: string; item: LibraryItem; onClose: () => void; onPrevious?: () => void; onNext?: () => void; position?: string }) {
  const url = `/api/projects/${projectId}/library/file/${item.id}`;
  return <FilePreviewDialog url={`${url}?disposition=inline`} downloadUrl={`${url}?disposition=attachment`} fileName={item.file_name || item.title} mimeType={item.mime_type} sizeBytes={item.size_bytes} onClose={onClose} onPrevious={onPrevious} onNext={onNext} position={position} />;
}
