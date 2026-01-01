import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { Profile, Document, UpdateProgress } from "@/lib/api";
import { ProfilesSection } from "@/components/ProfilesSection";
import { DocumentsSection } from "@/components/DocumentsSection";
import { UpdateSection } from "@/components/LiveUpdateSection";
import { RunHistoryTable } from "@/components/RunHistoryTable";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

interface ProfileStatus {
  name: string;
  stage: string;
  status: "pending" | "running" | "success" | "error";
  lastMessage: string;
  messages: Array<{ stage: string; message: string; status: string }>;
}

function AppContent() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [profilesStatus, setProfilesStatus] = useState<Record<string, ProfileStatus>>({});
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
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
    setIsUpdating(true);
    setProfilesStatus({});
    setExpandedProfile(null);

    // Start streaming progress
    unsubscribeRef.current = api.streamUpdateProgress((progress: UpdateProgress) => {
      if (progress.profile !== "") {
        // Only handle profile messages
        setProfilesStatus((prev) => {
          const profileName = progress.profile;
          const existing = prev[profileName] || { 
            name: profileName, 
            stage: "", 
            status: "pending", 
            lastMessage: "",
            messages: [] 
          };
          
          return {
            ...prev,
            [profileName]: {
              ...existing,
              stage: progress.stage,
              status: (progress.status === "error" ? "error" : progress.status === "success" ? "success" : "running") as "pending" | "running" | "success" | "error",
              lastMessage: progress.message,
              messages: [...existing.messages, { stage: progress.stage, message: progress.message, status: progress.status }],
            },
          };
        });
      } else if (progress.stage === "system" && progress.message === "Update process finished") {
        // Update is complete, reset the updating state
        setIsUpdating(false);
      }
    });

    // Trigger update
    await api.triggerUpdate();
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
        {Object.keys(profilesStatus).length > 0 && <UpdateSection profilesStatus={profilesStatus} expandedProfile={expandedProfile} onExpandProfile={setExpandedProfile} />}
        <RunHistoryTable />
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
