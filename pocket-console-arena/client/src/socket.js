import { io } from 'socket.io-client';

const host = window.location.hostname || 'localhost';
const SERVER_URL = `http://${host}:3001`;

export const socket = io(SERVER_URL, {
  autoConnect: true,
});