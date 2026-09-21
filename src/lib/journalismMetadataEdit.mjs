export function buildJournalismMetadataPatch(initial, current, publicationStatus) {
  const patch = {};
  if (current.workKindId !== initial.workKindId && current.workKindId) patch.workKindId = current.workKindId;
  if (publicationStatus !== "published" && publicationStatus !== "withdrawn" && current.plannedPublicationAt !== initial.plannedPublicationAt) {
    patch.plannedPublicationAt = current.plannedPublicationAt || null;
  }
  if (current.location !== initial.location) patch.location = current.location || null;
  if (current.editorialNotes !== initial.editorialNotes) patch.editorialNotes = current.editorialNotes || null;
  return Object.keys(patch).length ? patch : null;
}

export function validateJournalismMetadataEdit(current, publicationStatus) {
  const errors = {};
  if (current.location.length > 500) errors.location = "max";
  if (current.editorialNotes.length > 10000) errors.editorialNotes = "max";
  if (publicationStatus === "scheduled" && !current.plannedPublicationAt) errors.plannedPublicationAt = "required";
  return errors;
}

export function journalismLocalDateTime(value) {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
