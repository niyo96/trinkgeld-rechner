import { Injectable } from '@angular/core';

const STORAGE_KEY = 'trinkgeld-rechner-state';

@Injectable({ providedIn: 'root' })
export class StorageService {
  save<T>(data: T): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota exceeded or private mode
    }
  }

  load<T>(): T | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
