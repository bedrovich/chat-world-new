import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (url) => {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const s = io(url);
    setSocket(s);
    return () => s.close();
  }, [url]);
  return socket;
};