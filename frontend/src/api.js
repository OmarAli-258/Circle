export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export function wakeBackend() {
  fetch(`${API_URL}/health`).catch(() => {})
}
