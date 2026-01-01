import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { Profile, Document, UpdateProgress } from "@/lib/api";
import { ProfilesSection } from "@/features/ProfilesSection";
import { DocumentsSection } from "@/features/DocumentsSection";
import { UpdateSection } from "@/features/UpdateSection";
import { RunHistoryTable } from "@/features/RunHistoryTable";
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
  const [showUpdateSection, setShowUpdateSection] = useState(false);
  const [profilesStatus, setProfilesStatus] = useState<Record<string, ProfileStatus>>({});
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [runHistoryRefresh, setRunHistoryRefresh] = useState(0);
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
    setShowUpdateSection(true);
    setProfilesStatus({});
    setExpandedProfile(null);

    let completionTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // Start streaming progress
    unsubscribeRef.current = api.streamUpdateProgress((progress: UpdateProgress) => {
      if (progress.profile === "") {
        // System message
        if (progress.stage === "system" && (progress.message.includes("finished") || progress.message.includes("Update process"))) {
          if (completionTimeout) clearTimeout(completionTimeout);
          setIsUpdating(false);
          
          // Refresh run history and documents, then keep UpdateSection visible for 5 seconds
          setTimeout(() => {
            loadDocuments();
            setRunHistoryRefresh(prev => prev + 1);
            
            // Keep UpdateSection visible for 5 more seconds after documents load
            setTimeout(() => {
              setShowUpdateSection(false);
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
            }, 5000);
          }, 500);
        }
      } else {
        // Profile progress
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
              status: progress.status === "error" ? "error" : progress.status === "success" ? "success" : "running",
              lastMessage: progress.message,
              messages: [...existing.messages, { stage: progress.stage, message: progress.message, status: progress.status }],
            },
          };
        });
      }
    });

    // Set a 5 minute timeout fallback in case the stream gets stuck
    completionTimeout = setTimeout(() => {
      console.warn("Update timeout - closing stream");
      setIsUpdating(false);
      loadDocuments();
      setRunHistoryRefresh(prev => prev + 1);
      
      setTimeout(() => {
        setShowUpdateSection(false);
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      }, 5000);
    }, 5 * 60 * 1000);

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
        {showUpdateSection && <UpdateSection profilesStatus={profilesStatus} expandedProfile={expandedProfile} onExpandProfile={setExpandedProfile} />}
        <RunHistoryTable refreshTrigger={runHistoryRefresh} />
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
