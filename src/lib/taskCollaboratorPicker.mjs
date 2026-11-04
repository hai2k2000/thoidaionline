export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN").replace(/đ/g, "d").trim();
}

/**
 * @template {{ id: string, fullName: string, username?: string | null }} T
 * @param {T[]} people
 * @param {string} query
 * @returns {T[]}
 */
export function filterCollaboratorCandidates(people, query) {
  const normalized = normalizeSearch(query);
  return people.filter((person) => !normalized || [person.fullName, person.username].some((value) => normalizeSearch(value).includes(normalized)));
}

export function collaboratorLabel(person) {
  return `${person.fullName} · ${person.departmentName || "Chưa có phòng"}`;
}
