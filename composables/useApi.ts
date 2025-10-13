// API Error Handler และ Health Check
export const useApiHealth = () => {
  const config = useRuntimeConfig();
  const isApiOnline = ref(true);
  const lastChecked = ref<Date | null>(null);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${config.public.apiBase}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      isApiOnline.value = response.ok;
      lastChecked.value = new Date();
      return response.ok;
    } catch (error) {
      console.error('API Health Check Failed:', error);
      isApiOnline.value = false;
      lastChecked.value = new Date();
      return false;
    }
  };

  return {
    isApiOnline,
    lastChecked,
    checkApiHealth,
  };
};

// API Call with Error Handling
export const apiCall = async (
  url: string,
  options: RequestInit = {}
) => {
  const config = useRuntimeConfig();
  const fullUrl = `${config.public.apiBase}${url}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API Call Error:', {
      url: fullUrl,
      error: error.message,
      cause: error.cause,
    });

    // Check if it's a network error
    if (error.name === 'TypeError' && error.message === 'fetch failed') {
      throw new Error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อ');
    }

    // Check if it's a timeout
    if (error.name === 'TimeoutError') {
      throw new Error('การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง');
    }

    throw error;
  }
};
