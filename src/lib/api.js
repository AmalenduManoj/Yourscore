import { API_BASE_URL } from './constants.js'

export async function apiRequest(path, options = {}) {
  const { headers, ...requestOptions } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'omit',
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  const text = await response.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Something went wrong')
    error.status = response.status
    throw error
  }

  return data
}

export function getAuthToken() {
  return localStorage.getItem('cricscore_token')
}

export function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary env is missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || 'Image upload failed')
  }

  return data.secure_url
}
