import { api } from "@/lib/api";
import type { Document } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Trash2, FileText } from "lucide-react";

interface DocumentsSectionProps {
  documents: Document[];
  onDocumentsChange: () => void;
  onUpdate: () => void;
  isUpdating: boolean;
}

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

export function DocumentsSection({ documents, onDocumentsChange, onUpdate, isUpdating }: DocumentsSectionProps) {
  const handleDeleteDocument = async (profile: string, filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    await api.deleteDocument(profile, filename);
    onDocumentsChange();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDocumentsChange}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={onUpdate} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700">
            Force Fetch Charts
          </Button>
        </div>
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
              {documents
                .filter((d) => !d.is_ocr)
                .map((d) => {
                  const ocrDoc = documents.find(
                    (doc) => doc.profile === d.profile && doc.airac_date === d.airac_date && doc.is_ocr
                  );
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
                        <Button
                          size="sm"
                          variant={ocrDoc ? "default" : "secondary"}
                          disabled={!ocrDoc}
                          asChild={!!ocrDoc}
                        >
                          {ocrDoc ? (
                            <a href={api.getDocumentUrl(ocrDoc.path)} target="_blank" rel="noopener">
                              <Download className="mr-1 h-4 w-4" /> OCR
                            </a>
                          ) : (
                            <span>
                              <Download className="mr-1 h-4 w-4" /> OCR
                            </span>
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
  );
}
