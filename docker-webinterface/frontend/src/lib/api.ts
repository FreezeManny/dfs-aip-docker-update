const API_BASE = "/api";

export interface Profile {
  name: string;
  flight_rule: "vfr" | "ifr";
  filters: string[];
  enabled: boolean;
}

export interface Document {
  name: string;
  profile: string;
  airac_date: string;
  path: string;
  size: number;
  modified: string;
  is_ocr: boolean;
}

export const api = {
  // Profiles
  async getProfiles(): Promise<Profile[]> {
    const res = await fetch(`${API_BASE}/profiles`);
    const data = await res.json();
    return data.profiles;
  },

  async createProfile(profile: Omit<Profile, "enabled">): Promise<void> {
    await fetch(`${API_BASE}/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  },

  async updateProfile(name: string, profile: Profile): Promise<void> {
    await fetch(`${API_BASE}/profiles/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  },

  async deleteProfile(name: string): Promise<void> {
    await fetch(`${API_BASE}/profiles/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },

  // Documents
  async getDocuments(): Promise<Document[]> {
    const res = await fetch(`${API_BASE}/documents`);
    const data = await res.json();
    return data.documents;
  },

  async deleteDocument(profile: string, filename: string): Promise<void> {
    await fetch(`${API_BASE}/documents/${encodeURIComponent(profile)}/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
  },

  getDocumentUrl(path: string): string {
    return `${API_BASE}/documents/${path}`;
  },

  // Update
  async triggerUpdate(profile?: string): Promise<void> {
    const url = profile ? `${API_BASE}/update/run?profile=${encodeURIComponent(profile)}` : `${API_BASE}/update/run`;
    await fetch(url, { method: "POST" });
  },
};
