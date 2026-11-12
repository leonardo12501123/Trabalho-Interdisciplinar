
const API_URL = 'http://localhost:8080';

async function apiFetch(endpoint, options = {}) {
    const session = JSON.parse(localStorage.getItem('letleo_session') || 'null');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

   
    if (session && session.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
    }

    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        
        if (response.status === 204) return null;

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.erro || `Erro HTTP ${response.status}`);
        }
        return data;
    } catch (err) {
        console.error(`Erro na requisição ${endpoint}:`, err);
        throw err;
    }
}