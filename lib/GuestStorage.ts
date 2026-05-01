// Client-side storage for guest data
export interface StoredContent {
  id: string;
  title: string;
  content: string;
  type: string;
  isFavorite: boolean;
  createdAt: string;
  tone?: string;
  length?: string;
  language?: string;
  seoKeywords?: string[];
  plagiarismScore?: number;
}

const GUEST_CONTENT_KEY = 'guest_content';
const GUEST_FAVORITES_KEY = 'guest_favorites';

export class GuestStorage {
  // Save content to localStorage
  static saveContent(content: Omit<StoredContent, 'id' | 'createdAt'>): StoredContent {
    const newContent: StoredContent = {
      ...content,
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    const existing = this.getAllContent();
    const updated = [newContent, ...existing];
    localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(updated));
    
    return newContent;
  }
  
  // Get all guest content
  static getAllContent(): StoredContent[] {
    const stored = localStorage.getItem(GUEST_CONTENT_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  
  // Toggle favorite status
  static toggleFavorite(contentId: string): boolean {
    const contents = this.getAllContent();
    const content = contents.find(c => c.id === contentId);
    if (content) {
      content.isFavorite = !content.isFavorite;
      localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(contents));
      return content.isFavorite;
    }
    return false;
  }
  
  // Delete content
  static deleteContent(contentId: string): boolean {
    const contents = this.getAllContent();
    const filtered = contents.filter(c => c.id !== contentId);
    localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(filtered));
    return true;
  }
  
  // Get favorite content
  static getFavorites(): StoredContent[] {
    return this.getAllContent().filter(c => c.isFavorite);
  }
  
  // Clear all guest data (when user signs up)
  static clearAll(): void {
    localStorage.removeItem(GUEST_CONTENT_KEY);
    localStorage.removeItem(GUEST_FAVORITES_KEY);
  }
  
  // Migrate guest data to user account
  static getDataForMigration(): StoredContent[] {
    return this.getAllContent();
  }
}