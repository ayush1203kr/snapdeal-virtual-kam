const request = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
};

export const api = {
  sellers: () => request("/api/sellers"),
  analysis: id => request(`/api/sellers/${id}/analysis`),
  newChat: sellerId => request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ sellerId })
  }),
  turn: (id, message) => request(`/api/conversations/${id}/turn`, {
    method: "POST",
    body: JSON.stringify({ message })
  }),
  commitments: id => request(`/api/sellers/${id}/commitments`),
  updateCommitment: (id, status) => request(`/api/commitments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  }),
  checkIn: id => request(`/api/commitments/${id}/check-in`, { method: "POST" })
};
