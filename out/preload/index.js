"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  // Main → Renderer (push)
  PLAYER_UPDATE: "player:update",
  CONNECTION_STATUS: "connection:status",
  ALL_CONNECTIONS: "connection:all",
  // Renderer → Main (request/response)
  CONNECTION_ADD: "connection:add",
  CONNECTION_REMOVE: "connection:remove",
  CONNECTION_UPDATE: "connection:update",
  CONNECTION_LIST: "connection:list",
  CONNECTION_TEST: "connection:test",
  PLAYER_LIST: "player:list",
  PLAYER_GET_STATE: "player:get-state",
  PLAYER_MERGE: "player:merge",
  HISTORY_QUERY: "history:query",
  SESSION_LIST: "session:list",
  SESSION_GET: "session:get",
  GOAL_LIST: "goal:list",
  GOAL_CREATE: "goal:create",
  GOAL_UPDATE: "goal:update",
  GOAL_DELETE: "goal:delete",
  TASK_LIST: "task:list",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_DELETE: "task:delete",
  TASK_TOGGLE_COMPLETE: "task:toggle-complete",
  QUEST_LIST: "quest:list",
  QUEST_UPDATE_STATUS: "quest:update-status",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",
  APP_GET_VERSION: "app:get-version"
};
const api = {
  invoke: (channel, data) => {
    const allowed = Object.values(IPC_CHANNELS);
    if (!allowed.includes(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`));
    }
    return electron.ipcRenderer.invoke(channel, data);
  },
  onPlayerUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.PLAYER_UPDATE, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.PLAYER_UPDATE, handler);
  },
  onConnectionStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.CONNECTION_STATUS, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.CONNECTION_STATUS, handler);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
