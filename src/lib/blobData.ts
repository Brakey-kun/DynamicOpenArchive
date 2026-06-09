import fs from 'fs';
import path from 'path';

function localJsonPath(name: string): string {
  const dirName = name === 'parameters' ? 'settings' : 'data';
  return path.join(process.cwd(), dirName, `${name}.json`);
}

export async function getJson<T = any>(name: string, opts?: { blobOnly?: boolean }): Promise<T | null> {
  if (opts?.blobOnly) return null;
  return getLocalJson<T>(name);
}

export function getLocalJson<T = any>(name: string): T | null {
  try {
    const localPath = localJsonPath(name);
    if (fs.existsSync(localPath)) {
      const contents = fs.readFileSync(localPath, 'utf8');
      return JSON.parse(contents) as T;
    }
    return null;
  } catch (err) {
    console.error('Local getJson error:', err);
    return null;
  }
}

export async function setJson(name: string, data: any): Promise<string> {
  setLocalJson(name, data);
  return name;
}

export function setLocalJson(name: string, data: any): void {
  try {
    const dirName = name === 'parameters' ? 'settings' : 'data';
    const dir = path.join(process.cwd(), dirName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const localPath = path.join(dir, `${name}.json`);
    const contents = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(localPath, contents, 'utf8');
  } catch (err) {
    console.error('Local setJson error:', err);
    throw err;
  }
}