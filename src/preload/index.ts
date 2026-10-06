import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('onebox', { platform: process.platform });
