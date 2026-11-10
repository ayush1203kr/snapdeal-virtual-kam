const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextWeekday(target: string) {
  const date = new Date();
  const targetDay = weekdayNames.indexOf(target.toLowerCase());
  const offset = (targetDay - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + offset);
  date.setHours(17, 0, 0, 0);
  return date;
}

export function extractSellerCommitment(text: string) {
  const match = text.match(/\b(?:yes[, ]*)?(?:i will|i'll|we will|we'll)\s+(.+?)\s+(?:(?:by|before|on)\s+)?(today|tomorrow|in\s+\d+\s+days?|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})[.! ]*$/i);
  if (!match) return null;
  const action = match[1].trim().replace(/[.!]+$/, "");
  if (action.length < 5 || action.length > 180) return null;
  const dueText = match[2].toLowerCase();
  const dueDate = new Date();
  if (dueText === "tomorrow") dueDate.setDate(dueDate.getDate() + 1);
  else if (dueText === "today") dueDate.setHours(23, 59, 0, 0);
  else if (dueText === "next week") dueDate.setDate(dueDate.getDate() + 7);
  else if (dueText.startsWith("in ")) dueDate.setDate(dueDate.getDate() + Number(dueText.match(/\d+/)?.[0] || 0));
  else if (weekdayNames.includes(dueText)) return { action, dueDate: nextWeekday(dueText).toISOString() };
  else {
    const parsed = new Date(`${dueText}T17:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    dueDate.setTime(parsed.getTime());
  }
  if (dueDate.getTime() <= Date.now()) return null;
  return { action, dueDate: dueDate.toISOString() };
}
