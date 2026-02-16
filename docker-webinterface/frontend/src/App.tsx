import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile, Document } from "@/lib/api";
import { ProfilesSection } from "@/components/ProfilesSection";
import { DocumentsSection } from "@/components/DocumentsSection";
import { RunHistoryTable } from "@/components/RunHistoryTable";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { Moon, Sun } from "lucide-react";

function AppContent() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const loadProfiles = async () => {
    setProfiles(await api.getProfiles());
  };

  const loadDocuments = async () => {
    setDocuments(await api.getDocuments());
  };

  const loadAll = async () => {
    await Promise.all([loadProfiles(), loadDocuments()]);
  };

  const handleUpdate = async () => {
    // Note: toast is handled in DocumentsSection
    setIsUpdating(true);
    try {
      await api.triggerUpdate();
    } finally {
      // Set a timeout to reset the updating state after the update should be complete
      // This is a simple approach since we removed streaming
      setTimeout(() => setIsUpdating(false), 3000);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">DFS AIP Updater</h1>
          <Button size="icon" variant="ghost" onClick={toggleTheme}>
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </header>

        <ProfilesSection profiles={profiles} onProfilesChange={loadProfiles} />
        <DocumentsSection documents={documents} onDocumentsChange={loadDocuments} onUpdate={handleUpdate} isUpdating={isUpdating} />
        <RunHistoryTable />
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
