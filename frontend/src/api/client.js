const API_BASE_URL = 'http://localhost:8080/api';

export async function fetchAllSensors() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/sensors`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch sensor data:', error);
    throw error;
  }
}

export async function fetchHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/sensors/health`);
    return await response.json();
  } catch (error) {
    return null;
  }
}
