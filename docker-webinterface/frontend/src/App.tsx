import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile, Document } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Trash2, Plus, RefreshCw, FileText, Plane } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New profile form
  const [newName, setNewName] = useState("");
  const [newFlightRule, setNewFlightRule] = useState<"vfr" | "ifr">("vfr");
  const [newFilters, setNewFilters] = useState("");

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

  const handleCreateProfile = async () => {
    if (!newName.trim()) return;
    await api.createProfile({
      name: newName.trim(),
      flight_rule: newFlightRule,
      filters: newFilters
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
    });
    setNewName("");
    setNewFilters("");
    setDialogOpen(false);
    loadProfiles();
  };

  const handleToggleProfile = async (profile: Profile) => {
    await api.updateProfile(profile.name, { ...profile, enabled: !profile.enabled });
    loadProfiles();
  };

  const handleDeleteProfile = async (name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    await api.deleteProfile(name);
    loadProfiles();
  };

  const handleDeleteDocument = async (profile: string, filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    await api.deleteDocument(profile, filename);
    loadDocuments();
  };

  const handleUpdate = async () => {
    await api.triggerUpdate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">DFS AIP Updater</h1>
        </header>

        {/* Profiles */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Profiles</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadProfiles}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> New Profile
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. VFR Germany"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Flight Rule</Label>
                    <Select value={newFlightRule} onValueChange={(v) => setNewFlightRule(v as "vfr" | "ifr")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vfr">VFR</SelectItem>
                        <SelectItem value="ifr">IFR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Filters (comma-separated)</Label>
                    <Input
                      value={newFilters}
                      onChange={(e) => setNewFilters(e.target.value)}
                      placeholder="e.g. EDDF, EDDM"
                    />
                  </div>
                  <Button onClick={handleCreateProfile} className="w-full">
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No profiles yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Flight Rule</TableHead>
                    <TableHead>Filters</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.flight_rule.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        {p.filters.length > 0 ? p.filters.join(", ") : <span className="text-muted-foreground">All</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.enabled ? "default" : "secondary"}>
                          {p.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleToggleProfile(p)}>
                          {p.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteProfile(p.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Update Button */}
        <Button onClick={handleUpdate} size="lg" className="w-full py-6 text-lg">
          <Plane className="mr-3 h-6 w-6" />
          Download Latest AIP Charts
        </Button>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Documents</CardTitle>
            <Button size="sm" variant="outline" onClick={loadDocuments}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No documents yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>AIRAC</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.filter(d => !d.is_ocr).map((d) => {
                    const ocrDoc = documents.find(doc => doc.profile === d.profile && doc.airac_date === d.airac_date && doc.is_ocr);
                    return (
                      <TableRow key={d.path}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {d.profile}
                          </div>
                        </TableCell>
                        <TableCell>{d.airac_date}</TableCell>
                        <TableCell>{formatBytes(d.size)}</TableCell>
                        <TableCell>{formatDate(d.modified)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" asChild>
                            <a href={api.getDocumentUrl(d.path)} target="_blank" rel="noopener">
                              <Download className="mr-1 h-4 w-4" /> PDF
                            </a>
                          </Button>
                          <Button size="sm" variant={ocrDoc ? "default" : "secondary"} disabled={!ocrDoc} asChild={!!ocrDoc}>
                            {ocrDoc ? (
                              <a href={api.getDocumentUrl(ocrDoc.path)} target="_blank" rel="noopener">
                                <Download className="mr-1 h-4 w-4" /> OCR
                              </a>
                            ) : (
                              <span><Download className="mr-1 h-4 w-4" /> OCR</span>
                            )}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteDocument(d.profile, d.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
