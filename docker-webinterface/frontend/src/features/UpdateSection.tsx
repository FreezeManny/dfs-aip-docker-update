import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader, ChevronDown } from "lucide-react";

interface ProfileStatus {
  name: string;
  stage: string;
  status: "pending" | "running" | "success" | "error";
  lastMessage: string;
  messages: Array<{ stage: string; message: string; status: string }>;
}

const STAGE_LABELS: Record<string, string> = {
  init: "Initializing",
  toc_fetch: "Fetching TOC",
  pdf_gen: "Generating PDF",
  ocr: "Processing OCR",
  complete: "Complete",
};

interface UpdateSectionProps {
  profilesStatus: Record<string, ProfileStatus>;
  expandedProfile: string | null;
  onExpandProfile: (profile: string | null) => void;
}

export function UpdateSection({ profilesStatus, expandedProfile, onExpandProfile }: UpdateSectionProps) {
  const profiles = Object.values(profilesStatus);

  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        {profiles.map((profile) => {
          const isExpanded = expandedProfile === profile.name;
          return (
            <div key={profile.name}>
              <button
                onClick={() => onExpandProfile(isExpanded ? null : profile.name)}
                className="w-full flex items-center justify-between p-3 border rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-1">
                  {profile.status === "running" && (
                    <Loader className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                  )}
                  {profile.status === "success" && (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                  {profile.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{profile.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {STAGE_LABELS[profile.stage] || profile.stage}
                    </p>
                  </div>
                </div>
                <ChevronDown 
                  className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expandable logs */}
              {isExpanded && (
                <div className="mt-2 p-3 border rounded-lg bg-background text-xs space-y-1 max-h-48 overflow-y-auto font-mono">
                  {[...profile.messages].reverse().map((msg, i) => (
                    <div
                      key={i}
                      className={`${
                        msg.status === "error"
                          ? "text-red-600"
                          : msg.status === "success"
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-semibold">[{msg.stage}]</span> {msg.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
