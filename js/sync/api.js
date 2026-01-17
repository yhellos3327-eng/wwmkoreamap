import { BACKEND_URL } from '../config.js';

export const fetchCloudData = async () => {
    const response = await fetch(`${BACKEND_URL}/api/sync/load`, {
        credentials: 'include'
    });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : null;
};

export const saveCloudData = async (data) => {
    const response = await fetch(`${BACKEND_URL}/api/sync/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
    return await response.json();
};



export const fetchBackupList = async () => {
    const response = await fetch(`${BACKEND_URL}/api/backup/list`, {
        credentials: 'include'
    });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const result = await response.json();
    return result.success ? result.backups : [];
};

export const saveCloudBackup = async (label = null) => {
    const response = await fetch(`${BACKEND_URL}/api/backup/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label })
    });
    if (!response.ok) throw new Error(`Failed to save: ${response.status}`);
    return await response.json();
};

export const restoreFromBackup = async (backupId) => {
    const response = await fetch(`${BACKEND_URL}/api/backup/restore/${backupId}`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!response.ok) throw new Error(`Failed to restore: ${response.status}`);
    return await response.json();
};
