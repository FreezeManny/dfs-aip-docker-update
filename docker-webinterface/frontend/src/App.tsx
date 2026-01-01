import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile, Document } from "@/lib/api";
import { ProfilesSection } from "@/features/ProfilesSection";
import { UpdateSection } from "@/features/UpdateSection";
import { DocumentsSection } from "@/features/DocumentsSection";

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const loadProfiles = async () => {
    setProfiles(await api.getProfiles());
  };

  const loadDocuments = async () => {
    setDocuments(await api.getDocuments());
  };

  const loadAll = async () => {
    await Promise.all([loadProfiles(), loadDocuments()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">DFS AIP Updater</h1>
        </header>

        <ProfilesSection profiles={profiles} onProfilesChange={loadProfiles} />
        <UpdateSection onUpdate={loadDocuments} />
        <DocumentsSection documents={documents} onDocumentsChange={loadDocuments} />
      </div>
    </div>
  );
}
