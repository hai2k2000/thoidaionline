"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import type { PermissionItem } from "./types";
export default function usePermissionUserDetail(userId: string) {
  const [items, setItems] = useState<PermissionItem[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [departmentViewGrants, setDepartmentViewGrants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const response = await fetch(`/api/permissions/users/${userId}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({})); if (!response.ok)
    setError(response.status === 403 ? "Không có quyền" : "Không thể tải quyền.");
else {
    setItems(data.items ?? []); setDepartments(data.departments ?? []); setDepartmentViewGrants(data.departmentViewGrants ?? []);
    setError("");
} setLoading(false); }, [userId]); useEffect(() => void load(), [load]); return { items, departments, departmentViewGrants, setDepartmentViewGrants, loading, error, setError, load }; }

