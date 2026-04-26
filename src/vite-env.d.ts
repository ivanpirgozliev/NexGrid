/// <reference types="vite/client" />

interface ElectronAPI {
  quit: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
