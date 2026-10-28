"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import type { PermissionItem } from "./types";
export default function usePermissionUserDetail(userId: string) { const [items, setItems] = useState<PermissionItem[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const load = useCallback(async () => { setLoading(true); const response = await fetch(`/api/permissions/users/${userId}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({})); if (!response.ok)
    setError(response.status === 403 ? "Không có quyền" : "Không thể tải quyền.");
else {
    setItems(data.items ?? []);
    setError("");
} setLoading(false); }, [userId]); useEffect(() => void load(), [load]); return { items, loading, error, setError, load }; }

