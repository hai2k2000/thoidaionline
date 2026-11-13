"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, responseErrorMessage } from "@/lib/actionFeedback";
import { useActionFeedback } from "@/components/ActionFeedbackProvider";
import { validateTaskAttachment, TASK_ATTACHMENT_FORMAT_MESSAGE, TASK_ATTACHMENT_ACCEPT as POLICY_ACCEPT } from "@/lib/taskAttachmentPolicy.mjs";
import type { TaskAttachmentDto } from "@/lib/taskContracts";
import TaskLinkAttacher from "@/components/TaskLinkAttacher";
import CameraCaptureButton from "@/components/CameraCaptureButton";

export const TASK_ATTACHMENT_ACCEPT = POLICY_ACCEPT;

export { validateTaskAttachment };

export function uploadErrorMessage(status: number, code?: string, fallback = "Không thể tải tệp lên.") {
  if (status === 400 || status === 415) return TASK_ATTACHMENT_FORMAT_MESSAGE;
  if (status === 403) return "Bạn không có quyền tải tệp lên công việc này.";
  if (status === 413) return TASK_ATTACHMENT_FORMAT_MESSAGE;
  if (status >= 500) return "Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại.";
  return code === "forbidden" ? "Bạn không có quyền tải tệp lên công việc này." : fallback;
}

export default function TaskAttachmentUploader({ taskId, disabled = false, onUploaded, admin = false }: {
  taskId: string;
  disabled?: boolean;
  onUploaded?: (attachment: TaskAttachmentDto) => void;
  admin?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const router = useRouter();
  const { notify } = useActionFeedback();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function selectFiles(files: File[]) {
    if (!files.length || uploading.current || disabled) return;
    uploading.current = true;
    setBusy(true);
    setErrors([]);
    const reject = (file: File, text: string) => {
      const message = `${file.name}: ${text}`;
      setErrors(previous => [...previous, message]); notify("error", message);
    };
    let index = 0;
    let succeeded = false;
    try {
      for (const file of files) {
        index += 1;
        const validation = await validateTaskAttachment(file);
        if (validation) { reject(file, validation); continue; }
        setProgress(`Đang tải lên… (${index}/${files.length})`);
        try {
        const form = new FormData(); form.set("file", file);
        const response = await fetch(`/api/tasks/${taskId}/attachments`, { method: "POST", body: form });
        if (!response.ok) {
          reject(file, uploadErrorMessage(response.status, undefined, await responseErrorMessage(response, "Không thể tải tệp lên.")));
          continue;
        }
        succeeded = true;
        const body = await response.json().catch(() => null) as { attachment?: TaskAttachmentDto } | null;
        if (body?.attachment) onUploaded?.(body.attachment);
        notify("success", `Đã tải lên ${file.name}`);
        } catch { reject(file, errorMessage(null, "Lỗi kết nối khi tải tệp. Vui lòng thử lại.")); }
      }
      if (succeeded) router.refresh();
    } finally {
      uploading.current = false;
      setBusy(false); setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className={`flex flex-wrap items-center gap-2${admin ? " w-full" : ""}`}>
    <label title="Đính kèm tệp" aria-label="Đính kèm tệp" className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white text-orange-700 hover:bg-orange-50 focus-within:ring-2 focus-within:ring-orange-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v6m-3-3h6"/></svg>
      <input ref={inputRef} aria-label="Chọn tệp đính kèm" data-testid="task-attachment-input" name="file" type="file" multiple accept={TASK_ATTACHMENT_ACCEPT} disabled={disabled || busy} className="sr-only" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
    </label>
    <CameraCaptureButton disabled={disabled || busy} onCapture={(file) => selectFiles([file])} />
    <TaskLinkAttacher taskId={taskId} disabled={disabled || busy} />
    {progress ? <span role="status" className="text-sm text-slate-600">{progress}</span> : null}
    {errors.length ? <ul role="alert" className="w-full break-words text-sm text-red-700">{errors.map((message, i) => <li key={i}>{message}</li>)}</ul> : null}
  </div>;
}
